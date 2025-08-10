#!/usr/bin/env node

/**
 * Image Geolocation Processor - Main Application
 * Coordinates the two-phase processing system for image geolocation
 */

import path from 'path';
import { promptForDirectory, validateDirectoryPath, displayProgress, showSpinner } from './utils/input.js';
import { discoverImageFiles, createImageIndex, filterImagesNeedingGeolocation, getImagesWithGps } from './services/fileDiscovery.js';
import { parseTimelineData, validateTimelineFile, getTimelineStatistics } from './services/timelineParser.js';
import { primaryInterpolation, secondaryInterpolation, validateInterpolationResult } from './services/interpolation.js';
import { writeGpsCoordinates, extractGpsCoordinates, getImageTimestamp } from './services/exif.js';
import { StatisticsCollector, displayStatisticsReport, exportStatisticsReport } from './services/statistics.js';
import { isValidCoordinatePair } from './utils/coordinates.js';
import { createGeolocationDatabase, GPS_SOURCES } from './services/geolocationDatabase.js';
import { createTimelineAugmentationService } from './services/timelineAugmentation.js';

/**
 * Main application class
 */
class ImageGeolocationProcessor {
    constructor() {
        this.stats = new StatisticsCollector();
        this.timelineFilePath = path.resolve('data/Timeline Edits.json');
        this.geolocationDb = null;
        this.config = {
            timelineTolerance: 30, // minutes
            secondaryRadius: 2000, // meters
            secondaryTimeWindow: 4, // hours
            batchSize: 25, // images to process in parallel (optimized for better performance)
            createBackups: false, // set to true to create backups before modifying images
            timelineAugmentation: {
                enabled: true, // enable timeline augmentation from image GPS data
                exactTimeTolerance: 2, // minutes for exact duplicate detection
                proximityDistanceTolerance: 50, // meters for proximity duplicate detection
                proximityTimeTolerance: 10, // minutes for proximity duplicate detection
                createBackup: true // create backup of timeline file before modification
            },
            geolocationDatabase: {
                enableSqlitePersistence: false,
                sqliteDbPath: 'data/geolocation.db',
                exportPath: 'data/geolocation-export.json',
                validateCoordinates: true,
                coordinateSystem: 'WGS84'
            }
        };
    }
    
    /**
     * Run the complete image geolocation processing
     */
    async run() {
        try {
            console.log('🚀 Starting Image Geolocation Processor...\n');
            
            // Initialize geolocation database
            await this.initializeGeolocationDatabase();
            
            // Phase 0: Get target directory from user or command line
            let targetDirectory;
            
            // Check for command line argument first
            if (process.argv[2]) {
                try {
                    targetDirectory = validateDirectoryPath(process.argv[2]);
                    console.log(`\n📁 Using command line directory: ${targetDirectory}\n`);
                } catch (error) {
                    console.error(`❌ Invalid directory path: ${error.message}`);
                    process.exit(1);
                }
            } else {
                // Fall back to interactive prompt
                targetDirectory = promptForDirectory();
                console.log(`\n📁 Processing directory: ${targetDirectory}\n`);
            }
            
            // Phase 1: Image Discovery and Indexing
            await this.phaseOne(targetDirectory);
            
            // Phase 2: Geolocation Inference
            await this.phaseTwo();
            
            // Export geolocation database
            await this.exportGeolocationDatabase();
            
            // Generate and display final report
            this.generateFinalReport();
            
        } catch (error) {
            console.error(`\n❌ Application error: ${error.message}`);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        } finally {
            // Cleanup geolocation database
            await this.cleanupGeolocationDatabase();
        }
    }
    
