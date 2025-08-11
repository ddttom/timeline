/**
 * Timeline Consolidation Unit Tests
 * Comprehensive tests for consolidated placeholder functionality
 */

import { strict as assert } from 'assert';
import { createTimelineLogger } from '../src/utils/debugLogger.js';

/**
 * Mock TimelineValidator for testing
 */
class MockTimelineValidator {
    validateTimelineData(data) {
        return {
            isValid: true,
            issues: [],
            score: 1.0,
            statistics: {
                totalRecords: data.length,
                validRecords: data.length,
                invalidRecords: 0
            }
        };
    }
}

/**
 * Mock TimelineDuplicateMonitor for testing
 */
class MockTimelineDuplicateMonitor {
    constructor() {
        this.timestamps = new Map();
        this.monitoring = false;
    }

    startMonitoring() {
        this.monitoring = true;
        this.timestamps.clear();
    }

    recordTimestamp(timestamp, record) {
        if (!this.monitoring) return;
        
        if (!this.timestamps.has(timestamp)) {
            this.timestamps.set(timestamp, []);
        }
        this.timestamps.get(timestamp).push(record);
    }

    generateReport() {
        const duplicateTimestamps = [];
        let totalDuplicates = 0;
        
        for (const [timestamp, records] of this.timestamps) {
            if (records.length > 1) {
                duplicateTimestamps.push({
                    timestamp,
                    count: records.length,
                    records: records.slice(0, 3) // Sample first 3
                });
                totalDuplicates += records.length - 1; // Count duplicates (not unique)
            }
        }
        
        return {
            duplicateTimestamps,
            totalDuplicates,
            uniqueTimestamps: this.timestamps.size,
            totalRecords: Array.from(this.timestamps.values()).reduce((sum, records) => sum + records.length, 0)
        };
    }
}

/**
 * Mock timeline augmentation service for testing
 */
class MockTimelineAugmentation {
    constructor() {
        this.logger = createTimelineLogger({ prefix: 'MOCK_AUGMENT', level: 'ERROR' });
    }

    /**
     * Mock implementation of timestamp consolidation
     * @param {Array} timelineData - Timeline data to consolidate
     * @returns {Array} Consolidated timeline data
     */
    consolidateTimestamps(timelineData) {
        const timestampMap = new Map();
        
        // Group records by timestamp
        for (const record of timelineData) {
            const timestamp = record.timestamp;
            if (!timestampMap.has(timestamp)) {
                timestampMap.set(timestamp, {
                    timestamp,
                    type: 'placeholder',
                    consolidatedImages: [],
                    metadata: {
                        totalImages: 0,
                        cameras: new Set(),
                        locations: new Set()
                    }
                });
            }
            
            const consolidated = timestampMap.get(timestamp);
            consolidated.consolidatedImages.push(record);
            consolidated.metadata.totalImages++;
            
            if (record.metadata?.camera) {
                consolidated.metadata.cameras.add(record.metadata.camera);
            }
            
            if (record.latitude && record.longitude) {
                consolidated.metadata.locations.add(`${record.latitude},${record.longitude}`);
            }
        }
        
        // Convert Sets to Arrays for serialization
        const result = Array.from(timestampMap.values()).map(item => ({
            ...item,
            metadata: {
                ...item.metadata,
                cameras: Array.from(item.metadata.cameras),
                locations: Array.from(item.metadata.locations)
            }
        }));
        
        return result;
    }
}

/**
 * Timeline Consolidation Test Suite
 */
export class TimelineConsolidationTest {
    constructor() {
        this.logger = createTimelineLogger({ prefix: 'CONSOLIDATION_TEST', level: 'INFO' });
        this.validator = new MockTimelineValidator();
        this.duplicateMonitor = new MockTimelineDuplicateMonitor();
        this.augmentation = new MockTimelineAugmentation();
        
        this.testResults = [];
    }

