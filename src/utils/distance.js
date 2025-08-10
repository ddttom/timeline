/**
 * Distance calculation utilities
 * Provides functions for calculating distances between coordinates
 */

/**
 * Calculate the Haversine distance between two points on Earth
 * @param {number} lat1 - Latitude of first point in decimal degrees
 * @param {number} lng1 - Longitude of first point in decimal degrees
 * @param {number} lat2 - Latitude of second point in decimal degrees
 * @param {number} lng2 - Longitude of second point in decimal degrees
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    
    // Convert degrees to radians
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
}

/**
 * Calculate distance between two coordinate objects
 * @param {Object} coord1 - First coordinate {lat, lng}
 * @param {Object} coord2 - Second coordinate {lat, lng}
 * @returns {number} Distance in meters
 */
export function calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) {
        throw new Error('Both coordinates must be provided');
    }
    
    if (typeof coord1.lat !== 'number' || typeof coord1.lng !== 'number' ||
        typeof coord2.lat !== 'number' || typeof coord2.lng !== 'number') {
        throw new Error('Coordinates must have numeric lat and lng properties');
    }
    
    return calculateHaversineDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
}

/**
 * Find the closest coordinate from an array of coordinates
 * @param {Object} targetCoord - Target coordinate {lat, lng}
 * @param {Array} coordinates - Array of coordinate objects {lat, lng}
 * @returns {Object} Object with closest coordinate and distance
 */
export function findClosestCoordinate(targetCoord, coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        throw new Error('Coordinates array must not be empty');
    }
    
    let closestCoord = null;
    let minDistance = Infinity;
    
    for (const coord of coordinates) {
        const distance = calculateDistance(targetCoord, coord);
        if (distance < minDistance) {
            minDistance = distance;
            closestCoord = coord;
        }
    }
    
    return {
        coordinate: closestCoord,
        distance: minDistance
    };
}

/**
 * Filter coordinates within a specified radius
 * @param {Object} centerCoord - Center coordinate {lat, lng}
 * @param {Array} coordinates - Array of coordinate objects
 * @param {number} radiusMeters - Radius in meters
 * @returns {Array} Array of coordinates within radius with distances
 */
export function filterCoordinatesWithinRadius(centerCoord, coordinates, radiusMeters) {
    if (!Array.isArray(coordinates)) {
        throw new Error('Coordinates must be an array');
    }
    
    if (typeof radiusMeters !== 'number' || radiusMeters < 0) {
        throw new Error('Radius must be a positive number');
    }
    
    return coordinates
        .map(coord => ({
            ...coord,
            distance: calculateDistance(centerCoord, coord)
        }))
        .filter(coord => coord.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Latitude of first point in decimal degrees
 * @param {number} lng1 - Longitude of first point in decimal degrees
 * @param {number} lat2 - Latitude of second point in decimal degrees
 * @param {number} lng2 - Longitude of second point in decimal degrees
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize to 0-360
}

/**
 * Calculate the midpoint between two coordinates
 * @param {Object} coord1 - First coordinate {lat, lng}
 * @param {Object} coord2 - Second coordinate {lat, lng}
 * @returns {Object} Midpoint coordinate {lat, lng}
 */
export function calculateMidpoint(coord1, coord2) {
    if (!coord1 || !coord2) {
        throw new Error('Both coordinates must be provided');
    }
    
    const φ1 = coord1.lat * Math.PI / 180;
    const φ2 = coord2.lat * Math.PI / 180;
    const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;
    
    const Bx = Math.cos(φ2) * Math.cos(Δλ);
    const By = Math.cos(φ2) * Math.sin(Δλ);
    
    const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2),
                         Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By));
    const λ3 = (coord1.lng * Math.PI / 180) + Math.atan2(By, Math.cos(φ1) + Bx);
    
    return {
        lat: φ3 * 180 / Math.PI,
        lng: λ3 * 180 / Math.PI
    };
}

/**
 * Check if a coordinate is within a bounding box
 * @param {Object} coord - Coordinate to check {lat, lng}
 * @param {Object} bounds - Bounding box {north, south, east, west}
 * @returns {boolean} True if coordinate is within bounds
 */
export function isWithinBounds(coord, bounds) {
    if (!coord || !bounds) {
        throw new Error('Coordinate and bounds must be provided');
    }
    
    return coord.lat >= bounds.south &&
           coord.lat <= bounds.north &&
           coord.lng >= bounds.west &&
           coord.lng <= bounds.east;
}

/**
 * Create a bounding box around a center point with a given radius
 * @param {Object} centerCoord - Center coordinate {lat, lng}
 * @param {number} radiusMeters - Radius in meters
 * @returns {Object} Bounding box {north, south, east, west}
 */
export function createBoundingBox(centerCoord, radiusMeters) {
    if (!centerCoord || typeof radiusMeters !== 'number') {
        throw new Error('Center coordinate and radius must be provided');
    }
    
    // Approximate degrees per meter (varies by latitude)
    const latDegreesPerMeter = 1 / 111320;
    const lngDegreesPerMeter = 1 / (111320 * Math.cos(centerCoord.lat * Math.PI / 180));
    
    const latOffset = radiusMeters * latDegreesPerMeter;
    const lngOffset = radiusMeters * lngDegreesPerMeter;
    
    return {
        north: centerCoord.lat + latOffset,
        south: centerCoord.lat - latOffset,
        east: centerCoord.lng + lngOffset,
        west: centerCoord.lng - lngOffset
    };
}
