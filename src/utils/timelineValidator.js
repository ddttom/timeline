/**
 * Timeline Validator
 * Comprehensive integrity checking and validation for timeline data
 */

import { createTimelineLogger } from './debugLogger.js';
import { isValidCoordinatePair } from './coordinates.js';
import { calculateDistance } from './distance.js';

/**
 * Validation issue severity levels
 */
export const SEVERITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Validation issue types
 */
export const ISSUE_TYPES = {
    DUPLICATE_PLACEHOLDER: 'DUPLICATE_PLACEHOLDER',
    DUPLICATE_GPS_RECORD: 'DUPLICATE_GPS_RECORD',
    INVALID_COORDINATES: 'INVALID_COORDINATES',
    INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    TEMPORAL_INCONSISTENCY: 'TEMPORAL_INCONSISTENCY',
    SPATIAL_INCONSISTENCY: 'SPATIAL_INCONSISTENCY',
    EXCESSIVE_DUPLICATES: 'EXCESSIVE_DUPLICATES',
    MEMORY_INEFFICIENCY: 'MEMORY_INEFFICIENCY',
    PERFORMANCE_ISSUE: 'PERFORMANCE_ISSUE'
};

/**
 * Timeline Validator Class
 */
export class TimelineValidator {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ prefix: 'VALIDATOR' });
        this.config = {
            maxDuplicatesPerTimestamp: options.maxDuplicatesPerTimestamp || 5,
            maxTemporalGap: options.maxTemporalGap || 24 * 60 * 60 * 1000, // 24 hours
            maxSpatialDistance: options.maxSpatialDistance || 1000000, // 1000km
            enableDeepValidation: options.enableDeepValidation !== false,
            enablePerformanceChecks: options.enablePerformanceChecks !== false,
            coordinateValidation: {
                minLatitude: -90,
                maxLatitude: 90,
                minLongitude: -180,
                maxLongitude: 180
            }
        };
        
        this.validationResults = {
            issues: [],
            statistics: {},
            recommendations: [],
            validationTime: null
        };
    }

    /**
     * Validate timeline integrity
     * @param {Array} records - Timeline records to validate
     * @returns {Object} Validation results
     */
    validateTimelineIntegrity(records) {
        const startTime = performance.now();
        this.logger.info(`Starting timeline validation for ${records.length} records`);
        
        // Reset validation results
        this.validationResults = {
            issues: [],
            statistics: {},
            recommendations: [],
            validationTime: null
        };
        
        try {
            // Basic validation checks
            this.validateBasicStructure(records);
            this.validateTimestamps(records);
            this.validateCoordinates(records);
            
            // Duplicate detection
            this.validateDuplicates(records);
            
            // Advanced validation if enabled
            if (this.config.enableDeepValidation) {
                this.validateTemporalConsistency(records);
                this.validateSpatialConsistency(records);
            }
            
            // Performance validation if enabled
            if (this.config.enablePerformanceChecks) {
                this.validatePerformanceIssues(records);
            }
            
            // Generate statistics and recommendations
            this.generateStatistics(records);
            this.generateRecommendations();
            
            this.validationResults.validationTime = performance.now() - startTime;
            this.logger.info(`Timeline validation completed in ${this.validationResults.validationTime.toFixed(2)}ms`);
            
            return this.validationResults;
            
        } catch (error) {
            this.logger.error(`Timeline validation failed: ${error.message}`);
            this.addIssue(ISSUE_TYPES.PERFORMANCE_ISSUE, SEVERITY_LEVELS.CRITICAL, 
                `Validation process failed: ${error.message}`, null, { error: error.stack });
            return this.validationResults;
        }
    }

    /**
     * Validate basic record structure
     * @param {Array} records - Records to validate
     */
    validateBasicStructure(records) {
        this.logger.debug('Validating basic record structure');
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            // Check required fields
            if (!record.timestamp) {
                this.addIssue(ISSUE_TYPES.MISSING_REQUIRED_FIELD, SEVERITY_LEVELS.HIGH,
                    'Record missing timestamp field', i, { record });
            }
            
            // Validate timestamp type
            if (record.timestamp && !(record.timestamp instanceof Date) && typeof record.timestamp !== 'string') {
                this.addIssue(ISSUE_TYPES.INVALID_TIMESTAMP, SEVERITY_LEVELS.MEDIUM,
                    'Invalid timestamp type', i, { timestamp: record.timestamp, type: typeof record.timestamp });
            }
            
            // Check for placeholder consistency
            if (record.isPlaceholder) {
                if (record.latitude !== null || record.longitude !== null) {
                    this.addIssue(ISSUE_TYPES.SPATIAL_INCONSISTENCY, SEVERITY_LEVELS.MEDIUM,
                        'Placeholder record has non-null coordinates', i, { record });
                }
            }
        }
    }

    /**
     * Validate timestamps
     * @param {Array} records - Records to validate
     */
    validateTimestamps(records) {
        this.logger.debug('Validating timestamps');
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            if (!record.timestamp) continue;
            
            try {
                const timestamp = new Date(record.timestamp);
                
                // Check if timestamp is valid
                if (isNaN(timestamp.getTime())) {
                    this.addIssue(ISSUE_TYPES.INVALID_TIMESTAMP, SEVERITY_LEVELS.HIGH,
                        'Invalid timestamp value', i, { timestamp: record.timestamp });
                    continue;
                }
                
                // Check timestamp range (reasonable bounds)
                const year = timestamp.getFullYear();
                if (year < 1970 || year > 2100) {
                    this.addIssue(ISSUE_TYPES.INVALID_TIMESTAMP, SEVERITY_LEVELS.MEDIUM,
                        `Timestamp year out of reasonable range: ${year}`, i, { timestamp });
                }
                
                // Check for future timestamps (more than 1 day in future)
                const now = new Date();
                const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                if (timestamp > oneDayFromNow) {
                    this.addIssue(ISSUE_TYPES.TEMPORAL_INCONSISTENCY, SEVERITY_LEVELS.LOW,
                        'Timestamp is in the future', i, { timestamp, now });
                }
                
            } catch (error) {
                this.addIssue(ISSUE_TYPES.INVALID_TIMESTAMP, SEVERITY_LEVELS.HIGH,
                    `Timestamp parsing error: ${error.message}`, i, { timestamp: record.timestamp });
            }
        }
    }

    /**
     * Validate coordinates
     * @param {Array} records - Records to validate
     */
    validateCoordinates(records) {
        this.logger.debug('Validating coordinates');
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            // Skip placeholder records
            if (record.isPlaceholder || (record.latitude === null && record.longitude === null)) {
                continue;
            }
            
            // Check if coordinates exist
            if (record.latitude === undefined || record.longitude === undefined) {
                this.addIssue(ISSUE_TYPES.MISSING_REQUIRED_FIELD, SEVERITY_LEVELS.MEDIUM,
                    'Non-placeholder record missing coordinates', i, { record });
                continue;
            }
            
            // Validate coordinate values
            if (!isValidCoordinatePair(record.latitude, record.longitude)) {
                this.addIssue(ISSUE_TYPES.INVALID_COORDINATES, SEVERITY_LEVELS.HIGH,
                    'Invalid coordinate values', i, { 
                        latitude: record.latitude, 
                        longitude: record.longitude 
                    });
                continue;
            }
            
            // Check coordinate bounds
            const { minLatitude, maxLatitude, minLongitude, maxLongitude } = this.config.coordinateValidation;
            
            if (record.latitude < minLatitude || record.latitude > maxLatitude) {
                this.addIssue(ISSUE_TYPES.INVALID_COORDINATES, SEVERITY_LEVELS.HIGH,
                    `Latitude out of bounds: ${record.latitude}`, i, { latitude: record.latitude });
            }
            
            if (record.longitude < minLongitude || record.longitude > maxLongitude) {
                this.addIssue(ISSUE_TYPES.INVALID_COORDINATES, SEVERITY_LEVELS.HIGH,
                    `Longitude out of bounds: ${record.longitude}`, i, { longitude: record.longitude });
            }
        }
    }

    /**
     * Validate for duplicate records
     * @param {Array} records - Records to validate
     */
    validateDuplicates(records) {
        this.logger.debug('Validating for duplicates');
        
        const timestampMap = new Map();
        const coordinateMap = new Map();
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            if (!record.timestamp) continue;
            
            const timestampKey = new Date(record.timestamp).toISOString();
            
            // Track timestamp occurrences
            if (!timestampMap.has(timestampKey)) {
                timestampMap.set(timestampKey, []);
            }
            timestampMap.get(timestampKey).push({ index: i, record });
            
            // Track coordinate occurrences (for non-placeholder records)
            if (!record.isPlaceholder && record.latitude !== null && record.longitude !== null) {
                const coordKey = `${record.latitude.toFixed(6)},${record.longitude.toFixed(6)}`;
                if (!coordinateMap.has(coordKey)) {
                    coordinateMap.set(coordKey, []);
                }
                coordinateMap.get(coordKey).push({ index: i, record, timestamp: timestampKey });
            }
        }
        
        // Check for timestamp duplicates
        for (const [timestamp, occurrences] of timestampMap) {
            if (occurrences.length > 1) {
                const placeholderCount = occurrences.filter(occ => occ.record.isPlaceholder).length;
                const gpsCount = occurrences.length - placeholderCount;
                
                if (placeholderCount > 1) {
                    const severity = placeholderCount > this.config.maxDuplicatesPerTimestamp 
                        ? SEVERITY_LEVELS.CRITICAL 
                        : SEVERITY_LEVELS.HIGH;
                    
                    this.addIssue(ISSUE_TYPES.DUPLICATE_PLACEHOLDER, severity,
                        `${placeholderCount} duplicate placeholder records for timestamp ${timestamp}`, 
                        occurrences.map(occ => occ.index), 
                        { timestamp, placeholderCount, totalCount: occurrences.length });
                }
                
                if (gpsCount > 1) {
                    this.addIssue(ISSUE_TYPES.DUPLICATE_GPS_RECORD, SEVERITY_LEVELS.MEDIUM,
                        `${gpsCount} duplicate GPS records for timestamp ${timestamp}`, 
                        occurrences.filter(occ => !occ.record.isPlaceholder).map(occ => occ.index), 
                        { timestamp, gpsCount });
                }
                
                if (occurrences.length > this.config.maxDuplicatesPerTimestamp) {
                    this.addIssue(ISSUE_TYPES.EXCESSIVE_DUPLICATES, SEVERITY_LEVELS.CRITICAL,
                        `Excessive duplicates for timestamp ${timestamp}: ${occurrences.length} records`, 
                        occurrences.map(occ => occ.index), 
                        { timestamp, count: occurrences.length, threshold: this.config.maxDuplicatesPerTimestamp });
                }
            }
        }
        
        // Check for coordinate duplicates
        for (const [coordinates, occurrences] of coordinateMap) {
            if (occurrences.length > 1) {
                // Check if they're at different times (which might be suspicious)
                const uniqueTimestamps = new Set(occurrences.map(occ => occ.timestamp));
                if (uniqueTimestamps.size > 1) {
                    this.addIssue(ISSUE_TYPES.SPATIAL_INCONSISTENCY, SEVERITY_LEVELS.LOW,
                        `Same coordinates at different times: ${coordinates}`, 
                        occurrences.map(occ => occ.index), 
                        { coordinates, timestamps: Array.from(uniqueTimestamps) });
                }
            }
        }
    }

    /**
     * Validate temporal consistency
     * @param {Array} records - Records to validate
     */
    validateTemporalConsistency(records) {
        this.logger.debug('Validating temporal consistency');
        
        // Sort records by timestamp for consistency checking
        const sortedRecords = records
            .map((record, index) => ({ record, originalIndex: index }))
            .filter(item => item.record.timestamp)
            .sort((a, b) => new Date(a.record.timestamp) - new Date(b.record.timestamp));
        
        for (let i = 1; i < sortedRecords.length; i++) {
            const current = sortedRecords[i];
            const previous = sortedRecords[i - 1];
            
            const currentTime = new Date(current.record.timestamp);
            const previousTime = new Date(previous.record.timestamp);
            const timeDiff = currentTime - previousTime;
            
            // Check for excessive temporal gaps
            if (timeDiff > this.config.maxTemporalGap) {
                this.addIssue(ISSUE_TYPES.TEMPORAL_INCONSISTENCY, SEVERITY_LEVELS.LOW,
                    `Large temporal gap: ${(timeDiff / (1000 * 60 * 60)).toFixed(2)} hours`, 
                    [previous.originalIndex, current.originalIndex], 
                    { 
                        previousTime: previousTime.toISOString(), 
                        currentTime: currentTime.toISOString(),
                        gapHours: timeDiff / (1000 * 60 * 60)
                    });
            }
        }
    }

    /**
     * Validate spatial consistency
     * @param {Array} records - Records to validate
     */
    validateSpatialConsistency(records) {
        this.logger.debug('Validating spatial consistency');
        
        const gpsRecords = records
            .map((record, index) => ({ record, originalIndex: index }))
            .filter(item => !item.record.isPlaceholder && 
                           item.record.latitude !== null && 
                           item.record.longitude !== null &&
                           item.record.timestamp)
            .sort((a, b) => new Date(a.record.timestamp) - new Date(b.record.timestamp));
        
        for (let i = 1; i < gpsRecords.length; i++) {
            const current = gpsRecords[i];
            const previous = gpsRecords[i - 1];
            
            const distance = calculateDistance(
                previous.record.latitude, previous.record.longitude,
                current.record.latitude, current.record.longitude
            );
            
            const timeDiff = new Date(current.record.timestamp) - new Date(previous.record.timestamp);
            const timeDiffHours = timeDiff / (1000 * 60 * 60);
            
            // Check for impossible travel speeds (over 1000 km/h)
            if (timeDiffHours > 0) {
                const speed = distance / timeDiffHours; // km/h
                if (speed > 1000) {
                    this.addIssue(ISSUE_TYPES.SPATIAL_INCONSISTENCY, SEVERITY_LEVELS.MEDIUM,
                        `Impossible travel speed: ${speed.toFixed(2)} km/h`, 
                        [previous.originalIndex, current.originalIndex], 
                        { 
                            distance: distance.toFixed(2),
                            timeHours: timeDiffHours.toFixed(2),
                            speed: speed.toFixed(2)
                        });
                }
            }
            
            // Check for excessive spatial distances
            if (distance > this.config.maxSpatialDistance) {
                this.addIssue(ISSUE_TYPES.SPATIAL_INCONSISTENCY, SEVERITY_LEVELS.LOW,
                    `Large spatial distance: ${distance.toFixed(2)} km`, 
                    [previous.originalIndex, current.originalIndex], 
                    { distance: distance.toFixed(2) });
            }
        }
    }

    /**
     * Validate for performance issues
     * @param {Array} records - Records to validate
     */
    validatePerformanceIssues(records) {
        this.logger.debug('Validating for performance issues');
        
        // Check for memory inefficiencies
        const duplicateTimestamps = new Map();
        let totalDuplicates = 0;
        
        for (const record of records) {
            if (!record.timestamp) continue;
            
            const timestampKey = new Date(record.timestamp).toISOString();
            const count = duplicateTimestamps.get(timestampKey) || 0;
            duplicateTimestamps.set(timestampKey, count + 1);
            
            if (count > 0) {
                totalDuplicates++;
            }
        }
        
        if (totalDuplicates > records.length * 0.1) { // More than 10% duplicates
            this.addIssue(ISSUE_TYPES.MEMORY_INEFFICIENCY, SEVERITY_LEVELS.HIGH,
                `High duplicate ratio: ${((totalDuplicates / records.length) * 100).toFixed(1)}%`, 
                null, 
                { 
                    totalRecords: records.length,
                    duplicates: totalDuplicates,
                    duplicateRatio: (totalDuplicates / records.length) * 100
                });
        }
        
        // Check for excessive record count
        if (records.length > 100000) {
            this.addIssue(ISSUE_TYPES.PERFORMANCE_ISSUE, SEVERITY_LEVELS.MEDIUM,
                `Large record count may impact performance: ${records.length} records`, 
                null, 
                { recordCount: records.length });
        }
    }

    /**
     * Add a validation issue
     * @param {string} type - Issue type
     * @param {string} severity - Issue severity
     * @param {string} message - Issue message
     * @param {number|Array} recordIndex - Index(es) of affected record(s)
     * @param {Object} details - Additional issue details
     */
    addIssue(type, severity, message, recordIndex = null, details = {}) {
        const issue = {
            type,
            severity,
            message,
            recordIndex,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.validationResults.issues.push(issue);
        this.logger.debug(`Validation issue: ${severity} - ${message}`, { type, recordIndex, details });
    }

    /**
     * Generate validation statistics
     * @param {Array} records - Records that were validated
     */
    generateStatistics(records) {
        const issuesBySeverity = {};
        const issuesByType = {};
        
        for (const issue of this.validationResults.issues) {
            issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
            issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
        }
        
        const placeholderCount = records.filter(r => r.isPlaceholder).length;
        const gpsCount = records.length - placeholderCount;
        
        this.validationResults.statistics = {
            totalRecords: records.length,
            placeholderRecords: placeholderCount,
            gpsRecords: gpsCount,
            totalIssues: this.validationResults.issues.length,
            issuesBySeverity,
            issuesByType,
            validationTime: this.validationResults.validationTime
        };
    }

    /**
     * Generate recommendations based on validation results
     */
    generateRecommendations() {
        const recommendations = [];
        const { issues, statistics } = this.validationResults;
        
        // Duplicate-related recommendations
        const duplicateIssues = issues.filter(issue => 
            issue.type === ISSUE_TYPES.DUPLICATE_PLACEHOLDER || 
            issue.type === ISSUE_TYPES.DUPLICATE_GPS_RECORD ||
            issue.type === ISSUE_TYPES.EXCESSIVE_DUPLICATES
        );
        
        if (duplicateIssues.length > 0) {
            recommendations.push({
                type: 'CONSOLIDATION',
                priority: 'HIGH',
                message: `Found ${duplicateIssues.length} duplicate-related issues. Implement timestamp consolidation.`,
                impact: 'Significant performance and memory improvements',
                action: 'Refactor timeline extension logic to consolidate identical timestamps'
            });
        }
        
        // Performance recommendations
        const performanceIssues = issues.filter(issue => 
            issue.type === ISSUE_TYPES.MEMORY_INEFFICIENCY || 
            issue.type === ISSUE_TYPES.PERFORMANCE_ISSUE
        );
        
        if (performanceIssues.length > 0) {
            recommendations.push({
                type: 'PERFORMANCE',
                priority: 'MEDIUM',
                message: `Found ${performanceIssues.length} performance-related issues.`,
                impact: 'Improved processing speed and memory usage',
                action: 'Optimize data structures and implement efficient algorithms'
            });
        }
        
        // Data quality recommendations
        const dataQualityIssues = issues.filter(issue => 
            issue.type === ISSUE_TYPES.INVALID_COORDINATES || 
            issue.type === ISSUE_TYPES.INVALID_TIMESTAMP ||
            issue.type === ISSUE_TYPES.MISSING_REQUIRED_FIELD
        );
        
        if (dataQualityIssues.length > 0) {
            recommendations.push({
                type: 'DATA_QUALITY',
                priority: 'MEDIUM',
                message: `Found ${dataQualityIssues.length} data quality issues.`,
                impact: 'Improved data reliability and processing accuracy',
                action: 'Implement data validation and cleanup procedures'
            });
        }
        
        this.validationResults.recommendations = recommendations;
    }

    /**
     * Check if records are identical placeholders
     * @param {Object} record1 - First record
     * @param {Object} record2 - Second record
     * @returns {boolean} True if identical placeholders
     */
    static areIdenticalPlaceholders(record1, record2) {
        return record1.isPlaceholder && record2.isPlaceholder &&
               record1.latitude === null && record2.latitude === null &&
               record1.longitude === null && record2.longitude === null &&
               new Date(record1.timestamp).getTime() === new Date(record2.timestamp).getTime();
    }

    /**
     * Get validation summary
     * @returns {Object} Validation summary
     */
    getValidationSummary() {
        const { issues, statistics } = this.validationResults;
        const criticalIssues = issues.filter(issue => issue.severity === SEVERITY_LEVELS.CRITICAL);
        const highIssues = issues.filter(issue => issue.severity === SEVERITY_LEVELS.HIGH);
        
        return {
            isValid: criticalIssues.length === 0 && highIssues.length === 0,
            totalIssues: issues.length,
            criticalIssues: criticalIssues.length,
            highIssues: highIssues.length,
            recommendations: this.validationResults.recommendations.length,
            validationTime: statistics.validationTime
        };
    }
}
