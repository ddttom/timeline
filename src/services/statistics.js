/**
 * Statistics tracking and reporting service
 * Handles collection and reporting of processing statistics
 */

import { formatFileSize, formatDuration } from '../utils/input.js';

/**
 * Statistics collector class
 */
export class StatisticsCollector {
    constructor() {
        this.reset();
    }
    
    /**
     * Reset all statistics
     */
    reset() {
        this.startTime = new Date();
        this.endTime = null;
        
        this.discovery = {
            totalFilesScanned: 0,
            imageFilesFound: 0,
            directoriesTraversed: 0,
            totalSizeBytes: 0,
            errors: []
        };
        
        this.indexing = {
            totalImages: 0,
            successfullyIndexed: 0,
            indexingErrors: 0,
            imagesWithGps: 0,
            imagesWithTimestamp: 0,
            imagesNeedingGeolocation: 0,
            errors: []
        };
        
        this.timeline = {
            timelineFileExists: false,
            positionRecordsFound: 0,
            timeRange: null,
            deviceIds: [],
            errors: []
        };
        
        this.interpolation = {
            totalAttempts: 0,
            primarySuccessful: 0,
            secondarySuccessful: 0,
            failed: 0,
            sources: {},
            averageTimeDifference: 0,
            averageConfidence: 0,
            errors: []
        };
        
        this.gpsWriting = {
            totalAttempts: 0,
            successful: 0,
            failed: 0,
            backupsCreated: 0,
            errors: []
        };
        
        this.performance = {
            memoryUsage: {
                initial: process.memoryUsage(),
                peak: process.memoryUsage(),
                final: null
            },
            processingTimes: {
                discovery: 0,
                indexing: 0,
                timeline: 0,
                interpolation: 0,
                gpsWriting: 0
            }
        };
    }
    
    /**
     * Record discovery statistics
     * @param {Object} stats - Discovery statistics
     */
    recordDiscovery(stats) {
        this.discovery = {
            ...this.discovery,
            ...stats
        };
        this.updateMemoryUsage();
    }
    
    /**
     * Record indexing statistics
     * @param {Object} stats - Indexing statistics
     */
    recordIndexing(stats) {
        this.indexing = {
            ...this.indexing,
            ...stats
        };
        this.updateMemoryUsage();
    }
    
    /**
     * Record timeline statistics
     * @param {Object} stats - Timeline statistics
     */
    recordTimeline(stats) {
        this.timeline = {
            ...this.timeline,
            ...stats
        };
        this.updateMemoryUsage();
    }
    
    /**
     * Record interpolation attempt
     * @param {string} method - Interpolation method ('primary' or 'secondary')
     * @param {boolean} successful - Whether interpolation was successful
     * @param {Object} result - Interpolation result
     */
    recordInterpolation(method, successful, result = null) {
        this.interpolation.totalAttempts++;
        
        if (successful && result) {
            if (method === 'primary') {
                this.interpolation.primarySuccessful++;
            } else if (method === 'secondary') {
                this.interpolation.secondarySuccessful++;
            }
            
            // Track sources
            const source = result.source || 'unknown';
            this.interpolation.sources[source] = (this.interpolation.sources[source] || 0) + 1;
            
            // Update averages
            if (typeof result.timeDifference === 'number') {
                const currentAvg = this.interpolation.averageTimeDifference;
                const count = this.interpolation.primarySuccessful + this.interpolation.secondarySuccessful;
                this.interpolation.averageTimeDifference = 
                    (currentAvg * (count - 1) + result.timeDifference) / count;
            }
            
            if (typeof result.confidence === 'number') {
                const currentAvg = this.interpolation.averageConfidence;
                const count = this.interpolation.primarySuccessful + this.interpolation.secondarySuccessful;
                this.interpolation.averageConfidence = 
                    (currentAvg * (count - 1) + result.confidence) / count;
            }
        } else {
            this.interpolation.failed++;
        }
        
        this.updateMemoryUsage();
    }
    
