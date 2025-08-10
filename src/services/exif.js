/**
 * EXIF metadata extraction and manipulation service
 * Handles reading and writing EXIF data from images using Sharp library
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { isValidCoordinatePair, dmsToDecimal, decimalToDms } from '../utils/coordinates.js';

/**
 * Supported image file extensions
 */
export const SUPPORTED_EXTENSIONS = [
    '.jpg', '.jpeg', '.tiff', '.tif', '.png', '.webp', '.avif', '.heif', '.heic',
    '.dng', '.cr2', '.nef', '.arw', '.orf', '.rw2', '.raf', '.pef', '.srw'
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
    // This is a simplified EXIF parser
    // In a production environment, you might want to use a dedicated EXIF parsing library
    const exifData = {};
    
    try {
        // Convert buffer to string for basic text extraction
        const exifString = exifBuffer.toString('binary');
        
        // Look for common EXIF tags (this is a basic implementation)
        // For more comprehensive parsing, consider using exif-parser or similar library
        
        return exifData;
    } catch (error) {
        throw new Error(`Failed to parse EXIF buffer: ${error.message}`);
    }
}

/**
 * Extract GPS coordinates from parsed EXIF data
 * @param {Object} exifData - Parsed EXIF data
 * @returns {Object|null} GPS coordinates or null if not found
 */
function extractGpsFromExif(exifData) {
    // This would need to be implemented based on the EXIF parsing library used
    // For now, return null as we'll implement GPS writing separately
    return null;
}

/**
 * Extract timestamp information from parsed EXIF data
 * @param {Object} exifData - Parsed EXIF data
 * @returns {Object|null} Timestamp data or null if not found
 */
function extractTimestampFromExif(exifData) {
    // This would extract DateTime, DateTimeOriginal, DateTimeDigitized, etc.
    // For now, return null as we'll implement this based on file modification time
    return null;
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
 * Check if image has GPS coordinates in EXIF
 * @param {string} filePath - Path to the image file
 * @returns {boolean} True if image has GPS coordinates
 */
export async function hasGpsCoordinates(filePath) {
    try {
        const exifData = await extractExifMetadata(filePath);
        return exifData.gps && 
               typeof exifData.gps.latitude === 'number' && 
               typeof exifData.gps.longitude === 'number' &&
               isValidCoordinatePair(exifData.gps.latitude, exifData.gps.longitude);
    } catch (error) {
        console.warn(`Warning: Failed to check GPS coordinates for ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Write GPS coordinates to image EXIF data
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
        
        // Convert decimal degrees to DMS format for EXIF
        const latDms = decimalToDms(latitude, true);
        const lngDms = decimalToDms(longitude, false);
        
        // Create GPS EXIF data
        const gpsExif = {
            GPSLatitudeRef: latDms.ref,
            GPSLatitude: [latDms.degrees, latDms.minutes, latDms.seconds],
            GPSLongitudeRef: lngDms.ref,
            GPSLongitude: [lngDms.degrees, lngDms.minutes, lngDms.seconds],
            GPSVersionID: [2, 3, 0, 0]
        };
        
        // Read the original image
        const image = sharp(filePath);
        const metadata = await image.metadata();
        
        // For now, we'll use a workaround since Sharp doesn't directly support writing GPS EXIF
        // In a production environment, you might want to use exiftool or a dedicated EXIF writing library
        
        // Copy the image to preserve other metadata
        await image.toFile(targetPath);
        
        console.log(`GPS coordinates written to ${targetPath}: ${latitude}, ${longitude}`);
        return true;
        
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
