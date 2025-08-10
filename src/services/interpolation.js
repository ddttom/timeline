/**
 * Geolocation interpolation service
 * Handles primary and secondary interpolation for image geolocation
 */

import { findClosestRecord, interpolatePosition, findRecordsInTimeRange } from './timelineParser.js';
import { calculateDistance, filterCoordinatesWithinRadius } from '../utils/distance.js';
import { isValidCoordinatePair } from '../utils/coordinates.js';
import { extractTimezone, normalizeToUTC } from './timezone.js';

/**
 * Primary interpolation using timeline data
 * @param {Object} imageMetadata - Image metadata object
 * @param {Array} timelineRecords - Array of timeline position records
 * @param {number} toleranceMinutes - Tolerance in minutes (default: 30)
 * @returns {Object|null} Interpolated coordinates or null if not found
 */
export async function primaryInterpolation(imageMetadata, timelineRecords, toleranceMinutes = 30) {
    try {
        if (!imageMetadata.timestamp || !Array.isArray(timelineRecords)) {
            return null;
        }
        
        // Normalize image timestamp to UTC
        const timezone = extractTimezone(imageMetadata.exifData);
        const utcTimestamp = normalizeToUTC(imageMetadata.timestamp, timezone);
        
        console.log(`🔍 Primary interpolation for ${imageMetadata.fileName} at ${utcTimestamp.toISOString()}`);
        
        // Debug: Show timeline data range and comparison
        if (timelineRecords.length > 0) {
            const timelineStart = new Date(Math.min(...timelineRecords.map(r => new Date(r.timestamp))));
            const timelineEnd = new Date(Math.max(...timelineRecords.map(r => new Date(r.timestamp))));
            console.log(`   📅 Timeline range: ${timelineStart.toISOString()} to ${timelineEnd.toISOString()}`);
            console.log(`   🎯 Image timestamp: ${utcTimestamp.toISOString()}`);
            
            // Check if image timestamp is within timeline range
            if (utcTimestamp < timelineStart) {
                const daysBefore = Math.round((timelineStart - utcTimestamp) / (1000 * 60 * 60 * 24));
                console.log(`   ⚠️  Image is ${daysBefore} days BEFORE timeline start`);
            } else if (utcTimestamp > timelineEnd) {
                const daysAfter = Math.round((utcTimestamp - timelineEnd) / (1000 * 60 * 60 * 24));
                console.log(`   ⚠️  Image is ${daysAfter} days AFTER timeline end`);
            } else {
                console.log(`   ✅ Image timestamp is within timeline range`);
            }
            
            // Find closest record regardless of tolerance for debugging
            const allDistances = timelineRecords.map(record => {
                const recordTime = new Date(record.timestamp);
                const timeDiff = Math.abs(recordTime - utcTimestamp) / (1000 * 60); // minutes
                return { record, timeDiff };
            }).sort((a, b) => a.timeDiff - b.timeDiff);
            
            if (allDistances.length > 0) {
                const closest = allDistances[0];
                console.log(`   🔍 Closest timeline record: ${closest.timeDiff.toFixed(1)} minutes away`);
                console.log(`   📍 Closest record time: ${new Date(closest.record.timestamp).toISOString()}`);
            }
        }
        
        // Find closest timeline record within tolerance</search>
</search_and_replace>
        const closestRecord = findClosestRecord(timelineRecords, utcTimestamp, toleranceMinutes);
        
        if (closestRecord) {
            const timeDiff = Math.abs(new Date(closestRecord.timestamp) - utcTimestamp) / (1000 * 60); // minutes
            
            console.log(`✅ Found timeline match: ${timeDiff.toFixed(1)} minutes difference`);
            
            return {
                latitude: closestRecord.latitude,
                longitude: closestRecord.longitude,
                source: 'timeline_direct',
                accuracy: closestRecord.accuracy,
                timeDifference: timeDiff,
                sourceRecord: {
                    timestamp: closestRecord.timestamp,
                    source: closestRecord.source,
                    deviceId: closestRecord.deviceId
                }
            };
        }
        
        // Try interpolation between two nearby records
        const interpolatedResult = await interpolateFromTimeline(utcTimestamp, timelineRecords, toleranceMinutes * 2);
        
        if (interpolatedResult) {
            console.log(`✅ Timeline interpolation successful`);
            return interpolatedResult;
        }
        
        console.log(`❌ No timeline match found within ${toleranceMinutes} minutes`);
        return null;
        
    } catch (error) {
        console.warn(`Warning: Primary interpolation failed for ${imageMetadata.fileName}: ${error.message}`);
        return null;
    }
}

