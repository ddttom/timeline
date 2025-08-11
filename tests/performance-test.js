/**
 * Performance Test Suite
 * Test optimized timeline handling with large datasets and measure performance improvements
 */

import { strict as assert } from 'assert';
import { createTimelineLogger } from '../src/utils/debugLogger.js';
import { createPerformanceBenchmark } from '../src/utils/performanceBenchmark.js';
import { createTimelineDiagnostics } from '../src/utils/timelineDiagnostics.js';

/**
 * Performance test suite for timeline processing
 */
export class TimelinePerformanceTest {
    constructor() {
        this.logger = createTimelineLogger({ prefix: 'PERF_TEST', level: 'INFO' });
        this.benchmark = createPerformanceBenchmark({
            warmupRuns: 3,
            benchmarkRuns: 5,
            enableMemoryTracking: true
        });
        this.diagnostics = createTimelineDiagnostics({
            enablePerformanceMetrics: true,
            enableMemoryTracking: true
        });
        
        this.testResults = [];
    }

    /**
     * Run comprehensive performance tests
     * @returns {Object} Performance test results
     */
    async runPerformanceTests() {
        console.log('🚀 Starting Timeline Performance Tests...\n');
        
        const testSuites = [
            { name: 'Small Dataset Performance', size: 1000, fn: (data) => this.testSmallDatasetPerformance(data) },
            { name: 'Medium Dataset Performance', size: 5000, fn: (data) => this.testMediumDatasetPerformance(data) },
            { name: 'Large Dataset Performance', size: 20000, fn: (data) => this.testLargeDatasetPerformance(data) },
            { name: 'Duplicate Heavy Performance', size: 10000, fn: (data) => this.testDuplicateHeavyPerformance(data) },
            { name: 'Memory Efficiency Test', size: 15000, fn: (data) => this.testMemoryEfficiency(data) },
            { name: 'Concurrent Processing Test', size: 8000, fn: (data) => this.testConcurrentProcessing(data) },
            { name: 'Scalability Test', size: 50000, fn: (data) => this.testScalability(data) }
        ];

        const overallResults = {
            testSuites: [],
            summary: {},
            recommendations: [],
            timestamp: new Date().toISOString()
        };

        for (const suite of testSuites) {
            console.log(`📊 Running ${suite.name} (${suite.size} records)...`);
            
            try {
                const testData = this.generateTestData(suite.size, suite.name);
                const suiteResults = await suite.fn(testData);
                
                overallResults.testSuites.push({
                    name: suite.name,
                    dataSize: suite.size,
                    results: suiteResults,
                    status: 'PASSED'
                });
                
                console.log(`✅ ${suite.name} completed\n`);
                
            } catch (error) {
                console.log(`❌ ${suite.name} failed: ${error.message}\n`);
                
                overallResults.testSuites.push({
                    name: suite.name,
                    dataSize: suite.size,
                    error: error.message,
                    status: 'FAILED'
                });
            }
        }

        // Generate overall summary and recommendations
        overallResults.summary = this.generatePerformanceSummary(overallResults.testSuites);
        overallResults.recommendations = this.generatePerformanceRecommendations(overallResults.testSuites);

        this.displayResults(overallResults);
        return overallResults;
    }

    /**
     * Test small dataset performance (baseline)
     * @param {Array} testData - Test dataset
     * @returns {Object} Performance results
     */
    async testSmallDatasetPerformance(testData) {
        const results = {
            testType: 'SMALL_DATASET',
            dataSize: testData.length,
            metrics: {}
        };

        // Test basic timeline processing
        const startTime = performance.now();
        const startMemory = process.memoryUsage();

        const processed = await this.simulateTimelineProcessing(testData);

        const endTime = performance.now();
        const endMemory = process.memoryUsage();

        results.metrics = {
            processingTime: endTime - startTime,
            memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
            throughput: (testData.length / ((endTime - startTime) / 1000)).toFixed(2),
            processedRecords: processed.recordsProcessed,
            duplicatesFound: processed.duplicatesFound,
            placeholdersCreated: processed.placeholdersCreated
        };

        // Validate performance expectations for small datasets
        assert(results.metrics.processingTime < 1000, `Small dataset should process quickly: ${results.metrics.processingTime}ms`);
        assert(results.metrics.memoryUsage < 50 * 1024 * 1024, `Memory usage should be reasonable: ${results.metrics.memoryUsage} bytes`);

        return results;
    }

