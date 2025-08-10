/**
 * User input and directory validation utilities
 * Handles user prompts and directory validation
 */

import fs from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';

/**
 * Prompt user for target directory path with validation
 * @returns {string} Validated absolute directory path
 */
export function promptForDirectory() {
    console.log('\n=== Image Geolocation Processor ===');
    console.log('This application will process images in a directory and add GPS coordinates using timeline data.\n');
    
    while (true) {
        const userInput = readlineSync.question('Enter the target directory path: ');
        
        if (!userInput.trim()) {
            console.log('❌ Please enter a directory path.\n');
            continue;
        }
        
        try {
            const validatedPath = validateDirectoryPath(userInput.trim());
            
            // Show confirmation
            console.log(`\n📁 Target directory: ${validatedPath}`);
            const confirm = readlineSync.keyInYNStrict('Proceed with this directory?');
            
            if (confirm) {
                return validatedPath;
            } else {
                console.log('');
                continue;
            }
        } catch (error) {
            console.log(`❌ ${error.message}\n`);
            continue;
        }
    }
}

/**
 * Validate that a directory path exists and is accessible
 * @param {string} dirPath - Directory path to validate
 * @returns {string} Absolute path to the directory
 * @throws {Error} If directory is invalid or inaccessible
 */
export function validateDirectoryPath(dirPath) {
    if (typeof dirPath !== 'string') {
        throw new Error('Directory path must be a string');
    }
    
    // Resolve to absolute path
    const absolutePath = path.resolve(dirPath);
    
    try {
        // Check if path exists
        const stats = fs.statSync(absolutePath);
        
        if (!stats.isDirectory()) {
            throw new Error(`Path exists but is not a directory: ${absolutePath}`);
        }
        
        // Test read access
        fs.accessSync(absolutePath, fs.constants.R_OK);
        
        return absolutePath;
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Directory does not exist: ${absolutePath}`);
        } else if (error.code === 'EACCES') {
            throw new Error(`Permission denied accessing directory: ${absolutePath}`);
        } else if (error.message.includes('not a directory')) {
            throw error;
        } else {
            throw new Error(`Error accessing directory: ${error.message}`);
        }
    }
}

/**
 * Check if directory is readable and writable
 * @param {string} dirPath - Directory path to check
 * @returns {Object} Object with read and write permissions
 */
export function checkDirectoryPermissions(dirPath) {
    const permissions = {
        readable: false,
        writable: false
    };
    
    try {
        fs.accessSync(dirPath, fs.constants.R_OK);
        permissions.readable = true;
    } catch (error) {
        // Read permission not available
    }
    
    try {
        fs.accessSync(dirPath, fs.constants.W_OK);
        permissions.writable = true;
    } catch (error) {
        // Write permission not available
    }
    
    return permissions;
}

/**
 * Get directory statistics
 * @param {string} dirPath - Directory path
 * @returns {Object} Directory statistics
 */
export function getDirectoryStats(dirPath) {
    try {
        const stats = fs.statSync(dirPath);
        const permissions = checkDirectoryPermissions(dirPath);
        
        return {
            path: dirPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            permissions,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile()
        };
    } catch (error) {
        throw new Error(`Failed to get directory stats: ${error.message}`);
    }
}

/**
 * Prompt user for confirmation with custom message
 * @param {string} message - Confirmation message
 * @param {boolean} defaultValue - Default value if user just presses enter
 * @returns {boolean} User's confirmation
 */
export function promptConfirmation(message, defaultValue = false) {
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    const response = readlineSync.question(message + suffix + ' ');
    
    if (!response.trim()) {
        return defaultValue;
    }
    
    return response.toLowerCase().startsWith('y');
}

/**
 * Display a progress indicator
 * @param {string} message - Progress message
 * @param {number} current - Current progress value
 * @param {number} total - Total progress value
 */
export function displayProgress(message, current, total) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    
    process.stdout.write(`\r${message} [${progressBar}] ${percentage}% (${current}/${total})`);
    
    if (current === total) {
        console.log(''); // New line when complete
    }
}

/**
 * Clear the current line in terminal
 */
export function clearLine() {
    process.stdout.write('\r\x1b[K');
}

/**
 * Display a spinner with message
 * @param {string} message - Message to display with spinner
 * @returns {Function} Function to stop the spinner
 */
export function showSpinner(message) {
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let index = 0;
    
    const interval = setInterval(() => {
        process.stdout.write(`\r${spinnerChars[index]} ${message}`);
        index = (index + 1) % spinnerChars.length;
    }, 100);
    
    return () => {
        clearInterval(interval);
        clearLine();
    };
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}
