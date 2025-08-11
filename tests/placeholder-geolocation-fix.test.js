#!/usr/bin/env node

/**
 * Test suite for placeholder geolocation fix
 * Verifies that images outside timeline GPS coverage can be geolocated using enhanced fallback
 */

import { findClosestRecord, findClosestRecordWithFallback } from '../src/services/timelineParser.js';
import { primaryInterpolation } from '../src/services/interpolation.js';

/**
 * Test data simulating the Svalbard scenario
 */
const mockTimelineRecords = [
    // Real GPS records from February 2025 (end of timeline GPS coverage)
    {
        timestamp: '2025-02-10T10:00:00.000Z',
        latitude: 59.9139,
        longitude: 10.7522,
        source: 'timeline_existing',
        accuracy: 10
    },
    {
        timestamp: '2025-02-10T14:30:00.000Z',
        latitude: 59.9200,
        longitude: 10.7600,
        source: 'timeline_existing',
        accuracy: 15
    },
    // Placeholder entries for August 2025 (created by timeline extension)
    {
        timestamp: '2025-08-02T16:55:44.000Z',
        latitude: null,
        longitude: null,
        source: 'timeline_extension_placeholder',
        isPlaceholder: true
    },
    {
        timestamp: '2025-08-05T16:34:13.000Z',
        latitude: null,
        longitude: null,
        source: 'timeline_extension_placeholder',
        isPlaceholder: true
    }
];

const mockSvalbardImage = {
    fileName: 'IMG_2025_Svalbard.jpg',
    timestamp: new Date('2025-08-02T16:55:44.000Z'),
    exifData: {
        timezone: 'Arctic/Longyearbyen'
    }
};

/**
 * Test suite runner
 */
