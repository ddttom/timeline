/**
 * Google Maps timeline data parser
 * Handles parsing and extraction of position records from Google Maps timeline exports
 * Optimized for batch processing and smart logging
 */

import fs from 'fs';
import path from 'path';
import { e7ToDecimal, isValidCoordinatePair } from '../utils/coordinates.js';
import { createTimelineLogger, LOG_LEVELS } from '../utils/debugLogger.js';

/**
 * Parse Google Maps timeline data from JSON file
 * @param {string} timelineFilePath - Path to the timeline JSON file
 * @returns {Array} Array of position records with timestamps
 */
export async function parseTimelineData(timelineFilePath) {
    const logger = createTimelineLogger({ 
        prefix: 'TIMELINE-PARSER',
        level: LOG_LEVELS.INFO,
        suppressDuplicates: true,
        duplicateThreshold: 10
    });
    
    try {
        logger.info(`Loading timeline data from: ${timelineFilePath}`);
        
        // Check if file exists
        if (!fs.existsSync(timelineFilePath)) {
            throw new Error(`Timeline file not found: ${timelineFilePath}`);
        }
        
        // Read and parse JSON file
        const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
        const timelineData = JSON.parse(fileContent);
        
        // Extract position records with optimized processing
        const positionRecords = extractPositionRecords(timelineData, logger);
        
        logger.info(`Parsed ${positionRecords.length} position records from timeline`);
        return positionRecords;
        
    } catch (error) {
        logger.error(`Failed to parse timeline data: ${error.message}`);
        throw new Error(`Failed to parse timeline data: ${error.message}`);
    }
}

/**
 * Extract position records from timeline data structure
 * @param {Object} timelineData - Parsed timeline JSON data
 * @param {Object} logger - Logger instance
 * @returns {Array} Array of position records
 */
function extractPositionRecords(timelineData, logger) {
    const positionRecords = [];
    const placeholderStats = {
        total: 0,
        skipped: 0,
        processed: 0,
        consolidatedGroups: new Map()
    };
    
    if (!timelineData.timelineEdits || !Array.isArray(timelineData.timelineEdits)) {
        throw new Error('Invalid timeline data structure: missing timelineEdits array');
    }
    
    logger.debug(`Processing ${timelineData.timelineEdits.length} timeline edits`);
    
    for (const edit of timelineData.timelineEdits) {
        try {
            // Handle placeholder entries (timeline extensions) with batch processing
            if (edit.placeholderEntry) {
                const placeholderResult = processBatchedPlaceholder(edit.placeholderEntry, edit.deviceId, placeholderStats, logger);
                if (placeholderResult) {
                    positionRecords.push(placeholderResult);
                }
            }
            
            // Extract from rawSignal position data
            if (edit.rawSignal && edit.rawSignal.signal && edit.rawSignal.signal.position) {
                const positionData = edit.rawSignal.signal.position;
                const record = parsePositionRecord(positionData, edit.deviceId, logger);
                
                if (record) {
                    positionRecords.push(record);
                }
            }
            
            // Extract from placeAggregates
            if (edit.placeAggregates && edit.placeAggregates.placeAggregateInfo) {
                const aggregateRecords = parsePlaceAggregates(edit.placeAggregates, edit.deviceId, logger);
                positionRecords.push(...aggregateRecords);
            }
            
        } catch (recordError) {
            logger.warn(`Failed to parse timeline record: ${recordError.message}`);
            continue;
        }
    }
    
    // Log placeholder processing summary
    if (placeholderStats.total > 0) {
        logger.info(`Placeholder processing: ${placeholderStats.skipped} skipped, ${placeholderStats.processed} processed, ${placeholderStats.consolidatedGroups.size} unique timestamps`);
        
        // Log consolidation details at debug level
        if (placeholderStats.consolidatedGroups.size > 0) {
            logger.debug('Placeholder consolidation summary:', {
                uniqueTimestamps: placeholderStats.consolidatedGroups.size,
                totalOriginalEntries: placeholderStats.total,
                duplicatesEliminated: placeholderStats.total - placeholderStats.consolidatedGroups.size
            });
        }
    }
    
    // Sort records by timestamp
    positionRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Remove duplicates based on timestamp and coordinates
    const uniqueRecords = removeDuplicateRecords(positionRecords, logger);
    
    return uniqueRecords;
}