    /**
     * Phase 1: Image Discovery and EXIF Extraction
     * @param {string} targetDirectory - Target directory path
     */
    async phaseOne(targetDirectory) {
        console.log('📋 PHASE 1: Image Discovery and EXIF Extraction');
        console.log('='.repeat(50));
        
        const phaseStartTime = Date.now();
        
        try {
            // Step 1: Discover image files
            console.log('\n🔍 Step 1: Discovering image files...');
            const imageFiles = await discoverImageFiles(targetDirectory, (count, filePath) => {
                if (count % 100 === 0) {
                    process.stdout.write(`\r   Found ${count} images...`);
                }
            });
            
            this.stats.recordDiscovery({
                totalFilesScanned: imageFiles.length,
                imageFilesFound: imageFiles.length,
                directoriesTraversed: 1, // Simplified for now
                totalSizeBytes: 0 // Will be calculated during indexing
            });
            
            // Step 2: Create image index with metadata
            console.log('\n📊 Step 2: Creating image index...');
            this.imageIndex = await createImageIndex(imageFiles);
            
            // Step 3: GPS extraction with database priority checking
            console.log('\n🗄️  Step 3: GPS extraction with database priority...');
            await this.extractGpsWithPriority();
            
            // Step 4: Timeline augmentation from image GPS data
            if (this.config.timelineAugmentation.enabled) {
                console.log('\n📍 Step 4: Timeline augmentation from image GPS data...');
                await this.augmentTimelineFromImages();
            }
            
            // Calculate statistics from index
            let totalSize = 0;
            let imagesWithGps = 0;
            let imagesWithTimestamp = 0;
            let imagesNeedingGeolocation = 0;
            
            for (const [filePath, metadata] of this.imageIndex) {
                totalSize += metadata.fileSize || 0;
                if (metadata.hasGpsCoordinates) imagesWithGps++;
                if (metadata.hasValidTimestamp) imagesWithTimestamp++;
                if (metadata.needsGeolocation) imagesNeedingGeolocation++;
            }
            
            this.stats.recordIndexing({
                totalImages: this.imageIndex.size,
                successfullyIndexed: this.imageIndex.size,
                indexingErrors: 0,
                imagesWithGps,
                imagesWithTimestamp,
                imagesNeedingGeolocation
            });
            
            // Update discovery stats with total size
            this.stats.discovery.totalSizeBytes = totalSize;
            
            console.log(`\n✅ Phase 1 Complete:`);
            console.log(`   📸 Total images indexed: ${this.imageIndex.size.toLocaleString()}`);
            console.log(`   🗺️  Images with GPS: ${imagesWithGps.toLocaleString()}`);
            console.log(`   ⏰ Images with timestamp: ${imagesWithTimestamp.toLocaleString()}`);
            console.log(`   📍 Images needing geolocation: ${imagesNeedingGeolocation.toLocaleString()}`);
            
        } catch (error) {
            throw new Error(`Phase 1 failed: ${error.message}`);
        } finally {
            this.stats.recordProcessingTime('discovery', Date.now() - phaseStartTime);
        }
    }
    
    /**
     * Augment timeline data with GPS coordinates from images
     */
    async augmentTimelineFromImages() {
        try {
            // Create timeline augmentation service with configuration
            const augmentationConfig = {
                exactTimeTolerance: this.config.timelineAugmentation.exactTimeTolerance * 60 * 1000, // convert to ms
                proximityDistanceTolerance: this.config.timelineAugmentation.proximityDistanceTolerance,
                proximityTimeTolerance: this.config.timelineAugmentation.proximityTimeTolerance * 60 * 1000, // convert to ms
                createBackup: this.config.timelineAugmentation.createBackup
            };
            
            const augmentationService = createTimelineAugmentationService(augmentationConfig);
            
            // Augment timeline with image GPS data
            const augmentationReport = await augmentationService.augmentTimelineFromImages(
                this.timelineFilePath,
                this.imageIndex
            );
            
            // Log augmentation results
            if (augmentationReport.summary.newRecordsAdded > 0) {
                console.log(`   ✅ Timeline augmentation successful:`);
                console.log(`      ➕ New records added: ${augmentationReport.summary.newRecordsAdded}`);
                console.log(`      ⏭️  Duplicates skipped: ${augmentationReport.summary.totalSkipped}`);
                console.log(`      📸 Images processed: ${augmentationReport.summary.imagesProcessed}`);
                console.log(`      🗺️  Images with GPS: ${augmentationReport.summary.imagesWithGps}`);
            } else {
                console.log(`   ℹ️  No new timeline records added (${augmentationReport.summary.totalSkipped} duplicates skipped)`);
            }
            
            // Log any errors
            if (augmentationReport.errors && augmentationReport.errors.length > 0) {
                console.log(`   ⚠️  Augmentation warnings:`);
                augmentationReport.errors.forEach(error => {
                    console.log(`      • ${error}`);
                });
            }
            
        } catch (error) {
            console.warn(`   ⚠️  Timeline augmentation failed: ${error.message}`);
            // Don't throw - this is not critical to the main processing
        }
    }
    
