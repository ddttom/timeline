/**
 * Timeline Data Augmentation Service
 * Handles augmenting timeline data with GPS coordinates extracted from images
 */

import fs from 'fs';
import path from 'path';
import { calculateDistance } from '../utils/distance.js';
import { isValidCoordinatePair, decimalToE7 } from '../utils/coordinates.js';

/**
 * Configuration for timeline augmentation
 */
const AUGMENTATION_CONFIG = {
    // Duplicate detection tolerances
    exactTimeTolerance: 2 * 60 * 1000, // 2 minutes in milliseconds
    proximityDistanceTolerance: 50, // 50 meters
    proximityTimeTolerance: 10 * 60 * 1000, // 10 minutes in milliseconds
    
    // Backup settings
    createBackup: true,
    backupSuffix: '_backup_before_augmentation'
};

/**
 * Timeline augmentation statistics
 */
class AugmentationStats {
    constructor() {
        this.imagesProcessed = 0;
        this.imagesWithGps = 0;
        this.exactDuplicatesSkipped = 0;
        this.proximityDuplicatesSkipped = 0;
        this.newRecordsAdded = 0;
        this.errors = [];
    }

    addError(error) {
        this.errors.push(error);
    }

    generateReport() {
        return {
            summary: {
                imagesProcessed: this.imagesProcessed,
                imagesWithGps: this.imagesWithGps,
                exactDuplicatesSkipped: this.exactDuplicatesSkipped,
                proximityDuplicatesSkipped: this.proximityDuplicatesSkipped,
                newRecordsAdded: this.newRecordsAdded,
                totalSkipped: this.exactDuplicatesSkipped + this.proximityDuplicatesSkipped,
                errorCount: this.errors.length
            },
            errors: this.errors
        };
    }
}

/**
 * Timeline Augmentation Service
 */
export class TimelineAugmentationService {
    constructor(config = {}) {
        this.config = { ...AUGMENTATION_CONFIG, ...config };
        this.stats = new AugmentationStats();
        this.existingTimelineRecords = [];
    }

    /**
     * Augment timeline data with GPS coordinates from images
     * @param {string} timelineFilePath - Path to the timeline JSON file
     * @param {Map} imageIndex - Map of image file paths to metadata
     * @returns {Object} Augmentation results
     */
    async augmentTimelineFromImages(timelineFilePath, imageIndex) {
        try {
            console.log('\n🔄 Starting timeline augmentation from image GPS data...');
            
            // Load existing timeline data
            await this.loadExistingTimeline(timelineFilePath);
            
            // Extract GPS data from images
            const imageGpsRecords = await this.extractGpsFromImages(imageIndex);
            
            if (imageGpsRecords.length === 0) {
                console.log('   ℹ️  No images with GPS data found for timeline augmentation');
                return this.stats.generateReport();
            }

            // Filter out duplicates
            const newRecords = await this.filterDuplicates(imageGpsRecords);
            
            if (newRecords.length === 0) {
                console.log('   ℹ️  All image GPS data already exists in timeline');
                return this.stats.generateReport();
            }

            // Create backup if enabled
            if (this.config.createBackup) {
                await this.createTimelineBackup(timelineFilePath);
            }

            // Merge new records with existing timeline
            await this.mergeWithTimeline(timelineFilePath, newRecords);
            
            console.log(`✅ Timeline augmentation complete:`);
            console.log(`   📸 Images processed: ${this.stats.imagesProcessed}`);
            console.log(`   🗺️  Images with GPS: ${this.stats.imagesWithGps}`);
            console.log(`   ➕ New records added: ${this.stats.newRecordsAdded}`);
            console.log(`   ⏭️  Duplicates skipped: ${this.stats.exactDuplicatesSkipped + this.stats.proximityDuplicatesSkipped}`);
            
            return this.stats.generateReport();
            
        } catch (error) {
            this.stats.addError(`Timeline augmentation failed: ${error.message}`);
            throw new Error(`Failed to augment timeline: ${error.message}`);
        }
    }

    /**
     * Load existing timeline data for duplicate detection
     * @param {string} timelineFilePath - Path to timeline file
     */
    async loadExistingTimeline(timelineFilePath) {
        try {
            if (!fs.existsSync(timelineFilePath)) {
                console.log('   ℹ️  Timeline file does not exist, will create new one');
                this.existingTimelineRecords = [];
                return;
            }

            const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
            const timelineData = JSON.parse(fileContent);
            
            // Extract position records from existing timeline
            this.existingTimelineRecords = this.extractPositionRecordsFromTimeline(timelineData);
            
            console.log(`   📍 Loaded ${this.existingTimelineRecords.length} existing timeline records for duplicate detection`);
            
        } catch (error) {
            throw new Error(`Failed to load existing timeline: ${error.message}`);
        }
    }