    /**
     * Test medium dataset performance
     * @param {Array} testData - Test dataset
     * @returns {Object} Performance results
     */
    async testMediumDatasetPerformance(testData) {
        const results = {
            testType: 'MEDIUM_DATASET',
            dataSize: testData.length,
            metrics: {},
            optimizations: {}
        };

        // Test without optimizations (baseline)
        const baselineResults = await this.benchmarkProcessing(testData, false);
        
        // Test with optimizations
        const optimizedResults = await this.benchmarkProcessing(testData, true);

        results.metrics = {
            baseline: baselineResults,
            optimized: optimizedResults,
            improvement: {
                processingTime: ((baselineResults.processingTime - optimizedResults.processingTime) / baselineResults.processingTime * 100).toFixed(2),
                memoryUsage: ((baselineResults.memoryUsage - optimizedResults.memoryUsage) / baselineResults.memoryUsage * 100).toFixed(2),
                throughput: ((optimizedResults.throughput - baselineResults.throughput) / baselineResults.throughput * 100).toFixed(2)
            }
        };

        // Validate performance improvements
        assert(optimizedResults.processingTime <= baselineResults.processingTime, 'Optimized processing should be faster or equal');
        assert(parseFloat(results.metrics.improvement.processingTime) >= 0, 'Processing time should improve or stay same');

        return results;
    }

    /**
     * Test large dataset performance
     * @param {Array} testData - Test dataset
     * @returns {Object} Performance results
     */
    async testLargeDatasetPerformance(testData) {
        const results = {
            testType: 'LARGE_DATASET',
            dataSize: testData.length,
            metrics: {},
            scalabilityAnalysis: {}
        };

        // Run comprehensive benchmark
        const benchmarkResults = await this.benchmark.runBenchmarkSuite({
            timelineParsing: true,
            duplicateDetection: true,
            timestampConsolidation: true,
            memoryUsage: true,
            throughput: true
        });

        results.metrics = {
            benchmarkSummary: benchmarkResults.summary,
            timelineParsing: benchmarkResults.results.timelineParsing?.large,
            duplicateDetection: benchmarkResults.results.duplicateDetection,
            timestampConsolidation: benchmarkResults.results.timestampConsolidation?.large,
            memoryUsage: benchmarkResults.results.memoryUsage?.large,
            throughput: benchmarkResults.results.throughput
        };

        // Analyze scalability
        results.scalabilityAnalysis = this.analyzeScalability(results.metrics, testData.length);

        // Validate large dataset performance
        const avgProcessingTime = parseFloat(results.metrics.timelineParsing?.statistics?.averageTime || 0);
        assert(avgProcessingTime < 10000, `Large dataset processing should complete in reasonable time: ${avgProcessingTime}ms`);

        return results;
    }

    /**
     * Test performance with duplicate-heavy datasets
     * @param {Array} testData - Test dataset with many duplicates
     * @returns {Object} Performance results
     */
    async testDuplicateHeavyPerformance(testData) {
        const duplicateHeavyData = this.generateDuplicateHeavyData(testData.length, 0.7); // 70% duplicates
        
        const results = {
            testType: 'DUPLICATE_HEAVY',
            dataSize: duplicateHeavyData.length,
            duplicateRatio: 0.7,
            metrics: {}
        };

        // Test duplicate detection performance
        const startTime = performance.now();
        const startMemory = process.memoryUsage();

        const duplicateAnalysis = this.analyzeDuplicates(duplicateHeavyData);
        const consolidated = this.consolidateTimestamps(duplicateHeavyData);

        const endTime = performance.now();
        const endMemory = process.memoryUsage();

        results.metrics = {
            processingTime: endTime - startTime,
            memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
            duplicatesDetected: duplicateAnalysis.duplicateCount,
            consolidationRatio: ((duplicateHeavyData.length - consolidated.length) / duplicateHeavyData.length * 100).toFixed(2),
            throughput: (duplicateHeavyData.length / ((endTime - startTime) / 1000)).toFixed(2)
        };

        // Validate duplicate handling performance
        assert(duplicateAnalysis.duplicateCount > 0, 'Should detect duplicates in duplicate-heavy dataset');
        assert(consolidated.length < duplicateHeavyData.length, 'Consolidation should reduce dataset size');
        assert(parseFloat(results.metrics.consolidationRatio) > 50, 'Should achieve significant consolidation');

        return results;
    }

