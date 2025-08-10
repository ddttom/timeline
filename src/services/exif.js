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
        console.log(`Extracting GPS coordinates from: ${filePath}`);
        
        // Try custom EXIF parsing first
        const customResult = await extractGpsFromExif(filePath);
        if (customResult) {
            console.log(`Custom EXIF parsing successful for ${filePath}`);
            return customResult;
        }
        
        // Fallback to exiftool if available
        console.log(`Custom EXIF parsing failed, trying exiftool fallback for ${filePath}`);
        const exiftoolResult = await extractGpsWithExiftool(filePath);
        if (exiftoolResult) {
            console.log(`Exiftool fallback successful for ${filePath}`);
            return exiftoolResult;
        }
        
        console.log(`No GPS coordinates found in ${filePath}`);
        return null;
        
    } catch (error) {
        console.warn(`GPS extraction failed for ${filePath}: ${error.message}`);
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
            console.log(`No GPS data found in EXIF for ${filePath}`);
            return null;
        }
        
        const gps = exifData.gps;
        console.log(`Raw GPS data extracted:`, gps);
        
        // Convert GPS coordinates to decimal degrees
        const coordinates = convertGpsToDecimal(gps);
        if (coordinates && isValidCoordinatePair(coordinates.latitude, coordinates.longitude)) {
            console.log(`Valid GPS coordinates found: ${coordinates.latitude}, ${coordinates.longitude}`);
            return coordinates;
        }
        
        console.log(`Invalid GPS coordinates extracted from ${filePath}`);
        return null;
        
    } catch (error) {
        console.warn(`Custom EXIF parsing failed for ${filePath}: ${error.message}`);
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
            return { type: 'CR3', supportsExif: false };
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
    
    return { type: 'UNKNOWN', supportsExif: false };
}


/**
 * Parse EXIF buffer to extract GPS data
 * @param {Buffer} buffer - Image file buffer
 * @returns {Object|null} Parsed EXIF data with GPS information
 */
function parseExifBuffer(buffer) {
    try {
        // Check file format first
        const fileFormat = detectFileFormat(buffer);
        if (!fileFormat.supportsExif) {
            console.log(`File format ${fileFormat.type} not supported for EXIF parsing`);
            return null;
        }
        
        // Find EXIF marker (0xFFE1)
        const exifMarker = Buffer.from([0xFF, 0xE1]);
        let exifStart = -1;
        
        for (let i = 0; i < buffer.length - 1; i++) {
            if (buffer[i] === 0xFF && buffer[i + 1] === 0xE1) {
                exifStart = i;
                break;
            }
        }
        
        if (exifStart === -1) {
            console.log('No EXIF marker found');
            return null;
        }
        
        // Skip EXIF marker (2 bytes) and length (2 bytes)
        let offset = exifStart + 4;
        
        // Check for "Exif\0\0" identifier
        const exifId = buffer.slice(offset, offset + 6);
        if (exifId.toString() !== 'Exif\0\0') {
            console.log('Invalid EXIF identifier');
            return null;
        }
        offset += 6;
        
        // Parse TIFF header
        const tiffStart = offset;
        const byteOrder = buffer.slice(offset, offset + 2);
        const isLittleEndian = byteOrder.equals(Buffer.from([0x49, 0x49]));
        
        if (!isLittleEndian && !byteOrder.equals(Buffer.from([0x4D, 0x4D]))) {
            console.log('Invalid TIFF byte order');
            return null;
        }
        
        offset += 2;
        
        // Skip TIFF magic number (should be 42)
        offset += 2;
        
        // Get IFD0 offset
        const ifd0Offset = readValue(buffer, offset, 4, isLittleEndian);
        offset = tiffStart + ifd0Offset;
        
        console.log(`Parsing IFD0 at offset: ${offset}`);
        
        // Parse IFD0 to find GPS IFD pointer
        const ifd0Data = parseIFD(buffer, offset, tiffStart, isLittleEndian);
        
        // Look for GPS IFD pointer (tag 0x8825)
        let gpsIfdOffset = null;
        if (ifd0Data && ifd0Data['0x8825']) {
            gpsIfdOffset = ifd0Data['0x8825'];
            console.log(`Found GPS IFD pointer at offset: ${gpsIfdOffset}`);
        }
        
        if (!gpsIfdOffset) {
            console.log('No GPS IFD pointer found in IFD0');
            return null;
        }
        
        // Parse GPS IFD
        console.log(`Parsing GPS IFD at offset: ${gpsIfdOffset}`);
        const gpsData = parseGpsIFD(buffer, tiffStart + gpsIfdOffset, tiffStart, isLittleEndian);
        
        if (!gpsData || Object.keys(gpsData).length === 0) {
            console.log('No GPS data found in GPS IFD');
            return null;
        }
        
        console.log('GPS data extracted from GPS IFD:', gpsData);
        return { gps: gpsData };
        
    } catch (error) {
        console.error(`Failed to parse EXIF buffer: ${error.message}`);
        return null;
    }
}