/**
 * Process batched placeholder records to eliminate verbose logging
 * @param {Object} placeholderData - Placeholder data from timeline extension
 * @param {string} deviceId - Device ID
 * @param {Object} stats - Placeholder processing statistics
 * @param {Object} logger - Logger instance
 * @returns {Object|null} Parsed placeholder record or null if skipped
 */
function processBatchedPlaceholder(placeholderData, deviceId, stats, logger) {
    try {
        if (!placeholderData.timestamp) {
            return null;
        }
        
        stats.total++;
        const timestampKey = placeholderData.timestamp;
        
        // Track unique timestamps for consolidation reporting
        if (!stats.consolidatedGroups.has(timestampKey)) {
            stats.consolidatedGroups.set(timestampKey, {
                count: 0,
                firstSeen: new Date(),
                consolidatedImages: placeholderData.consolidatedImages || [],
                imageCount: placeholderData.imageCount || 1
            });
        }
        
        const group = stats.consolidatedGroups.get(timestampKey);
        group.count++;
        
        // Skip placeholder records during timeline parsing - they don't provide GPS coordinates
        // These are only used to extend the timeline range, not for interpolation
        stats.skipped++;
        
        // Only log the first occurrence of each timestamp to reduce verbosity
        if (group.count === 1) {
            logger.trace(`Skipping placeholder record at ${timestampKey} (no GPS coordinates)${group.imageCount > 1 ? ` - consolidated from ${group.imageCount} images` : ''}`);
        }
        
        return null;
        
    } catch (error) {
        logger.warn(`Failed to parse placeholder record: ${error.message}`);
        return null;
    }
}

/**
 * Parse a single position record from rawSignal data
 * @param {Object} positionData - Position data from rawSignal
 * @param {string} deviceId - Device ID
 * @param {Object} logger - Logger instance
 * @returns {Object|null} Parsed position record or null if invalid
 */
function parsePositionRecord(positionData, deviceId, logger) {
    try {
        if (!positionData.point || !positionData.timestamp) {
            return null;
        }
        
        const { latE7, lngE7 } = positionData.point;
        
        if (typeof latE7 !== 'number' || typeof lngE7 !== 'number') {
            return null;
        }
        
        // Convert E7 coordinates to decimal degrees
        const latitude = e7ToDecimal(latE7);
        const longitude = e7ToDecimal(lngE7);
        
        // Validate coordinates
        if (!isValidCoordinatePair(latitude, longitude)) {
            console.warn(`Warning: Invalid coordinates: ${latitude}, ${longitude}`);
            return null;
        }
        
        return {
            timestamp: new Date(positionData.timestamp),
            latitude,
            longitude,
            accuracy: positionData.accuracyMm ? positionData.accuracyMm / 1000 : null, // Convert mm to meters
            altitude: positionData.altitudeMeters || null,
            speed: positionData.speedMetersPerSecond || null,
            source: positionData.source || 'unknown',
            deviceId: deviceId || null,
            recordType: 'position'
        };
        
    } catch (error) {
        console.warn(`Warning: Failed to parse position record: ${error.message}`);
        return null;
    }
}

/**
 * Parse place aggregates data
 * @param {Object} placeAggregates - Place aggregates data
 * @param {string} deviceId - Device ID
 * @returns {Array} Array of position records from place aggregates
 */