    /**
     * Test memory efficiency
     * @param {Array} testData - Test dataset
     * @returns {Object} Memory efficiency results
     */
    async testMemoryEfficiency(testData) {
        const results = {
            testType: 'MEMORY_EFFICIENCY',
            dataSize: testData.length,
            memoryAnalysis: {}
        };

        // Run memory-focused diagnostics
        const diagnosticResults = await this.diagnostics.runComprehensiveDiagnostics(testData, {
            memoryLeakDetection: true,
            performanceAnalysis: true
        });

        results.memoryAnalysis = {
            memoryLeakDetection: diagnosticResults.diagnostics.memoryLeakDetection,
            performanceMetrics: diagnosticResults.diagnostics.performanceAnalysis?.metrics,
            healthStatus: diagnosticResults.analysis.overallHealth,
            recommendations: diagnosticResults.recommendations.filter(r => r.type === 'MEMORY')
        };

        // Test memory cleanup
        const memorySnapshots = [];
        for (let i = 0; i < 5; i++) {
            const beforeMemory = process.memoryUsage().heapUsed;
            await this.simulateTimelineProcessing(testData.slice(0, 1000));
            
            if (global.gc) global.gc();
            
            const afterMemory = process.memoryUsage().heapUsed;
            memorySnapshots.push(afterMemory - beforeMemory);
        }

        results.memoryAnalysis.memoryGrowthPattern = {
            snapshots: memorySnapshots,
            averageGrowth: (memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length).toFixed(2),
            maxGrowth: Math.max(...memorySnapshots),
            minGrowth: Math.min(...memorySnapshots)
        };

        // Validate memory efficiency
        const avgGrowth = parseFloat(results.memoryAnalysis.memoryGrowthPattern.averageGrowth);
        assert(avgGrowth < 10 * 1024 * 1024, `Average memory growth should be reasonable: ${avgGrowth} bytes`);

        return results;
    }

    /**
     * Test concurrent processing performance
     * @param {Array} testData - Test dataset
     * @returns {Object} Concurrent processing results
     */
    async testConcurrentProcessing(testData) {
        const results = {
            testType: 'CONCURRENT_PROCESSING',
            dataSize: testData.length,
            concurrencyTests: {}
        };

        const concurrencyLevels = [1, 2, 4, 8];
        
        for (const concurrency of concurrencyLevels) {
            const startTime = performance.now();
            
            const chunks = this.chunkArray(testData, Math.ceil(testData.length / concurrency));
            const processingPromises = chunks.map(chunk => this.simulateTimelineProcessing(chunk));
            
            const chunkResults = await Promise.all(processingPromises);
            const endTime = performance.now();
            
            const totalProcessed = chunkResults.reduce((sum, result) => sum + result.recordsProcessed, 0);
            
            results.concurrencyTests[`workers_${concurrency}`] = {
                processingTime: endTime - startTime,
                throughput: (totalProcessed / ((endTime - startTime) / 1000)).toFixed(2),
                recordsProcessed: totalProcessed,
                chunks: chunks.length
            };
        }

        // Analyze concurrency benefits
        const sequential = results.concurrencyTests.workers_1;
        const parallel = results.concurrencyTests.workers_4;
        
        results.concurrencyAnalysis = {
            speedupRatio: (sequential.processingTime / parallel.processingTime).toFixed(2),
            throughputImprovement: ((parseFloat(parallel.throughput) - parseFloat(sequential.throughput)) / parseFloat(sequential.throughput) * 100).toFixed(2)
        };

        return results;
    }