/**
 * Parse an IFD (Image File Directory)
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - IFD offset
 * @param {number} tiffStart - TIFF header start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {Object} Parsed IFD data
 */
function parseIFD(buffer, offset, tiffStart, isLittleEndian) {
    const data = {};
    
    try {
        const entryCount = readValue(buffer, offset, 2, isLittleEndian);
        offset += 2;
        
        console.log(`IFD has ${entryCount} entries`);
        
        for (let i = 0; i < entryCount; i++) {
            const tag = readValue(buffer, offset, 2, isLittleEndian);
            const type = readValue(buffer, offset + 2, 2, isLittleEndian);
            const count = readValue(buffer, offset + 4, 4, isLittleEndian);
            const valueOffset = readValue(buffer, offset + 8, 4, isLittleEndian);
            
            // For GPS IFD pointer (tag 0x8825), store the offset directly
            if (tag === 0x8825) {
                data[`0x${tag.toString(16).toUpperCase()}`] = valueOffset;
                console.log(`Found GPS IFD pointer: 0x${tag.toString(16).padStart(4, '0')} -> offset ${valueOffset}`);
            }
            
            offset += 12;
        }
        
    } catch (error) {
        console.error(`Failed to parse IFD: ${error.message}`);
    }
    
    return data;
}

/**
 * Parse GPS IFD specifically for GPS tags
 * @param {Buffer} buffer - Image buffer
 * @param {number} offset - GPS IFD offset
 * @param {number} tiffStart - TIFF header start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {Object} Parsed GPS data
 */
function parseGpsIFD(buffer, offset, tiffStart, isLittleEndian) {
    const gpsData = {};
    
    try {
        const entryCount = readValue(buffer, offset, 2, isLittleEndian);
        offset += 2;
        
        console.log(`GPS IFD has ${entryCount} entries`);
        
        for (let i = 0; i < entryCount; i++) {
            const tag = readValue(buffer, offset, 2, isLittleEndian);
            const type = readValue(buffer, offset + 2, 2, isLittleEndian);
            const count = readValue(buffer, offset + 4, 4, isLittleEndian);
            const valueOffset = readValue(buffer, offset + 8, 4, isLittleEndian);
            
            console.log(`GPS tag: 0x${tag.toString(16).padStart(4, '0')}, type: ${type}, count: ${count}, valueOffset: ${valueOffset}`);
            
            // Parse GPS tag value
            const tagName = GPS_TAGS[tag];
            if (tagName) {
                const value = parseGpsTagValue(buffer, tag, type, count, valueOffset, tiffStart, isLittleEndian);
                if (value !== null) {
                    gpsData[tagName] = value;
                    console.log(`Parsed GPS tag ${tagName}: ${JSON.stringify(value)}`);
                }
            }
            
            offset += 12;
        }
        
    } catch (error) {
        console.error(`Failed to parse GPS IFD: ${error.message}`);
    }
    
    return gpsData;
}

/**
 * Get the size in bytes for an EXIF data type
 * @param {number} type - EXIF data type
 * @returns {number} Size in bytes
 */
function getTypeSize(type) {
    switch (type) {
        case 1: // BYTE
        case 2: // ASCII
        case 6: // SBYTE
        case 7: // UNDEFINED
            return 1;
        case 3: // SHORT
        case 8: // SSHORT
            return 2;
        case 4: // LONG
        case 9: // SLONG
        case 11: // FLOAT
            return 4;
        case 5: // RATIONAL
        case 10: // SRATIONAL
        case 12: // DOUBLE
            return 8;
        default:
            return 1;
    }
}

/**
 * Parse GPS-specific EXIF tags
 * @param {Buffer} buffer - Image buffer
 * @param {number} tag - EXIF tag number
 * @param {number} type - Data type
 * @param {number} count - Number of values
 * @param {number} valueOffset - Offset to value data
 * @param {number} tiffStart - TIFF header start offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {*} Parsed tag value
 */
