/**
 * EXIF metadata extraction and manipulation service
 * Handles reading and writing EXIF data from images using Sharp library
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isValidCoordinatePair, dmsToDecimal, decimalToDms } from '../utils/coordinates.js';

const execAsync = promisify(exec);

/**
 * Supported image file extensions
 */
export const SUPPORTED_EXTENSIONS = [
    '.jpg', '.jpeg', '.tiff', '.tif', '.png', '.webp', '.avif', '.heif', '.heic',
    '.dng', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.raf', '.pef', '.srw'
];

/**
 * Check if file is a supported image format
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file is supported
 */
export function isSupportedImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Extract complete EXIF metadata from an image file
 * @param {string} filePath - Path to the image file
 * @returns {Object} EXIF metadata object
 */
export async function extractExifMetadata(filePath) {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        
        // Extract basic metadata
        const exifData = {
            filePath: path.resolve(filePath),
            fileName: path.basename(filePath),
            fileSize: fs.statSync(filePath).size,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            density: metadata.density,
            hasProfile: metadata.hasProfile,
            hasAlpha: metadata.hasAlpha,
            orientation: metadata.orientation,
            exif: metadata.exif || null,
            icc: metadata.icc || null,
            iptc: metadata.iptc || null,
            xmp: metadata.xmp || null,
            tifftagPhotoshop: metadata.tifftagPhotoshop || null
        };
        
        // Parse EXIF data if available
        if (metadata.exif) {
            try {
                const exifBuffer = metadata.exif;
                const parsedExif = parseExifBuffer(exifBuffer);
                exifData.parsedExif = parsedExif;
                
                // Extract GPS coordinates if available
                const gpsData = extractGpsFromExif(parsedExif);
                if (gpsData) {
                    exifData.gps = gpsData;
                }
                
                // Extract timestamp information
                const timestampData = extractTimestampFromExif(parsedExif);
                if (timestampData) {
                    exifData.timestamp = timestampData;
                }
                
            } catch (parseError) {
                console.warn(`Warning: Failed to parse EXIF data for ${filePath}: ${parseError.message}`);
                exifData.exifParseError = parseError.message;
            }
        }
        
        return exifData;
        
    } catch (error) {
        throw new Error(`Failed to extract EXIF metadata from ${filePath}: ${error.message}`);
    }
}

/**
 * Parse EXIF buffer to extract readable data
 * @param {Buffer} exifBuffer - EXIF data buffer
 * @returns {Object} Parsed EXIF data
 */
function parseExifBuffer(exifBuffer) {
    const exifData = {};
    
    try {
        // Use a simple EXIF parser implementation
        // This parses the most common EXIF tags including GPS data
        const parsed = parseExifTags(exifBuffer);
        
        // Extract GPS-related tags
        if (parsed.gps) {
            exifData.gps = parsed.gps;
        }
        
        // Extract timestamp-related tags
        if (parsed.datetime) {
            exifData.datetime = parsed.datetime;
        }
        
        // Extract other useful metadata
        if (parsed.camera) {
            exifData.camera = parsed.camera;
        }
        
        return exifData;
    } catch (error) {
        throw new Error(`Failed to parse EXIF buffer: ${error.message}`);
    }
}

/**
 * Parse EXIF tags from buffer
 * @param {Buffer} buffer - EXIF data buffer
 * @returns {Object} Parsed EXIF tags
 */
function parseExifTags(buffer) {
    const result = {
        gps: {},
        datetime: {},
        camera: {}
    };
    
    try {
        // Check for EXIF header
        if (buffer.length < 8) {
            return result;
        }
        
        // Simple EXIF parsing - look for GPS tags
        const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        
        // Check for TIFF header (0x4949 or 0x4D4D)
        const tiffHeader = dataView.getUint16(0, true);
        const littleEndian = tiffHeader === 0x4949;
        
        if (tiffHeader !== 0x4949 && tiffHeader !== 0x4D4D) {
            return result;
        }
        
        // Get IFD offset
        const ifdOffset = dataView.getUint32(4, littleEndian);
        
        if (ifdOffset >= buffer.length) {
            return result;
        }
        
        // Parse IFD entries
        parseIFD(dataView, ifdOffset, littleEndian, result);
        
        return result;
        
    } catch (error) {
        console.warn('EXIF parsing error:', error.message);
        return result;
    }
}

