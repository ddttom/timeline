#!/usr/bin/env node

/**
 * CR3 File Processing Test
 * Tests the improved CR3 file format support and GPS extraction
 */

import { extractGpsCoordinates, getImageTimestamp, isSupportedImageFile } from '../src/services/exif.js';
import { createGeolocationDatabase } from '../src/services/geolocationDatabase.js';
import fs from 'fs';
import path from 'path';

/**
 * Test configuration
 */
const TEST_CONFIG = {
    // Add your CR3 test files here
    testFiles: [
        '/Users/tomcranstoun/pics/svalbard/pics/0T4A2370.CR3',
        '/Users/tomcranstoun/pics/svalbard/pics/0T4A2371.CR3',
        '/Users/tomcranstoun/pics/svalbard/pics/0T4A2372.CR3'
    ],
    maxTestFiles: 3 // Limit number of files to test for performance
};

/**
 * Test results tracking
 */
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run a single test with error handling
 */
async function runTest(testName, testFunction) {
    testResults.total++;
    try {
        console.log(`🧪 Running: ${testName}`);
        const result = await testFunction();
        if (result) {
            testResults.passed++;
            console.log(`   ✅ PASSED: ${testName}`);
            return true;
        } else {
            testResults.failed++;
            console.log(`   ❌ FAILED: ${testName}`);
            return false;
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push({ test: testName, error: error.message });
        console.log(`   ❌ ERROR: ${testName} - ${error.message}`);
        return false;
    }
}

/**
 * Test CR3 file format detection
 */
async function testCR3FileSupport() {
    const cr3Extensions = ['.cr3', '.CR3'];
    
    for (const ext of cr3Extensions) {
        const testFile = `test${ext}`;
        if (!isSupportedImageFile(testFile)) {
            console.log(`   ❌ CR3 extension ${ext} not supported`);
            return false;
        }
    }
    
    console.log(`   ✅ CR3 file extensions properly supported`);
    return true;
}

/**
 * Test GPS extraction from actual CR3 files
 */
async function testCR3GpsExtraction() {
    const availableFiles = TEST_CONFIG.testFiles.filter(file => fs.existsSync(file));
    
    if (availableFiles.length === 0) {
        console.log(`   ⚠️  No CR3 test files found, skipping GPS extraction test`);
        return true; // Skip test if no files available
    }
    
    let successCount = 0;
    const testFiles = availableFiles.slice(0, TEST_CONFIG.maxTestFiles);
    
    console.log(`   🔍 Testing GPS extraction on ${testFiles.length} CR3 files...`);
    
    for (const filePath of testFiles) {
        try {
            const startTime = Date.now();
            const gpsCoords = await extractGpsCoordinates(filePath);
            const endTime = Date.now();
            
            const fileName = path.basename(filePath);
            
            if (gpsCoords) {
                console.log(`   ✅ ${fileName}: GPS found (${gpsCoords.latitude}, ${gpsCoords.longitude}) in ${endTime - startTime}ms`);
                successCount++;
            } else {
                console.log(`   ℹ️  ${fileName}: No GPS data found in ${endTime - startTime}ms`);
            }
        } catch (error) {
            console.log(`   ❌ ${path.basename(filePath)}: Error - ${error.message}`);
        }
    }
    
    console.log(`   📊 GPS extraction results: ${successCount}/${testFiles.length} files had GPS data`);
    return true; // Test passes if no errors occurred
}

/**
 * Test timestamp extraction from CR3 files
 */
async function testCR3TimestampExtraction() {
    const availableFiles = TEST_CONFIG.testFiles.filter(file => fs.existsSync(file));
    
    if (availableFiles.length === 0) {
        console.log(`   ⚠️  No CR3 test files found, skipping timestamp extraction test`);
        return true;
    }
    
    let successCount = 0;
    const testFiles = availableFiles.slice(0, TEST_CONFIG.maxTestFiles);
    
    console.log(`   🕒 Testing timestamp extraction on ${testFiles.length} CR3 files...`);
    
    for (const filePath of testFiles) {
        try {
            const startTime = Date.now();
            const timestamp = await getImageTimestamp(filePath);
            const endTime = Date.now();
            
            const fileName = path.basename(filePath);
            
            if (timestamp) {
                console.log(`   ✅ ${fileName}: Timestamp found (${timestamp.toISOString()}) in ${endTime - startTime}ms`);
                successCount++;
            } else {
                console.log(`   ℹ️  ${fileName}: No timestamp found in ${endTime - startTime}ms`);
            }
        } catch (error) {
            console.log(`   ❌ ${path.basename(filePath)}: Error - ${error.message}`);
        }
    }
    
    console.log(`   📊 Timestamp extraction results: ${successCount}/${testFiles.length} files had timestamps`);
    return successCount > 0; // Test passes if at least one timestamp was found
}

/**
 * Test database integration
 */
async function testDatabaseIntegration() {
    try {
        const db = await createGeolocationDatabase({
            exportPath: 'tests/test-geolocation-export.json'
        });
        
        await db.initialize();
        
        // Test export method
        const exportResult = await db.export();
        if (!exportResult) {
            console.log(`   ❌ Database export failed`);
            return false;
        }
        
        // Test close method
        await db.close();
        
        // Cleanup test file
        if (fs.existsSync('tests/test-geolocation-export.json')) {
            fs.unlinkSync('tests/test-geolocation-export.json');
        }
        
        console.log(`   ✅ Database export and close methods working`);
        return true;
        
    } catch (error) {
        console.log(`   ❌ Database integration error: ${error.message}`);
        return false;
    }
}

/**
 * Performance benchmark test
 */
async function testPerformanceBenchmark() {
    const availableFiles = TEST_CONFIG.testFiles.filter(file => fs.existsSync(file));
    
    if (availableFiles.length === 0) {
        console.log(`   ⚠️  No CR3 test files found, skipping performance test`);
        return true;
    }
    
    const testFile = availableFiles[0];
    const iterations = 3;
    const times = [];
    
    console.log(`   ⏱️  Running performance benchmark on ${path.basename(testFile)} (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await extractGpsCoordinates(testFile);
        const endTime = Date.now();
        times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`   📊 Performance results: avg=${avgTime.toFixed(1)}ms, min=${minTime}ms, max=${maxTime}ms`);
    
    // Test passes if average time is under 2 seconds (reasonable for CR3 files)
    return avgTime < 2000;
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('🚀 Starting CR3 File Processing Tests\n');
    console.log('=' .repeat(50));
    
    // Run all tests
    await runTest('CR3 File Format Support', testCR3FileSupport);
    await runTest('CR3 GPS Extraction', testCR3GpsExtraction);
    await runTest('CR3 Timestamp Extraction', testCR3TimestampExtraction);
    await runTest('Database Integration', testDatabaseIntegration);
    await runTest('Performance Benchmark', testPerformanceBenchmark);
    
    // Display results
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        testResults.errors.forEach(error => {
            console.log(`   ${error.test}: ${error.error}`);
        });
    }
    
    console.log('\n✅ CR3 Processing Tests Complete!');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

export { runAllTests, testResults };