function parseGpsTagValue(buffer, tag, type, count, valueOffset, tiffStart, isLittleEndian) {
    try {
        const typeSize = getTypeSize(type);
        const totalSize = typeSize * count;
        
        // If data fits in 4 bytes, it's stored in the valueOffset field directly
        // Otherwise, valueOffset points to the actual data location
        let dataOffset;
        if (totalSize <= 4) {
            // Data is stored directly in the valueOffset field
            dataOffset = valueOffset;
            // For little-endian, we need to read from a temporary buffer
            if (isLittleEndian && totalSize < 4) {
                const tempBuffer = Buffer.alloc(4);
                tempBuffer.writeUInt32LE(valueOffset, 0);
                return parseGpsValue(tempBuffer, 0, tag, type, count, isLittleEndian);
            } else {
                const tempBuffer = Buffer.alloc(4);
                if (isLittleEndian) {
                    tempBuffer.writeUInt32LE(valueOffset, 0);
                } else {
                    tempBuffer.writeUInt32BE(valueOffset, 0);
                }
                return parseGpsValue(tempBuffer, 0, tag, type, count, isLittleEndian);
            }
        } else {
            // Data is stored at the offset location
            dataOffset = tiffStart + valueOffset;
            return parseGpsValue(buffer, dataOffset, tag, type, count, isLittleEndian);
        }
        
    } catch (error) {
        console.error(`Failed to parse GPS tag 0x${tag.toString(16)}: ${error.message}`);
        return null;
    }
}

/**
 * Parse GPS value based on tag type
 * @param {Buffer} buffer - Data buffer
 * @param {number} offset - Data offset
 * @param {number} tag - GPS tag
 * @param {number} type - Data type
 * @param {number} count - Value count
 * @param {boolean} isLittleEndian - Byte order
 * @returns {*} Parsed value
 */
function parseGpsValue(buffer, offset, tag, type, count, isLittleEndian) {
    try {
        switch (tag) {
            case 0x0001: // GPSLatitudeRef
            case 0x0003: // GPSLongitudeRef
            case 0x0005: // GPSAltitudeRef
                return String.fromCharCode(buffer[offset]);
                
            case 0x0002: // GPSLatitude
            case 0x0004: // GPSLongitude
                if (type === 5 && count === 3) { // RATIONAL, 3 values (degrees, minutes, seconds)
                    const degrees = readRational(buffer, offset, isLittleEndian);
                    const minutes = readRational(buffer, offset + 8, isLittleEndian);
                    const seconds = readRational(buffer, offset + 16, isLittleEndian);
                    return [degrees, minutes, seconds];
                }
                break;
                
            case 0x0006: // GPSAltitude
                if (type === 5) { // RATIONAL
                    return readRational(buffer, offset, isLittleEndian);
                }
                break;
                
            case 0x0007: // GPSTimeStamp
                if (type === 5 && count === 3) { // RATIONAL, 3 values (hours, minutes, seconds)
                    const hours = readRational(buffer, offset, isLittleEndian);
                    const minutes = readRational(buffer, offset + 8, isLittleEndian);
                    const seconds = readRational(buffer, offset + 16, isLittleEndian);
                    return [hours, minutes, seconds];
                }
                break;
                
            case 0x001D: // GPSDateStamp
                if (type === 2) { // ASCII
                    let dateStr = '';
                    for (let i = 0; i < count - 1; i++) { // -1 to exclude null terminator
                        dateStr += String.fromCharCode(buffer[offset + i]);
                    }
                    return dateStr;
                }
                break;
        }
        
        return null;
        
    } catch (error) {
        console.error(`Failed to parse GPS value for tag 0x${tag.toString(16)}: ${error.message}`);
        return null;
    }
}

/**
 * Read a rational value (fraction) from buffer
 * @param {Buffer} buffer - Data buffer
 * @param {number} offset - Data offset
 * @param {boolean} isLittleEndian - Byte order
 * @returns {number} Decimal value
 */