/**
 * Parse IFD (Image File Directory) entries
 * @param {DataView} dataView - Data view of EXIF buffer
 * @param {number} offset - IFD offset
 * @param {boolean} littleEndian - Byte order
 * @param {Object} result - Result object to populate
 */
function parseIFD(dataView, offset, littleEndian, result) {
    try {
        if (offset + 2 >= dataView.byteLength) {
            return;
        }
        
        const entryCount = dataView.getUint16(offset, littleEndian);
        let entryOffset = offset + 2;
        
        for (let i = 0; i < entryCount && entryOffset + 12 <= dataView.byteLength; i++) {
            const tag = dataView.getUint16(entryOffset, littleEndian);
            const type = dataView.getUint16(entryOffset + 2, littleEndian);
            const count = dataView.getUint32(entryOffset + 4, littleEndian);
            const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian);
            
            // Parse GPS tags
            parseGpsTag(tag, type, count, valueOffset, dataView, littleEndian, result.gps);
            
            // Parse datetime tags
            parseDateTimeTag(tag, type, count, valueOffset, dataView, littleEndian, result.datetime);
            
            entryOffset += 12;
        }
        
        // Look for GPS IFD
        const nextIfdOffset = dataView.getUint32(entryOffset, littleEndian);
        if (nextIfdOffset > 0 && nextIfdOffset < dataView.byteLength) {
            parseIFD(dataView, nextIfdOffset, littleEndian, result);
        }
        
    } catch (error) {
        console.warn('IFD parsing error:', error.message);
    }
}

/**
 * Parse GPS-specific EXIF tags
 * @param {number} tag - EXIF tag number
 * @param {number} type - Data type
 * @param {number} count - Value count
 * @param {number} valueOffset - Value offset
 * @param {DataView} dataView - Data view
 * @param {boolean} littleEndian - Byte order
 * @param {Object} gpsData - GPS data object to populate
 */
function parseGpsTag(tag, type, count, valueOffset, dataView, littleEndian, gpsData) {
    try {
        switch (tag) {
            case 0x0001: // GPSLatitudeRef
                gpsData.latitudeRef = readStringValue(dataView, valueOffset, count);
                break;
            case 0x0002: // GPSLatitude
                gpsData.latitude = readRationalArray(dataView, valueOffset, count, littleEndian);
                break;
            case 0x0003: // GPSLongitudeRef
                gpsData.longitudeRef = readStringValue(dataView, valueOffset, count);
                break;
            case 0x0004: // GPSLongitude
                gpsData.longitude = readRationalArray(dataView, valueOffset, count, littleEndian);
                break;
            case 0x0005: // GPSAltitudeRef
                gpsData.altitudeRef = dataView.getUint8(valueOffset);
                break;
            case 0x0006: // GPSAltitude
                gpsData.altitude = readRational(dataView, valueOffset, littleEndian);
                break;
            case 0x0010: // GPSImgDirection
                gpsData.bearing = readRational(dataView, valueOffset, littleEndian);
                break;
            case 0x001F: // GPSHPositioningError
                gpsData.accuracy = readRational(dataView, valueOffset, littleEndian);
                break;
        }
    } catch (error) {
        console.warn(`GPS tag ${tag} parsing error:`, error.message);
    }
}

/**
 * Parse datetime-specific EXIF tags
 * @param {number} tag - EXIF tag number
 * @param {number} type - Data type
 * @param {number} count - Value count
 * @param {number} valueOffset - Value offset
 * @param {DataView} dataView - Data view
 * @param {boolean} littleEndian - Byte order
 * @param {Object} datetimeData - Datetime data object to populate
 */