class PlaceholderGeolocationTest {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
    }

    /**
     * Run a single test
     */
    runTest(testName, testFunction) {
        this.totalTests++;
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = testFunction();
            if (result) {
                console.log(`✅ PASSED: ${testName}`);
                this.passedTests++;
                this.testResults.push({ name: testName, status: 'PASSED', error: null });
            } else {
                console.log(`❌ FAILED: ${testName}`);
                this.testResults.push({ name: testName, status: 'FAILED', error: 'Test returned false' });
            }
        } catch (error) {
            console.log(`❌ FAILED: ${testName} - ${error.message}`);
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
        }
    }

    /**
     * Test 1: Verify findClosestRecord filters out placeholder entries
     */
    testFindClosestRecordFiltersPlaceholders() {
        const targetTimestamp = new Date('2025-08-02T16:55:44.000Z');
        
        // This should NOT return the placeholder entry even though it's an exact timestamp match
        const result = findClosestRecord(mockTimelineRecords, targetTimestamp, 30);
        
        // Should be null because placeholder entries are filtered out
        if (result !== null) {
            console.log(`   ❌ Expected null, got:`, result);
            return false;
        }
        
        console.log(`   ✅ Correctly filtered out placeholder entries`);
        return true;
    }

    /**
     * Test 2: Verify enhanced fallback finds valid GPS records
     */
    testEnhancedFallbackFindsValidGPS() {
        const targetTimestamp = new Date('2025-08-02T16:55:44.000Z');
        
        const result = findClosestRecordWithFallback(mockTimelineRecords, targetTimestamp, 30, 72);
        
        if (!result || !result.record) {
            console.log(`   ❌ Expected fallback result, got:`, result);
            return false;
        }
        
        if (result.record.latitude === null || result.record.longitude === null) {
            console.log(`   ❌ Fallback returned placeholder entry:`, result.record);
            return false;
        }
        
        if (!result.fallbackUsed) {
            console.log(`   ❌ Expected fallback to be used, got:`, result);
            return false;
        }
        
        console.log(`   ✅ Enhanced fallback found valid GPS record:`);
        console.log(`      📍 Coordinates: ${result.record.latitude}, ${result.record.longitude}`);
        console.log(`      ⏰ Time difference: ${result.timeDifferenceMinutes.toFixed(1)} minutes`);
        console.log(`      🔄 Fallback tolerance: ${result.fallbackToleranceHours} hours`);
        
        return true;
    }

    /**
     * Test 3: Verify primary interpolation uses enhanced fallback
     */
    async testPrimaryInterpolationWithFallback() {
        const result = await primaryInterpolation(mockSvalbardImage, mockTimelineRecords, 30);
        
        if (!result.success) {
            console.log(`   ❌ Primary interpolation failed:`, result.failureDetails);
            return false;
        }
        
        if (!result.result.latitude || !result.result.longitude) {
            console.log(`   ❌ No coordinates returned:`, result.result);
            return false;
        }
        
        if (result.result.source !== 'timeline_fallback') {
            console.log(`   ❌ Expected fallback source, got:`, result.result.source);
            return false;
        }
        
        console.log(`   ✅ Primary interpolation successful with fallback:`);
        console.log(`      📍 Coordinates: ${result.result.latitude}, ${result.result.longitude}`);
        console.log(`      📊 Source: ${result.result.source}`);
        console.log(`      ⏰ Time difference: ${result.result.timeDifference.toFixed(1)} minutes`);
        console.log(`      🔄 Fallback used: ${result.result.fallbackUsed}`);
        
        return true;
    }

    /**
     * Test 4: Verify multiple Svalbard images can be processed
     */
    async testMultipleSvalbardImages() {
        const svalbardImages = [
            {
                fileName: 'IMG_2025_Svalbard_01.jpg',
                timestamp: new Date('2025-08-02T16:55:44.000Z'),
                exifData: { timezone: 'Arctic/Longyearbyen' }
            },
            {
                fileName: 'IMG_2025_Svalbard_02.jpg',
                timestamp: new Date('2025-08-05T16:34:13.000Z'),
                exifData: { timezone: 'Arctic/Longyearbyen' }
            },
            {
                fileName: 'IMG_2025_Svalbard_03.jpg',
                timestamp: new Date('2025-08-07T12:15:30.000Z'),
                exifData: { timezone: 'Arctic/Longyearbyen' }
            }
        ];

        let successCount = 0;
        
        for (const image of svalbardImages) {
            const result = await primaryInterpolation(image, mockTimelineRecords, 30);
            
            if (result.success && result.result.latitude && result.result.longitude) {
                successCount++;
                console.log(`   ✅ ${image.fileName}: ${result.result.latitude}, ${result.result.longitude}`);
            } else {
                console.log(`   ❌ ${image.fileName}: Failed - ${result.failureDetails?.message}`);
            }
        }
        
        if (successCount !== svalbardImages.length) {
            console.log(`   ❌ Expected ${svalbardImages.length} successes, got ${successCount}`);
            return false;
        }
        
        console.log(`   ✅ All ${successCount} Svalbard images successfully geolocated`);
        return true;
    }

    /**
     * Test 5: Performance test with large dataset
     */
    async testPerformanceWithLargeDataset() {
        // Create a larger timeline dataset
        const largeTimelineRecords = [...mockTimelineRecords];
        
        // Add more GPS records spread over time
        for (let i = 0; i < 100; i++) {
            largeTimelineRecords.push({
                timestamp: new Date(2025, 1, 1 + i, 10, 0, 0).toISOString(),
                latitude: 59.9139 + (Math.random() - 0.5) * 0.1,
                longitude: 10.7522 + (Math.random() - 0.5) * 0.1,
                source: 'timeline_existing',
                accuracy: 10 + Math.random() * 10
            });
        }
        
        const startTime = performance.now();
        
        // Test with 50 images
        let successCount = 0;
        for (let i = 0; i < 50; i++) {
            const testImage = {
                fileName: `test_image_${i}.jpg`,
                timestamp: new Date('2025-08-02T16:55:44.000Z'),
                exifData: { timezone: 'Arctic/Longyearbyen' }
            };
            
            const result = await primaryInterpolation(testImage, largeTimelineRecords, 30);
            if (result.success) successCount++;
        }
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        console.log(`   📊 Performance Results:`);
        console.log(`      ⏱️  Processing time: ${processingTime.toFixed(2)}ms`);
        console.log(`      📈 Average per image: ${(processingTime / 50).toFixed(2)}ms`);
        console.log(`      ✅ Success rate: ${successCount}/50 (${(successCount/50*100).toFixed(1)}%)`);
        
        // Performance should be reasonable (< 10ms per image on average)
        const avgTimePerImage = processingTime / 50;
        if (avgTimePerImage > 10) {
            console.log(`   ❌ Performance too slow: ${avgTimePerImage.toFixed(2)}ms per image`);
            return false;
        }
        
        // Success rate should be 100%
        if (successCount !== 50) {
            console.log(`   ❌ Not all images processed successfully: ${successCount}/50`);
            return false;
        }
        
        return true;
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Placeholder Geolocation Fix Tests');
        console.log('=' .repeat(60));
        
        // Run synchronous tests
        this.runTest('findClosestRecord filters out placeholder entries', 
            () => this.testFindClosestRecordFiltersPlaceholders());
        
        this.runTest('Enhanced fallback finds valid GPS records', 
            () => this.testEnhancedFallbackFindsValidGPS());
        
        // Run asynchronous tests
        await this.runAsyncTest('Primary interpolation uses enhanced fallback', 
            () => this.testPrimaryInterpolationWithFallback());
        
        await this.runAsyncTest('Multiple Svalbard images can be processed', 
            () => this.testMultipleSvalbardImages());
        
        await this.runAsyncTest('Performance test with large dataset', 
            () => this.testPerformanceWithLargeDataset());
        
        // Print summary
        this.printSummary();
    }

    /**
     * Run async test wrapper
     */
    async runAsyncTest(testName, testFunction) {
        this.totalTests++;
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = await testFunction();
            if (result) {
                console.log(`✅ PASSED: ${testName}`);
                this.passedTests++;
                this.testResults.push({ name: testName, status: 'PASSED', error: null });
            } else {
                console.log(`❌ FAILED: ${testName}`);
                this.testResults.push({ name: testName, status: 'FAILED', error: 'Test returned false' });
            }
        } catch (error) {
            console.log(`❌ FAILED: ${testName} - ${error.message}`);
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
        }
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`Passed: ${this.passedTests}`);
        console.log(`Failed: ${this.totalTests - this.passedTests}`);
        console.log(`Success Rate: ${(this.passedTests / this.totalTests * 100).toFixed(1)}%`);
        
        if (this.passedTests === this.totalTests) {
            console.log('\n🎉 ALL TESTS PASSED! The placeholder geolocation fix is working correctly.');
            console.log('✅ The 14 Svalbard geolocation failures should now be resolved.');
        } else {
            console.log('\n❌ Some tests failed. Please review the implementation.');
            
            // Show failed tests
            const failedTests = this.testResults.filter(test => test.status === 'FAILED');
            if (failedTests.length > 0) {
                console.log('\nFailed Tests:');
                failedTests.forEach(test => {
                    console.log(`  - ${test.name}: ${test.error}`);
                });
            }
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new PlaceholderGeolocationTest();
    await testSuite.runAllTests();
}

export { PlaceholderGeolocationTest };
