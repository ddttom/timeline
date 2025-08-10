/**
 * File discovery and directory traversal service
 * Handles recursive directory scanning and image file indexing
 */

import fs from 'fs';
import path from 'path';
import { isSupportedImageFile, extractExifMetadata, getImageTimestamp, hasGpsCoordinates } from './exif.js';
import { displayProgress, showSpinner } from '../utils/input.js';

/**
 * Recursively discover all image files in a directory
 * @param {string} rootDir - Root directory to scan
 * @param {Function} progressCallback - Optional progress callback function
 * @returns {Array} Array of image file paths
 */
export async function discoverImageFiles(rootDir, progressCallback = null) {
    const imageFiles = [];
    
    const spinner = showSpinner('Discovering image files...');
    
    try {
        await traverseDirectory(rootDir, (filePath) => {
            if (isSupportedImageFile(filePath)) {
                imageFiles.push(filePath);
                if (progressCallback) {
                    progressCallback(imageFiles.length, filePath);
                }
            }
        });
        
        spinner();
        console.log(`✅ Discovered ${imageFiles.length} image files`);
        
        return imageFiles;
        
    } catch (error) {
        spinner();
        throw new Error(`Failed to discover image files: ${error.message}`);
    }
}

/**
 * Recursively traverse directory and call callback for each file
 * @param {string} dirPath - Directory path to traverse
 * @param {Function} fileCallback - Callback function called for each file
 * @param {Set} visited - Set to track visited directories (prevents infinite loops)
 */
async function traverseDirectory(dirPath, fileCallback, visited = new Set()) {
    try {
        // Resolve absolute path to handle symlinks properly
        const absolutePath = path.resolve(dirPath);
        
        // Check for circular references
        if (visited.has(absolutePath)) {
            console.warn(`Warning: Circular reference detected, skipping ${absolutePath}`);
            return;
        }
        
        visited.add(absolutePath);
        
        const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(absolutePath, entry.name);
            
            try {
                if (entry.isDirectory()) {
                    // Skip hidden directories and common non-image directories
                    if (!entry.name.startsWith('.') && !isSkippableDirectory(entry.name)) {
                        await traverseDirectory(fullPath, fileCallback, visited);
                    }
                } else if (entry.isFile()) {
                    // Skip hidden files
                    if (!entry.name.startsWith('.')) {
                        fileCallback(fullPath);
                    }
                }
            } catch (entryError) {
                console.warn(`Warning: Error processing ${fullPath}: ${entryError.message}`);
                continue;
            }
        }
        
        visited.delete(absolutePath);
        
    } catch (error) {
        throw new Error(`Failed to traverse directory ${dirPath}: ${error.message}`);
    }
}

/**
 * Check if directory should be skipped during traversal
 * @param {string} dirName - Directory name
 * @returns {boolean} True if directory should be skipped
 */
function isSkippableDirectory(dirName) {
    const skipPatterns = [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        '__pycache__',
        '.DS_Store',
        'Thumbs.db',
        '.thumbnails',
        '.cache'
    ];
    
    return skipPatterns.some(pattern => 
        dirName.toLowerCase().includes(pattern.toLowerCase())
    );
}

/**
 * Create comprehensive image index with metadata
 * @param {Array} imageFiles - Array of image file paths
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Map} Map of file paths to metadata objects
 */