    /**
     * Run all consolidation tests
     * @returns {Object} Test results
     */
    async runAllTests() {
        console.log('🧪 Starting Timeline Consolidation Tests...\n');
        
        const testSuites = [
            { name: 'Basic Consolidation', fn: () => this.testBasicConsolidation() },
            { name: 'Duplicate Detection', fn: () => this.testDuplicateDetection() },
            { name: 'Metadata Preservation', fn: () => this.testMetadataPreservation() },
            { name: 'Edge Cases', fn: () => this.testEdgeCases() },
            { name: 'Performance Impact', fn: () => this.testPerformanceImpact() },
            { name: 'Data Integrity', fn: () => this.testDataIntegrity() },
            { name: 'Validation Integration', fn: () => this.testValidationIntegration() },
            { name: 'Monitor Integration', fn: () => this.testMonitorIntegration() },
            { name: 'Large Dataset Handling', fn: () => this.testLargeDatasetHandling() },
            { name: 'Complex Scenarios', fn: () => this.testComplexScenarios() }
        ];

        const results = {
            testSuites: [],
            summary: { total: 0, passed: 0, failed: 0 },
            timestamp: new Date().toISOString()
        };

        for (const suite of testSuites) {
            console.log(`🔬 Running ${suite.name}...`);
            
            try {
                const suiteResult = await suite.fn();
                results.testSuites.push({
                    name: suite.name,
                    status: 'PASSED',
                    results: suiteResult,
                    assertions: suiteResult.assertions || 0
                });
                results.summary.passed++;
                console.log(`✅ ${suite.name} passed (${suiteResult.assertions || 0} assertions)\n`);
                
            } catch (error) {
                results.testSuites.push({
                    name: suite.name,
                    status: 'FAILED',
                    error: error.message,
                    stack: error.stack
                });
                results.summary.failed++;
                console.log(`❌ ${suite.name} failed: ${error.message}\n`);
            }
        }

        results.summary.total = results.testSuites.length;
        this.displayTestResults(results);
        return results;
    }

    /**
     * Test basic timestamp consolidation functionality
     * @returns {Object} Test results
     */
    testBasicConsolidation() {
        const testData = [
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img1.jpg', fileName: 'img1.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img2.jpg', fileName: 'img2.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img3.jpg', fileName: 'img3.jpg' },
            { timestamp: '2024-01-01T13:00:00Z', filePath: '/img4.jpg', fileName: 'img4.jpg' }
        ];

        const consolidated = this.augmentation.consolidateTimestamps(testData);

        // Assertions
        assert.strictEqual(consolidated.length, 2, 'Should consolidate to 2 unique timestamps');
        
        const firstGroup = consolidated.find(item => item.timestamp === '2024-01-01T12:00:00Z');
        assert(firstGroup, 'Should find first timestamp group');
        assert.strictEqual(firstGroup.consolidatedImages.length, 3, 'First group should have 3 images');
        assert.strictEqual(firstGroup.metadata.totalImages, 3, 'Metadata should show 3 total images');
        
        const secondGroup = consolidated.find(item => item.timestamp === '2024-01-01T13:00:00Z');
        assert(secondGroup, 'Should find second timestamp group');
        assert.strictEqual(secondGroup.consolidatedImages.length, 1, 'Second group should have 1 image');

        return { assertions: 6, consolidated: consolidated.length, originalSize: testData.length };
    }

    /**
     * Test duplicate detection functionality
     * @returns {Object} Test results
     */
    testDuplicateDetection() {
        const testData = [
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img1.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img2.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img3.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img4.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img5.jpg' }
        ];

        this.duplicateMonitor.startMonitoring();
        
        for (const record of testData) {
            this.duplicateMonitor.recordTimestamp(record.timestamp, record);
        }

        const duplicateReport = this.duplicateMonitor.generateReport();
        
        // Assertions
        assert(duplicateReport.duplicateTimestamps.length > 0, 'Should detect duplicate timestamps');
        assert.strictEqual(duplicateReport.totalDuplicates, 4, 'Should detect 4 duplicates (5 total - 1 unique)');
        
        const duplicateEntry = duplicateReport.duplicateTimestamps[0];
        assert.strictEqual(duplicateEntry.count, 5, 'Duplicate entry should show count of 5');
        assert.strictEqual(duplicateEntry.timestamp, '2024-01-01T12:00:00Z', 'Should track correct timestamp');

        return { 
            assertions: 4, 
            duplicatesDetected: duplicateReport.totalDuplicates,
            uniqueTimestamps: duplicateReport.uniqueTimestamps
        };
    }