function parseDateTimeTag(tag, type, count, valueOffset, dataView, littleEndian, datetimeData) {
    try {
        switch (tag) {
            case 0x0132: // DateTime
                datetimeData.dateTime = readStringValue(dataView, valueOffset, count);
                break;
            case 0x9003: // DateTimeOriginal
                datetimeData.dateTimeOriginal = readStringValue(dataView, valueOffset, count);
                break;
            case 0x9004: // DateTimeDigitized
                datetimeData.dateTimeDigitized = readStringValue(dataView, valueOffset, count);
                break;
        }
    } catch (error) {
        console.warn(`DateTime tag ${tag} parsing error:`, error.message);
    }
}

/**
 * Read rational value (fraction) from EXIF data
 * @param {DataView} dataView - Data view
 * @param {number} offset - Value offset
 * @param {boolean} littleEndian - Byte order
 * @returns {number} Decimal value
 */
function readRational(dataView, offset, littleEndian) {
    if (offset + 8 > dataView.byteLength) {
        return null;
    }
    
    const numerator = dataView.getUint32(offset, littleEndian);
    const denominator = dataView.getUint32(offset + 4, littleEndian);
    
    return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Read array of rational values from EXIF data
 * @param {DataView} dataView - Data view
 * @param {number} offset - Value offset
 * @param {number} count - Number of values
 * @param {boolean} littleEndian - Byte order
 * @returns {Array} Array of decimal values
 */
function readRationalArray(dataView, offset, count, littleEndian) {
    const values = [];
    
    for (let i = 0; i < count && offset + (i * 8) + 8 <= dataView.byteLength; i++) {
        const rational = readRational(dataView, offset + (i * 8), littleEndian);
        if (rational !== null) {
            values.push(rational);
        }
    }
    
    return values;
}

/**
 * Read string value from EXIF data
 * @param {DataView} dataView - Data view
 * @param {number} offset - Value offset
 * @param {number} length - String length
 * @returns {string} String value
 */
function readStringValue(dataView, offset, length) {
    if (offset + length > dataView.byteLength) {
        return '';
    }
    
    const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, length);
    return String.fromCharCode(...bytes).replace(/\0/g, '');
}

/**
 * Extract GPS coordinates from parsed EXIF data
 * @param {Object} exifData - Parsed EXIF data
 * @returns {Object|null} GPS coordinates or null if not found
 */
function extractGpsFromExif(exifData) {
    try {
        if (!exifData || !exifData.gps) {
            return null;
        }
        
        const gps = exifData.gps;
        
        // Check if we have the minimum required GPS data
        if (!gps.latitude || !gps.longitude || !gps.latitudeRef || !gps.longitudeRef) {
            return null;
        }
        
        // Convert DMS (Degrees, Minutes, Seconds) to decimal degrees
        const latitude = convertDmsToDecimal(gps.latitude, gps.latitudeRef);
        const longitude = convertDmsToDecimal(gps.longitude, gps.longitudeRef);
        
        if (latitude === null || longitude === null) {
            return null;
        }
        
        // Validate coordinates
        if (!isValidCoordinatePair(latitude, longitude)) {
            return null;
        }
        
        // Build GPS data object
        const gpsData = {
            latitude: latitude,
            longitude: longitude,
            altitude: null,
            bearing: null,
            accuracy: null,
            timestamp: null
        };
        
        // Add altitude if available
        if (gps.altitude !== undefined && gps.altitude !== null) {
            gpsData.altitude = gps.altitude;
            // Apply altitude reference (0 = above sea level, 1 = below sea level)
            if (gps.altitudeRef === 1) {
                gpsData.altitude = -gpsData.altitude;
            }
        }
        
        // Add bearing if available
        if (gps.bearing !== undefined && gps.bearing !== null) {
            gpsData.bearing = gps.bearing;
        }
        
        // Add accuracy if available
        if (gps.accuracy !== undefined && gps.accuracy !== null) {
            gpsData.accuracy = gps.accuracy;
        }
        
        return gpsData;
        
    } catch (error) {
        console.warn('GPS extraction error:', error.message);
        return null;
    }
}