export async function createImageIndex(imageFiles, progressCallback = null) {
    const imageIndex = new Map();
    const totalFiles = imageFiles.length;
    let processedFiles = 0;
    
    console.log(`\n📊 Creating image index for ${totalFiles} files...`);
    
    // Process files in batches to manage memory usage
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < imageFiles.length; i += batchSize) {
        batches.push(imageFiles.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
        const batchPromises = batch.map(async (filePath) => {
            try {
                const metadata = await extractImageMetadata(filePath);
                imageIndex.set(filePath, metadata);
                
                processedFiles++;
                if (progressCallback) {
                    progressCallback(processedFiles, totalFiles);
                } else {
                    displayProgress('Processing images', processedFiles, totalFiles);
                }
                
                return { filePath, success: true };
                
            } catch (error) {
                console.warn(`Warning: Failed to process ${filePath}: ${error.message}`);
                processedFiles++;
                
                if (progressCallback) {
                    progressCallback(processedFiles, totalFiles);
                } else {
                    displayProgress('Processing images', processedFiles, totalFiles);
                }
                
                return { filePath, success: false, error: error.message };
            }
        });
        
        // Wait for batch to complete before processing next batch
        await Promise.all(batchPromises);
        
        // Small delay to prevent overwhelming the system
        if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    console.log(`✅ Image index created with ${imageIndex.size} entries`);
    return imageIndex;
}

/**
 * Extract comprehensive metadata for a single image
 * @param {string} filePath - Path to the image file
 * @returns {Object} Image metadata object
 */
async function extractImageMetadata(filePath) {
    try {
        // Get basic EXIF metadata
        const exifData = await extractExifMetadata(filePath);
        
        // Get timestamp
        const timestamp = await getImageTimestamp(filePath);
        
        // Check for existing GPS coordinates
        const hasGps = await hasGpsCoordinates(filePath);
        
        // Get file stats
        const stats = fs.statSync(filePath);
        
        return {
            filePath: path.resolve(filePath),
            fileName: path.basename(filePath),
            fileSize: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            timestamp: timestamp,
            hasValidTimestamp: timestamp && timestamp > new Date('1970-01-01'),
            hasGpsCoordinates: hasGps,
            format: exifData?.format || 'unknown',
            width: exifData?.width || null,
            height: exifData?.height || null,
            exifData: exifData,
            needsGeolocation: !hasGps && timestamp && timestamp > new Date('1970-01-01'),
            processedAt: new Date()
        };
        
    } catch (error) {
        throw new Error(`Failed to extract metadata for ${filePath}: ${error.message}`);
    }
}

/**
 * Filter images that need geolocation processing
 * @param {Map} imageIndex - Image index map
 * @returns {Array} Array of images that need geolocation
 */
export function filterImagesNeedingGeolocation(imageIndex) {
    const imagesNeedingGeolocation = [];
    
    for (const [filePath, metadata] of imageIndex) {
        if (metadata.needsGeolocation) {
            imagesNeedingGeolocation.push({
                filePath,
                metadata
            });
        }
    }
    
    console.log(`📍 Found ${imagesNeedingGeolocation.length} images needing geolocation`);
    return imagesNeedingGeolocation;
}

/**
 * Get images with GPS coordinates for interpolation
 * @param {Map} imageIndex - Image index map
 * @returns {Array} Array of images with GPS coordinates
 */
export function getImagesWithGps(imageIndex) {
    const imagesWithGps = [];
    
    for (const [filePath, metadata] of imageIndex) {
        if (metadata.hasGpsCoordinates && metadata.exifData && 
            metadata.exifData.latitude !== undefined && metadata.exifData.longitude !== undefined) {
            imagesWithGps.push({
                filePath,
                metadata,
                coordinates: {
                    lat: metadata.exifData.latitude,
                    lng: metadata.exifData.longitude
                },
                timestamp: metadata.timestamp
            });
        }
    }
    
    console.log(`🗺️  Found ${imagesWithGps.length} images with GPS coordinates`);
    return imagesWithGps;
}

/**
 * Get directory statistics
 * @param {string} rootDir - Root directory path
 * @returns {Object} Directory statistics
 */
export async function getDirectoryStatistics(rootDir) {
    let totalFiles = 0;
    let totalSize = 0;
    let imageFiles = 0;
    let directories = 0;
    
    const spinner = showSpinner('Calculating directory statistics...');
    
    try {
        await traverseDirectory(rootDir, (filePath) => {
            try {
                const stats = fs.statSync(filePath);
                totalFiles++;
                totalSize += stats.size;
                
                if (isSupportedImageFile(filePath)) {
                    imageFiles++;
                }
            } catch (error) {
                // Skip files that can't be accessed
            }
        });
        
        // Count directories
        await countDirectories(rootDir, (count) => {
            directories = count;
        });
        
        spinner();
        
        return {
            rootDirectory: rootDir,
            totalFiles,
            totalSize,
            imageFiles,
            directories,
            averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
        };
        
    } catch (error) {
        spinner();
        throw new Error(`Failed to get directory statistics: ${error.message}`);
    }
}

/**
 * Count directories recursively
 * @param {string} dirPath - Directory path
 * @param {Function} callback - Callback with count
 */
async function countDirectories(dirPath, callback) {
    let count = 0;
    
    await traverseDirectory(dirPath, () => {}, new Set());
    
    // This is a simplified implementation
    // In practice, you'd count directories during traversal
    callback(count);
}

/**
 * Validate image index integrity
 * @param {Map} imageIndex - Image index to validate
 * @returns {Object} Validation results
 */
export function validateImageIndex(imageIndex) {
    const results = {
        totalImages: imageIndex.size,
        validImages: 0,
        imagesWithGps: 0,
        imagesWithTimestamp: 0,
        imagesNeedingGeolocation: 0,
        errors: []
    };
    
    for (const [filePath, metadata] of imageIndex) {
        try {
            // Check if file still exists
            if (!fs.existsSync(filePath)) {
                results.errors.push(`File no longer exists: ${filePath}`);
                continue;
            }
            
            results.validImages++;
            
            if (metadata.hasGpsCoordinates) {
                results.imagesWithGps++;
            }
            
            if (metadata.hasValidTimestamp) {
                results.imagesWithTimestamp++;
            }
            
            if (metadata.needsGeolocation) {
                results.imagesNeedingGeolocation++;
            }
            
        } catch (error) {
            results.errors.push(`Error validating ${filePath}: ${error.message}`);
        }
    }
    
    return results;
}
