import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isValidCoordinatePair, dmsToDecimal, decimalToDms } from '../utils/coordinates.js';

const execAsync = promisify(exec);

/**
 * EXIF GPS tag definitions
 */
const GPS_TAGS = {
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x001D: 'GPSDateStamp'
};

/**
 * EXIF data type sizes in bytes
 */
const TYPE_SIZES = {
    1: 1,  // BYTE
    2: 1,  // ASCII
    3: 2,  // SHORT
    4: 4,  // LONG
    5: 8,  // RATIONAL
    6: 1,  // SBYTE
    7: 1,  // UNDEFINED
    8: 2,  // SSHORT
    9: 4,  // SLONG
    10: 8, // SRATIONAL
    11: 4, // FLOAT
    12: 8  // DOUBLE
};

/**
 * Extract GPS coordinates from image file
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object|null>} GPS coordinates or null if not found
 */
export async function extractGpsCoordinates(filePath) {
    try {
        // Check file format first to determine extraction strategy
        const buffer = await fs.promises.readFile(filePath);
        const fileFormat = detectFileFormat(buffer);
        
        // For CR3 and other formats that require exiftool, skip custom parsing
        if (fileFormat.requiresExiftool) {
            const exiftoolResult = await extractGpsWithExiftool(filePath);
            if (exiftoolResult) {
                return exiftoolResult;
            }
        } else if (fileFormat.supportsExif) {
            // Try custom EXIF parsing first for supported formats
            const customResult = await extractGpsFromExif(filePath);
            if (customResult) {
                return customResult;
            }
            
            // Fallback to exiftool if custom parsing fails
            const exiftoolResult = await extractGpsWithExiftool(filePath);
            if (exiftoolResult) {
                return exiftoolResult;
            }
        } else {
            // For unsupported formats, try exiftool as last resort
            const exiftoolResult = await extractGpsWithExiftool(filePath);
            if (exiftoolResult) {
                return exiftoolResult;
            }
        }
        
        return null;
        
    } catch (error) {
        console.warn(`GPS extraction failed for ${path.basename(filePath)}: ${error.message}`);
        return null;
    }
}

/**
 * Extract GPS coordinates using custom EXIF parsing
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object|null>} GPS coordinates or null if not found
 */
async function extractGpsFromExif(filePath) {
    try {
        const buffer = await fs.promises.readFile(filePath);
        const exifData = parseExifBuffer(buffer);
        
        if (!exifData || !exifData.gps) {
            return null;
        }
        
        const gps = exifData.gps;
        
        // Convert GPS coordinates to decimal degrees
        const coordinates = convertGpsToDecimal(gps);
        if (coordinates && isValidCoordinatePair(coordinates.latitude, coordinates.longitude)) {
            return coordinates;
        }
        
        return null;
        
    } catch (error) {
        console.warn(`Custom EXIF parsing failed for ${path.basename(filePath)}: ${error.message}`);
        return null;
    }
}

/**
 * Detect file format and EXIF support
 * @param {Buffer} buffer - Image file buffer
 * @returns {Object} File format information
 */
