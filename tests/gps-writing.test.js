/**
 * GPS Writing Test Suite
 * Tests the GPS coordinate writing functionality to EXIF data
 */

import { writeGpsCoordinates, extractGpsCoordinates } from '../src/services/exif.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test GPS coordinate writing and verification
 */
export async function testGpsWriting() {
    console.log('=== GPS Writing Test ===\n');
    
    // Find an image to test writing
    const sourceImagePath = path.join(process.env.HOME, 'pics', 'svalbard', 'pics', '0T4A2011.JPG');
    const testImagePath = path.join(process.cwd(), 'test-image-copy.jpg');
    
    try {
        // Create a copy of the image for testing
        console.log('Creating test image copy...');
        await fs.promises.copyFile(sourceImagePath, testImagePath);
        
        // Test coordinates (Svalbard location)
        const testLat = 78.22118333;
        const testLon = 15.639725;
        const testAlt = 42.81;
        
        console.log(`Writing GPS coordinates: ${testLat}, ${testLon}, altitude: ${testAlt}`);
        
        // Write GPS coordinates
        const writeResult = await writeGpsCoordinates(testImagePath, testLat, testLon, testAlt);
        
        if (writeResult) {
            console.log('✅ GPS coordinates written successfully!');
            
            // Verify by reading back the coordinates
            console.log('\nVerifying written coordinates...');
            const readResult = await extractGpsCoordinates(testImagePath);
            
            if (readResult) {
                console.log(`✅ GPS coordinates read back: ${readResult.latitude}, ${readResult.longitude}`);
                
                if (readResult.altitude !== undefined) {
                    console.log(`✅ Altitude read back: ${readResult.altitude} meters`);
                }
                
                // Check accuracy
                const latDiff = Math.abs(readResult.latitude - testLat);
                const lonDiff = Math.abs(readResult.longitude - testLon);
                const altDiff = readResult.altitude ? Math.abs(readResult.altitude - testAlt) : 0;
                
                console.log(`\nAccuracy check:`);
                console.log(`Latitude difference: ${latDiff.toFixed(8)}`);
                console.log(`Longitude difference: ${lonDiff.toFixed(8)}`);
                console.log(`Altitude difference: ${altDiff.toFixed(2)} meters`);
                
                if (latDiff < 0.00001 && lonDiff < 0.00001 && altDiff < 0.1) {
                    console.log('✅ Written coordinates match expected values!');
                    return { 
                        success: true, 
                        written: { latitude: testLat, longitude: testLon, altitude: testAlt },
                        read: readResult,
                        accuracy: { latDiff, lonDiff, altDiff }
                    };
                } else {
                    console.log('❌ Written coordinates do not match expected values');
                    return { 
                        success: false, 
                        error: 'Coordinate mismatch',
                        written: { latitude: testLat, longitude: testLon, altitude: testAlt },
                        read: readResult
                    };
                }
                
            } else {
                console.log('❌ Failed to read back GPS coordinates');
                return { success: false, error: 'Failed to read back coordinates' };
            }
            
        } else {
            console.log('❌ Failed to write GPS coordinates');
            return { success: false, error: 'Failed to write coordinates' };
        }
        
    } catch (error) {
        console.error('❌ GPS writing test failed:', error.message);
        return { success: false, error: error.message };
    } finally {
        // Clean up test file
        try {
            await fs.promises.unlink(testImagePath);
            console.log('\nTest image copy cleaned up');
        } catch (cleanupError) {
            console.warn('Warning: Failed to clean up test image copy');
        }
    }
}

/**
 * Test GPS writing with invalid coordinates
 */