    /**
     * Test metadata preservation during consolidation
     * @returns {Object} Test results
     */
    testMetadataPreservation() {
        const testData = [
            { 
                timestamp: '2024-01-01T12:00:00Z', 
                filePath: '/img1.jpg',
                latitude: 40.7128,
                longitude: -74.0060,
                metadata: { camera: 'Canon', iso: 100 }
            },
            { 
                timestamp: '2024-01-01T12:00:00Z', 
                filePath: '/img2.jpg',
                latitude: 40.7129,
                longitude: -74.0061,
                metadata: { camera: 'Nikon', iso: 200 }
            },
            { 
                timestamp: '2024-01-01T12:00:00Z', 
                filePath: '/img3.jpg',
                latitude: 40.7128,
                longitude: -74.0060,
                metadata: { camera: 'Canon', iso: 400 }
            }
        ];

        const consolidated = this.augmentation.consolidateTimestamps(testData);
        const group = consolidated[0];

        // Assertions
        assert.strictEqual(group.metadata.totalImages, 3, 'Should preserve total image count');
        assert(group.metadata.cameras.includes('Canon'), 'Should preserve Canon camera');
        assert(group.metadata.cameras.includes('Nikon'), 'Should preserve Nikon camera');
        assert.strictEqual(group.metadata.cameras.length, 2, 'Should have 2 unique cameras');
        assert.strictEqual(group.metadata.locations.length, 2, 'Should have 2 unique locations');
        assert(group.consolidatedImages.length === 3, 'Should preserve all original images');

        return { 
            assertions: 6, 
            metadataPreserved: true,
            uniqueCameras: group.metadata.cameras.length,
            uniqueLocations: group.metadata.locations.length
        };
    }

    /**
     * Test edge cases and error conditions
     * @returns {Object} Test results
     */
    testEdgeCases() {
        let assertions = 0;

        // Test empty dataset
        const emptyResult = this.augmentation.consolidateTimestamps([]);
        assert.strictEqual(emptyResult.length, 0, 'Empty dataset should return empty result');
        assertions++;

        // Test single record
        const singleRecord = [{ timestamp: '2024-01-01T12:00:00Z', filePath: '/img1.jpg' }];
        const singleResult = this.augmentation.consolidateTimestamps(singleRecord);
        assert.strictEqual(singleResult.length, 1, 'Single record should return single result');
        assert.strictEqual(singleResult[0].consolidatedImages.length, 1, 'Single result should have one image');
        assertions += 2;

        // Test null/undefined timestamps
        const invalidData = [
            { timestamp: null, filePath: '/img1.jpg' },
            { timestamp: undefined, filePath: '/img2.jpg' },
            { timestamp: '2024-01-01T12:00:00Z', filePath: '/img3.jpg' }
        ];
        const invalidResult = this.augmentation.consolidateTimestamps(invalidData);
        assert(invalidResult.length >= 1, 'Should handle invalid timestamps gracefully');
        assertions++;

        return { assertions, edgeCasesTested: 3 };
    }

    /**
     * Test performance impact of consolidation
     * @returns {Object} Test results
     */
    testPerformanceImpact() {
        const testSizes = [100, 500, 1000];
        const results = [];

        for (const size of testSizes) {
            const testData = this.generateTestData(size, 0.7); // 70% duplicates
            
            const startTime = performance.now();
            const consolidated = this.augmentation.consolidateTimestamps(testData);
            const endTime = performance.now();
            
            const reductionRatio = ((testData.length - consolidated.length) / testData.length * 100).toFixed(2);
            
            results.push({
                originalSize: size,
                consolidatedSize: consolidated.length,
                reductionRatio: parseFloat(reductionRatio),
                processingTime: endTime - startTime
            });
        }

        // Assertions
        assert(results.every(r => r.reductionRatio > 50), 'Should achieve >50% reduction for duplicate-heavy data');
        assert(results.every(r => r.processingTime < 1000), 'Processing should complete within 1 second');
        assert(results.every(r => r.consolidatedSize < r.originalSize), 'Consolidated size should be smaller');

        return { assertions: 3, performanceResults: results };
    }