function readRational(buffer, offset, isLittleEndian) {
    const numerator = readValue(buffer, offset, 4, isLittleEndian);
    const denominator = readValue(buffer, offset + 4, 4, isLittleEndian);
    return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Read a value from buffer with specified byte order
 * @param {Buffer} buffer - Data buffer
 * @param {number} offset - Data offset
 * @param {number} size - Value size in bytes
 * @param {boolean} isLittleEndian - Byte order
 * @returns {number} Read value
 */
function readValue(buffer, offset, size, isLittleEndian) {
    switch (size) {
        case 1:
            return buffer[offset];
        case 2:
            return isLittleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
        case 4:
            return isLittleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
        default:
            throw new Error(`Unsupported value size: ${size}`);
    }
}

/**
 * Convert GPS EXIF data to decimal coordinates
 * @param {Object} gpsData - Raw GPS EXIF data
 * @returns {Object|null} Decimal coordinates
 */
function convertGpsToDecimal(gpsData) {
    try {
        const {
            GPSLatitude,
            GPSLatitudeRef,
            GPSLongitude,
            GPSLongitudeRef,
            GPSAltitude,
            GPSAltitudeRef
        } = gpsData;
        
        if (!GPSLatitude || !GPSLatitudeRef || !GPSLongitude || !GPSLongitudeRef) {
            console.log('Missing required GPS coordinate data');
            return null;
        }
        
        // Handle different GPS coordinate formats
        let latitude, longitude;
        
        if (GPSLatitude.length === 3) {
            // Standard DMS format: [degrees, minutes, seconds]
            latitude = dmsToDecimal(GPSLatitude, GPSLatitudeRef);
        } else if (GPSLatitude.length === 2) {
            // Decimal minutes format: [degrees, decimal_minutes]
            const degrees = GPSLatitude[0];
            const decimalMinutes = GPSLatitude[1];
            const minutes = Math.floor(decimalMinutes);
            const seconds = (decimalMinutes - minutes) * 60;
            latitude = dmsToDecimal([degrees, minutes, seconds], GPSLatitudeRef);
        } else {
            console.error(`Invalid GPS latitude format: ${JSON.stringify(GPSLatitude)}`);
            return null;
        }
        
        if (GPSLongitude.length === 3) {
            // Standard DMS format: [degrees, minutes, seconds]
            longitude = dmsToDecimal(GPSLongitude, GPSLongitudeRef);
        } else if (GPSLongitude.length === 2) {
            // Decimal minutes format: [degrees, decimal_minutes]
            const degrees = GPSLongitude[0];
            const decimalMinutes = GPSLongitude[1];
            const minutes = Math.floor(decimalMinutes);
            const seconds = (decimalMinutes - minutes) * 60;
            longitude = dmsToDecimal([degrees, minutes, seconds], GPSLongitudeRef);
        } else {
            console.error(`Invalid GPS longitude format: ${JSON.stringify(GPSLongitude)}`);
            return null;
        }
        
        const result = {
            latitude: latitude,
            longitude: longitude
        };
        
        // Add altitude if available
        if (GPSAltitude !== undefined) {
            result.altitude = GPSAltitudeRef === '\x00' ? GPSAltitude : -GPSAltitude;
        }
        
        console.log(`Converted GPS coordinates: ${latitude}, ${longitude}`);
        return result;
        
    } catch (error) {
        console.error(`Failed to convert GPS coordinates: ${error.message}`);
        return null;
    }
}

/**
 * Extract GPS coordinates using exiftool as fallback
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object|null>} GPS coordinates or null if not found
 */
async function extractGpsWithExiftool(filePath) {
    try {
        const { stdout } = await execAsync(`exiftool -GPS* -j "${filePath}"`);
        const data = JSON.parse(stdout);
        
        if (!data || data.length === 0) {
            return null;
        }
        
        const gpsInfo = data[0];
        const lat = gpsInfo.GPSLatitude;
        const lon = gpsInfo.GPSLongitude;
        
        if (lat && lon && isValidCoordinatePair(lat, lon)) {
            const result = { latitude: lat, longitude: lon };
            
            if (gpsInfo.GPSAltitude) {
                result.altitude = gpsInfo.GPSAltitude;
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
            throw new Error('Invalid GPS coordinates');
        }
        
        let command = `exiftool -overwrite_original -GPS:GPSLatitude="${latitude}" -GPS:GPSLongitude="${longitude}"`;
        
        if (altitude !== null) {
            command += ` -GPS:GPSAltitude="${altitude}"`;
        }
        
        command += ` "${filePath}"`;
        
        await execAsync(command);
        console.log(`GPS coordinates written to ${filePath}`);
        return true;
        
    } catch (error) {
        console.warn(`exiftool GPS writing failed: ${error.message}`);
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
                const timestamp = new Date(exifData[field].replace(/:/g, '-').replace(/-/, ':').replace(/-/, ':'));
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