    /**
     * Phase 2: Geolocation Inference
     */
    async phaseTwo() {
        console.log('\n\n📍 PHASE 2: Geolocation Inference');
        console.log('='.repeat(50));
        
        const phaseStartTime = Date.now();
        
        try {
            // Step 1: Load and validate timeline data
            console.log('\n🗺️  Step 1: Loading timeline data...');
            await this.loadTimelineData();
            
            // Step 2: Filter images needing geolocation
            console.log('\n🎯 Step 2: Filtering images for processing...');
            this.imagesNeedingGeolocation = filterImagesNeedingGeolocation(this.imageIndex);
            this.imagesWithGps = getImagesWithGps(this.imageIndex);
            
            if (this.imagesNeedingGeolocation.length === 0) {
                console.log('✅ No images need geolocation processing!');
                return;
            }
            
            // Step 3: Process images in batches
            console.log(`\n🔄 Step 3: Processing ${this.imagesNeedingGeolocation.length} images...`);
            await this.processImagesInBatches();
            
            console.log(`\n✅ Phase 2 Complete:`);
            console.log(`   🎯 Primary interpolations: ${this.stats.interpolation.primarySuccessful.toLocaleString()}`);
            console.log(`   🥈 Secondary interpolations: ${this.stats.interpolation.secondarySuccessful.toLocaleString()}`);
            console.log(`   💾 GPS coordinates written: ${this.stats.gpsWriting.successful.toLocaleString()}`);
            
        } catch (error) {
            throw new Error(`Phase 2 failed: ${error.message}`);
        } finally {
            this.stats.recordProcessingTime('interpolation', Date.now() - phaseStartTime);
        }
    }
    
    /**
     * Load and validate timeline data
     */
    async loadTimelineData() {
        try {
            // Validate timeline file
            const validation = await validateTimelineFile(this.timelineFilePath);
            
            if (!validation.exists) {
                console.log('⚠️  Timeline file not found, skipping timeline-based interpolation');
                this.timelineRecords = [];
                this.stats.recordTimeline({
                    timelineFileExists: false,
                    positionRecordsFound: 0,
                    errors: ['Timeline file not found']
                });
                return;
            }
            
            if (!validation.validJson || !validation.hasTimelineEdits) {
                console.log('⚠️  Invalid timeline file format, skipping timeline-based interpolation');
                this.timelineRecords = [];
                this.stats.recordTimeline({
                    timelineFileExists: true,
                    positionRecordsFound: 0,
                    errors: validation.errors
                });
                return;
            }
            
            // Parse timeline data
            this.timelineRecords = await parseTimelineData(this.timelineFilePath);
            const timelineStats = getTimelineStatistics(this.timelineRecords);
            
            this.stats.recordTimeline({
                timelineFileExists: true,
                positionRecordsFound: this.timelineRecords.length,
                timeRange: timelineStats.timeRange,
                deviceIds: Object.keys(timelineStats.devices),
                errors: []
            });
            
            console.log(`   📍 Loaded ${this.timelineRecords.length.toLocaleString()} position records`);
            if (timelineStats.timeRange) {
                console.log(`   📅 Time range: ${timelineStats.timeRange.start.toLocaleDateString()} - ${timelineStats.timeRange.end.toLocaleDateString()}`);
            }
            
        } catch (error) {
            console.warn(`⚠️  Failed to load timeline data: ${error.message}`);
            this.timelineRecords = [];
            this.stats.recordTimeline({
                timelineFileExists: false,
                positionRecordsFound: 0,
                errors: [error.message]
            });
        }
    }
    