function parsePlaceAggregates(placeAggregates, deviceId, logger) {
    const records = [];
    
    try {
        if (!placeAggregates.placeAggregateInfo || !Array.isArray(placeAggregates.placeAggregateInfo)) {
            return records;
        }
        
        // Use the process window time range for place aggregates
        const processWindow = placeAggregates.processWindow;
        let baseTimestamp = new Date();
        
        if (processWindow && processWindow.startTime) {
            baseTimestamp = new Date(processWindow.startTime);
        }
        
        for (const placeInfo of placeAggregates.placeAggregateInfo) {
            if (placeInfo.point) {
                const { latE7, lngE7 } = placeInfo.point;
                
                if (typeof latE7 === 'number' && typeof lngE7 === 'number') {
                    const latitude = e7ToDecimal(latE7);
                    const longitude = e7ToDecimal(lngE7);
                    
                    if (isValidCoordinatePair(latitude, longitude)) {
                        records.push({
                            timestamp: baseTimestamp,
                            latitude,
                            longitude,
                            accuracy: null,
                            altitude: null,
                            speed: null,
                            source: 'place_aggregate',
                            deviceId: deviceId || null,
                            recordType: 'place_aggregate',
                            score: placeInfo.score || null,
                            placeId: placeInfo.placeId || null
                        });
                    }
                }
            }
        }
        
    } catch (error) {
        console.warn(`Warning: Failed to parse place aggregates: ${error.message}`);
    }
    
    return records;
}

/**
 * Remove duplicate position records
 * Optimized with Maps for O(1) lookups and comprehensive logging
 * @param {Array} records - Array of position records
 * @param {Object} logger - Logger instance
 * @returns {Array} Array with duplicates removed
 */
function removeDuplicateRecords(records, logger) {
    const seen = new Map();
    const uniqueRecords = [];
    let duplicatesRemoved = 0;
    
    for (const record of records) {
        // Handle records that might not have coordinates (like placeholder records)
        let key;
        if (record.latitude !== null && record.longitude !== null) {
            // Create a unique key based on timestamp and coordinates
            key = `${record.timestamp.getTime()}_${record.latitude.toFixed(6)}_${record.longitude.toFixed(6)}`;
        } else {
            // For placeholder records, use timestamp and record type
            key = `${record.timestamp.getTime()}_placeholder_${record.recordType || 'unknown'}`;
        }
        
        if (!seen.has(key)) {
            seen.set(key, {
                firstSeen: new Date(),
                count: 1,
                record: record
            });
            uniqueRecords.push(record);
        } else {
            // Track duplicate for logging
            const existing = seen.get(key);
            existing.count++;
            duplicatesRemoved++;
            
            // Log first few duplicates at debug level
            if (existing.count <= 3) {
                logger.debug(`Duplicate record removed: ${key.substring(0, 50)}...`);
            }
        }
    }
    
    if (duplicatesRemoved > 0) {
        logger.info(`Removed ${duplicatesRemoved} duplicate records from ${records.length} total records`);
        
        // Log statistics about duplicate patterns
        const duplicatePatterns = Array.from(seen.entries())
            .filter(([_, info]) => info.count > 1)
            .sort(([_, a], [__, b]) => b.count - a.count)
            .slice(0, 5); // Top 5 most duplicated patterns
        
        if (duplicatePatterns.length > 0) {
            logger.debug('Top duplicate patterns:', duplicatePatterns.map(([key, info]) => ({
                pattern: key.substring(0, 50) + '...',
                count: info.count
            })));
        }
    } else {
        logger.debug('No duplicate records found');
    }
    
    return uniqueRecords;
}

/**
 * Find position records within a time range
 * @param {Array} positionRecords - Array of position records
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {Array} Filtered position records
 */
export function findRecordsInTimeRange(positionRecords, startTime, endTime) {
    if (!Array.isArray(positionRecords)) {
        throw new Error('Position records must be an array');
    }
    
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
        throw new Error('Start time and end time must be Date objects');
    }
    
    return positionRecords.filter(record => {
        const recordTime = new Date(record.timestamp);
        return recordTime >= startTime && recordTime <= endTime;
    });
}

/**
 * Find the closest position record to a given timestamp
 * @param {Array} positionRecords - Array of position records
 * @param {Date} targetTimestamp - Target timestamp
 * @param {number} toleranceMinutes - Tolerance in minutes (default: 30)
 * @returns {Object|null} Closest position record or null if none within tolerance
 */