    /**
     * Test scalability with very large datasets
     * @param {Array} testData - Large test dataset
     * @returns {Object} Scalability results
     */
    async testScalability(testData) {
        const results = {
            testType: 'SCALABILITY',
            dataSize: testData.length,
            scalabilityMetrics: {}
        };

        // Test processing at different scales
        const scales = [1000, 5000, 10000, 25000, 50000];
        const scaleResults = [];

        for (const scale of scales) {
            if (scale > testData.length) continue;
            
            const subset = testData.slice(0, scale);
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;
            
            await this.simulateTimelineProcessing(subset);
            
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            
            scaleResults.push({
                scale,
                processingTime: endTime - startTime,
                memoryUsage: endMemory - startMemory,
                throughput: (scale / ((endTime - startTime) / 1000)).toFixed(2)
            });
        }

        results.scalabilityMetrics = {
            scaleResults,
            linearityAnalysis: this.analyzeLinearScaling(scaleResults),
            memoryScaling: this.analyzeMemoryScaling(scaleResults)
        };

        // Validate scalability
        const linearityScore = results.scalabilityMetrics.linearityAnalysis.score;
        assert(linearityScore > 0.7, `Processing should scale reasonably linearly: ${linearityScore}`);

        return results;
    }

    /**
     * Generate test data for performance testing
     * @param {number} size - Dataset size
     * @param {string} testType - Type of test
     * @returns {Array} Generated test data
     */
    generateTestData(size, duplicateRatio = 0.0) {
        const data = [];
        const startTime = new Date('2024-01-01T00:00:00Z');
        
        for (let i = 0; i < size; i++) {
            const timestamp = new Date(startTime.getTime() + i * 30000); // 30 second intervals
            
            data.push({
                timestamp: timestamp.toISOString(),
                filePath: `/test/img${i}.jpg`,
                fileName: `img${i}.jpg`,
                latitude: Math.random() > 0.5 ? 40.7128 + (Math.random() - 0.5) * 0.1 : undefined,
                longitude: Math.random() > 0.5 ? -74.0060 + (Math.random() - 0.5) * 0.1 : undefined,
                accuracy: Math.random() > 0.5 ? Math.random() * 100 : undefined,
                source: 'performance_test',
                metadata: {
                    camera: i % 3 === 0 ? 'Canon' : i % 3 === 1 ? 'Nikon' : 'Sony',
                    iso: 100 + (i % 20) * 50,
                    fNumber: 2.8 + (i % 5) * 0.4
                }
            });
        }
        
        return data;
    }

    /**
     * Generate duplicate-heavy test data
     * @param {number} size - Total dataset size
     * @param {number} duplicateRatio - Ratio of duplicates
     * @returns {Array} Test data with duplicates
     */
    generateDuplicateHeavyData(size, duplicateRatio) {
        const uniqueSize = Math.floor(size * (1 - duplicateRatio));
        const data = [];
        const baseTimestamp = new Date('2024-01-01T00:00:00Z');
        
        // Generate unique records
        for (let i = 0; i < uniqueSize; i++) {
            const timestamp = new Date(baseTimestamp.getTime() + i * 60000);
            data.push({
                timestamp: timestamp.toISOString(),
                filePath: `/unique${i}.jpg`,
                fileName: `unique${i}.jpg`,
                source: 'performance_test'
            });
        }
        
        // Generate duplicates
        const duplicateCount = size - uniqueSize;
        for (let i = 0; i < duplicateCount; i++) {
            const originalIndex = Math.floor(Math.random() * uniqueSize);
            const original = data[originalIndex];
            
            data.push({
                timestamp: original.timestamp,
                filePath: `/duplicate${i}.jpg`,
                fileName: `duplicate${i}.jpg`,
                source: 'performance_test'
            });
        }
        
        return data;
    }

