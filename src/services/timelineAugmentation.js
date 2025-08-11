/**
 * Timeline Data Augmentation Service
 * Handles augmenting timeline data with GPS coordinates extracted from images
 * Includes comprehensive monitoring, debugging, and duplicate consolidation
 */

import fs from 'fs';
import path from 'path';
import { calculateDistance } from '../utils/distance.js';
import { isValidCoordinatePair, decimalToE7 } from '../utils/coordinates.js';
import { createTimelineLogger, LOG_LEVELS } from '../utils/debugLogger.js';
import { TimelineDuplicateMonitor, TimelinePerformanceMonitor } from '../utils/timelineMonitors.js';
import { TimelineValidator } from '../utils/timelineValidator.js';

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
    backupSuffix: '_backup_before_augmentation',
    
    // Performance settings
    enableMonitoring: true,
    enableValidation: true,
    logLevel: LOG_LEVELS.DEBUG
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
        this.timelineExtensionsCreated = 0;
        this.duplicatesConsolidated = 0;
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
                timelineExtensionsCreated: this.timelineExtensionsCreated,
                duplicatesConsolidated: this.duplicatesConsolidated,
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
        this.logger = createTimelineLogger({ 
            level: this.config.logLevel,
            prefix: 'TIMELINE-AUG',
            suppressDuplicates: true,
            duplicateThreshold: 3
        });
        
        this.stats = new AugmentationStats();
        this.existingTimelineRecords = [];
        
        // Initialize monitoring components
        this.duplicateMonitor = new TimelineDuplicateMonitor({
            trackSources: true,
            enableDetailedTracking: true
        });
        
        this.performanceMonitor = new TimelinePerformanceMonitor({
            memorySnapshotInterval: 2000,
            trackGarbageCollection: true
        });
        
        this.validator = new TimelineValidator({
            maxDuplicatesPerTimestamp: 1, // We want to eliminate all duplicates
            enableDeepValidation: this.config.enableValidation,
            enablePerformanceChecks: true
        });
        
        this.logger.info('Timeline Augmentation Service initialized');
    }

    /**
     * Augment timeline with GPS data from images
     * @param {string} timelineFilePath - Path to timeline JSON file
     * @param {Map} imageIndex - Map of image file paths to metadata
     * @returns {Object} Augmentation results
     */
    async augmentTimeline(timelineFilePath, imageIndex) {
        this.logger.info(`Starting timeline augmentation for ${imageIndex.size} images`);
        this.performanceMonitor.startMonitoring('timeline_augmentation');
        
        try {
            // Load existing timeline data
            await this.loadExistingTimeline(timelineFilePath);
            
            // Extract GPS data from images
            this.performanceMonitor.startTiming('gps_extraction');
            const imageGpsRecords = await this.extractGpsFromImages(imageIndex);
            this.performanceMonitor.endTiming('gps_extraction');
            
            // Extract all image timestamps for timeline extension
            this.performanceMonitor.startTiming('timestamp_extraction');
            const imageTimestamps = await this.extractAllImageTimestamps(imageIndex);
            this.performanceMonitor.endTiming('timestamp_extraction');
            
            // Create timeline extensions for out-of-range timestamps
            this.performanceMonitor.startTiming('timeline_extension');
            const extensionRecords = await this.createTimelineExtensions(imageTimestamps);
            this.performanceMonitor.endTiming('timeline_extension');
            
            // Filter out duplicates from GPS records
            this.performanceMonitor.startTiming('duplicate_filtering');
            const newGpsRecords = await this.filterDuplicates(imageGpsRecords);
            this.performanceMonitor.endTiming('duplicate_filtering');
            
            // Combine GPS records and extension records
            const allNewRecords = [...newGpsRecords, ...extensionRecords];
            
            if (allNewRecords.length === 0) {
                this.logger.info('No new records to add to timeline');
                return this.generateAugmentationReport();
            }
            
            // Validate records before adding to timeline
            if (this.config.enableValidation) {
                this.performanceMonitor.startTiming('validation');
                const validationResults = this.validator.validateTimelineIntegrity(allNewRecords);
                this.performanceMonitor.endTiming('validation');
                
                if (validationResults.issues.length > 0) {
                    this.logger.warn(`Validation found ${validationResults.issues.length} issues`);
                    for (const issue of validationResults.issues.slice(0, 5)) { // Log first 5 issues
                        this.logger.debug(`Validation issue: ${issue.message}`, issue);
                    }
                }
            }
            
            // Create backup if enabled
            if (this.config.createBackup) {
                this.performanceMonitor.startTiming('backup_creation');
                await this.createTimelineBackup(timelineFilePath);
                this.performanceMonitor.endTiming('backup_creation');
            }
            
            // Merge new records with timeline
            this.performanceMonitor.startTiming('timeline_merge');
            await this.mergeWithTimeline(timelineFilePath, allNewRecords);
            this.performanceMonitor.endTiming('timeline_merge');
            
            this.logger.info(`Timeline augmentation completed successfully`);
            return this.generateAugmentationReport();
            
        } catch (error) {
            this.logger.error(`Timeline augmentation failed: ${error.message}`, { error: error.stack });
            this.stats.addError(`Augmentation failed: ${error.message}`);
            throw error;
        } finally {
            this.performanceMonitor.stopMonitoring();
        }
    }

    /**
     * Load existing timeline data
     * @param {string} timelineFilePath - Path to timeline file
     */
    async loadExistingTimeline(timelineFilePath) {
        this.logger.debug(`Loading existing timeline from: ${timelineFilePath}`);
        
        try {
            if (!fs.existsSync(timelineFilePath)) {
                this.logger.warn('Timeline file does not exist, starting with empty timeline');
                this.existingTimelineRecords = [];
                return;
            }
            
            const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
            const timelineData = JSON.parse(fileContent);
            
            this.existingTimelineRecords = this.extractPositionRecordsFromTimeline(timelineData);
            this.logger.info(`Loaded ${this.existingTimelineRecords.length} existing timeline records for duplicate detection`);
            
        } catch (error) {
            this.logger.error(`Failed to load existing timeline: ${error.message}`);
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
            
            // Extract placeholder entries (timeline extensions)
            if (edit.placeholderEntry) {
                records.push({
                    timestamp: new Date(edit.placeholderEntry.timestamp),
                    latitude: null,
                    longitude: null,
                    source: 'timeline_extension_placeholder',
                    isPlaceholder: true
                });
            }
        }
        
        return records;
    }

    /**
     * Extract all image timestamps for timeline extension
     * @param {Map} imageIndex - Map of image file paths to metadata
     * @returns {Array} Array of timestamp records from all images
     */
    async extractAllImageTimestamps(imageIndex) {
        const timestampRecords = [];
        
        for (const [filePath, metadata] of imageIndex) {
            this.stats.imagesProcessed++;
            
            // Skip images without valid timestamps
            if (!metadata.timestamp || !this.isValidTimestamp(metadata.timestamp)) {
                continue;
            }
            
            timestampRecords.push({
                timestamp: metadata.timestamp,
                filePath,
                fileName: metadata.fileName,
                hasGps: metadata.hasGpsCoordinates || false,
                source: 'image_timestamp'
            });
            
            // Track timestamp for duplicate monitoring
            this.duplicateMonitor.trackTimestamp(
                metadata.timestamp, 
                'image_timestamp', 
                filePath, 
                { fileName: metadata.fileName, hasGps: metadata.hasGpsCoordinates }
            );
        }
        
        this.logger.info(`Found ${timestampRecords.length} images with valid timestamps`);
        return timestampRecords;
    }
    
    /**
     * Create timeline extension records for timestamps outside current range
     * Consolidates identical timestamps into single placeholder entries
     * @param {Array} imageTimestamps - Array of image timestamp records
     * @returns {Array} Array of consolidated timeline extension records
     */
    async createTimelineExtensions(imageTimestamps) {
        if (imageTimestamps.length === 0) {
            return [];
        }
        
        // Determine current timeline range
        const currentRange = this.getCurrentTimelineRange();
        
        // Find timestamps outside current range
        const extensionTimestamps = imageTimestamps.filter(record => {
            const timestamp = new Date(record.timestamp);
            return !currentRange || 
                   timestamp < currentRange.start || 
                   timestamp > currentRange.end;
        });
        
        if (extensionTimestamps.length === 0) {
            this.logger.info('All image timestamps within existing timeline range');
            return [];
        }
        
        this.logger.info(`Creating timeline extensions for ${extensionTimestamps.length} out-of-range timestamps`);
        
        // Consolidate identical timestamps using timestamp consolidation logic
        const consolidatedTimestamps = this.consolidateTimestamps(extensionTimestamps);
        
        this.logger.info(`Consolidated ${extensionTimestamps.length} timestamps into ${consolidatedTimestamps.length} unique entries`);
        this.stats.duplicatesConsolidated = extensionTimestamps.length - consolidatedTimestamps.length;
        
        // Create placeholder timeline records from consolidated timestamps
        const extensionRecords = [];
        
        for (const consolidatedRecord of consolidatedTimestamps) {
            // Create single placeholder entry with consolidated metadata
            const placeholderRecord = {
                timestamp: new Date(consolidatedRecord.timestamp),
                latitude: null,
                longitude: null,
                source: 'timeline_extension_placeholder',
                accuracy: null,
                deviceId: 'image_timestamp_extension',
                isPlaceholder: true,
                // Consolidated metadata
                consolidatedImages: consolidatedRecord.images,
                imageCount: consolidatedRecord.images.length,
                filePaths: consolidatedRecord.images.map(img => img.filePath),
                fileNames: consolidatedRecord.images.map(img => img.fileName),
                // Legacy fields for backward compatibility
                filePath: consolidatedRecord.images[0]?.filePath || null,
                fileName: consolidatedRecord.images[0]?.fileName || null
            };
            
            extensionRecords.push(placeholderRecord);
            this.stats.timelineExtensionsCreated++;
            
            // Record consolidation for monitoring
            this.duplicateMonitor.recordConsolidation(
                consolidatedRecord.timestamp,
                consolidatedRecord.images.length,
                consolidatedRecord.images.map(img => img.source)
            );
        }
        
        return extensionRecords;
    }
    
    /**
     * Consolidate timestamps by grouping multiple images with identical timestamps
     * @param {Array} timestampRecords - Array of timestamp records
     * @returns {Array} Array of consolidated timestamp records
     */
    consolidateTimestamps(timestampRecords) {
        const timestampMap = new Map();
        
        // Group records by timestamp
        for (const record of timestampRecords) {
            const timestampKey = new Date(record.timestamp).toISOString();
            
            if (!timestampMap.has(timestampKey)) {
                timestampMap.set(timestampKey, {
                    timestamp: record.timestamp,
                    images: []
                });
            }
            
            timestampMap.get(timestampKey).images.push(record);
        }
        
        // Convert map to array of consolidated records
        const consolidatedRecords = Array.from(timestampMap.values());
        
        // Log consolidation statistics
        const duplicateGroups = consolidatedRecords.filter(record => record.images.length > 1);
        if (duplicateGroups.length > 0) {
            this.logger.debug(`Found ${duplicateGroups.length} timestamp groups with duplicates:`);
            for (const group of duplicateGroups.slice(0, 5)) { // Log first 5 groups
                this.logger.trace(`Timestamp ${group.timestamp}: ${group.images.length} images`, {
                    files: group.images.map(img => img.fileName)
                });
            }
        }
        
        return consolidatedRecords;
    }
    
    /**
     * Get current timeline range from existing records
     * @returns {Object|null} Timeline range with start and end dates
     */
    getCurrentTimelineRange() {
        if (this.existingTimelineRecords.length === 0) {
            return null;
        }
        
        const timestamps = this.existingTimelineRecords.map(record => new Date(record.timestamp));
        return {
            start: new Date(Math.min(...timestamps)),
            end: new Date(Math.max(...timestamps))
        };
    }
    
    /**
     * Validate timestamp
     * @param {Date|string} timestamp - Timestamp to validate
     * @returns {boolean} True if timestamp is valid
     */
    isValidTimestamp(timestamp) {
        if (!timestamp) return false;
        
        const date = new Date(timestamp);
        return date instanceof Date && !isNaN(date.getTime()) && 
               date.getFullYear() > 1970 && date.getFullYear() < 2100;
    }

    /**
     * Extract GPS data from images
     * @param {Map} imageIndex - Map of image file paths to metadata
     * @returns {Array} Array of GPS records from images
     */
    async extractGpsFromImages(imageIndex) {
        const gpsRecords = [];
        
        for (const [filePath, metadata] of imageIndex) {
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
                        
                        // Track for duplicate monitoring
                        this.duplicateMonitor.trackTimestamp(
                            gpsRecord.timestamp,
                            'image_gps',
                            filePath,
                            { coordinates: `${gpsRecord.latitude},${gpsRecord.longitude}` }
                        );
                    } else {
                        this.stats.addError(`Invalid coordinates in ${path.basename(filePath)}: ${gpsRecord.latitude}, ${gpsRecord.longitude}`);
                    }
                }
            } catch (error) {
                this.stats.addError(`Failed to extract GPS from ${path.basename(filePath)}: ${error.message}`);
            }
        }
        
        this.logger.info(`Found ${gpsRecords.length} images with valid GPS coordinates`);
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
                this.logger.debug(`Skipping exact duplicate: ${imageRecord.fileName} (${isDuplicate.reason})`);
            } else if (isDuplicate.isProximityDuplicate) {
                this.stats.proximityDuplicatesSkipped++;
                this.logger.debug(`Skipping proximity duplicate: ${imageRecord.fileName} (${isDuplicate.reason})`);
            } else {
                newRecords.push(imageRecord);
            }
        }
        
        this.logger.info(`${newRecords.length} new GPS records to add to timeline`);
        return newRecords;
    }

    /**
     * Check if a GPS record is a duplicate of existing timeline data
     * @param {Object} imageRecord - GPS record from image
     * @returns {Object} Duplicate check result
     */
    checkForDuplicate(imageRecord) {
        // Handle placeholder entries - they can't be duplicates since they have no GPS coordinates
        if (imageRecord.isPlaceholder || (imageRecord.latitude === null && imageRecord.longitude === null)) {
            // Check for timestamp duplicates only
            for (const existingRecord of this.existingTimelineRecords) {
                const timeDiff = Math.abs(imageRecord.timestamp.getTime() - existingRecord.timestamp.getTime());
                
                // If there's already a placeholder or real record at the same time, skip
                if (timeDiff <= this.config.exactTimeTolerance) {
                    return {
                        isExactDuplicate: true,
                        isProximityDuplicate: false,
                        reason: `Same timestamp (${Math.round(timeDiff / 1000)}s) - placeholder entry`
                    };
                }
            }
            
            return {
                isExactDuplicate: false,
                isProximityDuplicate: false,
                reason: null
            };
        }
        
        // Handle normal GPS records
        for (const existingRecord of this.existingTimelineRecords) {
            // Skip comparison with placeholder records that have no coordinates
            if (existingRecord.isPlaceholder || (existingRecord.latitude === null && existingRecord.longitude === null)) {
                continue;
            }
            
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
     * Convert GPS record to timeline format
     * @param {Object} gpsRecord - GPS record to convert
     * @returns {Object} Timeline format record
     */
    convertToTimelineFormat(gpsRecord) {
        // Handle placeholder entries
        if (gpsRecord.isPlaceholder) {
            return {
                deviceId: gpsRecord.deviceId || 'image_timestamp_extension',
                placeholderEntry: {
                    timestamp: gpsRecord.timestamp.toISOString(),
                    source: gpsRecord.source,
                    consolidatedImages: gpsRecord.consolidatedImages || [],
                    imageCount: gpsRecord.imageCount || 1,
                    filePaths: gpsRecord.filePaths || [gpsRecord.filePath],
                    fileNames: gpsRecord.fileNames || [gpsRecord.fileName]
                }
            };
        }
        
        // Handle regular GPS records
        return {
            deviceId: "image_gps_extraction",
            rawSignal: {
                signal: {
                    position: {
                        point: {
                            latE7: decimalToE7(gpsRecord.latitude),
                            lngE7: decimalToE7(gpsRecord.longitude)
                        },
                        timestamp: gpsRecord.timestamp.toISOString(),
                        accuracyMm: gpsRecord.accuracy ? Math.round(gpsRecord.accuracy * 1000) : null,
                        source: "GPS",
                        imageSource: {
                            filePath: gpsRecord.filePath,
                            fileName: gpsRecord.fileName,
                            extractedAt: new Date().toISOString()
                        }
                    }
                }
            }
        };
    }

    /**
     * Create backup of timeline file
     * @param {string} timelineFilePath - Path to timeline file
     */
    async createTimelineBackup(timelineFilePath) {
        try {
            if (!fs.existsSync(timelineFilePath)) {
                this.logger.warn('Timeline file does not exist, skipping backup');
                return;
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = timelineFilePath.replace('.json', `${this.config.backupSuffix}_${timestamp}.json`);
            
            await fs.promises.copyFile(timelineFilePath, backupPath);
            this.logger.info(`Created timeline backup: ${path.basename(backupPath)}`);
            
        } catch (error) {
            this.logger.error(`Failed to create timeline backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Merge new records with existing timeline
     * @param {string} timelineFilePath - Path to timeline file
     * @param {Array} newRecords - New records to add
     */
    async mergeWithTimeline(timelineFilePath, newRecords) {
        try {
            let timelineData = { timelineEdits: [] };
            
            // Load existing timeline if it exists
            if (fs.existsSync(timelineFilePath)) {
                const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
                timelineData = JSON.parse(fileContent);
            }
            
            // Convert new records to timeline format and add them
            for (const record of newRecords) {
                const timelineRecord = this.convertToTimelineFormat(record);
                timelineData.timelineEdits.push(timelineRecord);
                this.stats.newRecordsAdded++;
            }
            
            // Sort timeline by timestamp for better organization
            timelineData.timelineEdits.sort((a, b) => {
                const timestampA = this.getTimestampFromEdit(a);
                const timestampB = this.getTimestampFromEdit(b);
                return new Date(timestampA) - new Date(timestampB);
            });
            
            // Write updated timeline back to file
            await fs.promises.writeFile(timelineFilePath, JSON.stringify(timelineData, null, 2));
            this.logger.info(`Updated timeline file with ${newRecords.length} new records`);
            
        } catch (error) {
            this.logger.error(`Failed to merge with timeline: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract timestamp from timeline edit record
     * @param {Object} edit - Timeline edit record
     * @returns {string} Timestamp string
     */
    getTimestampFromEdit(edit) {
        if (edit.rawSignal && edit.rawSignal.signal && edit.rawSignal.signal.position) {
            return edit.rawSignal.signal.position.timestamp;
        }
        
        if (edit.placeholderEntry && edit.placeholderEntry.timestamp) {
            return edit.placeholderEntry.timestamp;
        }
        
        if (edit.placeAggregates && edit.placeAggregates.processWindow && edit.placeAggregates.processWindow.startTime) {
            return edit.placeAggregates.processWindow.startTime;
        }
        
        return new Date().toISOString(); // Fallback
    }

    /**
     * Generate comprehensive augmentation report
     * @returns {Object} Augmentation report
     */
    generateAugmentationReport() {
        const statsReport = this.stats.generateReport();
        const duplicateReport = this.duplicateMonitor.generateDuplicateReport(10);
        const performanceReport = this.performanceMonitor.generateReport();
        
        return {
            success: true,
            statistics: statsReport,
            duplicateAnalysis: duplicateReport,
            performance: performanceReport,
            summary: {
                imagesProcessed: this.stats.imagesProcessed,
                imagesWithGps: this.stats.imagesWithGps,
                newRecordsAdded: this.stats.newRecordsAdded,
                timelineExtensionsCreated: this.stats.timelineExtensionsCreated,
                duplicatesConsolidated: this.stats.duplicatesConsolidated,
                duplicatesSkipped: this.stats.exactDuplicatesSkipped + this.stats.proximityDuplicatesSkipped,
                errorCount: this.stats.errors.length
            }
        };
    }
}


/**
 * Create a timeline augmentation service instance
 * @param {Object} config - Configuration options
 * @returns {TimelineAugmentationService} Configured service instance
 */
export function createTimelineAugmentationService(config = {}) {
    return new TimelineAugmentationService(config);
}
