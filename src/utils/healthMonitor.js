/**
 * Timeline Health Monitoring Dashboard
 * Real-time metrics and health monitoring for timeline processing
 */

import { createTimelineLogger, LOG_LEVELS } from './debugLogger.js';
import { TimelineDuplicateMonitor, TimelinePerformanceMonitor } from './timelineMonitors.js';
import { TimelineValidator } from './timelineValidator.js';
import { createTimelineErrorTracker } from './errorTracker.js';

/**
 * Health status levels
 */
export const HEALTH_STATUS = {
    EXCELLENT: 'EXCELLENT',
    GOOD: 'GOOD',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Metric types for monitoring
 */
export const METRIC_TYPES = {
    PROCESSING_SPEED: 'PROCESSING_SPEED',
    MEMORY_USAGE: 'MEMORY_USAGE',
    ERROR_RATE: 'ERROR_RATE',
    DUPLICATE_RATE: 'DUPLICATE_RATE',
    SUCCESS_RATE: 'SUCCESS_RATE',
    VALIDATION_SCORE: 'VALIDATION_SCORE',
    THROUGHPUT: 'THROUGHPUT'
};

/**
 * Timeline Health Monitor
 * Provides real-time monitoring and health assessment
 */
export class TimelineHealthMonitor {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ 
            prefix: 'HEALTH-MONITOR',
            level: options.logLevel || LOG_LEVELS.INFO
        });
        
        this.config = {
            updateInterval: options.updateInterval || 5000, // 5 seconds
            historySize: options.historySize || 100,
            alertThresholds: {
                errorRate: options.errorRateThreshold || 10, // 10%
                memoryUsage: options.memoryThreshold || 500 * 1024 * 1024, // 500MB
                processingSpeed: options.speedThreshold || 1000, // 1 second
                duplicateRate: options.duplicateThreshold || 20 // 20%
            },
            enableAlerts: options.enableAlerts !== false,
            enableDashboard: options.enableDashboard !== false
        };
        
        // Initialize monitoring components
        this.duplicateMonitor = new TimelineDuplicateMonitor();
        this.performanceMonitor = new TimelinePerformanceMonitor();
        this.validator = new TimelineValidator();
        this.errorTracker = createTimelineErrorTracker();
        
        // Health metrics storage
        this.metrics = new Map();
        this.healthHistory = [];
        this.alerts = [];
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // Initialize metrics
        this.initializeMetrics();
        
        this.logger.info('Timeline Health Monitor initialized');
    }

    /**
     * Initialize health metrics
     */
    initializeMetrics() {
        for (const metricType of Object.values(METRIC_TYPES)) {
            this.metrics.set(metricType, {
                current: 0,
                history: [],
                trend: 'stable',
                status: HEALTH_STATUS.UNKNOWN,
                lastUpdated: new Date()
            });
        }
    }

    /**
     * Start health monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) {
            this.logger.warn('Health monitoring is already running');
            return;
        }
        
        this.isMonitoring = true;
        this.logger.info('Starting health monitoring');
        
        // Start periodic health checks
        this.monitoringInterval = setInterval(() => {
            this.updateHealthMetrics();
        }, this.config.updateInterval);
        
        // Initial health check
        this.updateHealthMetrics();
    }

    /**
     * Stop health monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.logger.info('Health monitoring stopped');
    }

    /**
     * Update all health metrics
     */
    updateHealthMetrics() {
        try {
            this.updateProcessingSpeedMetric();
            this.updateMemoryUsageMetric();
            this.updateErrorRateMetric();
            this.updateDuplicateRateMetric();
            this.updateSuccessRateMetric();
            this.updateValidationScoreMetric();
            this.updateThroughputMetric();
            
            // Calculate overall health status
            const overallHealth = this.calculateOverallHealth();
            
            // Store health snapshot
            this.storeHealthSnapshot(overallHealth);
            
            // Check for alerts
            if (this.config.enableAlerts) {
                this.checkAlerts();
            }
            
            // Log health status
            this.logger.debug(`Health check completed - Status: ${overallHealth.status}`);
            
        } catch (error) {
            this.logger.error(`Health monitoring update failed: ${error.message}`);
            this.errorTracker.trackError(error, 'HEALTH_MONITORING', 'HIGH');
        }
    }

    /**
     * Update processing speed metric
     */
    updateProcessingSpeedMetric() {
        const performanceReport = this.performanceMonitor.generateReport();
        let processingSpeed = 0;
        
        if (performanceReport.timings && !performanceReport.timings.noData) {
            processingSpeed = performanceReport.timings.averageDuration || 0;
        }
        
        this.updateMetric(METRIC_TYPES.PROCESSING_SPEED, processingSpeed, 'ms');
    }

    /**
     * Update memory usage metric
     */
    updateMemoryUsageMetric() {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed;
        
        this.updateMetric(METRIC_TYPES.MEMORY_USAGE, heapUsed, 'bytes');
    }

    /**
     * Update error rate metric
     */
    updateErrorRateMetric() {
        const errorStats = this.errorTracker.getErrorStatistics();
        const errorRate = errorStats.totalErrors > 0 ? 
            ((errorStats.totalErrors - errorStats.recoveredErrors) / errorStats.totalErrors * 100) : 0;
        
        this.updateMetric(METRIC_TYPES.ERROR_RATE, errorRate, '%');
    }

    /**
     * Update duplicate rate metric
     */
    updateDuplicateRateMetric() {
        const duplicateStats = this.duplicateMonitor.getDuplicateStats();
        const duplicateRate = duplicateStats.totalTimestamps > 0 ? 
            (duplicateStats.duplicateTimestamps / duplicateStats.totalTimestamps * 100) : 0;
        
        this.updateMetric(METRIC_TYPES.DUPLICATE_RATE, duplicateRate, '%');
    }

    /**
     * Update success rate metric
     */
    updateSuccessRateMetric() {
        const errorStats = this.errorTracker.getErrorStatistics();
        const successRate = errorStats.totalErrors > 0 ? 
            parseFloat(errorStats.recoveryRate) : 100;
        
        this.updateMetric(METRIC_TYPES.SUCCESS_RATE, successRate, '%');
    }

    /**
     * Update validation score metric
     */
    updateValidationScoreMetric() {
        // This would be updated when validation runs
        // For now, we'll use a placeholder
        const validationScore = 85; // Placeholder score
        
        this.updateMetric(METRIC_TYPES.VALIDATION_SCORE, validationScore, 'score');
    }

    /**
     * Update throughput metric
     */
    updateThroughputMetric() {
        const performanceReport = this.performanceMonitor.generateReport();
        let throughput = 0;
        
        if (performanceReport.summary && performanceReport.summary.totalDuration) {
            const durationSeconds = parseFloat(performanceReport.summary.totalDuration.replace('ms', '')) / 1000;
            const recordsProcessed = performanceReport.summary.processingSteps || 0;
            throughput = durationSeconds > 0 ? (recordsProcessed / durationSeconds) : 0;
        }
        
        this.updateMetric(METRIC_TYPES.THROUGHPUT, throughput, 'records/sec');
    }

    /**
     * Update a specific metric
     * @param {string} metricType - Type of metric
     * @param {number} value - Current value
     * @param {string} unit - Unit of measurement
     */
    updateMetric(metricType, value, unit = '') {
        const metric = this.metrics.get(metricType);
        if (!metric) return;
        
        const previousValue = metric.current;
        metric.current = value;
        metric.unit = unit;
        metric.lastUpdated = new Date();
        
        // Add to history
        metric.history.push({
            value,
            timestamp: new Date()
        });
        
        // Limit history size
        if (metric.history.length > this.config.historySize) {
            metric.history.shift();
        }
        
        // Calculate trend
        metric.trend = this.calculateTrend(metric.history);
        
        // Determine status
        metric.status = this.determineMetricStatus(metricType, value);
        
        // Log significant changes
        if (Math.abs(value - previousValue) > this.getSignificantChangeThreshold(metricType)) {
            this.logger.debug(`Significant change in ${metricType}: ${previousValue} -> ${value} ${unit}`);
        }
    }

    /**
     * Calculate trend from history
     * @param {Array} history - Metric history
     * @returns {string} Trend direction
     */
    calculateTrend(history) {
        if (history.length < 2) return 'stable';
        
        const recent = history.slice(-5); // Last 5 values
        if (recent.length < 2) return 'stable';
        
        const first = recent[0].value;
        const last = recent[recent.length - 1].value;
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    /**
     * Determine metric status based on thresholds
     * @param {string} metricType - Type of metric
     * @param {number} value - Current value
     * @returns {string} Health status
     */
    determineMetricStatus(metricType, value) {
        const thresholds = this.config.alertThresholds;
        
        switch (metricType) {
            case METRIC_TYPES.ERROR_RATE:
                if (value > thresholds.errorRate * 2) return HEALTH_STATUS.CRITICAL;
                if (value > thresholds.errorRate) return HEALTH_STATUS.WARNING;
                if (value < 2) return HEALTH_STATUS.EXCELLENT;
                return HEALTH_STATUS.GOOD;
                
            case METRIC_TYPES.MEMORY_USAGE:
                if (value > thresholds.memoryUsage * 2) return HEALTH_STATUS.CRITICAL;
                if (value > thresholds.memoryUsage) return HEALTH_STATUS.WARNING;
                if (value < thresholds.memoryUsage * 0.5) return HEALTH_STATUS.EXCELLENT;
                return HEALTH_STATUS.GOOD;
                
            case METRIC_TYPES.PROCESSING_SPEED:
                if (value > thresholds.processingSpeed * 3) return HEALTH_STATUS.CRITICAL;
                if (value > thresholds.processingSpeed) return HEALTH_STATUS.WARNING;
                if (value < thresholds.processingSpeed * 0.3) return HEALTH_STATUS.EXCELLENT;
                return HEALTH_STATUS.GOOD;
                
            case METRIC_TYPES.DUPLICATE_RATE:
                if (value > thresholds.duplicateRate * 2) return HEALTH_STATUS.CRITICAL;
                if (value > thresholds.duplicateRate) return HEALTH_STATUS.WARNING;
                if (value < 5) return HEALTH_STATUS.EXCELLENT;
                return HEALTH_STATUS.GOOD;
                
            case METRIC_TYPES.SUCCESS_RATE:
                if (value < 50) return HEALTH_STATUS.CRITICAL;
                if (value < 80) return HEALTH_STATUS.WARNING;
                if (value > 95) return HEALTH_STATUS.EXCELLENT;
                return HEALTH_STATUS.GOOD;
                
            default:
                return HEALTH_STATUS.GOOD;
        }
    }

    /**
     * Get significant change threshold for metric type
     * @param {string} metricType - Type of metric
     * @returns {number} Threshold value
     */
    getSignificantChangeThreshold(metricType) {
        switch (metricType) {
            case METRIC_TYPES.ERROR_RATE:
                return 5; // 5%
            case METRIC_TYPES.MEMORY_USAGE:
                return 50 * 1024 * 1024; // 50MB
            case METRIC_TYPES.PROCESSING_SPEED:
                return 500; // 500ms
            case METRIC_TYPES.DUPLICATE_RATE:
                return 10; // 10%
            default:
                return 10;
        }
    }

    /**
     * Calculate overall health status
     * @returns {Object} Overall health assessment
     */
    calculateOverallHealth() {
        const metricStatuses = Array.from(this.metrics.values()).map(m => m.status);
        const statusCounts = {};
        
        for (const status of metricStatuses) {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
        
        // Determine overall status based on worst metric
        let overallStatus = HEALTH_STATUS.EXCELLENT;
        
        if (statusCounts[HEALTH_STATUS.CRITICAL] > 0) {
            overallStatus = HEALTH_STATUS.CRITICAL;
        } else if (statusCounts[HEALTH_STATUS.WARNING] > 0) {
            overallStatus = HEALTH_STATUS.WARNING;
        } else if (statusCounts[HEALTH_STATUS.GOOD] > 0) {
            overallStatus = HEALTH_STATUS.GOOD;
        }
        
        return {
            status: overallStatus,
            timestamp: new Date(),
            metricStatuses: statusCounts,
            score: this.calculateHealthScore(statusCounts)
        };
    }

    /**
     * Calculate numerical health score
     * @param {Object} statusCounts - Count of each status
     * @returns {number} Health score (0-100)
     */
    calculateHealthScore(statusCounts) {
        const weights = {
            [HEALTH_STATUS.EXCELLENT]: 100,
            [HEALTH_STATUS.GOOD]: 80,
            [HEALTH_STATUS.WARNING]: 50,
            [HEALTH_STATUS.CRITICAL]: 20,
            [HEALTH_STATUS.UNKNOWN]: 60
        };
        
        let totalScore = 0;
        let totalMetrics = 0;
        
        for (const [status, count] of Object.entries(statusCounts)) {
            totalScore += weights[status] * count;
            totalMetrics += count;
        }
        
        return totalMetrics > 0 ? Math.round(totalScore / totalMetrics) : 0;
    }

    /**
     * Store health snapshot in history
     * @param {Object} healthSnapshot - Current health snapshot
     */
    storeHealthSnapshot(healthSnapshot) {
        this.healthHistory.push(healthSnapshot);
        
        // Limit history size
        if (this.healthHistory.length > this.config.historySize) {
            this.healthHistory.shift();
        }
    }

    /**
     * Check for alerts based on current metrics
     */
    checkAlerts() {
        const currentTime = new Date();
        
        for (const [metricType, metric] of this.metrics) {
            if (metric.status === HEALTH_STATUS.CRITICAL || metric.status === HEALTH_STATUS.WARNING) {
                const alertId = `${metricType}_${metric.status}_${currentTime.getTime()}`;
                
                const alert = {
                    id: alertId,
                    type: metricType,
                    severity: metric.status,
                    message: this.generateAlertMessage(metricType, metric),
                    value: metric.current,
                    unit: metric.unit,
                    timestamp: currentTime,
                    acknowledged: false
                };
                
                this.alerts.push(alert);
                this.logger.warn(`Health Alert: ${alert.message}`);
                
                // Limit alerts history
                if (this.alerts.length > 100) {
                    this.alerts.shift();
                }
            }
        }
    }

    /**
     * Generate alert message
     * @param {string} metricType - Type of metric
     * @param {Object} metric - Metric data
     * @returns {string} Alert message
     */
    generateAlertMessage(metricType, metric) {
        const value = metric.current;
        const unit = metric.unit || '';
        
        switch (metricType) {
            case METRIC_TYPES.ERROR_RATE:
                return `High error rate detected: ${value.toFixed(2)}${unit}`;
            case METRIC_TYPES.MEMORY_USAGE:
                return `High memory usage: ${(value / 1024 / 1024).toFixed(2)} MB`;
            case METRIC_TYPES.PROCESSING_SPEED:
                return `Slow processing speed: ${value.toFixed(2)}${unit}`;
            case METRIC_TYPES.DUPLICATE_RATE:
                return `High duplicate rate: ${value.toFixed(2)}${unit}`;
            case METRIC_TYPES.SUCCESS_RATE:
                return `Low success rate: ${value.toFixed(2)}${unit}`;
            default:
                return `${metricType} alert: ${value}${unit}`;
        }
    }

    /**
     * Get current health dashboard data
     * @returns {Object} Dashboard data
     */
    getDashboardData() {
        const overallHealth = this.calculateOverallHealth();
        
        return {
            overview: {
                status: overallHealth.status,
                score: overallHealth.score,
                lastUpdated: new Date(),
                isMonitoring: this.isMonitoring
            },
            metrics: Object.fromEntries(
                Array.from(this.metrics.entries()).map(([type, metric]) => [
                    type,
                    {
                        current: metric.current,
                        unit: metric.unit,
                        status: metric.status,
                        trend: metric.trend,
                        lastUpdated: metric.lastUpdated,
                        history: metric.history.slice(-20) // Last 20 data points
                    }
                ])
            ),
            alerts: this.alerts.filter(alert => !alert.acknowledged).slice(-10),
            healthHistory: this.healthHistory.slice(-20),
            recommendations: this.generateHealthRecommendations()
        };
    }

    /**
     * Generate health recommendations
     * @returns {Array} Health recommendations
     */
    generateHealthRecommendations() {
        const recommendations = [];
        
        for (const [metricType, metric] of this.metrics) {
            if (metric.status === HEALTH_STATUS.CRITICAL || metric.status === HEALTH_STATUS.WARNING) {
                recommendations.push({
                    type: metricType,
                    severity: metric.status,
                    recommendation: this.getMetricRecommendation(metricType, metric),
                    priority: metric.status === HEALTH_STATUS.CRITICAL ? 'HIGH' : 'MEDIUM'
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Get recommendation for specific metric
     * @param {string} metricType - Type of metric
     * @param {Object} metric - Metric data
     * @returns {string} Recommendation
     */
    getMetricRecommendation(metricType, metric) {
        switch (metricType) {
            case METRIC_TYPES.ERROR_RATE:
                return 'Review error logs and implement better error handling';
            case METRIC_TYPES.MEMORY_USAGE:
                return 'Optimize memory usage and implement garbage collection';
            case METRIC_TYPES.PROCESSING_SPEED:
                return 'Optimize algorithms and consider parallel processing';
            case METRIC_TYPES.DUPLICATE_RATE:
                return 'Implement better duplicate detection and consolidation';
            case METRIC_TYPES.SUCCESS_RATE:
                return 'Improve error recovery strategies and validation';
            default:
                return 'Monitor metric closely and investigate root causes';
        }
    }

    /**
     * Acknowledge alert
     * @param {string} alertId - Alert ID to acknowledge
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date();
            this.logger.info(`Alert acknowledged: ${alertId}`);
        }
    }

    /**
     * Get health summary
     * @returns {Object} Health summary
     */
    getHealthSummary() {
        const overallHealth = this.calculateOverallHealth();
        const activeAlerts = this.alerts.filter(a => !a.acknowledged).length;
        
        return {
            status: overallHealth.status,
            score: overallHealth.score,
            activeAlerts,
            isMonitoring: this.isMonitoring,
            lastUpdated: new Date(),
            uptime: this.isMonitoring ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Reset health monitor
     */
    reset() {
        this.stopMonitoring();
        this.initializeMetrics();
        this.healthHistory = [];
        this.alerts = [];
        this.logger.info('Health monitor reset');
    }
}

/**
 * Create a timeline health monitor instance
 * @param {Object} options - Monitor options
 * @returns {TimelineHealthMonitor} Health monitor instance
 */
export function createTimelineHealthMonitor(options = {}) {
    return new TimelineHealthMonitor({
        updateInterval: 5000,
        historySize: 100,
        enableAlerts: true,
        enableDashboard: true,
        logLevel: LOG_LEVELS.INFO,
        ...options
    });
}