/**
 * Convert DMS (Degrees, Minutes, Seconds) to decimal degrees
 * @param {Array} dmsArray - Array of [degrees, minutes, seconds]
 * @param {string} ref - Reference (N/S for latitude, E/W for longitude)
 * @returns {number|null} Decimal degrees or null if invalid
 */
function convertDmsToDecimal(dmsArray, ref) {
    try {
        if (!Array.isArray(dmsArray) || dmsArray.length < 3) {
            return null;
        }
        
        const degrees = dmsArray[0] || 0;
        const minutes = dmsArray[1] || 0;
        const seconds = dmsArray[2] || 0;
        
        let decimal = degrees + (minutes / 60) + (seconds / 3600);
        
        // Apply reference direction
        if (ref === 'S' || ref === 'W') {
            decimal = -decimal;
        }
        
        return decimal;
        
    } catch (error) {
        console.warn('DMS conversion error:', error.message);
        return null;
    }
}

/**
 * Extract timestamp information from parsed EXIF data
 * @param {Object} exifData - Parsed EXIF data
 * @returns {Object|null} Timestamp data or null if not found
 */
function extractTimestampFromExif(exifData) {
    try {
        if (!exifData || !exifData.datetime) {
            return null;
        }
        
        const datetime = exifData.datetime;
        const timestampData = {};
        
        // Try to parse DateTimeOriginal first (most accurate for photos)
        if (datetime.dateTimeOriginal) {
            const parsed = parseExifDateTime(datetime.dateTimeOriginal);
            if (parsed) {
                timestampData.dateTime = parsed.toISOString();
                timestampData.source = 'DateTimeOriginal';
                return timestampData;
            }
        }
        
        // Fallback to DateTimeDigitized
        if (datetime.dateTimeDigitized) {
            const parsed = parseExifDateTime(datetime.dateTimeDigitized);
            if (parsed) {
                timestampData.dateTime = parsed.toISOString();
                timestampData.source = 'DateTimeDigitized';
                return timestampData;
            }
        }
        
        // Fallback to DateTime
        if (datetime.dateTime) {
            const parsed = parseExifDateTime(datetime.dateTime);
            if (parsed) {
                timestampData.dateTime = parsed.toISOString();
                timestampData.source = 'DateTime';
                return timestampData;
            }
        }
        
        return null;
        
    } catch (error) {
        console.warn('Timestamp extraction error:', error.message);
        return null;
    }
}

/**
 * Parse EXIF datetime string to Date object
 * @param {string} exifDateTime - EXIF datetime string (format: "YYYY:MM:DD HH:MM:SS")
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseExifDateTime(exifDateTime) {
    try {
        if (!exifDateTime || typeof exifDateTime !== 'string') {
            return null;
        }
        
        // EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
        const match = exifDateTime.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        
        if (!match) {
            return null;
        }
        
        const [, year, month, day, hour, minute, second] = match;
        
        // Create date object (month is 0-based in JavaScript)
        const date = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
        );
        
        // Validate the date
        if (isNaN(date.getTime())) {
            return null;
        }
        
        return date;
        
    } catch (error) {
        console.warn('EXIF datetime parsing error:', error.message);
        return null;
    }
}

/**
 * Get image timestamp from file metadata or EXIF
 * @param {string} filePath - Path to the image file
 * @returns {Date|null} Image timestamp or null if not available
 */