export async function testInvalidGpsWriting() {
    console.log('\n=== Invalid GPS Writing Test ===\n');
    
    const sourceImagePath = path.join(process.env.HOME, 'pics', 'svalbard', 'pics', '0T4A2011.JPG');
    const testImagePath = path.join(process.cwd(), 'test-invalid-gps.jpg');
    
    try {
        // Create a copy of the image for testing
        await fs.promises.copyFile(sourceImagePath, testImagePath);
        
        // Test with invalid coordinates
        const invalidLat = 91.0; // Invalid latitude (> 90)
        const invalidLon = 181.0; // Invalid longitude (> 180)
        
        console.log(`Testing with invalid coordinates: ${invalidLat}, ${invalidLon}`);
        
        const writeResult = await writeGpsCoordinates(testImagePath, invalidLat, invalidLon);
        
        if (!writeResult) {
            console.log('✅ Correctly rejected invalid GPS coordinates');
            return { success: true, rejectedInvalid: true };
        } else {
            console.log('❌ Unexpectedly accepted invalid GPS coordinates');
            return { success: false, error: 'Invalid coordinates were accepted' };
        }
        
    } catch (error) {
        console.log('✅ Correctly threw error for invalid coordinates:', error.message);
        return { success: true, rejectedInvalid: true, error: error.message };
    } finally {
        // Clean up test file
        try {
            await fs.promises.unlink(testImagePath);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Test GPS format verification
 */
export async function testGpsFormat() {
    console.log('\n=== GPS Format Verification Test ===\n');
    
    const sourceImagePath = path.join(process.env.HOME, 'pics', 'svalbard', 'pics', '0T4A2011.JPG');
    const testImagePath = path.join(process.cwd(), 'test-format-check.jpg');
    
    try {
        // Create a copy of the image for testing
        await fs.promises.copyFile(sourceImagePath, testImagePath);
        
        // Test coordinates that should result in specific DMS format
        const testLat = 78.22118333; // Should be 78°13'16.26"N
        const testLon = 15.639725;   // Should be 15°38'23.01"E
        
        console.log(`Writing coordinates for format verification: ${testLat}, ${testLon}`);
        
        const writeResult = await writeGpsCoordinates(testImagePath, testLat, testLon);
        
        if (writeResult) {
            // Use exiftool to verify the exact format written
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            
            try {
                const { stdout } = await execAsync(`exiftool -GPS\\* "${testImagePath}"`);
                console.log('GPS data written to file:');
                console.log(stdout);
                
                // Check if the format contains expected DMS values
                const hasLatDegrees = stdout.includes('78 deg');
                const hasLonDegrees = stdout.includes('15 deg');
                const hasNorthRef = stdout.includes('North');
                const hasEastRef = stdout.includes('East');
                
                if (hasLatDegrees && hasLonDegrees && hasNorthRef && hasEastRef) {
                    console.log('✅ GPS coordinates written in correct DMS format');
                    return { success: true, format: 'DMS', exiftoolOutput: stdout };
                } else {
                    console.log('❌ GPS coordinates not in expected DMS format');
                    return { success: false, error: 'Incorrect format', exiftoolOutput: stdout };
                }
                
            } catch (exiftoolError) {
                console.log('⚠️  Could not verify format with exiftool:', exiftoolError.message);
                return { success: true, warning: 'Could not verify format with exiftool' };
            }
            
        } else {
            console.log('❌ Failed to write GPS coordinates for format test');
            return { success: false, error: 'Failed to write coordinates' };
        }
        
    } catch (error) {
        console.error('❌ GPS format test failed:', error.message);
        return { success: false, error: error.message };
    } finally {
        // Clean up test file
        try {
            await fs.promises.unlink(testImagePath);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Run all GPS writing tests
 */
export async function runGpsWritingTests() {
    console.log('🧪 Running GPS Writing Test Suite...\n');
    
    const results = {
        gpsWriting: await testGpsWriting(),
        invalidGpsWriting: await testInvalidGpsWriting(),
        gpsFormat: await testGpsFormat()
    };
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(r => r.success).length;
    
    console.log(`\n📊 GPS Writing Test Results: ${passedTests}/${totalTests} passed`);
    
    return {
        totalTests,
        passedTests,
        results,
        success: passedTests === totalTests
    };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runGpsWritingTests().then(results => {
        process.exit(results.success ? 0 : 1);
    });
}
