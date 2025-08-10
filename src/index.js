#!/usr/bin/env node

/**
 * Image Geolocation Processor - Main Application
 * Coordinates the two-phase processing system for image geolocation
 */

import path from 'path';
import { promptForDirectory, displayProgress, showSpinner } from './utils/input.js';
import { discoverImageFiles, createImageIndex, filterImagesNeedingGeolocation, getImagesWithGps } from './services/fileDiscovery.js';
import { parseTimelineData, validateTimelineFile, getTimelineStatistics } from './services/timelineParser.js';
import { primaryInterpolation, secondaryInterpolation, validateInterpolationResult } from './services/interpolation.js';
import { writeGpsToExif, isValidTimestamp, extractGpsFromImage } from './services/exif.js';
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
            batchSize: 10, // images to process in parallel
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
            
            // Phase 0: Get target directory from user
            const targetDirectory = promptForDirectory();
            console.log(`\n📁 Processing directory: ${targetDirectory}\n`);
            
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
            const success = await writeGpsToExif(
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
        const reportPath = path.resolve('processing-report.json');
        exportStatisticsReport(report, reportPath);
        
        // Display summary
        const summary = {
            totalImages: report.summary.totalImagesProcessed,
            newlyGeotagged: report.summary.newlyGeotaggedImages,
            successRate: report.summary.interpolationSuccessRate.toFixed(1),
            duration: Math.round(report.summary.totalDuration / 1000)
        };
        
        console.log(`🎉 Processing completed successfully!`);
        console.log(`   📸 ${summary.totalImages.toLocaleString()} images processed`);
        console.log(`   🎯 ${summary.newlyGeotagged.toLocaleString()} images newly geotagged`);
        console.log(`   ✅ ${summary.successRate}% success rate`);
        console.log(`   ⏱️  ${summary.duration}s total processing time`);
        
        // Add detailed analysis if no images were geotagged
        if (summary.newlyGeotagged === 0 && this.imagesNeedingGeolocation.length > 0) {
            console.log(`\n🔍 ANALYSIS: Why no images were geotagged`);
            console.log('='.repeat(50));
            
            // Analyze timeline coverage
            if (this.timelineRecords && this.timelineRecords.length > 0) {
                const timelineStart = new Date(Math.min(...this.timelineRecords.map(r => new Date(r.timestamp))));
                const timelineEnd = new Date(Math.max(...this.timelineRecords.map(r => new Date(r.timestamp))));
                
                console.log(`📅 Timeline coverage: ${timelineStart.toLocaleDateString()} to ${timelineEnd.toLocaleDateString()}`);
                
                // Analyze image timestamps
                const imageTimestamps = this.imagesNeedingGeolocation.map(img => img.metadata.timestamp).filter(t => t);
                if (imageTimestamps.length > 0) {
                    const imageStart = new Date(Math.min(...imageTimestamps));
                    const imageEnd = new Date(Math.max(...imageTimestamps));
                    
                    console.log(`📸 Image date range: ${imageStart.toLocaleDateString()} to ${imageEnd.toLocaleDateString()}`);
                    
                    // Check overlap
                    const hasOverlap = !(imageEnd < timelineStart || imageStart > timelineEnd);
                    if (!hasOverlap) {
                        if (imageStart > timelineEnd) {
                            const daysAfter = Math.round((imageStart - timelineEnd) / (1000 * 60 * 60 * 24));
                            console.log(`❌ Images are ${daysAfter} days AFTER timeline ends`);
                        } else {
                            const daysBefore = Math.round((timelineStart - imageStart) / (1000 * 60 * 60 * 24));
                            console.log(`❌ Images are ${daysBefore} days BEFORE timeline starts`);
                        }
                        console.log(`💡 Solution: Export timeline data that covers ${imageStart.toLocaleDateString()} to ${imageEnd.toLocaleDateString()}`);
                    } else {
                        console.log(`✅ Timeline and images have overlapping dates`);
                        console.log(`❌ But no matches found within ${this.config.timelineTolerance}-minute tolerance`);
                        console.log(`💡 Solution: Increase timelineTolerance in config (currently ${this.config.timelineTolerance} minutes)`);
                    }
                }
            } else {
                console.log(`❌ No timeline data available`);
                console.log(`💡 Solution: Place Timeline Edits.json file in data/ directory`);
            }
            
            // Secondary interpolation analysis
            if (this.imagesWithGps.length === 0) {
                console.log(`❌ No reference images with GPS coordinates found`);
                console.log(`💡 Solution: Include some images with existing GPS coordinates for interpolation`);
            } else {
                console.log(`✅ Found ${this.imagesWithGps.length} images with GPS coordinates for secondary interpolation`);
                console.log(`❌ But secondary interpolation also failed`);
                console.log(`💡 Check: Images may be too far apart in time (>${this.config.secondaryTimeWindow}h) or space (>${this.config.secondaryRadius}m)`);
            }
        }
    }
    
    /**
     * Initialize geolocation database
     */
    async initializeGeolocationDatabase() {
        try {
            this.geolocationDb = await createGeolocationDatabase(this.config.geolocationDatabase);
            console.log('✅ Geolocation database initialized');
        } catch (error) {
            console.error('❌ Failed to initialize geolocation database:', error.message);
            throw error;
        }
    }
    
    /**
     * Export geolocation database to JSON
     */
    async exportGeolocationDatabase() {
        try {
            if (!this.geolocationDb) {
                console.warn('⚠️  Geolocation database not initialized, skipping export');
                return;
            }
            
            const success = await this.geolocationDb.exportToJson();
            if (success) {
                const stats = this.geolocationDb.getStatistics();
                console.log(`\n📄 Geolocation database exported successfully`);
                console.log(`   📊 Total GPS records: ${stats.totalRecords}`);
                console.log(`   📍 EXIF GPS: ${stats.sourceBreakdown[GPS_SOURCES.EXIF_GPS]}`);
                console.log(`   🗺️  Timeline interpolated: ${stats.sourceBreakdown[GPS_SOURCES.TIMELINE_INTERPOLATED]}`);
                console.log(`   📸 Nearby images interpolated: ${stats.sourceBreakdown[GPS_SOURCES.NEARBY_INTERPOLATED]}`);
                console.log(`   💾 Export location: ${this.config.geolocationDatabase.exportPath}`);
            }
        } catch (error) {
            console.error('❌ Failed to export geolocation database:', error.message);
        }
    }
    
    /**
     * Extract GPS data with database priority checking
     */
    async extractGpsWithPriority() {
        try {
            let processedCount = 0;
            let databaseHits = 0;
            let exifExtractions = 0;
            const totalImages = this.imageIndex.size;
            
            console.log(`   Processing ${totalImages} images for GPS data...`);
            
            for (const [filePath, metadata] of this.imageIndex) {
                try {
                    // Priority 1: Check existing geolocation database
                    let gpsData = await this.geolocationDb.getGpsData(filePath);
                    
                    if (gpsData) {
                        // Found in database - update metadata
                        metadata.hasGpsCoordinates = true;
                        metadata.needsGeolocation = false;
                        metadata.gpsSource = gpsData.source;
                        metadata.gps = gpsData; // Store GPS data for timeline augmentation
                        databaseHits++;
                        
                        console.log(`   📍 Database: ${path.basename(filePath)} (${gpsData.source})`);
                    } else {
                        // Priority 2: Extract from EXIF if not in database
                        gpsData = await extractGpsFromImage(filePath);
                        
                        if (gpsData) {
                            // Store in database for future runs
                            await this.geolocationDb.store(filePath, gpsData, GPS_SOURCES.EXIF_GPS);
                            
                            // Update metadata
                            metadata.hasGpsCoordinates = true;
                            metadata.needsGeolocation = false;
                            metadata.gpsSource = GPS_SOURCES.EXIF_GPS;
                            metadata.gps = gpsData; // Store GPS data for timeline augmentation
                            exifExtractions++;
                            
                            console.log(`   📷 EXIF: ${path.basename(filePath)}`);
                        }
                    }
                    
                    processedCount++;
                    
                    // Show progress every 50 images
                    if (processedCount % 50 === 0) {
                        displayProgress('GPS extraction', processedCount, totalImages);
                    }
                    
                } catch (error) {
                    console.warn(`   ⚠️  Failed to process ${path.basename(filePath)}: ${error.message}`);
                }
            }
            
            console.log(`\n   ✅ GPS extraction completed:`);
            console.log(`      📊 Total processed: ${processedCount}`);
            console.log(`      🗄️  Database hits: ${databaseHits}`);
            console.log(`      📷 EXIF extractions: ${exifExtractions}`);
            console.log(`      🔍 Still need geolocation: ${totalImages - databaseHits - exifExtractions}`);
            
        } catch (error) {
            console.error('❌ GPS extraction error:', error.message);
            throw error;
        }
    }
    
    /**
     * Cleanup geolocation database resources
     */
    async cleanupGeolocationDatabase() {
        try {
            if (this.geolocationDb) {
                await this.geolocationDb.cleanup();
                this.geolocationDb = null;
            }
        } catch (error) {
            console.error('❌ Database cleanup error:', error.message);
        }
    }
}

/**
 * Application entry point
 */
async function main() {
    try {
        const processor = new ImageGeolocationProcessor();
        await processor.run();
    } catch (error) {
        console.error(`\n💥 Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught Exception:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Received SIGINT. Gracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Received SIGTERM. Gracefully shutting down...');
    process.exit(0);
});

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default ImageGeolocationProcessor;
