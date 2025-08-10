/**
 * GPS Extraction Test Suite
 * Tests the GPS coordinate extraction functionality from EXIF data
 */

import { extractGpsCoordinates } from '../src/services/exif.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test GPS extraction from a known GPS-enabled image
 */
export async function testGpsExtraction() {
    console.log('=== GPS Extraction Test ===\n');
    
    // Test with the known GPS image
    const testImagePath = path.join(process.env.HOME, 'pics', 'svalbard', 'pics', '0T4A2011.JPG');
    
    console.log(`Testing GPS extraction from: ${testImagePath}`);
    console.log('Expected coordinates: 78°13\'16.26"N, 15°38\'23.01"E\n');
    
    try {
        const result = await extractGpsCoordinates(testImagePath);
        
        if (result) {
            console.log('✅ GPS extraction successful!');
            console.log(`Extracted coordinates: ${result.latitude}, ${result.longitude}`);
            
            if (result.altitude !== undefined) {
                console.log(`Altitude: ${result.altitude} meters`);
            }
            
            // Verify the coordinates are approximately correct
            const expectedLat = 78.22118333; // 78 + 13/60 + 16.26/3600
            const expectedLon = 15.63972500; // 15 + 38/60 + 23.01/3600
            
            const latDiff = Math.abs(result.latitude - expectedLat);
            const lonDiff = Math.abs(result.longitude - expectedLon);
            
            console.log(`\nExpected: ${expectedLat}, ${expectedLon}`);
            console.log(`Difference: lat=${latDiff.toFixed(6)}, lon=${lonDiff.toFixed(6)}`);
            
            if (latDiff < 0.001 && lonDiff < 0.001) {
                console.log('✅ Coordinates match expected values!');
                return { success: true, coordinates: result, accuracy: { latDiff, lonDiff } };
            } else {
                console.log('❌ Coordinates do not match expected values');
                return { success: false, error: 'Coordinate mismatch', coordinates: result };
            }
            
        } else {
            console.log('❌ GPS extraction failed - no coordinates returned');
            return { success: false, error: 'No coordinates returned' };
        }
        
    } catch (error) {
        console.error('❌ GPS extraction failed with error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Test GPS extraction from an image without GPS data
 */
export async function testNoGpsImage() {
    console.log('\n=== No GPS Image Test ===\n');
    
    // Test with an image that should not have GPS data
    const testImagePath = path.join(process.env.HOME, 'pics', 'Glenna Wedding', '0T4A1973.JPG');
    
    console.log(`Testing GPS extraction from image without GPS: ${testImagePath}`);
    
    try {
        const result = await extractGpsCoordinates(testImagePath);
        
        if (!result || Object.keys(result).length === 0 || (!result.latitude && !result.longitude)) {
            console.log('✅ Correctly identified image without GPS data');
            return { success: true, hasGps: false };
        } else {
            console.log('❌ Unexpectedly found GPS data in image that should not have it');
            return { success: false, error: 'Unexpected GPS data found', coordinates: result };
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Run all GPS extraction tests
 */
export async function runGpsExtractionTests() {
    console.log('🧪 Running GPS Extraction Test Suite...\n');
    
    const results = {
        gpsExtraction: await testGpsExtraction(),
        noGpsImage: await testNoGpsImage()
    };
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(r => r.success).length;
    
    console.log(`\n📊 GPS Extraction Test Results: ${passedTests}/${totalTests} passed`);
    
    return {
        totalTests,
        passedTests,
        results,
        success: passedTests === totalTests
    };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runGpsExtractionTests().then(results => {
        process.exit(results.success ? 0 : 1);
    });
}