    /**
     * Process images in batches to manage memory usage
     */
    async processImagesInBatches() {
        const totalImages = this.imagesNeedingGeolocation.length;
        let processedCount = 0;
        
        // Process in batches
        for (let i = 0; i < totalImages; i += this.config.batchSize) {
            const batch = this.imagesNeedingGeolocation.slice(i, i + this.config.batchSize);
            
            // Process batch in parallel
            const batchPromises = batch.map(async (imageData) => {
                try {
                    await this.processImage(imageData);
                    processedCount++;
                    displayProgress('Processing images', processedCount, totalImages);
                } catch (error) {
                    console.warn(`\nWarning: Failed to process ${imageData.metadata.fileName}: ${error.message}`);
                    processedCount++;
                    displayProgress('Processing images', processedCount, totalImages);
                }
            });
            
            await Promise.all(batchPromises);
            
            // Small delay between batches to prevent overwhelming the system
            if (i + this.config.batchSize < totalImages) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
    
    /**
     * Process a single image for geolocation
     * @param {Object} imageData - Image data object
     */
    async processImage(imageData) {
        const { filePath, metadata } = imageData;
        
        try {
            // Priority 1: Check if GPS data already exists in database
            const existingGps = await this.geolocationDb.getGpsData(filePath);
            if (existingGps) {
                console.log(`   🗄️  Database: ${path.basename(filePath)} (${existingGps.source})`);
                return; // Skip interpolation - already have GPS data
            }
            
            // Validate timestamp for interpolation
            if (!metadata.timestamp || !isValidTimestamp(metadata.timestamp)) {
                throw new Error('Invalid or missing timestamp');
            }
            
            let interpolationResult = null;
            let gpsSource = null;
            
            // Priority 2: Try primary interpolation (timeline data)
            if (this.timelineRecords && this.timelineRecords.length > 0) {
                interpolationResult = await primaryInterpolation(
                    metadata,
                    this.timelineRecords,
                    this.config.timelineTolerance
                );
                
                if (interpolationResult && validateInterpolationResult(interpolationResult)) {
                    gpsSource = GPS_SOURCES.TIMELINE_INTERPOLATED;
                    this.stats.recordInterpolation('primary', true, interpolationResult);
                } else {
                    this.stats.recordInterpolation('primary', false);
                }
            }
            
            // Priority 3: Try secondary interpolation if primary failed
            if (!interpolationResult && this.imagesWithGps && this.imagesWithGps.length > 0) {
                interpolationResult = await secondaryInterpolation(
                    metadata,
                    this.imagesWithGps,
                    this.config.secondaryRadius,
                    this.config.secondaryTimeWindow
                );
                
                if (interpolationResult && validateInterpolationResult(interpolationResult)) {
                    gpsSource = GPS_SOURCES.NEARBY_INTERPOLATED;
                    this.stats.recordInterpolation('secondary', true, interpolationResult);
                } else {
                    this.stats.recordInterpolation('secondary', false);
                }
            }
            
            // Write GPS coordinates and store in database if interpolation was successful
            if (interpolationResult && validateInterpolationResult(interpolationResult)) {
                await this.writeGpsCoordinates(filePath, interpolationResult);
                
                // Store interpolated GPS data in database for future runs
                const gpsData = {
                    latitude: interpolationResult.latitude,
                    longitude: interpolationResult.longitude,
                    altitude: interpolationResult.altitude || null,
                    bearing: null,
                    accuracy: null,
                    timestamp: metadata.timestamp
                };
                
                const interpolationDetails = {
                    method: interpolationResult.method || 'unknown',
                    confidence: interpolationResult.confidence || 'medium',
                    timeDistance: interpolationResult.timeDistance || null,
                    spatialDistance: interpolationResult.spatialDistance || null
                };
                
                await this.geolocationDb.store(filePath, gpsData, gpsSource, interpolationDetails);
                
                console.log(`   🎯 ${gpsSource === GPS_SOURCES.TIMELINE_INTERPOLATED ? 'Timeline' : 'Nearby'}: ${path.basename(filePath)}`);
            } else {
                // Record failed interpolation
                if (!interpolationResult) {
                    this.stats.recordInterpolation('none', false);
                }
            }
            
        } catch (error) {
            throw new Error(`Failed to process image: ${error.message}`);
        }
    }
    
    /**
     * Write GPS coordinates to image file
     * @param {string} filePath - Image file path
     * @param {Object} interpolationResult - Interpolation result
     */
    async writeGpsCoordinates(filePath, interpolationResult) {
        try {
            // Validate coordinates
            if (!isValidCoordinatePair(interpolationResult.latitude, interpolationResult.longitude)) {
                throw new Error('Invalid coordinates from interpolation');
            }
            
            // Create backup if configured
            let backupCreated = false;
            if (this.config.createBackups) {
                try {
                    const { createBackup } = await import('./services/exif.js');
                    await createBackup(filePath);
                    backupCreated = true;
                } catch (backupError) {
                    console.warn(`Warning: Failed to create backup for ${filePath}: ${backupError.message}`);
                }
            }
            
            // Write GPS coordinates
            const success = await writeGpsCoordinates(
                filePath,
                interpolationResult.latitude,
                interpolationResult.longitude
            );
            
            this.stats.recordGpsWriting(success, backupCreated);
            
            if (!success) {
                throw new Error('Failed to write GPS coordinates to EXIF');
            }
            
        } catch (error) {
            this.stats.recordGpsWriting(false, false, error.message);
            throw error;
        }
    }
    
    /**
     * Generate and display final report
     */
    generateFinalReport() {
        console.log('\n\n📊 Generating final report...');
        
        const report = this.stats.generateReport();
        displayStatisticsReport(report);
        
        // Export report to JSON file
        try {
            exportStatisticsReport(report, 'data/processing-report.json');
            console.log('\n📄 Report exported to data/processing-report.json');
        } catch (error) {
            console.warn(`Warning: Failed to export report: ${error.message}`);
        }
        
        // Summary
        const summary = {
            totalImages: this.imageIndex?.size || 0,
            imagesWithGps: report.indexing?.imagesWithGps || 0,
            interpolationsSuccessful: (report.interpolation?.primarySuccessful || 0) + (report.interpolation?.secondarySuccessful || 0),
            gpsCoordinatesWritten: report.gpsWriting?.successful || 0
        };
        
        console.log('\n🎯 Processing Summary:');
        console.log(`   📸 Total images processed: ${summary.totalImages.toLocaleString()}`);
        console.log(`   🗺️  Images with GPS coordinates: ${summary.imagesWithGps.toLocaleString()}`);
        console.log(`   🎯 Successful interpolations: ${summary.interpolationsSuccessful.toLocaleString()}`);
        console.log(`   💾 GPS coordinates written: ${summary.gpsCoordinatesWritten.toLocaleString()}`);
        
        if (summary.totalImages > 0) {
            const gpsPercentage = ((summary.imagesWithGps / summary.totalImages) * 100).toFixed(1);
            console.log(`   📊 GPS coverage: ${gpsPercentage}%`);
        }
        
        console.log('\n✅ Processing complete!');
    }
    
    /**
     * Initialize geolocation database
     */
    async initializeGeolocationDatabase() {
        try {
            this.geolocationDb = await createGeolocationDatabase(this.config.geolocationDatabase);
        } catch (error) {
            throw new Error(`Failed to initialize geolocation database: ${error.message}`);
        }
    }
    
    /**
     * Export geolocation database
     */
    async exportGeolocationDatabase() {
        try {
            if (this.geolocationDb && this.config.geolocationDatabase.exportPath) {
                console.log('\n💾 Exporting geolocation database...');
                const exportPath = await this.geolocationDb.export(this.config.geolocationDatabase.exportPath);
                console.log(`   📄 Database exported to: ${exportPath}`);
            }
        } catch (error) {
            console.warn(`Warning: Failed to export geolocation database: ${error.message}`);
        }
    }
    
    /**
     * Extract GPS coordinates with database priority (optimized with batching)
     */
    async extractGpsWithPriority() {
        const totalImages = this.imageIndex.size;
        const imageEntries = Array.from(this.imageIndex.entries());
        let processedCount = 0;
        
        console.log(`   🔄 Processing ${totalImages} images in batches of ${this.config.batchSize}...`);
        
        // Process images in batches for better performance
        for (let i = 0; i < imageEntries.length; i += this.config.batchSize) {
            const batch = imageEntries.slice(i, i + this.config.batchSize);
            
            // Process batch in parallel
            const batchPromises = batch.map(async ([filePath, metadata]) => {
                try {
                    // Priority 1: Check database first (fast lookup)
                    const existingGps = await this.geolocationDb.getGpsData(filePath);
                    if (existingGps) {
                        // Update metadata with database GPS data
                        metadata.hasGpsCoordinates = true;
                        metadata.exifData = metadata.exifData || {};
                        metadata.exifData.latitude = existingGps.latitude;
                        metadata.exifData.longitude = existingGps.longitude;
                        metadata.needsGeolocation = false;
                        return { success: true, source: 'database', filePath };
                    }
                    
                    // Priority 2: Extract from EXIF (slower operation)
                    const gpsCoordinates = await extractGpsCoordinates(filePath);
                    if (gpsCoordinates && gpsCoordinates.latitude && gpsCoordinates.longitude) {
                        // Store extracted GPS data in database for future runs
                        const gpsData = {
                            latitude: gpsCoordinates.latitude,
                            longitude: gpsCoordinates.longitude,
                            altitude: gpsCoordinates.altitude || null,
                            bearing: null,
                            accuracy: null,
                            timestamp: metadata.timestamp
                        };
                        
                        await this.geolocationDb.store(filePath, gpsData, GPS_SOURCES.EXIF_EXTRACTED);
                        
                        // Update metadata
                        metadata.hasGpsCoordinates = true;
                        metadata.exifData = metadata.exifData || {};
                        metadata.exifData.latitude = gpsCoordinates.latitude;
                        metadata.exifData.longitude = gpsCoordinates.longitude;
                        metadata.needsGeolocation = false;
                        
                        return { success: true, source: 'exif', filePath };
                    }
                    
                    return { success: false, source: 'none', filePath };
                    
                } catch (error) {
                    console.warn(`Warning: GPS extraction failed for ${path.basename(filePath)}: ${error.message}`);
                    return { success: false, source: 'error', filePath, error: error.message };
                }
            });
            
            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);
            processedCount += batchResults.length;
            
            // Update progress
            displayProgress('GPS extraction', processedCount, totalImages);
            
            // Small delay between batches to prevent overwhelming the system
            if (i + this.config.batchSize < imageEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        console.log(''); // New line after progress
        console.log(`   ✅ Completed GPS extraction for ${totalImages} images`);
    }
    
    /**
     * Cleanup geolocation database
     */
    async cleanupGeolocationDatabase() {
        try {
            if (this.geolocationDb) {
                await this.geolocationDb.close();
            }
        } catch (error) {
            console.warn(`Warning: Failed to cleanup geolocation database: ${error.message}`);
        }
    }
}

/**
 * Main application entry point
 */
async function main() {
    const processor = new ImageGeolocationProcessor();
    await processor.run();
}

/**
 * Validate timestamp for processing
 * @param {Date} timestamp - Timestamp to validate
 * @returns {boolean} True if valid
 */
function isValidTimestamp(timestamp) {
    return timestamp instanceof Date && 
           !isNaN(timestamp.getTime()) && 
           timestamp.getTime() > 0;
}

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