function detectFileFormat(buffer) {
    // Check for JPEG format
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return { type: 'JPEG', supportsExif: true };
    }
    
    // Check for CR3 format (Canon RAW v3)
    if (buffer.length >= 12) {
        const ftyp = buffer.slice(4, 8).toString();
        const brand = buffer.slice(8, 12).toString();
        if (ftyp === 'ftyp' && brand === 'crx ') {
            return { type: 'CR3', supportsExif: false, requiresExiftool: true };
        }
    }
    
    // Check for CR2 format (Canon RAW v2)
    if (buffer.length >= 10) {
        const cr2Header = buffer.slice(0, 10).toString();
        if (cr2Header.includes('CR')) {
            return { type: 'CR2', supportsExif: true, requiresExiftool: true };
        }
    }
    
    // Check for TIFF format
    if (buffer.length >= 4) {
        const tiffLE = Buffer.from([0x49, 0x49, 0x2A, 0x00]); // Little endian
        const tiffBE = Buffer.from([0x4D, 0x4D, 0x00, 0x2A]); // Big endian
        if (buffer.slice(0, 4).equals(tiffLE) || buffer.slice(0, 4).equals(tiffBE)) {
            return { type: 'TIFF', supportsExif: true };
        }
    }
    
    // Check for PNG format
    if (buffer.length >= 8) {
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (buffer.slice(0, 8).equals(pngSignature)) {
            return { type: 'PNG', supportsExif: false };
        }
    }
    
    // Check for NEF format (Nikon RAW)
    if (buffer.length >= 4) {
        const tiffLE = Buffer.from([0x49, 0x49, 0x2A, 0x00]);
        const tiffBE = Buffer.from([0x4D, 0x4D, 0x00, 0x2A]);
        if (buffer.slice(0, 4).equals(tiffLE) || buffer.slice(0, 4).equals(tiffBE)) {
            // Check for NEF specific markers
            const nefMarker = buffer.slice(0, 100).toString();
            if (nefMarker.includes('NIKON')) {
                return { type: 'NEF', supportsExif: true, requiresExiftool: true };
            }
        }
    }
    
    return { type: 'UNKNOWN', supportsExif: false };
}

/**
 * Parse EXIF data from image buffer
 * @param {Buffer} buffer - Image file buffer
 * @returns {Object|null} Parsed EXIF data or null if parsing fails
 */
function parseExifBuffer(buffer) {
    try {
        // Check file format first
        const fileFormat = detectFileFormat(buffer);
        if (!fileFormat.supportsExif) {
            return null;
        }
        
        // Find EXIF data in JPEG
        if (fileFormat.type === 'JPEG') {
            let offset = 2; // Skip JPEG SOI marker
            
            while (offset < buffer.length - 1) {
                if (buffer[offset] !== 0xFF) break;
                
                const marker = buffer[offset + 1];
                if (marker === 0xE1) { // APP1 marker (EXIF)
                    const segmentLength = buffer.readUInt16BE(offset + 2);
                    const exifHeader = buffer.slice(offset + 4, offset + 10).toString();
                    
                    if (exifHeader === 'Exif\0\0') {
                        const tiffStart = offset + 10;
                        return parseTiffData(buffer, tiffStart);
                    }
                }
                
                // Move to next segment
                const segmentLength = buffer.readUInt16BE(offset + 2);
                offset += 2 + segmentLength;
            }
        } else if (fileFormat.type === 'TIFF') {
            return parseTiffData(buffer, 0);
        }
        
        return null;
        
    } catch (error) {
        console.warn(`EXIF parsing error: ${error.message}`);
        return null;
    }
}

/**
 * Parse TIFF data structure
 * @param {Buffer} buffer - Image buffer
 * @param {number} tiffStart - Start offset of TIFF data
 * @returns {Object|null} Parsed TIFF data
 */
function parseTiffData(buffer, tiffStart) {
    try {
        // Check TIFF header
        const byteOrder = buffer.slice(tiffStart, tiffStart + 2);
        const isLittleEndian = byteOrder.equals(Buffer.from([0x49, 0x49]));
        
        // Read IFD0 offset
        const ifd0Offset = isLittleEndian 
            ? buffer.readUInt32LE(tiffStart + 4)
            : buffer.readUInt32BE(tiffStart + 4);
        
        // Parse IFD0
        const ifd0 = parseIFD(buffer, tiffStart + ifd0Offset, tiffStart, isLittleEndian);
        
        // Look for GPS IFD
        if (ifd0.gpsIFDOffset) {
            const gpsIFD = parseGpsIFD(buffer, tiffStart + ifd0.gpsIFDOffset, tiffStart, isLittleEndian);
            return { gps: gpsIFD };
        }
        
        return null;
        
    } catch (error) {
        console.warn(`TIFF parsing error: ${error.message}`);
        return null;
    }
}

