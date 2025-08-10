/**
 * Coordinate conversion and validation utilities
 * Handles conversion between different coordinate formats and validation
 */

/**
 * Convert E7 format coordinates to decimal degrees
 * Google Maps timeline uses E7 format (coordinates multiplied by 10^7)
 * @param {number} e7Value - Coordinate in E7 format
 * @returns {number} Coordinate in decimal degrees
 */
export function e7ToDecimal(e7Value) {
    if (typeof e7Value !== 'number') {
        throw new Error('E7 value must be a number');
    }
    return e7Value / 10000000;
}

/**
 * Convert decimal degrees to E7 format
 * @param {number} decimal - Coordinate in decimal degrees
 * @returns {number} Coordinate in E7 format
 */
export function decimalToE7(decimal) {
    if (typeof decimal !== 'number') {
        throw new Error('Decimal value must be a number');
    }
    return Math.round(decimal * 10000000);
}

/**
 * Validate latitude coordinate
 * @param {number} lat - Latitude in decimal degrees
 * @returns {boolean} True if valid latitude
 */
export function isValidLatitude(lat) {
    return typeof lat === 'number' && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude coordinate
 * @param {number} lng - Longitude in decimal degrees
 * @returns {boolean} True if valid longitude
 */
export function isValidLongitude(lng) {
    return typeof lng === 'number' && lng >= -180 && lng <= 180;
}

/**
 * Validate coordinate pair
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @returns {boolean} True if both coordinates are valid
 */
export function isValidCoordinatePair(lat, lng) {
    return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Convert GPS coordinates to decimal degrees from DMS format
 * @param {Array} dmsArray - Array of [degrees, minutes, seconds]
 * @param {string} ref - Reference direction ('N', 'S', 'E', 'W')
 * @returns {number} Coordinate in decimal degrees
 */
export function dmsToDecimal(dmsArray, ref) {
    if (!Array.isArray(dmsArray) || dmsArray.length !== 3) {
        throw new Error('DMS array must contain exactly 3 elements [degrees, minutes, seconds]');
    }
    
    const [degrees, minutes, seconds] = dmsArray;
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    
    // Apply negative sign for South and West
    if (ref === 'S' || ref === 'W') {
        decimal = -decimal;
    }
    
    return decimal;
}

/**
 * Convert decimal degrees to DMS format
 * @param {number} decimal - Coordinate in decimal degrees
 * @param {boolean} isLatitude - True for latitude, false for longitude
 * @returns {Object} Object with degrees, minutes, seconds, and reference
 */
export function decimalToDms(decimal, isLatitude = true) {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutesFloat = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;
    
    let ref;
    if (isLatitude) {
        ref = decimal >= 0 ? 'N' : 'S';
    } else {
        ref = decimal >= 0 ? 'E' : 'W';
    }
    
    return {
        degrees,
        minutes,
        seconds,
        ref
    };
}

/**
 * Normalize longitude to -180 to 180 range
 * @param {number} lng - Longitude in decimal degrees
 * @returns {number} Normalized longitude
 */
export function normalizeLongitude(lng) {
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return lng;
}

/**
 * Calculate the center point of multiple coordinates
 * @param {Array} coordinates - Array of {lat, lng} objects
 * @returns {Object} Center point {lat, lng}
 */
export function calculateCenter(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        throw new Error('Coordinates array must not be empty');
    }
    
    let totalLat = 0;
    let totalLng = 0;
    
    for (const coord of coordinates) {
        if (!isValidCoordinatePair(coord.lat, coord.lng)) {
            throw new Error('Invalid coordinate pair in array');
        }
        totalLat += coord.lat;
        totalLng += coord.lng;
    }
    
    return {
        lat: totalLat / coordinates.length,
        lng: totalLng / coordinates.length
    };
}