    /**
     * Record GPS writing attempt
     * @param {boolean} successful - Whether writing was successful
     * @param {boolean} backupCreated - Whether backup was created
     * @param {string} error - Error message if failed
     */
    recordGpsWriting(successful, backupCreated = false, error = null) {
        this.gpsWriting.totalAttempts++;
        
        if (successful) {
            this.gpsWriting.successful++;
        } else {
            this.gpsWriting.failed++;
            if (error) {
                this.gpsWriting.errors.push(error);
            }
        }
        
        if (backupCreated) {
            this.gpsWriting.backupsCreated++;
        }
        
        this.updateMemoryUsage();
    }
    
    /**
     * Record processing time for a phase
     * @param {string} phase - Processing phase name
     * @param {number} timeMs - Time in milliseconds
     */
    recordProcessingTime(phase, timeMs) {
        if (this.performance.processingTimes.hasOwnProperty(phase)) {
            this.performance.processingTimes[phase] = timeMs;
        }
    }
    
    /**
     * Update memory usage tracking
     */
    updateMemoryUsage() {
        const current = process.memoryUsage();
        
        // Track peak memory usage
        if (current.heapUsed > this.performance.memoryUsage.peak.heapUsed) {
            this.performance.memoryUsage.peak = current;
        }
    }
    
    /**
     * Finalize statistics collection
     */
    finalize() {
        this.endTime = new Date();
        this.performance.memoryUsage.final = process.memoryUsage();
    }
    
    /**
     * Get total processing duration
     * @returns {number} Duration in milliseconds
     */
    getTotalDuration() {
        const end = this.endTime || new Date();
        return end.getTime() - this.startTime.getTime();
    }
    
    /**
     * Get success rate for interpolation
     * @returns {number} Success rate as percentage
     */
    getInterpolationSuccessRate() {
        const total = this.interpolation.totalAttempts;
        if (total === 0) return 0;
        
        const successful = this.interpolation.primarySuccessful + this.interpolation.secondarySuccessful;
        return (successful / total) * 100;
    }
    
    /**
     * Get GPS writing success rate
     * @returns {number} Success rate as percentage
     */
    getGpsWritingSuccessRate() {
        const total = this.gpsWriting.totalAttempts;
        if (total === 0) return 0;
        
        return (this.gpsWriting.successful / total) * 100;
    }
    
    /**
     * Generate comprehensive statistics report
     * @returns {Object} Complete statistics report
     */
    generateReport() {
        this.finalize();
        
        return {
            summary: {
                totalDuration: this.getTotalDuration(),
                startTime: this.startTime,
                endTime: this.endTime,
                interpolationSuccessRate: this.getInterpolationSuccessRate(),
                gpsWritingSuccessRate: this.getGpsWritingSuccessRate(),
                totalImagesProcessed: this.indexing.totalImages,
                newlyGeotaggedImages: this.gpsWriting.successful
            },
            discovery: this.discovery,
            indexing: this.indexing,
            timeline: this.timeline,
            interpolation: this.interpolation,
            gpsWriting: this.gpsWriting,
            performance: this.performance
        };
    }
}

/**
 * Format and display statistics report
 * @param {Object} report - Statistics report
 */