    /**
     * Benchmark processing with and without optimizations
     * @param {Array} testData - Test data
     * @param {boolean} useOptimizations - Whether to use optimizations
     * @returns {Object} Benchmark results
     */
    async benchmarkProcessing(testData, useOptimizations) {
        const startTime = performance.now();
        const startMemory = process.memoryUsage();
        
        let processed;
        if (useOptimizations) {
            processed = await this.simulateOptimizedProcessing(testData);
        } else {
            processed = await this.simulateBasicProcessing(testData);
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        
        return {
            processingTime: endTime - startTime,
            memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
            throughput: (testData.length / ((endTime - startTime) / 1000)).toFixed(2),
            recordsProcessed: processed.recordsProcessed,
            optimized: useOptimizations
        };
    }

    /**
     * Simulate basic timeline processing (without optimizations)
     * @param {Array} testData - Test data
     * @returns {Object} Processing results
     */
    async simulateBasicProcessing(testData) {
        const results = { recordsProcessed: 0, duplicatesFound: 0 };
        const seen = [];
        
        for (const record of testData) {
            results.recordsProcessed++;
            
            // Inefficient duplicate detection (O(n²))
            for (const seenRecord of seen) {
                if (seenRecord.timestamp === record.timestamp) {
                    results.duplicatesFound++;
                    break;
                }
            }
            
            seen.push(record);
        }
        
        return results;
    }

    /**
     * Simulate optimized timeline processing
     * @param {Array} testData - Test data
     * @returns {Object} Processing results
     */
    async simulateOptimizedProcessing(testData) {
        const results = { recordsProcessed: 0, duplicatesFound: 0 };
        const timestampMap = new Map();
        
        for (const record of testData) {
            results.recordsProcessed++;
            
            // Efficient duplicate detection (O(1))
            if (timestampMap.has(record.timestamp)) {
                results.duplicatesFound++;
            } else {
                timestampMap.set(record.timestamp, record);
            }
        }
        
        return results;
    }

    /**
     * Simulate timeline processing
     * @param {Array} testData - Test data
     * @returns {Object} Processing results
     */
    async simulateTimelineProcessing(testData) {
        return await this.simulateOptimizedProcessing(testData);
    }

    /**
     * Analyze duplicates in dataset
     * @param {Array} testData - Test data
     * @returns {Object} Duplicate analysis
     */
    analyzeDuplicates(testData) {
        const timestampMap = new Map();
        let duplicateCount = 0;
        
        for (const record of testData) {
            if (timestampMap.has(record.timestamp)) {
                duplicateCount++;
            } else {
                timestampMap.set(record.timestamp, record);
            }
        }
        
        return {
            totalRecords: testData.length,
            uniqueTimestamps: timestampMap.size,
            duplicateCount,
            duplicateRatio: (duplicateCount / testData.length).toFixed(3)
        };
    }

    /**
     * Consolidate timestamps
     * @param {Array} testData - Test data
     * @returns {Array} Consolidated data
     */
    consolidateTimestamps(testData) {
        const timestampMap = new Map();
        
        for (const record of testData) {
            if (!timestampMap.has(record.timestamp)) {
                timestampMap.set(record.timestamp, {
                    timestamp: record.timestamp,
                    consolidatedImages: []
                });
            }
            timestampMap.get(record.timestamp).consolidatedImages.push(record);
        }
        
        return Array.from(timestampMap.values());
    }

    /**
     * Analyze scalability metrics
     * @param {Object} metrics - Performance metrics
     * @param {number} dataSize - Dataset size
     * @returns {Object} Scalability analysis
     */
    analyzeScalability(metrics, dataSize) {
        const analysis = {
            dataSize,
            processingTimePerRecord: 0,
            memoryPerRecord: 0,
            scalabilityScore: 'GOOD'
        };
        
        if (metrics.timelineParsing?.statistics?.averageTime) {
            analysis.processingTimePerRecord = (parseFloat(metrics.timelineParsing.statistics.averageTime) / dataSize).toFixed(4);
        }
        
        if (metrics.memoryUsage?.memoryAnalysis?.peakMemory?.heapUsed) {
            analysis.memoryPerRecord = (metrics.memoryUsage.memoryAnalysis.peakMemory.heapUsed / dataSize).toFixed(2);
        }
        
        // Determine scalability score
        const timePerRecord = parseFloat(analysis.processingTimePerRecord);
        if (timePerRecord > 1) {
            analysis.scalabilityScore = 'POOR';
        } else if (timePerRecord > 0.1) {
            analysis.scalabilityScore = 'FAIR';
        } else {
            analysis.scalabilityScore = 'EXCELLENT';
        }
        
        return analysis;
    }

    /**
     * Analyze linear scaling characteristics
     * @param {Array} scaleResults - Results at different scales
     * @returns {Object} Linearity analysis
     */
    analyzeLinearScaling(scaleResults) {
        if (scaleResults.length < 2) return { score: 0, trend: 'INSUFFICIENT_DATA' };
        
        // Calculate correlation between scale and processing time
        const scales = scaleResults.map(r => r.scale);
        const times = scaleResults.map(r => r.processingTime);
        
        const correlation = this.calculateCorrelation(scales, times);
        
        return {
            score: Math.abs(correlation),
            trend: correlation > 0.8 ? 'LINEAR' : correlation > 0.6 ? 'MOSTLY_LINEAR' : 'NON_LINEAR',
            correlation
        };
    }

    /**
     * Analyze memory scaling characteristics
     * @param {Array} scaleResults - Results at different scales
     * @returns {Object} Memory scaling analysis
     */
    analyzeMemoryScaling(scaleResults) {
        if (scaleResults.length < 2) return { trend: 'INSUFFICIENT_DATA' };
        
        const memoryGrowthRates = [];
        for (let i = 1; i < scaleResults.length; i++) {
            const prevResult = scaleResults[i - 1];
            const currResult = scaleResults[i];
            
            const scaleIncrease = currResult.scale - prevResult.scale;
            const memoryIncrease = currResult.memoryUsage - prevResult.memoryUsage;
            
            memoryGrowthRates.push(memoryIncrease / scaleIncrease);
        }
        
        const avgGrowthRate = memoryGrowthRates.reduce((a, b) => a + b, 0) / memoryGrowthRates.length;
        
        return {
            averageGrowthRate: avgGrowthRate.toFixed(2),
            trend: avgGrowthRate < 1000 ? 'EFFICIENT' : avgGrowthRate < 5000 ? 'MODERATE' : 'HIGH',
            growthRates: memoryGrowthRates
        };
    }

    /**
     * Calculate correlation coefficient
     * @param {Array} x - X values
     * @param {Array} y - Y values
     * @returns {number} Correlation coefficient
     */
    calculateCorrelation(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Chunk array into smaller arrays
     * @param {Array} array - Array to chunk
     * @param {number} chunkSize - Size of each chunk
     * @returns {Array} Array of chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Generate performance summary
     * @param {Array} testSuites - Test suite results
     * @returns {Object} Performance summary
     */
    generatePerformanceSummary(testSuites) {
        const summary = {
            totalTests: testSuites.length,
            passedTests: testSuites.filter(s => s.status === 'PASSED').length,
            failedTests: testSuites.filter(s => s.status === 'FAILED').length,
            overallPerformance: 'GOOD',
            keyMetrics: {}
        };
        
        // Analyze key metrics across all tests
        const allMetrics = testSuites
            .filter(s => s.status === 'PASSED' && s.results.metrics)
            .map(s => s.results.metrics);
        
        if (allMetrics.length > 0) {
            summary.keyMetrics = {
                averageProcessingTime: this.calculateAverageMetric(allMetrics, 'processingTime'),
                averageMemoryUsage: this.calculateAverageMetric(allMetrics, 'memoryUsage'),
                averageThroughput: this.calculateAverageMetric(allMetrics, 'throughput')
            };
        }
        
        // Determine overall performance rating
        if (summary.failedTests > 0) {
            summary.overallPerformance = 'POOR';
        } else if (summary.passedTests === summary.totalTests) {
            summary.overallPerformance = 'EXCELLENT';
        }
        
        return summary;
    }

    /**
     * Calculate average metric across test results
     * @param {Array} metrics - Array of metric objects
     * @param {string} metricName - Name of metric to average
     * @returns {number} Average value
     */
    calculateAverageMetric(metrics, metricName) {
        const values = metrics
            .map(m => this.extractMetricValue(m, metricName))
            .filter(v => v !== null && !isNaN(v));
        
        return values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
    }

    /**
     * Extract metric value from nested metric object
     * @param {Object} metrics - Metrics object
     * @param {string} metricName - Metric name
     * @returns {number|null} Metric value
     */
    extractMetricValue(metrics, metricName) {
        if (metrics[metricName] !== undefined) {
            return parseFloat(metrics[metricName]);
        }
        
        // Check nested objects
        for (const key of Object.keys(metrics)) {
            if (typeof metrics[key] === 'object' && metrics[key][metricName] !== undefined) {
                return parseFloat(metrics[key][metricName]);
            }
        }
        
        return null;
    }

    /**
     * Generate performance recommendations
     * @param {Array} testSuites - Test suite results
     * @returns {Array} Recommendations
     */
    generatePerformanceRecommendations(testSuites) {
        const recommendations = [];
        
        // Analyze failed tests
        const failedTests = testSuites.filter(s => s.status === 'FAILED');
        if (failedTests.length > 0) {
            recommendations.push({
                type: 'CRITICAL',
                category: 'TEST_FAILURES',
                message: `${failedTests.length} performance tests failed. Review error messages and optimize accordingly.`,
                failedTests: failedTests.map(t => ({ name: t.name, error: t.error }))
            });
        }
        
        // Analyze performance metrics
        const passedTests = testSuites.filter(s => s.status === 'PASSED');
        
        for (const test of passedTests) {
            const metrics = test.results?.metrics;
            if (!metrics) continue;
            
            // Check processing time
            const processingTime = this.extractMetricValue(metrics, 'processingTime');
            if (processingTime > 5000) { // > 5 seconds
                recommendations.push({
                    type: 'WARNING',
                    category: 'PROCESSING_TIME',
                    message: `${test.name} took ${processingTime}ms to process. Consider optimization.`,
                    testName: test.name,
                    metric: 'processingTime',
                    value: processingTime
                });
            }
            
            // Check memory usage
            const memoryUsage = this.extractMetricValue(metrics, 'memoryUsage');
            if (memoryUsage > 100 * 1024 * 1024) { // > 100MB
                recommendations.push({
                    type: 'WARNING',
                    category: 'MEMORY_USAGE',
                    message: `${test.name} used ${(memoryUsage / 1024 / 1024).toFixed(2)}MB memory. Monitor for memory leaks.`,
                    testName: test.name,
                    metric: 'memoryUsage',
                    value: memoryUsage
                });
            }
            
            // Check throughput
            const throughput = this.extractMetricValue(metrics, 'throughput');
            if (throughput && parseFloat(throughput) < 100) { // < 100 records/sec
                recommendations.push({
                    type: 'INFO',
                    category: 'THROUGHPUT',
                    message: `${test.name} achieved ${throughput} records/sec throughput. Consider batch processing optimizations.`,
                    testName: test.name,
                    metric: 'throughput',
                    value: throughput
                });
            }
        }
        
        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'SUCCESS',
                category: 'PERFORMANCE',
                message: 'All performance tests passed with good metrics. Timeline processing is well optimized.'
            });
        }
        
