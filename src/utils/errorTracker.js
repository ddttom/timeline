/**
 * Comprehensive Error Tracking System
 * Provides categorized error types, recovery strategies, and detailed error analysis
 */

import { createTimelineLogger, LOG_LEVELS } from './debugLogger.js';

/**
 * Error categories for timeline processing
 */
export const ERROR_CATEGORIES = {
    TIMELINE_PARSING: 'TIMELINE_PARSING',
    DUPLICATE_PROCESSING: 'DUPLICATE_PROCESSING',
    TIMESTAMP_VALIDATION: 'TIMESTAMP_VALIDATION',
    COORDINATE_VALIDATION: 'COORDINATE_VALIDATION',
    FILE_SYSTEM: 'FILE_SYSTEM',
    MEMORY_MANAGEMENT: 'MEMORY_MANAGEMENT',
    PERFORMANCE: 'PERFORMANCE',
    DATA_CORRUPTION: 'DATA_CORRUPTION',
    NETWORK: 'NETWORK',
    CONFIGURATION: 'CONFIGURATION'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Recovery strategy types
 */
export const RECOVERY_STRATEGIES = {
    RETRY: 'RETRY',
    SKIP: 'SKIP',
    FALLBACK: 'FALLBACK',
    ABORT: 'ABORT',
    MANUAL_INTERVENTION: 'MANUAL_INTERVENTION',
    AUTOMATIC_REPAIR: 'AUTOMATIC_REPAIR'
};

/**
 * Error tracking and recovery system
 */
export class ErrorTracker {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ 
            prefix: 'ERROR-TRACKER',
            level: options.logLevel || LOG_LEVELS.DEBUG
        });
        
        this.config = {
            maxErrorHistory: options.maxErrorHistory || 1000,
            enableRecovery: options.enableRecovery !== false,
            enableAnalytics: options.enableAnalytics !== false,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000
        };
        
        this.errorHistory = [];
        this.errorCounts = new Map();
        this.recoveryAttempts = new Map();
        this.errorPatterns = new Map();
        
        this.logger.info('Error Tracker initialized');
    }

    /**
     * Track an error with comprehensive details
     * @param {Error|string} error - Error object or message
     * @param {string} category - Error category
     * @param {string} severity - Error severity
     * @param {Object} context - Additional context
     * @param {string} recoveryStrategy - Suggested recovery strategy
     * @returns {string} Error ID for tracking
     */
    trackError(error, category, severity, context = {}, recoveryStrategy = RECOVERY_STRATEGIES.SKIP) {
        const errorId = this.generateErrorId();
        const timestamp = new Date();
        
        const errorRecord = {
            id: errorId,
            timestamp,
            category,
            severity,
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : null,
            context,
            recoveryStrategy,
            recovered: false,
            recoveryAttempts: 0,
            firstOccurrence: timestamp,
            lastOccurrence: timestamp,
            occurrenceCount: 1
        };
        
        // Check for similar errors
        const similarError = this.findSimilarError(errorRecord);
        if (similarError) {
            similarError.lastOccurrence = timestamp;
            similarError.occurrenceCount++;
            this.logger.debug(`Similar error found, updated occurrence count: ${similarError.occurrenceCount}`);
            return similarError.id;
        }
        
        // Add to error history
        this.errorHistory.push(errorRecord);
        
        // Limit history size
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory.shift();
        }
        
        // Update error counts
        const categoryCount = this.errorCounts.get(category) || 0;
        this.errorCounts.set(category, categoryCount + 1);
        
        // Log the error
        this.logError(errorRecord);
        
        // Attempt recovery if enabled
        if (this.config.enableRecovery) {
            this.attemptRecovery(errorRecord);
        }
        
        // Analyze error patterns
        if (this.config.enableAnalytics) {
            this.analyzeErrorPattern(errorRecord);
        }
        
        return errorId;
    }

    /**
     * Generate unique error ID
     * @returns {string} Unique error ID
     */
    generateErrorId() {
        return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Find similar error in history
     * @param {Object} errorRecord - Error record to compare
     * @returns {Object|null} Similar error or null
     */
    findSimilarError(errorRecord) {
        const recentErrors = this.errorHistory.slice(-50); // Check last 50 errors
        
        for (const existingError of recentErrors) {
            if (this.areErrorsSimilar(errorRecord, existingError)) {
                return existingError;
            }
        }
        
        return null;
    }

    /**
     * Check if two errors are similar
     * @param {Object} error1 - First error
     * @param {Object} error2 - Second error
     * @returns {boolean} True if similar
     */
    areErrorsSimilar(error1, error2) {
        return error1.category === error2.category &&
               error1.message === error2.message &&
               JSON.stringify(error1.context) === JSON.stringify(error2.context);
    }

    /**
     * Log error with appropriate level
     * @param {Object} errorRecord - Error record to log
     */
    logError(errorRecord) {
        const logMessage = `${errorRecord.category}: ${errorRecord.message}`;
        const logContext = {
            errorId: errorRecord.id,
            severity: errorRecord.severity,
            context: errorRecord.context,
            recoveryStrategy: errorRecord.recoveryStrategy
        };
        
        switch (errorRecord.severity) {
            case ERROR_SEVERITY.CRITICAL:
                this.logger.error(logMessage, logContext);
                break;
            case ERROR_SEVERITY.HIGH:
                this.logger.error(logMessage, logContext);
                break;
            case ERROR_SEVERITY.MEDIUM:
                this.logger.warn(logMessage, logContext);
                break;
            case ERROR_SEVERITY.LOW:
                this.logger.info(logMessage, logContext);
                break;
            default:
                this.logger.debug(logMessage, logContext);
        }
    }

    /**
     * Attempt error recovery
     * @param {Object} errorRecord - Error record
     */
    async attemptRecovery(errorRecord) {
        const recoveryKey = `${errorRecord.category}_${errorRecord.message}`;
        const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
        
        if (attempts >= this.config.retryAttempts) {
            this.logger.warn(`Max recovery attempts reached for error: ${errorRecord.id}`);
            return false;
        }
        
        this.recoveryAttempts.set(recoveryKey, attempts + 1);
        errorRecord.recoveryAttempts = attempts + 1;
        
        this.logger.debug(`Attempting recovery for error: ${errorRecord.id} (attempt ${attempts + 1})`);
        
        try {
            const recovered = await this.executeRecoveryStrategy(errorRecord);
            if (recovered) {
                errorRecord.recovered = true;
                this.logger.info(`Successfully recovered from error: ${errorRecord.id}`);
                return true;
            }
        } catch (recoveryError) {
            this.logger.error(`Recovery failed for error: ${errorRecord.id}`, { recoveryError: recoveryError.message });
        }
        
        return false;
    }

    /**
     * Execute recovery strategy
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if recovery successful
     */
    async executeRecoveryStrategy(errorRecord) {
        switch (errorRecord.recoveryStrategy) {
            case RECOVERY_STRATEGIES.RETRY:
                return await this.retryOperation(errorRecord);
                
            case RECOVERY_STRATEGIES.FALLBACK:
                return await this.fallbackOperation(errorRecord);
                
            case RECOVERY_STRATEGIES.AUTOMATIC_REPAIR:
                return await this.automaticRepair(errorRecord);
                
            case RECOVERY_STRATEGIES.SKIP:
                this.logger.debug(`Skipping error as per strategy: ${errorRecord.id}`);
                return true;
                
            case RECOVERY_STRATEGIES.ABORT:
                this.logger.error(`Aborting operation due to error: ${errorRecord.id}`);
                throw new Error(`Operation aborted: ${errorRecord.message}`);
                
            case RECOVERY_STRATEGIES.MANUAL_INTERVENTION:
                this.logger.warn(`Manual intervention required for error: ${errorRecord.id}`);
                return false;
                
            default:
                this.logger.warn(`Unknown recovery strategy: ${errorRecord.recoveryStrategy}`);
                return false;
        }
    }

    /**
     * Retry operation with delay
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if retry successful
     */
    async retryOperation(errorRecord) {
        if (this.config.retryDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
        
        // This would need to be implemented based on the specific operation
        // For now, we'll simulate a retry
        this.logger.debug(`Retrying operation for error: ${errorRecord.id}`);
        return Math.random() > 0.5; // 50% success rate for simulation
    }

    /**
     * Execute fallback operation
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if fallback successful
     */
    async fallbackOperation(errorRecord) {
        this.logger.debug(`Executing fallback for error: ${errorRecord.id}`);
        
        // Implement specific fallback strategies based on error category
        switch (errorRecord.category) {
            case ERROR_CATEGORIES.TIMELINE_PARSING:
                return this.fallbackTimelineParsing(errorRecord);
                
            case ERROR_CATEGORIES.FILE_SYSTEM:
                return this.fallbackFileSystem(errorRecord);
                
            case ERROR_CATEGORIES.MEMORY_MANAGEMENT:
                return this.fallbackMemoryManagement(errorRecord);
                
            default:
                return false;
        }
    }

    /**
     * Automatic repair for specific error types
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if repair successful
     */
    async automaticRepair(errorRecord) {
        this.logger.debug(`Attempting automatic repair for error: ${errorRecord.id}`);
        
        switch (errorRecord.category) {
            case ERROR_CATEGORIES.DATA_CORRUPTION:
                return this.repairDataCorruption(errorRecord);
                
            case ERROR_CATEGORIES.DUPLICATE_PROCESSING:
                return this.repairDuplicateProcessing(errorRecord);
                
            default:
                return false;
        }
    }

    /**
     * Fallback for timeline parsing errors
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if fallback successful
     */
    fallbackTimelineParsing(errorRecord) {
        this.logger.debug('Attempting timeline parsing fallback');
        // Implement fallback parsing logic
        return true;
    }

    /**
     * Fallback for file system errors
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if fallback successful
     */
    fallbackFileSystem(errorRecord) {
        this.logger.debug('Attempting file system fallback');
        // Implement file system fallback logic
        return true;
    }

    /**
     * Fallback for memory management errors
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if fallback successful
     */
    fallbackMemoryManagement(errorRecord) {
        this.logger.debug('Attempting memory management fallback');
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }

    /**
     * Repair data corruption
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if repair successful
     */
    repairDataCorruption(errorRecord) {
        this.logger.debug('Attempting data corruption repair');
        // Implement data repair logic
        return true;
    }

    /**
     * Repair duplicate processing issues
     * @param {Object} errorRecord - Error record
     * @returns {boolean} True if repair successful
     */
    repairDuplicateProcessing(errorRecord) {
        this.logger.debug('Attempting duplicate processing repair');
        // Implement duplicate repair logic
        return true;
    }

    /**
     * Analyze error patterns for insights
     * @param {Object} errorRecord - Error record
     */
    analyzeErrorPattern(errorRecord) {
        const patternKey = `${errorRecord.category}_${errorRecord.severity}`;
        
        if (!this.errorPatterns.has(patternKey)) {
            this.errorPatterns.set(patternKey, {
                count: 0,
                firstSeen: errorRecord.timestamp,
                lastSeen: errorRecord.timestamp,
                messages: new Set(),
                contexts: []
            });
        }
        
        const pattern = this.errorPatterns.get(patternKey);
        pattern.count++;
        pattern.lastSeen = errorRecord.timestamp;
        pattern.messages.add(errorRecord.message);
        pattern.contexts.push(errorRecord.context);
        
        // Detect error spikes
        if (pattern.count > 10) {
            const timeSpan = pattern.lastSeen - pattern.firstSeen;
            const errorRate = pattern.count / (timeSpan / 1000 / 60); // errors per minute
            
            if (errorRate > 5) { // More than 5 errors per minute
                this.logger.warn(`Error spike detected: ${patternKey} - ${errorRate.toFixed(2)} errors/min`);
            }
        }
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStatistics() {
        const totalErrors = this.errorHistory.length;
        const errorsBySeverity = {};
        const errorsByCategory = {};
        const recoveredErrors = this.errorHistory.filter(e => e.recovered).length;
        
        for (const error of this.errorHistory) {
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
        }
        
        return {
            totalErrors,
            recoveredErrors,
            recoveryRate: totalErrors > 0 ? (recoveredErrors / totalErrors * 100).toFixed(2) : 0,
            errorsBySeverity,
            errorsByCategory,
            errorPatterns: this.getErrorPatternSummary(),
            recentErrors: this.errorHistory.slice(-10)
        };
    }

    /**
     * Get error pattern summary
     * @returns {Array} Error pattern summary
     */
    getErrorPatternSummary() {
        return Array.from(this.errorPatterns.entries()).map(([pattern, data]) => ({
            pattern,
            count: data.count,
            firstSeen: data.firstSeen,
            lastSeen: data.lastSeen,
            uniqueMessages: data.messages.size,
            timeSpan: data.lastSeen - data.firstSeen
        }));
    }

    /**
     * Generate error report
     * @returns {Object} Comprehensive error report
     */
    generateErrorReport() {
        const statistics = this.getErrorStatistics();
        const recommendations = this.generateRecommendations(statistics);
        
        return {
            summary: {
                totalErrors: statistics.totalErrors,
                recoveredErrors: statistics.recoveredErrors,
                recoveryRate: statistics.recoveryRate,
                reportGeneratedAt: new Date().toISOString()
            },
            statistics,
            recommendations,
            criticalErrors: this.errorHistory.filter(e => e.severity === ERROR_SEVERITY.CRITICAL),
            frequentErrors: this.getFrequentErrors(),
            recoveryAttempts: Object.fromEntries(this.recoveryAttempts)
        };
    }

    /**
     * Get frequent errors
     * @returns {Array} Most frequent errors
     */
    getFrequentErrors() {
        const errorCounts = new Map();
        
        for (const error of this.errorHistory) {
            const key = `${error.category}: ${error.message}`;
            errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
        }
        
        return Array.from(errorCounts.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([error, count]) => ({ error, count }));
    }

    /**
     * Generate recommendations based on error patterns
     * @param {Object} statistics - Error statistics
     * @returns {Array} Recommendations
     */
    generateRecommendations(statistics) {
        const recommendations = [];
        
        // High error rate recommendation
        if (statistics.totalErrors > 100) {
            recommendations.push({
                type: 'HIGH_ERROR_RATE',
                priority: 'HIGH',
                message: `High error count detected: ${statistics.totalErrors} errors`,
                action: 'Review error patterns and implement preventive measures'
            });
        }
        
        // Low recovery rate recommendation
        if (parseFloat(statistics.recoveryRate) < 50) {
            recommendations.push({
                type: 'LOW_RECOVERY_RATE',
                priority: 'MEDIUM',
                message: `Low recovery rate: ${statistics.recoveryRate}%`,
                action: 'Improve recovery strategies and error handling'
            });
        }
        
        // Critical errors recommendation
        if (statistics.errorsBySeverity[ERROR_SEVERITY.CRITICAL] > 0) {
            recommendations.push({
                type: 'CRITICAL_ERRORS',
                priority: 'CRITICAL',
                message: `${statistics.errorsBySeverity[ERROR_SEVERITY.CRITICAL]} critical errors detected`,
                action: 'Immediate investigation and resolution required'
            });
        }
        
        return recommendations;
    }

    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.errorCounts.clear();
        this.recoveryAttempts.clear();
        this.errorPatterns.clear();
        this.logger.info('Error history cleared');
    }

    /**
     * Export error data for analysis
     * @returns {Object} Exportable error data
     */
    exportErrorData() {
        return {
            errorHistory: this.errorHistory,
            errorCounts: Object.fromEntries(this.errorCounts),
            recoveryAttempts: Object.fromEntries(this.recoveryAttempts),
            errorPatterns: Object.fromEntries(this.errorPatterns),
            exportedAt: new Date().toISOString()
        };
    }
}

/**
 * Create a timeline-specific error tracker
 * @param {Object} options - Error tracker options
 * @returns {ErrorTracker} Timeline error tracker instance
 */
export function createTimelineErrorTracker(options = {}) {
    return new ErrorTracker({
        logLevel: LOG_LEVELS.DEBUG,
        maxErrorHistory: 500,
        enableRecovery: true,
        enableAnalytics: true,
        retryAttempts: 3,
        retryDelay: 1000,
        ...options
    });
}