/**
 * Parse Image File Directory (IFD)
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - IFD offset
 * @param {number} tiffStart - TIFF data start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {Object} Parsed IFD data
 */
function parseIFD(buffer, offset, tiffStart, isLittleEndian) {
    const entryCount = isLittleEndian 
        ? buffer.readUInt16LE(offset)
        : buffer.readUInt16BE(offset);
    
    const ifd = {};
    let currentOffset = offset + 2;
    
    for (let i = 0; i < entryCount; i++) {
        const tag = isLittleEndian 
            ? buffer.readUInt16LE(currentOffset)
            : buffer.readUInt16BE(currentOffset);
        
        if (tag === 0x8825) { // GPS IFD tag
            const valueOffset = isLittleEndian 
                ? buffer.readUInt32LE(currentOffset + 8)
                : buffer.readUInt32BE(currentOffset + 8);
            ifd.gpsIFDOffset = valueOffset;
        }
        
        currentOffset += 12; // Each IFD entry is 12 bytes
    }
    
    return ifd;
}

/**
 * Parse GPS IFD
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - GPS IFD offset
 * @param {number} tiffStart - TIFF data start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {Object} Parsed GPS data
 */
function parseGpsIFD(buffer, offset, tiffStart, isLittleEndian) {
    const entryCount = isLittleEndian 
        ? buffer.readUInt16LE(offset)
        : buffer.readUInt16BE(offset);
    
    const gps = {};
    let currentOffset = offset + 2;
    
    for (let i = 0; i < entryCount; i++) {
        const tag = isLittleEndian 
            ? buffer.readUInt16LE(currentOffset)
            : buffer.readUInt16BE(currentOffset);
        const type = isLittleEndian 
            ? buffer.readUInt16LE(currentOffset + 2)
            : buffer.readUInt16BE(currentOffset + 2);
        const count = isLittleEndian 
            ? buffer.readUInt32LE(currentOffset + 4)
            : buffer.readUInt32BE(currentOffset + 4);
        const valueOffset = isLittleEndian 
            ? buffer.readUInt32LE(currentOffset + 8)
            : buffer.readUInt32BE(currentOffset + 8);
        
        const tagName = GPS_TAGS[tag];
        if (tagName) {
            const value = parseGpsTagValue(buffer, tag, type, count, valueOffset, tiffStart, isLittleEndian);
            if (value !== null) {
                gps[tagName] = value;
            }
        }
        
        currentOffset += 12;
    }
    
    return gps;
}

/**
 * Get type size in bytes
 * @param {number} type - EXIF data type
 * @returns {number} Size in bytes
 */
function getTypeSize(type) {
    return TYPE_SIZES[type] || 1;
}

/**
 * Parse GPS tag value
 * @param {Buffer} buffer - Image buffer
 * @param {number} tag - GPS tag
 * @param {number} type - Data type
 * @param {number} count - Value count
 * @param {number} valueOffset - Value offset
 * @param {number} tiffStart - TIFF start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {*} Parsed value
 */
function parseGpsTagValue(buffer, tag, type, count, valueOffset, tiffStart, isLittleEndian) {
    const typeSize = getTypeSize(type);
    const totalSize = typeSize * count;
    
    let dataOffset;
    if (totalSize <= 4) {
        // Value is stored in the offset field itself
        dataOffset = tiffStart + valueOffset;
    } else {
        // Value is stored at the offset location
        dataOffset = tiffStart + valueOffset;
    }
    
    return parseGpsValue(buffer, dataOffset, tag, type, count, isLittleEndian);
}

/**
 * Parse GPS value based on type
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - Data offset
 * @param {number} tag - GPS tag
 * @param {number} type - Data type
 * @param {number} count - Value count
 * @param {boolean} isLittleEndian - Byte order
 * @returns {*} Parsed value
 */