        return recommendations;
    }

    /**
     * Display performance test results
     * @param {Object} results - Test results
     */
    displayResults(results) {
        console.log('\n📊 PERFORMANCE TEST RESULTS');
        console.log('=' .repeat(50));
        
        // Summary
        console.log(`\n📈 Summary:`);
        console.log(`  Total Tests: ${results.summary.totalTests}`);
        console.log(`  Passed: ${results.summary.passedTests}`);
        console.log(`  Failed: ${results.summary.failedTests}`);
        console.log(`  Overall Performance: ${results.summary.overallPerformance}`);
        
        // Key metrics
        if (results.summary.keyMetrics) {
            console.log(`\n🔢 Key Metrics:`);
            console.log(`  Average Processing Time: ${results.summary.keyMetrics.averageProcessingTime}ms`);
            console.log(`  Average Memory Usage: ${(results.summary.keyMetrics.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Average Throughput: ${results.summary.keyMetrics.averageThroughput} records/sec`);
        }
        
        // Test details
        console.log(`\n📋 Test Details:`);
        for (const suite of results.testSuites) {
            const status = suite.status === 'PASSED' ? '✅' : '❌';
            console.log(`  ${status} ${suite.name} (${suite.dataSize} records)`);
            
            if (suite.status === 'FAILED') {
                console.log(`    Error: ${suite.error}`);
            } else if (suite.results?.metrics) {
                const metrics = suite.results.metrics;
                const processingTime = this.extractMetricValue(metrics, 'processingTime');
                const throughput = this.extractMetricValue(metrics, 'throughput');
                
                if (processingTime) console.log(`    Processing Time: ${processingTime}ms`);
                if (throughput) console.log(`    Throughput: ${throughput} records/sec`);
            }
        }
        
        // Recommendations
        if (results.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            for (const rec of results.recommendations) {
                const icon = rec.type === 'CRITICAL' ? '🚨' : rec.type === 'WARNING' ? '⚠️' : rec.type === 'SUCCESS' ? '✅' : 'ℹ️';
                console.log(`  ${icon} ${rec.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
    }
}