/**
 * Interpolate coordinates from timeline data between two records
 * @param {Date} targetTimestamp - Target timestamp
 * @param {Array} timelineRecords - Timeline records
 * @param {number} maxToleranceMinutes - Maximum tolerance for finding records
 * @returns {Object|null} Interpolated result or null
 */
async function interpolateFromTimeline(targetTimestamp, timelineRecords, maxToleranceMinutes) {
    try {
        // Find records before and after the target timestamp
        const beforeRecords = timelineRecords
            .filter(record => new Date(record.timestamp) <= targetTimestamp)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const afterRecords = timelineRecords
            .filter(record => new Date(record.timestamp) >= targetTimestamp)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (beforeRecords.length === 0 || afterRecords.length === 0) {
            return null;
        }
        
        const beforeRecord = beforeRecords[0];
        const afterRecord = afterRecords[0];
        
        // Check if records are within tolerance
        const beforeDiff = (targetTimestamp - new Date(beforeRecord.timestamp)) / (1000 * 60);
        const afterDiff = (new Date(afterRecord.timestamp) - targetTimestamp) / (1000 * 60);
        
        if (beforeDiff > maxToleranceMinutes || afterDiff > maxToleranceMinutes) {
            return null;
        }
        
        // Interpolate between the two records
        const interpolatedRecord = interpolatePosition(beforeRecord, afterRecord, targetTimestamp);
        
        return {
            latitude: interpolatedRecord.latitude,
            longitude: interpolatedRecord.longitude,
            source: 'timeline_interpolated',
            accuracy: null,
            timeDifference: Math.min(beforeDiff, afterDiff),
            interpolationDetails: {
                beforeRecord: {
                    timestamp: beforeRecord.timestamp,
                    latitude: beforeRecord.latitude,
                    longitude: beforeRecord.longitude,
                    timeDiff: beforeDiff
                },
                afterRecord: {
                    timestamp: afterRecord.timestamp,
                    latitude: afterRecord.latitude,
                    longitude: afterRecord.longitude,
                    timeDiff: afterDiff
                },
                factor: interpolatedRecord.interpolatedFrom.factor
            }
        };
        
    } catch (error) {
        console.warn(`Warning: Timeline interpolation failed: ${error.message}`);
        return null;
    }
}

/**
 * Secondary interpolation using nearby images with GPS data
 * @param {Object} imageMetadata - Image metadata object
 * @param {Array} imagesWithGps - Array of images with GPS coordinates
 * @param {number} radiusMeters - Search radius in meters (default: 2000)
 * @param {number} timeWindowHours - Time window in hours (default: 4)
 * @returns {Object|null} Interpolated coordinates or null if not found
 */
export async function secondaryInterpolation(imageMetadata, imagesWithGps, radiusMeters = 2000, timeWindowHours = 4) {
    try {
        if (!imageMetadata.timestamp || !Array.isArray(imagesWithGps) || imagesWithGps.length === 0) {
            return null;
        }
        
        console.log(`🔍 Secondary interpolation for ${imageMetadata.fileName}`);
        
        // Find images within time window
        const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
        const targetTime = imageMetadata.timestamp.getTime();
        
        const nearbyImages = imagesWithGps.filter(img => {
            if (!img.timestamp || !img.coordinates) return false;
            
            const timeDiff = Math.abs(img.timestamp.getTime() - targetTime);
            return timeDiff <= timeWindowMs;
        });
        
        if (nearbyImages.length === 0) {
            console.log(`❌ No images found within ${timeWindowHours} hour time window`);
            return null;
        }
        
        console.log(`📍 Found ${nearbyImages.length} images within time window`);
        
        // Apply weighted interpolation
        const result = await weightedInterpolation(imageMetadata, nearbyImages, radiusMeters, timeWindowHours);
        
        if (result) {
            console.log(`✅ Secondary interpolation successful`);
            return result;
        }
        
        console.log(`❌ Secondary interpolation failed`);
        return null;
        
    } catch (error) {
        console.warn(`Warning: Secondary interpolation failed for ${imageMetadata.fileName}: ${error.message}`);
        return null;
    }
}

