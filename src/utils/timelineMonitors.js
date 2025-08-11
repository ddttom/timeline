/**
 * Timeline Monitoring Utilities
 * Comprehensive monitoring and diagnostic tools for timeline processing
 */

import { createTimelineLogger } from './debugLogger.js';

/**
 * Timeline Duplicate Monitor
 * Tracks and reports duplicate timestamp patterns
 */
export class TimelineDuplicateMonitor {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ prefix: 'DUPLICATE-MONITOR' });
        this.timestampCounts = new Map();
        this.duplicatePatterns = [];
        this.consolidationStats = {
            originalEntries: 0,
            consolidatedEntries: 0,
            duplicatesEliminated: 0,
            timestampsProcessed: 0
        };
        
        // Configuration
        this.config = {
            trackSources: options.trackSources !== false,
            maxPatternHistory: options.maxPatternHistory || 1000,
            reportThreshold: options.reportThreshold || 2,
            enableDetailedTracking: options.enableDetailedTracking !== false
        };
    }

    /**
     * Track a timestamp occurrence
     * @param {Date|string} timestamp - Timestamp to track
     * @param {string} source - Source of the timestamp (image_timestamp, timeline_existing, etc.)
     * @param {string} filePath - File path associated with timestamp
     * @param {Object} metadata - Additional metadata
     */
    trackTimestamp(timestamp, source, filePath = null, metadata = {}) {
        const timestampKey = new Date(timestamp).toISOString();
        this.consolidationStats.timestampsProcessed++;
        
        if (!this.timestampCounts.has(timestampKey)) {
            this.timestampCounts.set(timestampKey, {
                count: 0,
                sources: [],
                firstSeen: new Date(),
                lastSeen: new Date(),
                metadata: []
            });
        }
        
        const entry = this.timestampCounts.get(timestampKey);
        entry.count++;
        entry.lastSeen = new Date();
        
        if (this.config.trackSources) {
            entry.sources.push({
                source,
                filePath,
                timestamp: new Date(),
                metadata
            });
        }
        
        if (this.config.enableDetailedTracking) {
            entry.metadata.push({
                source,
                filePath,
                ...metadata
            });
        }
        
        // Log if this becomes a duplicate
        if (entry.count === this.config.reportThreshold) {
            this.logger.debug(`Duplicate timestamp detected: ${timestampKey} (${entry.count} occurrences)`);
        }
        
        this.logger.trace(`Tracked timestamp: ${timestampKey} from ${source} (count: ${entry.count})`);
    }

    /**
     * Record consolidation of duplicate timestamps
     * @param {string} timestamp - Timestamp that was consolidated
     * @param {number} originalCount - Original number of entries
     * @param {Array} consolidatedSources - Sources that were consolidated
     */
    recordConsolidation(timestamp, originalCount, consolidatedSources = []) {
        const timestampKey = new Date(timestamp).toISOString();
        
        this.consolidationStats.originalEntries += originalCount;
        this.consolidationStats.consolidatedEntries += 1;
        this.consolidationStats.duplicatesEliminated += (originalCount - 1);
        
        const pattern = {
            timestamp: timestampKey,
            originalCount,
            consolidatedCount: 1,
            duplicatesEliminated: originalCount - 1,
            sources: consolidatedSources,
            consolidatedAt: new Date()
        };
        
        this.duplicatePatterns.push(pattern);
        
        // Limit pattern history size
        if (this.duplicatePatterns.length > this.config.maxPatternHistory) {
            this.duplicatePatterns.shift();
        }
        
        this.logger.debug(`Consolidated ${originalCount} entries for timestamp ${timestampKey} into 1 entry`);
    }

    /**
     * Get duplicate statistics
     * @returns {Object} Duplicate statistics
     */
    getDuplicateStats() {
        const duplicateTimestamps = Array.from(this.timestampCounts.entries())
            .filter(([_, entry]) => entry.count > 1);
        
        const totalDuplicates = duplicateTimestamps.reduce((sum, [_, entry]) => sum + (entry.count - 1), 0);
        const maxDuplicates = Math.max(...Array.from(this.timestampCounts.values()).map(entry => entry.count), 0);
        
        return {
            totalTimestamps: this.timestampCounts.size,
            duplicateTimestamps: duplicateTimestamps.length,
            totalDuplicateEntries: totalDuplicates,
            maxDuplicatesForSingleTimestamp: maxDuplicates,
            averageDuplicatesPerTimestamp: duplicateTimestamps.length > 0 
                ? (totalDuplicates / duplicateTimestamps.length).toFixed(2) 
                : 0,
            consolidationStats: { ...this.consolidationStats }
        };
    }

    /**
     * Generate comprehensive duplicate report
     * @param {number} topN - Number of top duplicates to include in report
     * @returns {Object} Detailed duplicate report
     */
    generateDuplicateReport(topN = 10) {
        const stats = this.getDuplicateStats();
        const duplicateTimestamps = Array.from(this.timestampCounts.entries())
            .filter(([_, entry]) => entry.count > 1)
            .sort(([_, a], [__, b]) => b.count - a.count)
            .slice(0, topN);
        
        const report = {
            summary: stats,
            topDuplicates: duplicateTimestamps.map(([timestamp, entry]) => ({
                timestamp,
                count: entry.count,
                duplicatesEliminated: entry.count - 1,
                firstSeen: entry.firstSeen,
                lastSeen: entry.lastSeen,
                sources: this.config.trackSources ? entry.sources.map(s => s.source) : [],
                filePaths: this.config.trackSources ? entry.sources.map(s => s.filePath).filter(Boolean) : []
            })),
            consolidationPatterns: this.duplicatePatterns.slice(-topN),
            recommendations: this.generateRecommendations(stats)
        };
        
        return report;
    }

    /**
     * Generate recommendations based on duplicate patterns
     * @param {Object} stats - Duplicate statistics
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(stats) {
        const recommendations = [];
        
        if (stats.duplicateTimestamps > 0) {
            recommendations.push({
                type: 'CONSOLIDATION_NEEDED',
                priority: 'HIGH',
                message: `Found ${stats.duplicateTimestamps} timestamps with duplicates. Consider implementing timestamp consolidation.`,
                impact: `Could eliminate ${stats.totalDuplicateEntries} duplicate entries`
            });
        }
        
        if (stats.maxDuplicatesForSingleTimestamp > 10) {
            recommendations.push({
                type: 'EXCESSIVE_DUPLICATES',
                priority: 'CRITICAL',
                message: `Single timestamp has ${stats.maxDuplicatesForSingleTimestamp} duplicates. This indicates a serious issue.`,
                impact: 'Severe performance degradation and memory waste'
            });
        }
        
        if (stats.consolidationStats.duplicatesEliminated > 0) {
            recommendations.push({
                type: 'CONSOLIDATION_SUCCESS',
                priority: 'INFO',
                message: `Successfully eliminated ${stats.consolidationStats.duplicatesEliminated} duplicate entries through consolidation.`,
                impact: 'Improved performance and reduced memory usage'
            });
        }
        
        return recommendations;
    }

    /**
     * Check if timestamp is a duplicate
     * @param {Date|string} timestamp - Timestamp to check
     * @returns {Object} Duplicate check result
     */
    isDuplicate(timestamp) {
        const timestampKey = new Date(timestamp).toISOString();
        const entry = this.timestampCounts.get(timestampKey);
        
        if (!entry) {
            return { isDuplicate: false, count: 0 };
        }
        
        return {
            isDuplicate: entry.count > 1,
            count: entry.count,
            firstSeen: entry.firstSeen,
            lastSeen: entry.lastSeen
        };
    }

    /**
     * Reset monitoring data
     */
    reset() {
        this.timestampCounts.clear();
        this.duplicatePatterns = [];
        this.consolidationStats = {
            originalEntries: 0,
            consolidatedEntries: 0,
            duplicatesEliminated: 0,
            timestampsProcessed: 0
        };
        this.logger.info('Duplicate monitor reset');
    }

    /**
     * Export monitoring data for analysis
     * @returns {Object} Exportable monitoring data
     */
    exportData() {
        return {
            timestampCounts: Object.fromEntries(this.timestampCounts),
            duplicatePatterns: this.duplicatePatterns,
            consolidationStats: this.consolidationStats,
            exportedAt: new Date().toISOString()
        };
    }
}