export function displayStatisticsReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMAGE GEOLOCATION PROCESSING REPORT');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📋 SUMMARY');
    console.log('-'.repeat(30));
    console.log(`⏱️  Total Duration: ${formatDuration(report.summary.totalDuration)}`);
    console.log(`📅 Start Time: ${report.summary.startTime.toLocaleString()}`);
    console.log(`📅 End Time: ${report.summary.endTime.toLocaleString()}`);
    console.log(`📸 Total Images Processed: ${report.summary.totalImagesProcessed.toLocaleString()}`);
    console.log(`🎯 Newly Geotagged Images: ${report.summary.newlyGeotaggedImages.toLocaleString()}`);
    console.log(`✅ Interpolation Success Rate: ${report.summary.interpolationSuccessRate.toFixed(1)}%`);
    console.log(`💾 GPS Writing Success Rate: ${report.summary.gpsWritingSuccessRate.toFixed(1)}%`);
    
    // Discovery
    console.log('\n🔍 FILE DISCOVERY');
    console.log('-'.repeat(30));
    console.log(`📁 Directories Traversed: ${report.discovery.directoriesTraversed.toLocaleString()}`);
    console.log(`📄 Total Files Scanned: ${report.discovery.totalFilesScanned.toLocaleString()}`);
    console.log(`🖼️  Image Files Found: ${report.discovery.imageFilesFound.toLocaleString()}`);
    console.log(`💽 Total Size: ${formatFileSize(report.discovery.totalSizeBytes)}`);
    if (report.discovery.errors.length > 0) {
        console.log(`❌ Discovery Errors: ${report.discovery.errors.length}`);
    }
    
    // Indexing
    console.log('\n📊 IMAGE INDEXING');
    console.log('-'.repeat(30));
    console.log(`📸 Total Images: ${report.indexing.totalImages.toLocaleString()}`);
    console.log(`✅ Successfully Indexed: ${report.indexing.successfullyIndexed.toLocaleString()}`);
    console.log(`🗺️  Images with GPS: ${report.indexing.imagesWithGps.toLocaleString()}`);
    console.log(`⏰ Images with Timestamp: ${report.indexing.imagesWithTimestamp.toLocaleString()}`);
    console.log(`📍 Images Needing Geolocation: ${report.indexing.imagesNeedingGeolocation.toLocaleString()}`);
    if (report.indexing.indexingErrors > 0) {
        console.log(`❌ Indexing Errors: ${report.indexing.indexingErrors.toLocaleString()}`);
    }
    
    // Timeline
    console.log('\n🗺️  TIMELINE DATA');
    console.log('-'.repeat(30));
    console.log(`📍 Position Records: ${report.timeline.positionRecordsFound.toLocaleString()}`);
    if (report.timeline.timeRange) {
        console.log(`📅 Time Range: ${report.timeline.timeRange.start?.toLocaleDateString()} - ${report.timeline.timeRange.end?.toLocaleDateString()}`);
    }
    console.log(`📱 Device IDs: ${report.timeline.deviceIds.length}`);
    if (report.timeline.errors.length > 0) {
        console.log(`❌ Timeline Errors: ${report.timeline.errors.length}`);
    }
    
    // Interpolation
    console.log('\n🎯 GEOLOCATION INTERPOLATION');
    console.log('-'.repeat(30));
    console.log(`🔄 Total Attempts: ${report.interpolation.totalAttempts.toLocaleString()}`);
    console.log(`🥇 Primary Successful: ${report.interpolation.primarySuccessful.toLocaleString()}`);
    console.log(`🥈 Secondary Successful: ${report.interpolation.secondarySuccessful.toLocaleString()}`);
    console.log(`❌ Failed: ${report.interpolation.failed.toLocaleString()}`);
    
    if (report.interpolation.averageTimeDifference > 0) {
        console.log(`⏱️  Average Time Difference: ${report.interpolation.averageTimeDifference.toFixed(1)} minutes`);
    }
    
    if (report.interpolation.averageConfidence > 0) {
        console.log(`🎯 Average Confidence: ${(report.interpolation.averageConfidence * 100).toFixed(1)}%`);
    }
    
    // Sources breakdown
    if (Object.keys(report.interpolation.sources).length > 0) {
        console.log('\n📊 Interpolation Sources:');
        for (const [source, count] of Object.entries(report.interpolation.sources)) {
            console.log(`   ${source}: ${count.toLocaleString()}`);
        }
    }
    
    // GPS Writing
    console.log('\n💾 GPS COORDINATE WRITING');
    console.log('-'.repeat(30));
    console.log(`🔄 Total Attempts: ${report.gpsWriting.totalAttempts.toLocaleString()}`);
    console.log(`✅ Successful: ${report.gpsWriting.successful.toLocaleString()}`);
    console.log(`❌ Failed: ${report.gpsWriting.failed.toLocaleString()}`);
    console.log(`💾 Backups Created: ${report.gpsWriting.backupsCreated.toLocaleString()}`);
    
    // Performance
    console.log('\n⚡ PERFORMANCE');
    console.log('-'.repeat(30));
    console.log(`🧠 Initial Memory: ${formatFileSize(report.performance.memoryUsage.initial.heapUsed)}`);
    console.log(`📈 Peak Memory: ${formatFileSize(report.performance.memoryUsage.peak.heapUsed)}`);
    if (report.performance.memoryUsage.final) {
        console.log(`🏁 Final Memory: ${formatFileSize(report.performance.memoryUsage.final.heapUsed)}`);
    }
    
    // Processing times
    console.log('\n⏱️  Processing Times:');
    for (const [phase, timeMs] of Object.entries(report.performance.processingTimes)) {
        if (timeMs > 0) {
            console.log(`   ${phase}: ${formatDuration(timeMs)}`);
        }
    }
    
    // Errors summary
    const totalErrors = report.discovery.errors.length + 
                       report.indexing.errors.length + 
                       report.timeline.errors.length + 
                       report.interpolation.errors.length + 
                       report.gpsWriting.errors.length;
    
    if (totalErrors > 0) {
        console.log('\n❌ ERRORS SUMMARY');
        console.log('-'.repeat(30));
        console.log(`Total Errors: ${totalErrors}`);
        
        if (report.discovery.errors.length > 0) {
            console.log(`Discovery: ${report.discovery.errors.length}`);
        }
        if (report.indexing.errors.length > 0) {
            console.log(`Indexing: ${report.indexing.errors.length}`);
        }
        if (report.timeline.errors.length > 0) {
            console.log(`Timeline: ${report.timeline.errors.length}`);
        }
        if (report.interpolation.errors.length > 0) {
            console.log(`Interpolation: ${report.interpolation.errors.length}`);
        }
        if (report.gpsWriting.errors.length > 0) {
            console.log(`GPS Writing: ${report.gpsWriting.errors.length}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Processing Complete!');
    console.log('='.repeat(60) + '\n');
}

/**
 * Export statistics report to JSON file
 * @param {Object} report - Statistics report
 * @param {string} filePath - Output file path
 */
export async function exportStatisticsReport(report, filePath) {
    try {
        const fs = await import('fs');
        const reportJson = JSON.stringify(report, null, 2);
        await fs.promises.writeFile(filePath, reportJson, 'utf8');
        console.log(`📊 Statistics report exported to: ${filePath}`);
    } catch (error) {
        console.error(`❌ Failed to export statistics report: ${error.message}`);
    }
}

/**
 * Create a summary statistics object for quick overview
 * @param {Object} report - Full statistics report
 * @returns {Object} Summary statistics
 */
export function createSummaryStatistics(report) {
    return {
        processingTime: formatDuration(report.summary.totalDuration),
        totalImages: report.summary.totalImagesProcessed,
        newlyGeotagged: report.summary.newlyGeotaggedImages,
        successRate: `${report.summary.interpolationSuccessRate.toFixed(1)}%`,
        primaryInterpolations: report.interpolation.primarySuccessful,
        secondaryInterpolations: report.interpolation.secondarySuccessful,
        failed: report.interpolation.failed,
        memoryUsed: formatFileSize(report.performance.memoryUsage.peak.heapUsed),
        errors: report.discovery.errors.length + 
                report.indexing.errors.length + 
                report.timeline.errors.length + 
                report.interpolation.errors.length + 
                report.gpsWriting.errors.length
    };
}
