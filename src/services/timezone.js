/**
 * Timezone handling service
 * Handles timezone extraction from EXIF data and system fallback
 */

/**
 * Extract timezone from EXIF data or use system fallback
 * @param {Object} exifData - EXIF metadata object
 * @returns {string} Timezone identifier (e.g., 'America/New_York')
 */
export function extractTimezone(exifData) {
    try {
        // Try to extract timezone from EXIF data
        const exifTimezone = getTimezoneFromExif(exifData);
        if (exifTimezone) {
            return exifTimezone;
        }
        
        // Fallback to system timezone
        return getSystemTimezone();
        
    } catch (error) {
        console.warn(`Warning: Failed to extract timezone: ${error.message}`);
        return getSystemTimezone();
    }
}

/**
 * Get timezone from EXIF data
 * @param {Object} exifData - EXIF metadata object
 * @returns {string|null} Timezone identifier or null if not found
 */
function getTimezoneFromExif(exifData) {
    if (!exifData || !exifData.parsedExif) {
        return null;
    }
    
    // Look for timezone information in various EXIF fields
    const exif = exifData.parsedExif;
    
    // Check for timezone offset in DateTime fields
    if (exif.DateTimeOriginal) {
        const timezone = parseTimezoneFromDateTime(exif.DateTimeOriginal);
        if (timezone) return timezone;
    }
    
    if (exif.DateTime) {
        const timezone = parseTimezoneFromDateTime(exif.DateTime);
        if (timezone) return timezone;
    }
    
    if (exif.DateTimeDigitized) {
        const timezone = parseTimezoneFromDateTime(exif.DateTimeDigitized);
        if (timezone) return timezone;
    }
    
    // Check for timezone-specific EXIF tags
    if (exif.TimeZoneOffset) {
        return convertOffsetToTimezone(exif.TimeZoneOffset);
    }
    
    if (exif.OffsetTime) {
        return convertOffsetToTimezone(exif.OffsetTime);
    }
    
    if (exif.OffsetTimeOriginal) {
        return convertOffsetToTimezone(exif.OffsetTimeOriginal);
    }
    
    if (exif.OffsetTimeDigitized) {
        return convertOffsetToTimezone(exif.OffsetTimeDigitized);
    }
    
    return null;
}

/**
 * Parse timezone from DateTime string
 * @param {string} dateTimeString - DateTime string from EXIF
 * @returns {string|null} Timezone identifier or null
 */
function parseTimezoneFromDateTime(dateTimeString) {
    if (typeof dateTimeString !== 'string') {
        return null;
    }
    
    // Look for timezone offset patterns like +05:30, -08:00, etc.
    const offsetPattern = /([+-]\d{2}):?(\d{2})$/;
    const match = dateTimeString.match(offsetPattern);
    
    if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const totalMinutes = hours * 60 + (hours >= 0 ? minutes : -minutes);
        
        return convertOffsetToTimezone(totalMinutes);
    }
    
    return null;
}

/**
 * Convert timezone offset to timezone identifier
 * @param {number|string} offset - Timezone offset in minutes or string format
 * @returns {string} Timezone identifier
 */
function convertOffsetToTimezone(offset) {
    let offsetMinutes;
    
    if (typeof offset === 'string') {
        // Parse string format like "+05:30" or "-08:00"
        const match = offset.match(/([+-])(\d{1,2}):?(\d{2})?/);
        if (match) {
            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]);
            const minutes = parseInt(match[3] || '0');
            offsetMinutes = sign * (hours * 60 + minutes);
        } else {
            offsetMinutes = 0;
        }
    } else if (typeof offset === 'number') {
        offsetMinutes = offset;
    } else {
        offsetMinutes = 0;
    }
    
    // Convert offset to common timezone identifiers
    // This is a simplified mapping - in production, you might want a more comprehensive lookup
    const timezoneMap = {
        '-720': 'Pacific/Auckland',     // UTC+12
        '-660': 'Pacific/Noumea',       // UTC+11
        '-600': 'Australia/Sydney',     // UTC+10
        '-540': 'Asia/Tokyo',           // UTC+9
        '-480': 'Asia/Shanghai',        // UTC+8
        '-420': 'Asia/Bangkok',         // UTC+7
        '-360': 'Asia/Dhaka',           // UTC+6
        '-300': 'Asia/Karachi',         // UTC+5
        '-270': 'Asia/Kolkata',         // UTC+5:30
        '-240': 'Asia/Dubai',           // UTC+4
        '-180': 'Europe/Moscow',        // UTC+3
        '-120': 'Europe/Berlin',        // UTC+2
        '-60': 'Europe/London',         // UTC+1
        '0': 'UTC',                     // UTC
        '60': 'Atlantic/Azores',        // UTC-1
        '120': 'Atlantic/South_Georgia', // UTC-2
        '180': 'America/Sao_Paulo',     // UTC-3
        '240': 'America/New_York',      // UTC-4
        '300': 'America/New_York',      // UTC-5
        '360': 'America/Chicago',       // UTC-6
        '420': 'America/Denver',        // UTC-7
        '480': 'America/Los_Angeles',   // UTC-8
        '540': 'America/Anchorage',     // UTC-9
        '600': 'Pacific/Honolulu',      // UTC-10
        '660': 'Pacific/Midway',        // UTC-11
        '720': 'Pacific/Kwajalein'      // UTC-12
    };
    
    const key = (-offsetMinutes).toString();
    return timezoneMap[key] || 'UTC';
}