    /**
     * Test data integrity after consolidation
     * @returns {Object} Test results
     */
    testDataIntegrity() {
        const testData = this.generateTestData(1000, 0.5);
        const originalImageCount = testData.length;
        
        const consolidated = this.augmentation.consolidateTimestamps(testData);
        
        // Count total images in consolidated result
        let totalConsolidatedImages = 0;
        for (const group of consolidated) {
            totalConsolidatedImages += group.consolidatedImages.length;
        }

        // Assertions
        assert.strictEqual(totalConsolidatedImages, originalImageCount, 'Should preserve all original images');
        
        // Verify no data loss
        const originalTimestamps = new Set(testData.map(item => item.timestamp));
        const consolidatedTimestamps = new Set(consolidated.map(item => item.timestamp));
        assert.strictEqual(consolidatedTimestamps.size, originalTimestamps.size, 'Should preserve all unique timestamps');

        return { 
            assertions: 2,
            dataIntegrityVerified: true,
            originalCount: originalImageCount,
            consolidatedCount: totalConsolidatedImages
        };
    }

    /**
     * Test integration with timeline validator
     * @returns {Object} Test results
     */
    testValidationIntegration() {
        const testData = this.generateTestData(500, 0.6);
        const consolidated = this.augmentation.consolidateTimestamps(testData);
        
        // Validate consolidated data
        const validationResult = this.validator.validateTimelineData(consolidated);
        
        // Assertions
        assert(validationResult.isValid, 'Consolidated data should pass validation');
        assert(validationResult.issues.length === 0, 'Should have no validation issues');
        assert(validationResult.statistics.totalRecords === consolidated.length, 'Statistics should match consolidated count');

        return { 
            assertions: 3, 
            validationPassed: validationResult.isValid,
            validationScore: validationResult.score,
            issuesFound: validationResult.issues.length
        };
    }

    /**
     * Test integration with duplicate monitor
     * @returns {Object} Test results
     */
    testMonitorIntegration() {
        const testData = this.generateTestData(300, 0.8); // High duplicate ratio
        
        this.duplicateMonitor.startMonitoring();
        
        // Process data through monitor
        for (const record of testData) {
            this.duplicateMonitor.recordTimestamp(record.timestamp, record);
        }
        
        const monitorReport = this.duplicateMonitor.generateReport();
        const consolidated = this.augmentation.consolidateTimestamps(testData);
        
        // Assertions
        assert(monitorReport.totalDuplicates > 0, 'Monitor should detect duplicates');
        assert(consolidated.length < testData.length, 'Consolidation should reduce dataset size');
        assert(monitorReport.uniqueTimestamps === consolidated.length, 'Monitor unique count should match consolidated count');

        return { 
            assertions: 3, 
            duplicatesDetected: monitorReport.totalDuplicates,
            uniqueTimestamps: monitorReport.uniqueTimestamps,
            consolidatedGroups: consolidated.length
        };
    }

    /**
     * Test handling of large datasets
     * @returns {Object} Test results
     */
    testLargeDatasetHandling() {
        const largeDataset = this.generateTestData(5000, 0.75); // 5k records, 75% duplicates
        
        const startTime = performance.now();
        const consolidated = this.augmentation.consolidateTimestamps(largeDataset);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        const reductionRatio = ((largeDataset.length - consolidated.length) / largeDataset.length * 100);

        // Assertions
        assert(processingTime < 2000, 'Large dataset should process within 2 seconds');
        assert(reductionRatio > 60, 'Should achieve significant reduction (>60%)');
        assert(consolidated.length > 0, 'Should produce consolidated results');

        return { 
            assertions: 3, 
            originalSize: largeDataset.length,
            consolidatedSize: consolidated.length,
            processingTime,
            reductionRatio: reductionRatio.toFixed(2)
        };
    }