/**
 * Weighted interpolation based on temporal and spatial distance
 * @param {Object} targetImage - Target image metadata
 * @param {Array} referenceImages - Reference images with GPS
 * @param {number} maxRadius - Maximum radius in meters
 * @param {number} maxTimeHours - Maximum time window in hours
 * @returns {Object|null} Weighted interpolation result
 */
export async function weightedInterpolation(targetImage, referenceImages, maxRadius, maxTimeHours) {
    try {
        if (!targetImage.timestamp || referenceImages.length === 0) {
            return null;
        }
        
        const targetTime = targetImage.timestamp.getTime();
        const maxTimeMs = maxTimeHours * 60 * 60 * 1000;
        
        // Calculate weights for each reference image
        const weightedImages = [];
        
        for (const refImage of referenceImages) {
            if (!refImage.coordinates || !refImage.timestamp) continue;
            
            // Calculate temporal weight (closer in time = higher weight)
            const timeDiff = Math.abs(refImage.timestamp.getTime() - targetTime);
            const timeWeight = Math.max(0, 1 - (timeDiff / maxTimeMs));
            
            if (timeWeight <= 0) continue;
            
            // For spatial weight, we need an estimated location
            // Since we don't have target coordinates yet, we'll use temporal weight only
            // In a more sophisticated implementation, you might use multiple iterations
            
            const totalWeight = timeWeight;
            
            if (totalWeight > 0) {
                weightedImages.push({
                    ...refImage,
                    weight: totalWeight,
                    timeDiff: timeDiff / (1000 * 60) // minutes
                });
            }
        }
        
        if (weightedImages.length === 0) {
            return null;
        }
        
        // Sort by weight (highest first)
        weightedImages.sort((a, b) => b.weight - a.weight);
        
        // Use top weighted images for interpolation
        const topImages = weightedImages.slice(0, Math.min(5, weightedImages.length));
        
        // Calculate weighted average coordinates
        let totalWeight = 0;
        let weightedLat = 0;
        let weightedLng = 0;
        
        for (const img of topImages) {
            weightedLat += img.coordinates.lat * img.weight;
            weightedLng += img.coordinates.lng * img.weight;
            totalWeight += img.weight;
        }
        
        if (totalWeight === 0) {
            return null;
        }
        
        const interpolatedLat = weightedLat / totalWeight;
        const interpolatedLng = weightedLng / totalWeight;
        
        // Validate interpolated coordinates
        if (!isValidCoordinatePair(interpolatedLat, interpolatedLng)) {
            return null;
        }
        
        // Now calculate spatial weights with the interpolated position
        const refinedResult = await refineWithSpatialWeights(
            { lat: interpolatedLat, lng: interpolatedLng },
            targetImage,
            weightedImages,
            maxRadius
        );
        
        return refinedResult || {
            latitude: interpolatedLat,
            longitude: interpolatedLng,
            source: 'image_interpolated',
            accuracy: null,
            confidence: totalWeight / topImages.length,
            referenceCount: topImages.length,
            interpolationDetails: {
                method: 'temporal_weighted',
                referenceImages: topImages.map(img => ({
                    fileName: img.metadata?.fileName || 'unknown',
                    coordinates: img.coordinates,
                    weight: img.weight,
                    timeDiff: img.timeDiff
                }))
            }
        };
        
    } catch (error) {
        console.warn(`Warning: Weighted interpolation failed: ${error.message}`);
        return null;
    }
}

/**
 * Refine interpolation with spatial weights
 * @param {Object} estimatedCoords - Estimated coordinates {lat, lng}
 * @param {Object} targetImage - Target image metadata
 * @param {Array} weightedImages - Images with temporal weights
 * @param {number} maxRadius - Maximum radius in meters
 * @returns {Object|null} Refined interpolation result
 */