export async function getImageTimestamp(filePath) {
    try {
        // First try to get timestamp from EXIF
        const exifData = await extractExifMetadata(filePath);
        
        if (exifData.timestamp && exifData.timestamp.dateTime) {
            return new Date(exifData.timestamp.dateTime);
        }
        
        // Fallback to file modification time
        const stats = fs.statSync(filePath);
        return stats.mtime;
        
    } catch (error) {
        console.warn(`Warning: Failed to get timestamp for ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Extract GPS coordinates directly from image file
 * @param {string} filePath - Path to the image file
 * @returns {Object|null} GPS data or null if not found
 */
export async function extractGpsFromImage(filePath) {
    try {
        const exifData = await extractExifMetadata(filePath);
        
        if (!exifData.gps) {
            return null;
        }
        
        const gpsData = extractGpsFromExif(exifData);
        
        if (gpsData) {
            // Add timestamp from EXIF if available
            const timestampData = extractTimestampFromExif(exifData);
            if (timestampData && timestampData.dateTime) {
                gpsData.timestamp = timestampData.dateTime;
            }
        }
        
        return gpsData;
        
    } catch (error) {
        console.warn(`Warning: Failed to extract GPS from ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Check if image has GPS coordinates in EXIF
 * @param {string} filePath - Path to the image file
 * @returns {boolean} True if image has GPS coordinates
 */
export async function hasGpsCoordinates(filePath) {
    try {
        const gpsData = await extractGpsFromImage(filePath);
        return gpsData !== null && 
               typeof gpsData.latitude === 'number' && 
               typeof gpsData.longitude === 'number' &&
               isValidCoordinatePair(gpsData.latitude, gpsData.longitude);
    } catch (error) {
        console.warn(`Warning: Failed to check GPS coordinates for ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Write GPS coordinates to image EXIF data using hybrid approach
 * @param {string} filePath - Path to the image file
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @param {string} outputPath - Optional output path (defaults to overwriting original)
 * @returns {boolean} True if successful
 */
export async function writeGpsToExif(filePath, latitude, longitude, outputPath = null) {
    try {
        if (!isValidCoordinatePair(latitude, longitude)) {
            throw new Error('Invalid GPS coordinates provided');
        }
        
        const targetPath = outputPath || filePath;
        
        // Try piexifjs first (JavaScript-based approach)
        const piexifSuccess = await writeGpsWithPiexif(filePath, latitude, longitude, targetPath);
        if (piexifSuccess) {
            console.log(`📍 GPS coordinates written via piexifjs to ${targetPath}: ${latitude}, ${longitude}`);
            return true;
        }
        
        // Fallback to exiftool if piexifjs fails
        const exiftoolSuccess = await writeGpsWithExiftool(filePath, latitude, longitude, targetPath);
        if (exiftoolSuccess) {
            console.log(`📍 GPS coordinates written via exiftool to ${targetPath}: ${latitude}, ${longitude}`);
            return true;
        }
        
        // If both methods fail, log warning but don't throw error
        console.warn(`⚠️  Failed to write GPS coordinates to ${targetPath} - both piexifjs and exiftool failed`);
        return false;
        
    } catch (error) {
        throw new Error(`Failed to write GPS coordinates to ${filePath}: ${error.message}`);
    }
}

/**
 * Validate Unix epoch timestamp
 * @param {Date|number} timestamp - Timestamp to validate
 * @returns {boolean} True if timestamp is after Unix epoch
 */
export function isValidTimestamp(timestamp) {
    try {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const unixEpoch = new Date('1970-01-01T00:00:00Z');
        
        return date instanceof Date && 
               !isNaN(date.getTime()) && 
               date > unixEpoch;
    } catch (error) {
        return false;
    }
}

/**
 * Get file statistics including creation and modification times
 * @param {string} filePath - Path to the file
 * @returns {Object} File statistics
 */
export function getFileStats(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
        };
    } catch (error) {
        throw new Error(`Failed to get file stats for ${filePath}: ${error.message}`);
    }
}

/**
 * Create a backup of an image file before modification
 * @param {string} filePath - Path to the original file
 * @returns {string} Path to the backup file
 */
export async function createBackup(filePath) {
    try {
        const dir = path.dirname(filePath);
        const name = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        const backupPath = path.join(dir, `${name}_backup_${timestamp}${ext}`);
        
        await fs.promises.copyFile(filePath, backupPath);
        return backupPath;
        
    } catch (error) {
        throw new Error(`Failed to create backup for ${filePath}: ${error.message}`);
    }
}

/**
 * Write GPS coordinates using piexifjs library
 * @param {string} filePath - Source file path
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @param {string} targetPath - Target file path
 * @returns {boolean} True if successful
 */
async function writeGpsWithPiexif(filePath, latitude, longitude, targetPath) {
    try {
        // Dynamic import to handle optional dependency
        const piexif = (await import('piexifjs')).default;
        
        // Read the image file
        const imageBuffer = fs.readFileSync(filePath);
        const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        
        // Get existing EXIF data or create new
        let exifDict;
        try {
            exifDict = piexif.load(imageDataUrl);
        } catch (error) {
            // Create new EXIF dict if none exists
            exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
        }
        
        // Convert decimal degrees to DMS format for EXIF
        const latDms = decimalToDms(latitude, true);
        const lngDms = decimalToDms(longitude, false);
        
        // Set GPS data in EXIF
        exifDict.GPS[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
        exifDict.GPS[piexif.GPSIFD.GPSLatitudeRef] = latDms.ref;
        exifDict.GPS[piexif.GPSIFD.GPSLatitude] = [
            [latDms.degrees, 1],
            [Math.floor(latDms.minutes), 1],
            [Math.floor(latDms.seconds * 1000), 1000]
        ];
        exifDict.GPS[piexif.GPSIFD.GPSLongitudeRef] = lngDms.ref;
        exifDict.GPS[piexif.GPSIFD.GPSLongitude] = [
            [lngDms.degrees, 1],
            [Math.floor(lngDms.minutes), 1],
            [Math.floor(lngDms.seconds * 1000), 1000]
        ];
        
        // Convert back to binary
        const exifBytes = piexif.dump(exifDict);
        const newImageDataUrl = piexif.insert(exifBytes, imageDataUrl);
        
        // Extract base64 data and write to file
        const base64Data = newImageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const outputBuffer = Buffer.from(base64Data, 'base64');
        
        fs.writeFileSync(targetPath, outputBuffer);
        return true;
        
    } catch (error) {
        console.warn(`piexifjs GPS writing failed: ${error.message}`);
        return false;
    }
}

/**
 * Write GPS coordinates using exiftool command-line tool
 * @param {string} filePath - Source file path
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @param {string} targetPath - Target file path
 * @returns {boolean} True if successful
 */
async function writeGpsWithExiftool(filePath, latitude, longitude, targetPath) {
    try {
        // Check if exiftool is available
        try {
            await execAsync('exiftool -ver');
        } catch (error) {
            console.warn('exiftool not found in PATH');
            return false;
        }
        
        // Copy file if source and target are different
        if (filePath !== targetPath) {
            fs.copyFileSync(filePath, targetPath);
        }
        
        // Format coordinates for exiftool
        const latRef = latitude >= 0 ? 'N' : 'S';
        const lngRef = longitude >= 0 ? 'E' : 'W';
        const absLat = Math.abs(latitude);
        const absLng = Math.abs(longitude);
        
        // Build exiftool command
        const command = [
            'exiftool',
            '-overwrite_original',
            `-GPSLatitude=${absLat}`,
            `-GPSLatitudeRef=${latRef}`,
            `-GPSLongitude=${absLng}`,
            `-GPSLongitudeRef=${lngRef}`,
            '-GPSVersionID="2.3.0.0"',
            `"${targetPath}"`
        ].join(' ');
        
        await execAsync(command);
        return true;
        
    } catch (error) {
        console.warn(`exiftool GPS writing failed: ${error.message}`);
        return false;
    }
}