export function findClosestRecord(positionRecords, targetTimestamp, toleranceMinutes = 30) {
    if (!Array.isArray(positionRecords) || positionRecords.length === 0) {
        return null;
    }
    
    if (!(targetTimestamp instanceof Date)) {
        throw new Error('Target timestamp must be a Date object');
    }
    
    const toleranceMs = toleranceMinutes * 60 * 1000;
    let closestRecord = null;
    let minTimeDiff = Infinity;
    
    for (const record of positionRecords) {
        // Skip placeholder entries with null coordinates
        if (record.latitude === null || record.longitude === null || 
            record.isPlaceholder || record.source === 'timeline_extension_placeholder') {
            continue;
        }
        
        const recordTime = new Date(record.timestamp);
        const timeDiff = Math.abs(recordTime.getTime() - targetTimestamp.getTime());
        
        if (timeDiff <= toleranceMs && timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestRecord = record;
        }
    }
    
    return closestRecord;
}
/**
 * Enhanced fallback record finder for images beyond normal GPS coverage
 * Uses progressive search expansion to find the nearest valid GPS record
 * @param {Array} positionRecords - Array of position records
 * @param {Date} targetTimestamp - Target timestamp
 * @param {number} initialToleranceMinutes - Initial tolerance in minutes (default: 30)
 * @param {number} maxToleranceHours - Maximum tolerance in hours (default: 72)
 * @returns {Object|null} Closest valid GPS record or null
 */
export function findClosestRecordWithFallback(positionRecords, targetTimestamp, initialToleranceMinutes = 30, maxToleranceHours = 72) {
    if (!Array.isArray(positionRecords) || positionRecords.length === 0) {
        return null;
    }
    
    if (!(targetTimestamp instanceof Date)) {
        throw new Error('Target timestamp must be a Date object');
    }
    
    // First try normal tolerance
    let result = findClosestRecord(positionRecords, targetTimestamp, initialToleranceMinutes);
    if (result) {
        return {
            record: result,
            fallbackUsed: false,
            timeDifferenceMinutes: Math.abs(new Date(result.timestamp) - targetTimestamp) / (1000 * 60)
        };
    }
    
    // Filter out placeholder entries for fallback search
    const validGpsRecords = positionRecords.filter(record => 
        record.latitude !== null && record.longitude !== null && 
        !record.isPlaceholder && record.source !== 'timeline_extension_placeholder'
    );
    
    if (validGpsRecords.length === 0) {
        return null;
    }
    
    // Progressive search expansion: 1h, 6h, 24h, 72h
    const toleranceSteps = [60, 360, 1440, maxToleranceHours * 60]; // minutes
    
    for (const toleranceMinutes of toleranceSteps) {
        if (toleranceMinutes > maxToleranceHours * 60) break;
        
        const toleranceMs = toleranceMinutes * 60 * 1000;
        let closestRecord = null;
        let minTimeDiff = Infinity;
        
        for (const record of validGpsRecords) {
            const recordTime = new Date(record.timestamp);
            const timeDiff = Math.abs(recordTime.getTime() - targetTimestamp.getTime());
            
            if (timeDiff <= toleranceMs && timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestRecord = record;
            }
        }
        
        if (closestRecord) {
            return {
                record: closestRecord,
                fallbackUsed: true,
                fallbackToleranceHours: toleranceMinutes / 60,
                timeDifferenceMinutes: minTimeDiff / (1000 * 60)
            };
        }
    }
    
    // Last resort: find the absolute closest GPS record regardless of time (only if enabled)
    // Note: This section is disabled by default to prevent using GPS records that are too far away in time
    // The unlimited fallback can be enabled in configuration if needed, but it's not recommended
    // as it may result in very inaccurate location assignments
    
    return null;
}


/**
 * Interpolate position between two records
 * @param {Object} record1 - First position record
 * @param {Object} record2 - Second position record
 * @param {Date} targetTimestamp - Target timestamp for interpolation
 * @returns {Object} Interpolated position
 */