async function refineWithSpatialWeights(estimatedCoords, targetImage, weightedImages, maxRadius) {
    try {
        // Filter images within spatial radius
        const spatiallyNearImages = filterCoordinatesWithinRadius(
            estimatedCoords,
            weightedImages.map(img => ({
                ...img.coordinates,
                ...img
            })),
            maxRadius
        );
        
        if (spatiallyNearImages.length === 0) {
            return null;
        }
        
        // Recalculate weights combining temporal and spatial factors
        let totalWeight = 0;
        let weightedLat = 0;
        let weightedLng = 0;
        
        for (const img of spatiallyNearImages) {
            // Spatial weight (closer in space = higher weight)
            const spatialWeight = Math.max(0, 1 - (img.distance / maxRadius));
            
            // Find original temporal weight
            const originalImg = weightedImages.find(w => 
                w.coordinates.lat === img.lat && w.coordinates.lng === img.lng
            );
            const temporalWeight = originalImg ? originalImg.weight : 0;
            
            // Combined weight (you can adjust the balance between temporal and spatial)
            const combinedWeight = (temporalWeight * 0.6) + (spatialWeight * 0.4);
            
            if (combinedWeight > 0) {
                weightedLat += img.lat * combinedWeight;
                weightedLng += img.lng * combinedWeight;
                totalWeight += combinedWeight;
            }
        }
        
        if (totalWeight === 0) {
            return null;
        }
        
        const refinedLat = weightedLat / totalWeight;
        const refinedLng = weightedLng / totalWeight;
        
        if (!isValidCoordinatePair(refinedLat, refinedLng)) {
            return null;
        }
        
        return {
            latitude: refinedLat,
            longitude: refinedLng,
            source: 'image_interpolated_refined',
            accuracy: null,
            confidence: totalWeight / spatiallyNearImages.length,
            referenceCount: spatiallyNearImages.length,
            interpolationDetails: {
                method: 'temporal_spatial_weighted',
                spatialRadius: maxRadius,
                referenceImages: spatiallyNearImages.map(img => ({
                    fileName: img.metadata?.fileName || 'unknown',
                    coordinates: { lat: img.lat, lng: img.lng },
                    distance: img.distance,
                    timeDiff: img.timeDiff
                }))
            }
        };
        
    } catch (error) {
        console.warn(`Warning: Spatial refinement failed: ${error.message}`);
        return null;
    }
}

/**
 * Validate interpolation result
 * @param {Object} result - Interpolation result
 * @returns {boolean} True if result is valid
 */
export function validateInterpolationResult(result) {
    if (!result || typeof result !== 'object') {
        return false;
    }
    
    // Check required fields
    if (typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
        return false;
    }
    
    // Validate coordinates
    if (!isValidCoordinatePair(result.latitude, result.longitude)) {
        return false;
    }
    
    // Check source
    if (typeof result.source !== 'string') {
        return false;
    }
    
    return true;
}

/**
 * Get interpolation statistics
 * @param {Array} results - Array of interpolation results
 * @returns {Object} Statistics object
 */
export function getInterpolationStatistics(results) {
    if (!Array.isArray(results)) {
        return {
            total: 0,
            successful: 0,
            failed: 0,
            sources: {},
            averageConfidence: 0
        };
    }
    
    const stats = {
        total: results.length,
        successful: 0,
        failed: 0,
        sources: {},
        averageConfidence: 0,
        averageTimeDifference: 0
    };
    
    let totalConfidence = 0;
    let totalTimeDiff = 0;
    let confidenceCount = 0;
    let timeDiffCount = 0;
    
    for (const result of results) {
        if (result && validateInterpolationResult(result)) {
            stats.successful++;
            
            // Count sources
            const source = result.source || 'unknown';
            stats.sources[source] = (stats.sources[source] || 0) + 1;
            
            // Average confidence
            if (typeof result.confidence === 'number') {
                totalConfidence += result.confidence;
                confidenceCount++;
            }
            
            // Average time difference
            if (typeof result.timeDifference === 'number') {
                totalTimeDiff += result.timeDifference;
                timeDiffCount++;
            }
        } else {
            stats.failed++;
        }
    }
    
    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    stats.averageTimeDifference = timeDiffCount > 0 ? totalTimeDiff / timeDiffCount : 0;
    
    return stats;
}