/**
 * Timeline Performance Monitor
 * Tracks memory usage and processing metrics
 */
export class TimelinePerformanceMonitor {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ prefix: 'PERF-MONITOR' });
        this.metrics = {
            startTime: null,
            endTime: null,
            memorySnapshots: [],
            processingSteps: [],
            operationTimings: new Map(),
            errorCounts: new Map()
        };
        
        this.config = {
            memorySnapshotInterval: options.memorySnapshotInterval || 1000, // ms
            maxSnapshots: options.maxSnapshots || 100,
            trackGarbageCollection: options.trackGarbageCollection !== false
        };
        
        this.memoryTimer = null;
    }

    /**
     * Start performance monitoring
     * @param {string} operationName - Name of the operation being monitored
     */
    startMonitoring(operationName = 'timeline_processing') {
        this.metrics.startTime = performance.now();
        this.metrics.operationName = operationName;
        
        // Take initial memory snapshot
        this.takeMemorySnapshot('start');
        
        // Start periodic memory monitoring
        if (this.config.memorySnapshotInterval > 0) {
            this.memoryTimer = setInterval(() => {
                this.takeMemorySnapshot('periodic');
            }, this.config.memorySnapshotInterval);
        }
        
        this.logger.info(`Started monitoring: ${operationName}`);
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        this.metrics.endTime = performance.now();
        
        // Stop memory monitoring
        if (this.memoryTimer) {
            clearInterval(this.memoryTimer);
            this.memoryTimer = null;
        }
        
        // Take final memory snapshot
        this.takeMemorySnapshot('end');
        
        const duration = this.metrics.endTime - this.metrics.startTime;
        this.logger.info(`Stopped monitoring. Duration: ${duration.toFixed(2)}ms`);
    }

    /**
     * Take a memory usage snapshot
     * @param {string} label - Label for the snapshot
     */
    takeMemorySnapshot(label = 'snapshot') {
        const memoryUsage = process.memoryUsage();
        const snapshot = {
            timestamp: performance.now(),
            label,
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers
            }
        };
        
        this.metrics.memorySnapshots.push(snapshot);
        
        // Limit snapshot history
        if (this.metrics.memorySnapshots.length > this.config.maxSnapshots) {
            this.metrics.memorySnapshots.shift();
        }
        
        this.logger.trace(`Memory snapshot (${label}): ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB heap used`);
    }

    /**
     * Record a processing step
     * @param {string} stepName - Name of the processing step
     * @param {Object} stepMetrics - Metrics for the step
     */
    recordStep(stepName, stepMetrics = {}) {
        const step = {
            name: stepName,
            timestamp: performance.now(),
            metrics: stepMetrics
        };
        
        this.metrics.processingSteps.push(step);
        this.logger.debug(`Processing step: ${stepName}`, stepMetrics);
    }

    /**
     * Start timing an operation
     * @param {string} operationName - Name of the operation
     */
    startTiming(operationName) {
        this.metrics.operationTimings.set(operationName, {
            startTime: performance.now(),
            endTime: null,
            duration: null
        });
        
        this.logger.trace(`Started timing: ${operationName}`);
    }

    /**
     * End timing an operation
     * @param {string} operationName - Name of the operation
     * @returns {number} Duration in milliseconds
     */
    endTiming(operationName) {
        const timing = this.metrics.operationTimings.get(operationName);
        if (!timing) {
            this.logger.warn(`No timing found for operation: ${operationName}`);
            return 0;
        }
        
        timing.endTime = performance.now();
        timing.duration = timing.endTime - timing.startTime;
        
        this.logger.debug(`Completed timing: ${operationName} (${timing.duration.toFixed(2)}ms)`);
        return timing.duration;
    }

    /**
     * Record an error occurrence
     * @param {string} errorType - Type of error
     * @param {string} errorMessage - Error message
     */
    recordError(errorType, errorMessage) {
        const count = this.metrics.errorCounts.get(errorType) || 0;
        this.metrics.errorCounts.set(errorType, count + 1);
        
        this.logger.error(`Error recorded: ${errorType} - ${errorMessage}`);
    }

    /**
     * Generate performance report
     * @returns {Object} Comprehensive performance report
     */
    generateReport() {
        const duration = (this.metrics.endTime || performance.now()) - (this.metrics.startTime || 0);
        const memoryStats = this.calculateMemoryStats();
        const timingStats = this.calculateTimingStats();
        
        return {
            summary: {
                operationName: this.metrics.operationName,
                totalDuration: `${duration.toFixed(2)}ms`,
                processingSteps: this.metrics.processingSteps.length,
                memorySnapshots: this.metrics.memorySnapshots.length,
                operationTimings: this.metrics.operationTimings.size,
                errorCount: Array.from(this.metrics.errorCounts.values()).reduce((sum, count) => sum + count, 0)
            },
            memory: memoryStats,
            timings: timingStats,
            steps: this.metrics.processingSteps,
            errors: Object.fromEntries(this.metrics.errorCounts),
            recommendations: this.generatePerformanceRecommendations(memoryStats, timingStats)
        };
    }

    /**
     * Calculate memory usage statistics
     * @returns {Object} Memory statistics
     */
    calculateMemoryStats() {
        if (this.metrics.memorySnapshots.length === 0) {
            return { noData: true };
        }
        
        const snapshots = this.metrics.memorySnapshots;
        const heapUsages = snapshots.map(s => s.memory.heapUsed);
        
        return {
            initial: snapshots[0].memory,
            final: snapshots[snapshots.length - 1].memory,
            peak: {
                heapUsed: Math.max(...heapUsages),
                timestamp: snapshots[heapUsages.indexOf(Math.max(...heapUsages))].timestamp
            },
            average: {
                heapUsed: heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length
            },
            growth: {
                heapUsed: snapshots[snapshots.length - 1].memory.heapUsed - snapshots[0].memory.heapUsed
            }
        };
    }

    /**
     * Calculate timing statistics
     * @returns {Object} Timing statistics
     */
    calculateTimingStats() {
        const timings = Array.from(this.metrics.operationTimings.entries())
            .filter(([_, timing]) => timing.duration !== null)
            .map(([name, timing]) => ({ name, duration: timing.duration }));
        
        if (timings.length === 0) {
            return { noData: true };
        }
        
        const durations = timings.map(t => t.duration);
        const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
        
        return {
            operations: timings,
            totalDuration,
            averageDuration: totalDuration / timings.length,
            slowestOperation: timings.reduce((slowest, current) => 
                current.duration > slowest.duration ? current : slowest
            ),
            fastestOperation: timings.reduce((fastest, current) => 
                current.duration < fastest.duration ? current : fastest
            )
        };
    }

    /**
     * Generate performance recommendations
     * @param {Object} memoryStats - Memory statistics
     * @param {Object} timingStats - Timing statistics
     * @returns {Array} Performance recommendations
     */
    generatePerformanceRecommendations(memoryStats, timingStats) {
        const recommendations = [];
        
        if (memoryStats.growth && memoryStats.growth.heapUsed > 100 * 1024 * 1024) { // 100MB
            recommendations.push({
                type: 'MEMORY_GROWTH',
                priority: 'HIGH',
                message: `High memory growth detected: ${(memoryStats.growth.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                suggestion: 'Consider implementing memory cleanup or reducing data retention'
            });
        }
        
        if (timingStats.slowestOperation && timingStats.slowestOperation.duration > 5000) { // 5 seconds
            recommendations.push({
                type: 'SLOW_OPERATION',
                priority: 'MEDIUM',
                message: `Slow operation detected: ${timingStats.slowestOperation.name} (${timingStats.slowestOperation.duration.toFixed(2)}ms)`,
                suggestion: 'Consider optimizing or breaking down this operation'
            });
        }
        
        return recommendations;
    }

    /**
     * Reset performance monitoring data
     */
    reset() {
        this.metrics = {
            startTime: null,
            endTime: null,
            memorySnapshots: [],
            processingSteps: [],
            operationTimings: new Map(),
            errorCounts: new Map()
        };
        
        if (this.memoryTimer) {
            clearInterval(this.memoryTimer);
            this.memoryTimer = null;
        }
        
        this.logger.info('Performance monitor reset');
    }
}