/**
 * Get system timezone
 * @returns {string} System timezone identifier
 */
export function getSystemTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.warn('Warning: Failed to get system timezone, using UTC');
        return 'UTC';
    }
}

/**
 * Convert timestamp to specific timezone
 * @param {Date} timestamp - Original timestamp
 * @param {string} timezone - Target timezone identifier
 * @returns {Date} Converted timestamp
 */
export function convertToTimezone(timestamp, timezone) {
    if (!(timestamp instanceof Date)) {
        throw new Error('Timestamp must be a Date object');
    }
    
    if (typeof timezone !== 'string') {
        throw new Error('Timezone must be a string');
    }
    
    try {
        // Create a new date in the target timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const parts = formatter.formatToParts(timestamp);
        const partsObj = {};
        
        for (const part of parts) {
            partsObj[part.type] = part.value;
        }
        
        // Construct new date string
        const dateString = `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`;
        
        return new Date(dateString);
        
    } catch (error) {
        console.warn(`Warning: Failed to convert to timezone ${timezone}: ${error.message}`);
        return timestamp;
    }
}

/**
 * Normalize timestamp to UTC
 * @param {Date} timestamp - Original timestamp
 * @param {string} sourceTimezone - Source timezone identifier
 * @returns {Date} UTC timestamp
 */
export function normalizeToUTC(timestamp, sourceTimezone) {
    if (!(timestamp instanceof Date)) {
        throw new Error('Timestamp must be a Date object');
    }
    
    if (typeof sourceTimezone !== 'string') {
        throw new Error('Source timezone must be a string');
    }
    
    try {
        // Get the timezone offset for the source timezone at the given timestamp
        const tempDate = new Date(timestamp.toLocaleString('en-US', { timeZone: sourceTimezone }));
        const utcDate = new Date(timestamp.toLocaleString('en-US', { timeZone: 'UTC' }));
        
        const offset = tempDate.getTime() - utcDate.getTime();
        
        return new Date(timestamp.getTime() - offset);
        
    } catch (error) {
        console.warn(`Warning: Failed to normalize to UTC from ${sourceTimezone}: ${error.message}`);
        return timestamp;
    }
}

/**
 * Get timezone offset in minutes
 * @param {string} timezone - Timezone identifier
 * @param {Date} date - Date to get offset for (default: current date)
 * @returns {number} Offset in minutes
 */
export function getTimezoneOffset(timezone, date = new Date()) {
    try {
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        
        return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
        
    } catch (error) {
        console.warn(`Warning: Failed to get timezone offset for ${timezone}: ${error.message}`);
        return 0;
    }
}

/**
 * Check if timezone is valid
 * @param {string} timezone - Timezone identifier to validate
 * @returns {boolean} True if timezone is valid
 */
export function isValidTimezone(timezone) {
    if (typeof timezone !== 'string') {
        return false;
    }
    
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get common timezone identifiers
 * @returns {Array} Array of common timezone identifiers
 */
export function getCommonTimezones() {
    return [
        'UTC',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
        'Europe/London',
        'Europe/Berlin',
        'Europe/Moscow',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Kolkata',
        'Asia/Dubai',
        'Australia/Sydney',
        'Pacific/Auckland'
    ];
}

/**
 * Format timezone offset as string
 * @param {number} offsetMinutes - Offset in minutes
 * @returns {string} Formatted offset string (e.g., "+05:30", "-08:00")
 */
export function formatTimezoneOffset(offsetMinutes) {
    if (typeof offsetMinutes !== 'number') {
        return '+00:00';
    }
    
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse timezone offset from string
 * @param {string} offsetString - Offset string (e.g., "+05:30", "-08:00")
 * @returns {number} Offset in minutes
 */
export function parseTimezoneOffset(offsetString) {
    if (typeof offsetString !== 'string') {
        return 0;
    }
    
    const match = offsetString.match(/([+-])(\d{1,2}):?(\d{2})?/);
    if (!match) {
        return 0;
    }
    
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2]);
    const minutes = parseInt(match[3] || '0');
    
    return sign * (hours * 60 + minutes);
}

/**
 * Get timezone information for a coordinate
 * This is a simplified implementation - in production, you might want to use a timezone lookup service
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @returns {string} Estimated timezone identifier
 */
export function getTimezoneFromCoordinates(latitude, longitude) {
    // This is a very simplified timezone estimation based on longitude
    // In production, you would use a proper timezone lookup service or database
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return 'UTC';
    }
    
    // Rough timezone estimation based on longitude (15 degrees per hour)
    const offsetHours = Math.round(longitude / 15);
    const offsetMinutes = offsetHours * 60;
    
    return convertOffsetToTimezone(-offsetMinutes);
}