function parseGpsValue(buffer, offset, tag, type, count, isLittleEndian) {
    try {
        if (type === 2) { // ASCII
            return buffer.slice(offset, offset + count - 1).toString();
        } else if (type === 5) { // RATIONAL
            const values = [];
            for (let i = 0; i < count; i++) {
                const rational = readRational(buffer, offset + i * 8, isLittleEndian);
                values.push(rational);
            }
            return count === 1 ? values[0] : values;
        } else if (type === 1 || type === 3 || type === 4) { // BYTE, SHORT, LONG
            const size = getTypeSize(type);
            return readValue(buffer, offset, size, isLittleEndian);
        }
        
        return null;
        
    } catch (error) {
        console.warn(`GPS value parsing error: ${error.message}`);
        return null;
    }
}

/**
 * Read rational value (numerator/denominator)
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - Data offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {number} Decimal value
 */
function readRational(buffer, offset, isLittleEndian) {
    const numerator = isLittleEndian 
        ? buffer.readUInt32LE(offset)
        : buffer.readUInt32BE(offset);
    const denominator = isLittleEndian 
        ? buffer.readUInt32LE(offset + 4)
        : buffer.readUInt32BE(offset + 4);
    
    return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Read value based on size and byte order
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - Data offset
 * @param {number} size - Value size in bytes
 * @param {boolean} isLittleEndian - Byte order
 * @returns {number} Value
 */
function readValue(buffer, offset, size, isLittleEndian) {
    if (size === 1) {
        return buffer.readUInt8(offset);
    } else if (size === 2) {
        return isLittleEndian 
            ? buffer.readUInt16LE(offset)
            : buffer.readUInt16BE(offset);
    } else if (size === 4) {
        return isLittleEndian 
            ? buffer.readUInt32LE(offset)
            : buffer.readUInt32BE(offset);
    }
    return 0;
}

/**
 * Convert GPS coordinates from DMS to decimal degrees
 * @param {Object} gpsData - Raw GPS data from EXIF
 * @returns {Object|null} Decimal coordinates or null if conversion fails
 */
function convertGpsToDecimal(gpsData) {
    try {
        const lat = gpsData.GPSLatitude;
        const latRef = gpsData.GPSLatitudeRef;
        const lon = gpsData.GPSLongitude;
        const lonRef = gpsData.GPSLongitudeRef;
        
        if (!lat || !lon || !latRef || !lonRef) {
            return null;
        }
        
        // Convert latitude
        let latitude;
        if (Array.isArray(lat) && lat.length >= 3) {
            latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
        } else if (typeof lat === 'number') {
            latitude = lat;
        } else {
            return null;
        }
        
        // Convert longitude
        let longitude;
        if (Array.isArray(lon) && lon.length >= 3) {
            longitude = lon[0] + lon[1] / 60 + lon[2] / 3600;
        } else if (typeof lon === 'number') {
            longitude = lon;
        } else {
            return null;
        }
        
        // Apply direction
        if (latRef === 'S') latitude = -latitude;
        if (lonRef === 'W') longitude = -longitude;
        
        const result = {
            latitude: parseFloat(latitude.toFixed(8)),
            longitude: parseFloat(longitude.toFixed(8))
        };
        
        // Add altitude if available
        if (gpsData.GPSAltitude && typeof gpsData.GPSAltitude === 'number') {
            result.altitude = gpsData.GPSAltitude;
            if (gpsData.GPSAltitudeRef === 1) {
                result.altitude = -result.altitude; // Below sea level
            }
        }
        
        return result;
        
    } catch (error) {
        console.warn(`GPS coordinate conversion error: ${error.message}`);
        return null;
    }
}

/**
 * Extract GPS coordinates using exiftool
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object|null>} GPS coordinates or null if not found
 */
async function extractGpsWithExiftool(filePath) {
    try {
        // Use comprehensive GPS tag extraction with exiftool
        const { stdout } = await execAsync(`exiftool -GPS* -GPSPosition -j "${filePath}"`);
        const data = JSON.parse(stdout);
        
        if (!data || data.length === 0) {
            return null;
        }
        
        const gpsInfo = data[0];
        let lat = null;
        let lon = null;
        
        // Try different GPS coordinate formats
        if (gpsInfo.GPSPosition) {
            // GPSPosition format: "12.345678 N, 123.456789 W"
            const coords = parseGpsPosition(gpsInfo.GPSPosition);
            if (coords) {
                lat = coords.latitude;
                lon = coords.longitude;
            }
        } else if (gpsInfo.GPSLatitude && gpsInfo.GPSLongitude) {
            // Individual latitude/longitude fields
            lat = parseGpsCoordinate(gpsInfo.GPSLatitude, gpsInfo.GPSLatitudeRef);
            lon = parseGpsCoordinate(gpsInfo.GPSLongitude, gpsInfo.GPSLongitudeRef);
        }
        
        if (lat !== null && lon !== null && isValidCoordinatePair(lat, lon)) {
            const result = { latitude: lat, longitude: lon };
            
            // Add altitude if available
            if (gpsInfo.GPSAltitude) {
                const altitude = parseFloat(gpsInfo.GPSAltitude);
                if (!isNaN(altitude)) {
                    result.altitude = altitude;
                }
            }
            
            return result;
        }
        
        return null;
        
    } catch (error) {
        console.warn(`exiftool GPS extraction failed: ${error.message}`);
        return null;
    }
}

/**
 * Parse GPS position string from exiftool
 * @param {string} gpsPosition - GPS position string
 * @returns {Object|null} Parsed coordinates
 */
function parseGpsPosition(gpsPosition) {
    try {
        // Format: "12.345678 N, 123.456789 W" or "12°34'56.78" N, 123°45'67.89" W"
        const parts = gpsPosition.split(',');
        if (parts.length !== 2) return null;
        
        const latPart = parts[0].trim();
        const lonPart = parts[1].trim();
        
        const lat = parseGpsCoordinate(latPart);
        const lon = parseGpsCoordinate(lonPart);
        
        if (lat !== null && lon !== null) {
            return { latitude: lat, longitude: lon };
        }
        
        return null;
        
    } catch (error) {
        console.warn(`GPS position parsing error: ${error.message}`);
        return null;
    }
}

/**
 * Parse individual GPS coordinate
 * @param {string} coord - Coordinate string
 * @param {string} [ref] - Direction reference (N/S/E/W)
 * @returns {number|null} Decimal coordinate
 */
function parseGpsCoordinate(coord, ref) {
    try {
        if (typeof coord === 'number') {
            // Already in decimal format
            let result = coord;
            if (ref === 'S' || ref === 'W') {
                result = -result;
            }
            return result;
        }
        
        if (typeof coord !== 'string') return null;
        
        // Extract direction from coordinate string if not provided separately
        let direction = ref;
        let coordValue = coord;
        
        if (!direction) {
            const dirMatch = coord.match(/([NSEW])$/i);
            if (dirMatch) {
                direction = dirMatch[1].toUpperCase();
                coordValue = coord.replace(/[NSEW]$/i, '').trim();
            }
        }
        
        // Try to parse as decimal degrees
        const decimal = parseFloat(coordValue);
        if (!isNaN(decimal)) {
            let result = decimal;
            if (direction === 'S' || direction === 'W') {
                result = -result;
            }
            return result;
        }
        
        // Try to parse as DMS (degrees, minutes, seconds)
        const dmsMatch = coordValue.match(/(\d+)°(\d+)'([\d.]+)"/);
        if (dmsMatch) {
            const degrees = parseInt(dmsMatch[1]);
            const minutes = parseInt(dmsMatch[2]);
            const seconds = parseFloat(dmsMatch[3]);
            
            let result = degrees + minutes / 60 + seconds / 3600;
            if (direction === 'S' || direction === 'W') {
                result = -result;
            }
            return result;
        }
        
        return null;
        
    } catch (error) {
        console.warn(`GPS coordinate parsing error: ${error.message}`);
        return null;
    }
}

/**
 * Write GPS coordinates to image file using exiftool
 * @param {string} filePath - Path to image file
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @param {number} [altitude] - Altitude in meters
 * @returns {Promise<boolean>} Success status
 */
export async function writeGpsCoordinates(filePath, latitude, longitude, altitude = null) {
    try {
        if (!isValidCoordinatePair(latitude, longitude)) {
            console.warn(`Invalid GPS coordinates: ${latitude}, ${longitude}`);
            return false;
        }
        
        // Convert decimal degrees to DMS format for exiftool
        const latDms = decimalToDms(latitude, 'latitude');
        const lonDms = decimalToDms(longitude, 'longitude');
        
        let command = `exiftool -overwrite_original -GPSLatitude="${latDms.degrees}" -GPSLatitudeRef="${latDms.ref}" -GPSLongitude="${lonDms.degrees}" -GPSLongitudeRef="${lonDms.ref}"`;
        
        if (altitude !== null && !isNaN(altitude)) {
            const altRef = altitude >= 0 ? 0 : 1; // 0 = above sea level, 1 = below
            command += ` -GPSAltitude="${Math.abs(altitude)}" -GPSAltitudeRef="${altRef}"`;
        }
        
        command += ` "${filePath}"`;
        
        await execAsync(command);
        console.log(`GPS coordinates written to ${filePath}`);
        return true;
        
    } catch (error) {
        console.warn(`Failed to write GPS coordinates to ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Check if a file is a supported image format
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if the file is a supported image format
 */
export function isSupportedImageFile(filePath) {
    const supportedExtensions = ['.jpg', '.jpeg', '.tiff', '.tif', '.cr3', '.cr2', '.nef', '.arw', '.dng'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
}

/**
 * Extract EXIF metadata from image file
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object|null>} EXIF metadata or null if extraction fails
 */
export async function extractExifMetadata(filePath) {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return parseExifBuffer(buffer);
    } catch (error) {
        console.warn(`Failed to extract EXIF metadata from ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Get image timestamp from EXIF data
 * @param {string} filePath - Path to image file
 * @returns {Promise<Date|null>} Image timestamp or null if not found
 */
export async function getImageTimestamp(filePath) {
    try {
        const { stdout } = await execAsync(`exiftool -DateTimeOriginal -CreateDate -DateTime -j "${filePath}"`);
        const data = JSON.parse(stdout);
        
        if (!data || data.length === 0) {
            return null;
        }
        
        const exifData = data[0];
        
        // Try different timestamp fields in order of preference
        const timestampFields = ['DateTimeOriginal', 'CreateDate', 'DateTime'];
        
        for (const field of timestampFields) {
            if (exifData[field]) {
                // Handle different date formats from exiftool
                let dateString = exifData[field];
                
                // Convert EXIF date format (YYYY:MM:DD HH:MM:SS) to ISO format
                if (dateString.includes(':')) {
                    // Replace first two colons with dashes for proper date parsing
                    dateString = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                }
                
                const timestamp = new Date(dateString);
                if (!isNaN(timestamp.getTime())) {
                    return timestamp;
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.warn(`Failed to get image timestamp from ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Check if image has GPS coordinates
 * @param {string} filePath - Path to image file
 * @returns {Promise<boolean>} True if image has GPS coordinates
 */
export async function hasGpsCoordinates(filePath) {
    const coordinates = await extractGpsCoordinates(filePath);
    return coordinates !== null;
}