export function interpolatePosition(record1, record2, targetTimestamp) {
    if (!record1 || !record2) {
        throw new Error('Both position records must be provided');
    }
    
    if (!(targetTimestamp instanceof Date)) {
        throw new Error('Target timestamp must be a Date object');
    }
    
    const time1 = new Date(record1.timestamp).getTime();
    const time2 = new Date(record2.timestamp).getTime();
    const targetTime = targetTimestamp.getTime();
    
    // Ensure target time is between the two records
    if (targetTime < Math.min(time1, time2) || targetTime > Math.max(time1, time2)) {
        throw new Error('Target timestamp must be between the two position records');
    }
    
    // Calculate interpolation factor (0 to 1)
    const factor = (targetTime - time1) / (time2 - time1);
    
    // Interpolate coordinates
    const latitude = record1.latitude + (record2.latitude - record1.latitude) * factor;
    const longitude = record1.longitude + (record2.longitude - record1.longitude) * factor;
    
    return {
        timestamp: targetTimestamp,
        latitude,
        longitude,
        accuracy: null, // Interpolated positions don't have accuracy
        altitude: null,
        speed: null,
        source: 'interpolated',
        deviceId: record1.deviceId || record2.deviceId,
        recordType: 'interpolated',
        interpolatedFrom: {
            record1: {
                timestamp: record1.timestamp,
                latitude: record1.latitude,
                longitude: record1.longitude
            },
            record2: {
                timestamp: record2.timestamp,
                latitude: record2.latitude,
                longitude: record2.longitude
            },
            factor
        }
    };
}

/**
 * Get timeline data statistics
 * @param {Array} positionRecords - Array of position records
 * @returns {Object} Timeline statistics
 */
export function getTimelineStatistics(positionRecords) {
    if (!Array.isArray(positionRecords) || positionRecords.length === 0) {
        return {
            totalRecords: 0,
            timeRange: null,
            recordTypes: {},
            sources: {},
            devices: {}
        };
    }
    
    const stats = {
        totalRecords: positionRecords.length,
        timeRange: {
            start: new Date(Math.min(...positionRecords.map(r => new Date(r.timestamp)))),
            end: new Date(Math.max(...positionRecords.map(r => new Date(r.timestamp))))
        },
        recordTypes: {},
        sources: {},
        devices: {}
    };
    
    // Count record types, sources, and devices
    for (const record of positionRecords) {
        // Record types
        const recordType = record.recordType || 'unknown';
        stats.recordTypes[recordType] = (stats.recordTypes[recordType] || 0) + 1;
        
        // Sources
        const source = record.source || 'unknown';
        stats.sources[source] = (stats.sources[source] || 0) + 1;
        
        // Devices
        const deviceId = record.deviceId || 'unknown';
        stats.devices[deviceId] = (stats.devices[deviceId] || 0) + 1;
    }
    
    return stats;
}

/**
 * Validate timeline data file
 * @param {string} timelineFilePath - Path to timeline file
 * @returns {Object} Validation results
 */
export async function validateTimelineFile(timelineFilePath) {
    const validation = {
        exists: false,
        readable: false,
        validJson: false,
        hasTimelineEdits: false,
        positionRecordsCount: 0,
        errors: []
    };
    
    try {
        // Check if file exists
        validation.exists = fs.existsSync(timelineFilePath);
        if (!validation.exists) {
            validation.errors.push('Timeline file does not exist');
            return validation;
        }
        
        // Check if file is readable
        try {
            await fs.promises.access(timelineFilePath, fs.constants.R_OK);
            validation.readable = true;
        } catch (error) {
            validation.errors.push('Timeline file is not readable');
            return validation;
        }
        
        // Check if file contains valid JSON
        try {
            const fileContent = await fs.promises.readFile(timelineFilePath, 'utf8');
            const timelineData = JSON.parse(fileContent);
            validation.validJson = true;
            
            // Check for timelineEdits structure
            if (timelineData.timelineEdits && Array.isArray(timelineData.timelineEdits)) {
                validation.hasTimelineEdits = true;
                
                // Count potential position records
                const positionRecords = extractPositionRecords(timelineData);
                validation.positionRecordsCount = positionRecords.length;
            } else {
                validation.errors.push('Timeline data does not contain timelineEdits array');
            }
            
        } catch (jsonError) {
            validation.errors.push(`Invalid JSON format: ${jsonError.message}`);
        }
        
    } catch (error) {
        validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
}