    /**
     * Extract position records from timeline data structure
     * @param {Object} timelineData - Timeline data object
     * @returns {Array} Array of position records
     */
    extractPositionRecordsFromTimeline(timelineData) {
        const records = [];
        
        if (!timelineData.timelineEdits || !Array.isArray(timelineData.timelineEdits)) {
            return records;
        }

        for (const edit of timelineData.timelineEdits) {
            // Extract from rawSignal position data
            if (edit.rawSignal && edit.rawSignal.signal && edit.rawSignal.signal.position) {
                const positionData = edit.rawSignal.signal.position;
                if (positionData.point && positionData.timestamp) {
                    records.push({
                        timestamp: new Date(positionData.timestamp),
                        latitude: positionData.point.latE7 / 10000000,
                        longitude: positionData.point.lngE7 / 10000000,
                        source: 'timeline_existing'
                    });
                }
            }
            
            // Extract from placeAggregates
            if (edit.placeAggregates && edit.placeAggregates.placeAggregateInfo) {
                const processWindow = edit.placeAggregates.processWindow;
                let baseTimestamp = new Date();
                
                if (processWindow && processWindow.startTime) {
                    baseTimestamp = new Date(processWindow.startTime);
                }
                
                for (const placeInfo of edit.placeAggregates.placeAggregateInfo) {
                    if (placeInfo.point) {
                        records.push({
                            timestamp: baseTimestamp,
                            latitude: placeInfo.point.latE7 / 10000000,
                            longitude: placeInfo.point.lngE7 / 10000000,
                            source: 'timeline_existing_place'
                        });
                    }
                }
            }
        }
        
        return records;
    }

    /**
     * Extract GPS data from images
     * @param {Map} imageIndex - Map of image file paths to metadata
     * @returns {Array} Array of GPS records from images
     */
    async extractGpsFromImages(imageIndex) {
        const gpsRecords = [];
        
        for (const [filePath, metadata] of imageIndex) {
            this.stats.imagesProcessed++;
            
            try {
                // Check if image has GPS coordinates
                if (metadata.hasGpsCoordinates && metadata.gps && metadata.timestamp) {
                    this.stats.imagesWithGps++;
                    
                    const gpsRecord = {
                        filePath: filePath,
                        fileName: path.basename(filePath),
                        timestamp: new Date(metadata.timestamp),
                        latitude: metadata.gps.latitude,
                        longitude: metadata.gps.longitude,
                        altitude: metadata.gps.altitude || null,
                        accuracy: metadata.gps.accuracy || null,
                        source: 'image_exif'
                    };
                    
                    // Validate coordinates
                    if (isValidCoordinatePair(gpsRecord.latitude, gpsRecord.longitude)) {
                        gpsRecords.push(gpsRecord);
                    } else {
                        this.stats.addError(`Invalid coordinates in ${path.basename(filePath)}: ${gpsRecord.latitude}, ${gpsRecord.longitude}`);
                    }
                }
            } catch (error) {
                this.stats.addError(`Failed to extract GPS from ${path.basename(filePath)}: ${error.message}`);
            }
        }
        
        console.log(`   🗺️  Found ${gpsRecords.length} images with valid GPS coordinates`);
        return gpsRecords;
    }

    /**
     * Filter out duplicate GPS records
     * @param {Array} imageGpsRecords - GPS records from images
     * @returns {Array} Filtered GPS records
     */
    async filterDuplicates(imageGpsRecords) {
        const newRecords = [];
        
        for (const imageRecord of imageGpsRecords) {
            const isDuplicate = this.checkForDuplicate(imageRecord);
            
            if (isDuplicate.isExactDuplicate) {
                this.stats.exactDuplicatesSkipped++;
                console.log(`   ⏭️  Skipping exact duplicate: ${imageRecord.fileName} (${isDuplicate.reason})`);
            } else if (isDuplicate.isProximityDuplicate) {
                this.stats.proximityDuplicatesSkipped++;
                console.log(`   ⏭️  Skipping proximity duplicate: ${imageRecord.fileName} (${isDuplicate.reason})`);
            } else {
                newRecords.push(imageRecord);
            }
        }
        
        console.log(`   ➕ ${newRecords.length} new GPS records to add to timeline`);
        return newRecords;
    }