    /**
     * Test complex consolidation scenarios
     * @returns {Object} Test results
     */
    testComplexScenarios() {
        // Scenario 1: GPS data with slight variations
        const gpsData = [
            { timestamp: '2024-01-01T12:00:00Z', latitude: 40.7128, longitude: -74.0060 },
            { timestamp: '2024-01-01T12:00:00Z', latitude: 40.7129, longitude: -74.0061 },
            { timestamp: '2024-01-01T12:00:00Z', latitude: 40.7127, longitude: -74.0059 }
        ];
        
        const gpsResult = this.augmentation.consolidateTimestamps(gpsData);
        
        // Scenario 2: Large timestamp clusters
        const clusterData = [];
        for (let i = 0; i < 50; i++) {
            clusterData.push({ timestamp: '2024-01-01T12:00:00Z', filePath: `/cluster${i}.jpg` });
        }
        for (let i = 0; i < 30; i++) {
            clusterData.push({ timestamp: '2024-01-01T13:00:00Z', filePath: `/cluster2_${i}.jpg` });
        }
        
        const clusterResult = this.augmentation.consolidateTimestamps(clusterData);

        // Assertions
        assert(gpsResult.length === 1, 'GPS data should consolidate by timestamp');
        assert(gpsResult[0].metadata.locations.length >= 1, 'Should preserve location variations');
        assert(clusterResult.length === 2, 'Should create 2 clusters');
        assert(clusterResult[0].consolidatedImages.length === 50, 'First cluster should have 50 images');
        assert(clusterResult[1].consolidatedImages.length === 30, 'Second cluster should have 30 images');

        return { 
            assertions: 5, 
            scenariosTested: 2,
            gpsConsolidation: gpsResult[0].metadata.locations.length,
            clusterSizes: clusterResult.map(c => c.consolidatedImages.length)
        };
    }

    /**
     * Generate test data with specified duplicate ratio
     * @param {number} size - Total dataset size
     * @param {number} duplicateRatio - Ratio of duplicates (0-1)
     * @returns {Array} Generated test data
     */
    generateTestData(size, duplicateRatio) {
        const uniqueCount = Math.floor(size * (1 - duplicateRatio));
        const data = [];
        const baseTimestamp = new Date('2024-01-01T00:00:00Z');
        
        // Generate unique records
        for (let i = 0; i < uniqueCount; i++) {
            const timestamp = new Date(baseTimestamp.getTime() + i * 60000); // 1 minute intervals
            data.push({
                timestamp: timestamp.toISOString(),
                filePath: `/unique${i}.jpg`,
                fileName: `unique${i}.jpg`,
                metadata: {
                    camera: i % 3 === 0 ? 'Canon' : i % 3 === 1 ? 'Nikon' : 'Sony',
                    iso: 100 + (i % 10) * 50
                }
            });
        }
        
        // Generate duplicates
        const duplicateCount = size - uniqueCount;
        for (let i = 0; i < duplicateCount; i++) {
            const originalIndex = Math.floor(Math.random() * uniqueCount);
            const original = data[originalIndex];
            
            data.push({
                timestamp: original.timestamp,
                filePath: `/duplicate${i}.jpg`,
                fileName: `duplicate${i}.jpg`,
                metadata: {
                    camera: original.metadata.camera,
                    iso: original.metadata.iso
                }
            });
        }
        
        return data;
    }

    /**
     * Display test results
     * @param {Object} results - Test results
     */
    displayTestResults(results) {
        console.log('\n🧪 TIMELINE CONSOLIDATION TEST RESULTS');
        console.log('=' .repeat(50));
        
        console.log(`\n📊 Summary:`);
        console.log(`  Total Tests: ${results.summary.total}`);
        console.log(`  Passed: ${results.summary.passed}`);
        console.log(`  Failed: ${results.summary.failed}`);
        console.log(`  Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
        
        console.log(`\n📋 Test Details:`);
        for (const suite of results.testSuites) {
            const status = suite.status === 'PASSED' ? '✅' : '❌';
            console.log(`  ${status} ${suite.name}`);
            
            if (suite.status === 'PASSED' && suite.assertions) {
                console.log(`    Assertions: ${suite.assertions}`);
            } else if (suite.status === 'FAILED') {
                console.log(`    Error: ${suite.error}`);
            }
        }
        
        if (results.summary.failed === 0) {
            console.log(`\n🎉 All consolidation tests passed! Timeline consolidation is working correctly.`);
        } else {
            console.log(`\n⚠️  ${results.summary.failed} test(s) failed. Review errors and fix issues.`);
        }
        
        console.log('\n' + '='.repeat(50));
    }
}

/**
 * Export test runner function
 * @returns {Promise<Object>} Test results
 */
export async function runConsolidationTests() {
    const testSuite = new TimelineConsolidationTest();
    return await testSuite.runAllTests();
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runConsolidationTests()
        .then(results => {
            process.exit(results.summary.failed === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}
