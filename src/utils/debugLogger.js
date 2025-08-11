/**
 * Configurable Debug Logger for Timeline Processing
 * Provides comprehensive tracing with configurable verbosity levels
 */

/**
 * Log levels in order of verbosity
 */
export const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

/**
 * Log level names for display
 */
const LOG_LEVEL_NAMES = {
    [LOG_LEVELS.ERROR]: 'ERROR',
    [LOG_LEVELS.WARN]: 'WARN',
    [LOG_LEVELS.INFO]: 'INFO',
    [LOG_LEVELS.DEBUG]: 'DEBUG',
    [LOG_LEVELS.TRACE]: 'TRACE'
};

/**
 * Log level emojis for visual distinction
 */
const LOG_LEVEL_EMOJIS = {
    [LOG_LEVELS.ERROR]: '❌',
    [LOG_LEVELS.WARN]: '⚠️',
    [LOG_LEVELS.INFO]: 'ℹ️',
    [LOG_LEVELS.DEBUG]: '🔍',
    [LOG_LEVELS.TRACE]: '🔬'
};

/**
 * Configurable Debug Logger Class
 */
class DebugLogger {
    constructor(options = {}) {
        this.level = options.level || LOG_LEVELS.INFO;
        this.prefix = options.prefix || 'TIMELINE';
        this.enableTimestamps = options.enableTimestamps !== false;
        this.enableColors = options.enableColors !== false;
        this.maxMessageLength = options.maxMessageLength || 1000;
        this.logCounts = new Map();
        this.suppressDuplicates = options.suppressDuplicates || false;
        this.duplicateThreshold = options.duplicateThreshold || 5;
        
        // Performance tracking
        this.startTime = performance.now();
        this.logMetrics = {
            totalLogs: 0,
            logsByLevel: new Map(),
            suppressedDuplicates: 0
        };
    }

    /**
     * Set the logging level
     * @param {number} level - Log level from LOG_LEVELS
     */
    setLevel(level) {
        this.level = level;
        this.info(`Log level set to ${LOG_LEVEL_NAMES[level]}`);
    }

    /**
     * Check if a log level should be output
     * @param {number} level - Log level to check
     * @returns {boolean} True if should log
     */
    shouldLog(level) {
        return level <= this.level;
    }

    /**
     * Format log message with timestamp and prefix
     * @param {number} level - Log level
     * @param {string} message - Log message
     * @returns {string} Formatted message
     */
    formatMessage(level, message) {
        const parts = [];
        
        if (this.enableTimestamps) {
            const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(3);
            parts.push(`[${elapsed}s]`);
        }
        
        const emoji = LOG_LEVEL_EMOJIS[level];
        const levelName = LOG_LEVEL_NAMES[level];
        parts.push(`${emoji} ${this.prefix}:${levelName}`);
        
        // Truncate long messages
        const truncatedMessage = message.length > this.maxMessageLength 
            ? message.substring(0, this.maxMessageLength) + '...'
            : message;
            
        parts.push(truncatedMessage);
        
        return parts.join(' ');
    }

    /**
     * Check for duplicate messages and suppress if needed
     * @param {string} message - Message to check
     * @returns {boolean} True if should suppress
     */
    shouldSuppressDuplicate(message) {
        if (!this.suppressDuplicates) return false;
        
        const count = this.logCounts.get(message) || 0;
        this.logCounts.set(message, count + 1);
        
        if (count >= this.duplicateThreshold) {
            this.logMetrics.suppressedDuplicates++;
            return true;
        }
        
        return false;
    }

    /**
     * Core logging method
     * @param {number} level - Log level
     * @param {string} message - Message to log
     * @param {Object} data - Optional data object
     */
    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;
        
        if (this.shouldSuppressDuplicate(message)) return;
        
        const formattedMessage = this.formatMessage(level, message);
        
        // Update metrics
        this.logMetrics.totalLogs++;
        const levelCount = this.logMetrics.logsByLevel.get(level) || 0;
        this.logMetrics.logsByLevel.set(level, levelCount + 1);
        