    /**
     * Check if a GPS record is a duplicate of existing timeline data
     * @param {Object} imageRecord - GPS record from image
     * @returns {Object} Duplicate check result
     */
    checkForDuplicate(imageRecord) {
        for (const existingRecord of this.existingTimelineRecords) {
            // Check for exact time and location match
            const timeDiff = Math.abs(imageRecord.timestamp.getTime() - existingRecord.timestamp.getTime());
            const distance = calculateDistance(
                imageRecord.latitude, imageRecord.longitude,
                existingRecord.latitude, existingRecord.longitude
            );
            
            // Exact duplicate check
            if (timeDiff <= this.config.exactTimeTolerance && distance <= 10) {
                return {
                    isExactDuplicate: true,
                    isProximityDuplicate: false,
                    reason: `Same time (${Math.round(timeDiff / 1000)}s) and location (${Math.round(distance)}m)`
                };
            }
            
            // Proximity duplicate check
            if (timeDiff <= this.config.proximityTimeTolerance && distance <= this.config.proximityDistanceTolerance) {
                return {
                    isExactDuplicate: false,
                    isProximityDuplicate: true,
                    reason: `Close time (${Math.round(timeDiff / 60000)}min) and location (${Math.round(distance)}m)`
                };
            }
        }
        
        return {
            isExactDuplicate: false,
            isProximityDuplicate: false,
            reason: null
        };
    }

    /**
     * Convert image GPS record to Google Maps timeline format
     * @param {Object} gpsRecord - GPS record from image
     * @returns {Object} Timeline edit entry
     */
    convertToTimelineFormat(gpsRecord) {
        return {
            deviceId: "image_derived",
            rawSignal: {
                signal: {
                    position: {
                        point: {
                            latE7: decimalToE7(gpsRecord.latitude),
                            lngE7: decimalToE7(gpsRecord.longitude)
                        },
                        timestamp: gpsRecord.timestamp.toISOString(),
                        accuracyMm: gpsRecord.accuracy ? Math.round(gpsRecord.accuracy * 1000) : null,
                        altitudeMeters: gpsRecord.altitude,
                        source: "IMAGE_EXIF"
                    }
                }
            },
            // Add metadata about the source image
            imageMetadata: {
                filePath: gpsRecord.filePath,
                fileName: gpsRecord.fileName,
                extractedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Create backup of timeline file
     * @param {string} timelineFilePath - Path to timeline file
     */
    async createTimelineBackup(timelineFilePath) {
        try {
            const dir = path.dirname(timelineFilePath);
            const name = path.basename(timelineFilePath, path.extname(timelineFilePath));
            const ext = path.extname(timelineFilePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            const backupPath = path.join(dir, `${name}${this.config.backupSuffix}_${timestamp}${ext}`);
            
            await fs.promises.copyFile(timelineFilePath, backupPath);
            console.log(`   💾 Created timeline backup: ${path.basename(backupPath)}`);
            
        } catch (error) {
            throw new Error(`Failed to create timeline backup: ${error.message}`);
        }
    }

    /**
     * Merge new GPS records with existing timeline
     * @param {string} timelineFilePath - Path to timeline file
     * @param {Array} newRecords - New GPS records to add
     */
    async mergeWithTimeline(timelineFilePath, newRecords) {
        try {
            let timelineData;
            
            // Load existing timeline or create new structure
            if (fs.existsSync(timelineFilePath)) {
                const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
                timelineData = JSON.parse(fileContent);
            } else {
                timelineData = { timelineEdits: [] };
            }
            
            // Convert new records to timeline format and add them
            for (const record of newRecords) {
                const timelineEntry = this.convertToTimelineFormat(record);
                timelineData.timelineEdits.push(timelineEntry);
                this.stats.newRecordsAdded++;
            }
            
            // Sort timeline entries by timestamp
            timelineData.timelineEdits.sort((a, b) => {
                const timeA = this.getTimestampFromEdit(a);
                const timeB = this.getTimestampFromEdit(b);
                return new Date(timeA) - new Date(timeB);
            });
            
            // Write updated timeline back to file
            await fs.promises.writeFile(
                timelineFilePath, 
                JSON.stringify(timelineData, null, 2), 
                'utf8'
            );
            
            console.log(`   💾 Updated timeline file with ${this.stats.newRecordsAdded} new records`);
            
        } catch (error) {
            throw new Error(`Failed to merge with timeline: ${error.message}`);
        }
    }

    /**
     * Extract timestamp from timeline edit entry for sorting
     * @param {Object} edit - Timeline edit entry
     * @returns {string} Timestamp string
     */
    getTimestampFromEdit(edit) {
        if (edit.rawSignal && edit.rawSignal.signal && edit.rawSignal.signal.position) {
            return edit.rawSignal.signal.position.timestamp;
        }
        
        if (edit.placeAggregates && edit.placeAggregates.processWindow) {
            return edit.placeAggregates.processWindow.startTime;
        }
        
        // Fallback to current time if no timestamp found
        return new Date().toISOString();
    }
}

/**
 * Create and configure timeline augmentation service
 * @param {Object} config - Configuration options
 * @returns {TimelineAugmentationService} Configured service instance
 */
export function createTimelineAugmentationService(config = {}) {
    return new TimelineAugmentationService(config);
}