        // Output to appropriate console method
        switch (level) {
            case LOG_LEVELS.ERROR:
                console.error(formattedMessage, data || '');
                break;
            case LOG_LEVELS.WARN:
                console.warn(formattedMessage, data || '');
                break;
            case LOG_LEVELS.INFO:
                console.info(formattedMessage, data || '');
                break;
            case LOG_LEVELS.DEBUG:
            case LOG_LEVELS.TRACE:
                console.log(formattedMessage, data || '');
                break;
        }
    }

    /**
     * Error level logging
     * @param {string} message - Error message
     * @param {Object} data - Optional error data
     */
    error(message, data = null) {
        this.log(LOG_LEVELS.ERROR, message, data);
    }

    /**
     * Warning level logging
     * @param {string} message - Warning message
     * @param {Object} data - Optional warning data
     */
    warn(message, data = null) {
        this.log(LOG_LEVELS.WARN, message, data);
    }

    /**
     * Info level logging
     * @param {string} message - Info message
     * @param {Object} data - Optional info data
     */
    info(message, data = null) {
        this.log(LOG_LEVELS.INFO, message, data);
    }

    /**
     * Debug level logging
     * @param {string} message - Debug message
     * @param {Object} data - Optional debug data
     */
    debug(message, data = null) {
        this.log(LOG_LEVELS.DEBUG, message, data);
    }

    /**
     * Trace level logging
     * @param {string} message - Trace message
     * @param {Object} data - Optional trace data
     */
    trace(message, data = null) {
        this.log(LOG_LEVELS.TRACE, message, data);
    }

    /**
     * Log timeline processing step
     * @param {string} step - Processing step name
     * @param {Object} metrics - Step metrics
     */
    logStep(step, metrics = {}) {
        const message = `Step: ${step}`;
        this.debug(message, metrics);
    }

    /**
     * Log performance timing
     * @param {string} operation - Operation name
     * @param {number} startTime - Start time from performance.now()
     * @param {Object} additionalData - Additional timing data
     */
    logTiming(operation, startTime, additionalData = {}) {
        const duration = performance.now() - startTime;
        const message = `${operation} completed in ${duration.toFixed(2)}ms`;
        this.debug(message, additionalData);
    }

    /**
     * Log duplicate detection event
     * @param {string} type - Type of duplicate (exact, proximity, timestamp)
     * @param {string} identifier - Duplicate identifier
     * @param {Object} details - Duplicate details
     */
    logDuplicate(type, identifier, details = {}) {
        const message = `Duplicate ${type}: ${identifier}`;
        this.trace(message, details);
    }

    /**
     * Get logging statistics
     * @returns {Object} Logging metrics
     */
    getMetrics() {
        const runtime = (performance.now() - this.startTime) / 1000;
        return {
            runtime: `${runtime.toFixed(3)}s`,
            totalLogs: this.logMetrics.totalLogs,
            logsPerSecond: (this.logMetrics.totalLogs / runtime).toFixed(2),
            suppressedDuplicates: this.logMetrics.suppressedDuplicates,
            logsByLevel: Object.fromEntries(
                Array.from(this.logMetrics.logsByLevel.entries()).map(([level, count]) => [
                    LOG_LEVEL_NAMES[level], count
                ])
            ),
            uniqueMessages: this.logCounts.size
        };
    }

    /**
     * Reset logging metrics
     */
    resetMetrics() {
        this.startTime = performance.now();
        this.logMetrics = {
            totalLogs: 0,
            logsByLevel: new Map(),
            suppressedDuplicates: 0
        };
        this.logCounts.clear();
    }

    /**
     * Create a child logger with specific prefix
     * @param {string} childPrefix - Child logger prefix
     * @returns {DebugLogger} Child logger instance
     */
    createChild(childPrefix) {
        return new DebugLogger({
            level: this.level,
            prefix: `${this.prefix}:${childPrefix}`,
            enableTimestamps: this.enableTimestamps,
            enableColors: this.enableColors,
            maxMessageLength: this.maxMessageLength,
            suppressDuplicates: this.suppressDuplicates,
            duplicateThreshold: this.duplicateThreshold
        });
    }
}

/**
 * Default logger instance
 */
export const logger = new DebugLogger({
    level: LOG_LEVELS.INFO,
    prefix: 'TIMELINE',
    suppressDuplicates: true,
    duplicateThreshold: 3
});

/**
 * Create a timeline-specific logger
 * @param {Object} options - Logger options
 * @returns {DebugLogger} Timeline logger instance
 */
export function createTimelineLogger(options = {}) {
    return new DebugLogger({
        level: LOG_LEVELS.DEBUG,
        prefix: 'TIMELINE',
        suppressDuplicates: true,
        duplicateThreshold: 5,
        ...options
    });
}

/**
 * Set global log level from environment or config
 * @param {string} levelName - Log level name (ERROR, WARN, INFO, DEBUG, TRACE)
 */
export function setGlobalLogLevel(levelName) {
    const level = LOG_LEVELS[levelName.toUpperCase()];
    if (level !== undefined) {
        logger.setLevel(level);
    } else {
        logger.warn(`Invalid log level: ${levelName}. Using INFO level.`);
    }
}

export { DebugLogger };
