/**
 * Performance Benchmarking Tools
 * Comprehensive benchmarking and performance analysis for timeline processing
 */

import { createTimelineLogger, LOG_LEVELS } from './debugLogger.js';
import { TimelinePerformanceMonitor } from './timelineMonitors.js';

/**
 * Benchmark test types
 */
export const BENCHMARK_TYPES = {
    TIMELINE_PARSING: 'TIMELINE_PARSING',
    DUPLICATE_DETECTION: 'DUPLICATE_DETECTION',
    TIMESTAMP_CONSOLIDATION: 'TIMESTAMP_CONSOLIDATION',
    PLACEHOLDER_PROCESSING: 'PLACEHOLDER_PROCESSING',
    MEMORY_USAGE: 'MEMORY_USAGE',
    THROUGHPUT: 'THROUGHPUT',
    LATENCY: 'LATENCY',
    CONCURRENT_PROCESSING: 'CONCURRENT_PROCESSING'
};

/**
 * Performance benchmark categories
 */
export const BENCHMARK_CATEGORIES = {
    MICRO: 'MICRO',           // Small operations (< 1ms)
    SMALL: 'SMALL',           // Small datasets (< 100 records)
    MEDIUM: 'MEDIUM',         // Medium datasets (100-1000 records)
    LARGE: 'LARGE',           // Large datasets (1000-10000 records)
    XLARGE: 'XLARGE',         // Extra large datasets (> 10000 records)
    STRESS: 'STRESS'          // Stress testing with extreme loads
};

/**
 * Performance Benchmark Suite
 */
export class PerformanceBenchmark {
    constructor(options = {}) {
        this.logger = createTimelineLogger({ 
            prefix: 'BENCHMARK',
            level: options.logLevel || LOG_LEVELS.INFO
        });
        
        this.config = {
            warmupRuns: options.warmupRuns || 3,
            benchmarkRuns: options.benchmarkRuns || 10,
            enableMemoryTracking: options.enableMemoryTracking !== false,
            enableGarbageCollection: options.enableGarbageCollection !== false,
            timeoutMs: options.timeoutMs || 30000,
            enableDetailedMetrics: options.enableDetailedMetrics !== false
        };
        
        this.performanceMonitor = new TimelinePerformanceMonitor({
            memorySnapshotInterval: 100,
            trackGarbageCollection: this.config.enableGarbageCollection
        });
        
        this.benchmarkResults = new Map();
        this.testData = new Map();
        
        this.logger.info('Performance Benchmark Suite initialized');
    }

    /**
     * Run comprehensive benchmark suite
     * @param {Object} testSuite - Test suite configuration
     * @returns {Object} Benchmark results
     */
    async runBenchmarkSuite(testSuite = {}) {
        this.logger.info('Starting comprehensive benchmark suite');
        const suiteStartTime = performance.now();
        
        try {
            // Initialize test data
            await this.initializeTestData();
            
            // Run individual benchmarks
            const results = {};
            
            if (testSuite.timelineParsing !== false) {
                results.timelineParsing = await this.benchmarkTimelineParsing();
            }
            
            if (testSuite.duplicateDetection !== false) {
                results.duplicateDetection = await this.benchmarkDuplicateDetection();
            }
            
            if (testSuite.timestampConsolidation !== false) {
                results.timestampConsolidation = await this.benchmarkTimestampConsolidation();
            }
            
            if (testSuite.placeholderProcessing !== false) {
                results.placeholderProcessing = await this.benchmarkPlaceholderProcessing();
            }
            
            if (testSuite.memoryUsage !== false) {
                results.memoryUsage = await this.benchmarkMemoryUsage();
            }
            
            if (testSuite.throughput !== false) {
                results.throughput = await this.benchmarkThroughput();
            }
            
            if (testSuite.concurrentProcessing !== false) {
                results.concurrentProcessing = await this.benchmarkConcurrentProcessing();
            }
            
            const suiteDuration = performance.now() - suiteStartTime;
            
            const suiteResults = {
                summary: {
                    totalDuration: suiteDuration,
                    testsRun: Object.keys(results).length,
                    timestamp: new Date().toISOString(),
                    environment: this.getEnvironmentInfo()
                },
                results,
                recommendations: this.generatePerformanceRecommendations(results)
            };
            
            this.logger.info(`Benchmark suite completed in ${suiteDuration.toFixed(2)}ms`);
            return suiteResults;
            
        } catch (error) {
            this.logger.error(`Benchmark suite failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize test data for benchmarks
     */
    async initializeTestData() {
        this.logger.debug('Initializing test data');
        
        // Generate test timeline data
        this.testData.set('timeline_small', this.generateTimelineData(100));
        this.testData.set('timeline_medium', this.generateTimelineData(1000));
        this.testData.set('timeline_large', this.generateTimelineData(5000));
        this.testData.set('timeline_xlarge', this.generateTimelineData(20000));
        
        // Generate test image data
        this.testData.set('images_small', this.generateImageData(50));
        this.testData.set('images_medium', this.generateImageData(500));
        this.testData.set('images_large', this.generateImageData(2000));
        
        // Generate duplicate-heavy data
        this.testData.set('duplicates_heavy', this.generateDuplicateHeavyData(1000, 0.5));
        this.testData.set('duplicates_light', this.generateDuplicateHeavyData(1000, 0.1));
        
        this.logger.debug('Test data initialization complete');
    }

    /**
     * Generate timeline test data
     * @param {number} recordCount - Number of records to generate
     * @returns {Array} Generated timeline data
     */
    generateTimelineData(recordCount) {
        const records = [];
        const startTime = new Date('2024-01-01T00:00:00Z');
        
        for (let i = 0; i < recordCount; i++) {
            const timestamp = new Date(startTime.getTime() + i * 60000); // 1 minute intervals
            records.push({
                timestamp,
                latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                accuracy: Math.random() * 100,
                source: 'test_data',
                deviceId: 'benchmark_device'
            });
        }
        
        return records;
    }

    /**
     * Generate image test data
     * @param {number} imageCount - Number of images to generate
     * @returns {Array} Generated image data
     */
    generateImageData(imageCount) {
        const images = [];
        const startTime = new Date('2024-01-01T00:00:00Z');
        
        for (let i = 0; i < imageCount; i++) {
            const timestamp = new Date(startTime.getTime() + i * 30000); // 30 second intervals
            images.push({
                filePath: `/test/image_${i}.jpg`,
                fileName: `image_${i}.jpg`,
                timestamp,
                hasGps: Math.random() > 0.3, // 70% have GPS
                source: 'image_timestamp'
            });
        }
        
        return images;
    }

    /**
     * Generate duplicate-heavy test data
     * @param {number} recordCount - Total number of records
     * @param {number} duplicateRatio - Ratio of duplicates (0-1)
     * @returns {Array} Generated data with duplicates
     */
    generateDuplicateHeavyData(recordCount, duplicateRatio) {
        const uniqueCount = Math.floor(recordCount * (1 - duplicateRatio));
        const duplicateCount = recordCount - uniqueCount;
        
        const records = [];
        const baseTimestamp = new Date('2024-01-01T00:00:00Z');
        
        // Generate unique records
        for (let i = 0; i < uniqueCount; i++) {
            const timestamp = new Date(baseTimestamp.getTime() + i * 60000);
            records.push({
                timestamp,
                filePath: `/test/unique_${i}.jpg`,
                fileName: `unique_${i}.jpg`,
                source: 'image_timestamp'
            });
        }
        
        // Generate duplicates by copying existing records
        for (let i = 0; i < duplicateCount; i++) {
            const originalIndex = Math.floor(Math.random() * uniqueCount);
            const original = records[originalIndex];
            records.push({
                ...original,
                filePath: `/test/duplicate_${i}.jpg`,
                fileName: `duplicate_${i}.jpg`
            });
        }
        
        return records;
    }

    /**
     * Benchmark timeline parsing performance
     * @returns {Object} Benchmark results
     */
    async benchmarkTimelineParsing() {
        this.logger.info('Running timeline parsing benchmarks');
        
        const results = {};
        const testSizes = ['small', 'medium', 'large', 'xlarge'];
        
        for (const size of testSizes) {
            const testData = this.testData.get(`timeline_${size}`);
            if (!testData) continue;
            
            this.logger.debug(`Benchmarking timeline parsing - ${size} dataset (${testData.length} records)`);
            
            const benchmark = await this.runBenchmark(
                `timeline_parsing_${size}`,
                () => this.simulateTimelineParsing(testData),
                {
                    category: BENCHMARK_CATEGORIES[size.toUpperCase()],
                    dataSize: testData.length
                }
            );
            
            results[size] = benchmark;
        }
        
        return results;
    }

    /**
     * Benchmark duplicate detection performance
     * @returns {Object} Benchmark results
     */
    async benchmarkDuplicateDetection() {
        this.logger.info('Running duplicate detection benchmarks');
        
        const results = {};
        const testTypes = ['light', 'heavy'];
        
        for (const type of testTypes) {
            const testData = this.testData.get(`duplicates_${type}`);
            if (!testData) continue;
            
            this.logger.debug(`Benchmarking duplicate detection - ${type} duplicates (${testData.length} records)`);
            
            const benchmark = await this.runBenchmark(
                `duplicate_detection_${type}`,
                () => this.simulateDuplicateDetection(testData),
                {
                    category: BENCHMARK_CATEGORIES.MEDIUM,
                    dataSize: testData.length,
                    duplicateType: type
                }
            );
            
            results[type] = benchmark;
        }
        
        return results;
    }

    /**
     * Benchmark timestamp consolidation performance
     * @returns {Object} Benchmark results
     */
    async benchmarkTimestampConsolidation() {
        this.logger.info('Running timestamp consolidation benchmarks');
        
        const results = {};
        const testSizes = ['small', 'medium', 'large'];
        
        for (const size of testSizes) {
            const testData = this.testData.get(`images_${size}`);
            if (!testData) continue;
            
            this.logger.debug(`Benchmarking timestamp consolidation - ${size} dataset (${testData.length} images)`);
            
            const benchmark = await this.runBenchmark(
                `timestamp_consolidation_${size}`,
                () => this.simulateTimestampConsolidation(testData),
                {
                    category: BENCHMARK_CATEGORIES[size.toUpperCase()],
                    dataSize: testData.length
                }
            );
            
            results[size] = benchmark;
        }
        
        return results;
    }

    /**
     * Benchmark placeholder processing performance
     * @returns {Object} Benchmark results
     */
    async benchmarkPlaceholderProcessing() {
        this.logger.info('Running placeholder processing benchmarks');
        
        const testData = this.testData.get('duplicates_heavy');
        
        const benchmark = await this.runBenchmark(
            'placeholder_processing',
            () => this.simulatePlaceholderProcessing(testData),
            {
                category: BENCHMARK_CATEGORIES.MEDIUM,
                dataSize: testData.length
            }
        );
        
        return { standard: benchmark };
    }

    /**
     * Benchmark memory usage patterns
     * @returns {Object} Benchmark results
     */
    async benchmarkMemoryUsage() {
        this.logger.info('Running memory usage benchmarks');
        
        const results = {};
        const testSizes = ['small', 'medium', 'large', 'xlarge'];
        
        for (const size of testSizes) {
            const testData = this.testData.get(`timeline_${size}`);
            if (!testData) continue;
            
            this.logger.debug(`Benchmarking memory usage - ${size} dataset`);
            
            const memoryBenchmark = await this.runMemoryBenchmark(
                `memory_usage_${size}`,
                () => this.simulateMemoryIntensiveOperation(testData),
                {
                    category: BENCHMARK_CATEGORIES[size.toUpperCase()],
                    dataSize: testData.length
                }
            );
            
            results[size] = memoryBenchmark;
        }
        
        return results;
    }

    /**
     * Benchmark throughput performance
     * @returns {Object} Benchmark results
     */
    async benchmarkThroughput() {
        this.logger.info('Running throughput benchmarks');
        
        const testData = this.testData.get('timeline_large');
        const batchSizes = [10, 50, 100, 500];
        const results = {};
        
        for (const batchSize of batchSizes) {
            this.logger.debug(`Benchmarking throughput - batch size ${batchSize}`);
            
            const benchmark = await this.runBenchmark(
                `throughput_batch_${batchSize}`,
                () => this.simulateBatchProcessing(testData, batchSize),
                {
                    category: BENCHMARK_CATEGORIES.LARGE,
                    batchSize,
                    dataSize: testData.length
                }
            );
            
            // Calculate throughput metrics
            benchmark.throughput = {
                recordsPerSecond: (testData.length / (benchmark.averageTime / 1000)).toFixed(2),
                batchesPerSecond: (Math.ceil(testData.length / batchSize) / (benchmark.averageTime / 1000)).toFixed(2)
            };
            
            results[`batch_${batchSize}`] = benchmark;
        }
        
        return results;
    }

    /**
     * Benchmark concurrent processing performance
     * @returns {Object} Benchmark results
     */
    async benchmarkConcurrentProcessing() {
        this.logger.info('Running concurrent processing benchmarks');
        
        const testData = this.testData.get('timeline_medium');
        const concurrencyLevels = [1, 2, 4, 8];
        const results = {};
        
        for (const concurrency of concurrencyLevels) {
            this.logger.debug(`Benchmarking concurrent processing - ${concurrency} workers`);
            
            const benchmark = await this.runBenchmark(
                `concurrent_${concurrency}`,
                () => this.simulateConcurrentProcessing(testData, concurrency),
                {
                    category: BENCHMARK_CATEGORIES.MEDIUM,
                    concurrency,
                    dataSize: testData.length
                }
            );
            
            results[`workers_${concurrency}`] = benchmark;
        }
        
        return results;
    }

    /**
     * Run a single benchmark test
     * @param {string} testName - Name of the test
     * @param {Function} testFunction - Function to benchmark
     * @param {Object} metadata - Test metadata
     * @returns {Object} Benchmark results
     */
    async runBenchmark(testName, testFunction, metadata = {}) {
        const results = {
            testName,
            metadata,
            runs: [],
            statistics: {}
        };
        
        // Warmup runs
        this.logger.trace(`Running ${this.config.warmupRuns} warmup runs for ${testName}`);
        for (let i = 0; i < this.config.warmupRuns; i++) {
            try {
                await testFunction();
            } catch (error) {
                this.logger.warn(`Warmup run ${i + 1} failed: ${error.message}`);
            }
        }
        
        // Force garbage collection if available
        if (this.config.enableGarbageCollection && global.gc) {
            global.gc();
        }
        
        // Benchmark runs
        this.logger.trace(`Running ${this.config.benchmarkRuns} benchmark runs for ${testName}`);
        for (let i = 0; i < this.config.benchmarkRuns; i++) {
            const runResult = await this.runSingleBenchmark(testFunction, i + 1);
            results.runs.push(runResult);
        }
        
        // Calculate statistics
        results.statistics = this.calculateBenchmarkStatistics(results.runs);
        
        // Store results
        this.benchmarkResults.set(testName, results);
        
        return results;
    }

    /**
     * Run a single benchmark iteration
     * @param {Function} testFunction - Function to benchmark
     * @param {number} runNumber - Run number
     * @returns {Object} Single run results
     */
    async runSingleBenchmark(testFunction, runNumber) {
        const startMemory = process.memoryUsage();
        const startTime = performance.now();
        
        let error = null;
        let result = null;
        
        try {
            result = await Promise.race([
                testFunction(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Benchmark timeout')), this.config.timeoutMs)
                )
            ]);
        } catch (err) {
            error = err.message;
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        
        return {
            runNumber,
            duration: endTime - startTime,
            memoryDelta: {
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                external: endMemory.external - startMemory.external
            },
            error,
            result,
            timestamp: new Date()
        };
    }

    /**
     * Run memory-specific benchmark
     * @param {string} testName - Name of the test
     * @param {Function} testFunction - Function to benchmark
     * @param {Object} metadata - Test metadata
     * @returns {Object} Memory benchmark results
     */
    async runMemoryBenchmark(testName, testFunction, metadata = {}) {
        this.performanceMonitor.startMonitoring('memory_benchmark');
        
        const benchmark = await this.runBenchmark(testName, testFunction, metadata);
        
        this.performanceMonitor.stopMonitoring();
        const performanceReport = this.performanceMonitor.generateReport();
        
        benchmark.memoryAnalysis = {
            peakMemory: performanceReport.memory?.peak || {},
            memoryGrowth: performanceReport.memory?.growth || {},
            averageMemory: performanceReport.memory?.average || {},
            recommendations: performanceReport.recommendations || []
        };
        
        return benchmark;
    }

    /**
     * Calculate benchmark statistics
     * @param {Array} runs - Array of benchmark runs
     * @returns {Object} Statistical analysis
     */
    calculateBenchmarkStatistics(runs) {
        const successfulRuns = runs.filter(run => !run.error);
        const durations = successfulRuns.map(run => run.duration);
        
        if (durations.length === 0) {
            return {
                successRate: 0,
                averageTime: 0,
                medianTime: 0,
                minTime: 0,
                maxTime: 0,
                standardDeviation: 0
            };
        }
        
        durations.sort((a, b) => a - b);
        
        const sum = durations.reduce((a, b) => a + b, 0);
        const average = sum / durations.length;
        const median = durations[Math.floor(durations.length / 2)];
        const min = durations[0];
        const max = durations[durations.length - 1];
        
        // Calculate standard deviation
        const variance = durations.reduce((acc, duration) => {
            return acc + Math.pow(duration - average, 2);
        }, 0) / durations.length;
        const standardDeviation = Math.sqrt(variance);
        
        return {
            successRate: (successfulRuns.length / runs.length * 100).toFixed(2),
            averageTime: average.toFixed(2),
            medianTime: median.toFixed(2),
            minTime: min.toFixed(2),
            maxTime: max.toFixed(2),
            standardDeviation: standardDeviation.toFixed(2),
            p95: durations[Math.floor(durations.length * 0.95)].toFixed(2),
            p99: durations[Math.floor(durations.length * 0.99)].toFixed(2)
        };
    }

    /**
     * Simulate timeline parsing operation
     * @param {Array} timelineData - Timeline data to parse
     * @returns {Array} Parsed results
     */
    simulateTimelineParsing(timelineData) {
        const results = [];
        
        for (const record of timelineData) {
            // Simulate parsing operations
            const parsed = {
                timestamp: new Date(record.timestamp),
                coordinates: {
                    lat: record.latitude,
                    lng: record.longitude
                },
                metadata: {
                    accuracy: record.accuracy,
                    source: record.source
                }
            };
            
            results.push(parsed);
        }
        
        return results;
    }

    /**
     * Simulate duplicate detection operation
     * @param {Array} data - Data to check for duplicates
     * @returns {Object} Duplicate detection results
     */
    simulateDuplicateDetection(data) {
        const seen = new Map();
        const duplicates = [];
        const unique = [];
        
        for (const item of data) {
            const key = `${item.timestamp.getTime()}_${item.filePath}`;
            
            if (seen.has(key)) {
                duplicates.push(item);
            } else {
                seen.set(key, true);
                unique.push(item);
            }
        }
        
        return {
            totalItems: data.length,
            uniqueItems: unique.length,
            duplicateItems: duplicates.length,
            duplicateRate: (duplicates.length / data.length * 100).toFixed(2)
        };
    }

    /**
     * Simulate timestamp consolidation operation
     * @param {Array} imageData - Image data to consolidate
     * @returns {Object} Consolidation results
     */
    simulateTimestampConsolidation(imageData) {
        const timestampMap = new Map();
        
        for (const image of imageData) {
            const timestampKey = image.timestamp.toISOString();
            
            if (!timestampMap.has(timestampKey)) {
                timestampMap.set(timestampKey, {
                    timestamp: image.timestamp,
                    images: []
                });
            }
            
            timestampMap.get(timestampKey).images.push(image);
        }
        
        const consolidatedRecords = Array.from(timestampMap.values());
        const duplicatesEliminated = imageData.length - consolidatedRecords.length;
        
        return {
            originalCount: imageData.length,
            consolidatedCount: consolidatedRecords.length,
            duplicatesEliminated,
            consolidationRatio: (duplicatesEliminated / imageData.length * 100).toFixed(2)
        };
    }

    /**
     * Simulate placeholder processing operation
     * @param {Array} data - Data to process as placeholders
     * @returns {Object} Processing results
     */
    simulatePlaceholderProcessing(data) {
        const placeholders = [];
        
        for (const item of data) {
            const placeholder = {
                timestamp: item.timestamp,
                latitude: null,
                longitude: null,
                isPlaceholder: true,
                source: 'timeline_extension_placeholder',
                originalItem: item
            };
            
            placeholders.push(placeholder);
        }
        
        return {
            processedCount: placeholders.length,
            placeholderCount: placeholders.length
        };
    }

    /**
     * Simulate memory-intensive operation
     * @param {Array} data - Data to process
     * @returns {Object} Processing results
     */
    simulateMemoryIntensiveOperation(data) {
        const largeArray = [];
        const processedData = [];
        
        // Create memory pressure
        for (let i = 0; i < data.length; i++) {
            largeArray.push(new Array(1000).fill(data[i]));
            processedData.push({
                ...data[i],
                processed: true,
                index: i
            });
        }
        
        return {
            processedCount: processedData.length,
            memoryArraySize: largeArray.length
        };
    }

    /**
     * Simulate batch processing operation
     * @param {Array} data - Data to process in batches
     * @param {number} batchSize - Size of each batch
     * @returns {Object} Batch processing results
     */
    simulateBatchProcessing(data, batchSize) {
        const batches = [];
        const results = [];
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            batches.push(batch);
            
            // Simulate batch processing
            const batchResult = batch.map(item => ({
                ...item,
                batchIndex: batches.length - 1,
                processed: true
            }));
            
            results.push(...batchResult);
        }
        
        return {
            totalBatches: batches.length,
            processedItems: results.length,
            averageBatchSize: (results.length / batches.length).toFixed(2)
        };
    }

    /**
     * Simulate concurrent processing operation
     * @param {Array} data - Data to process concurrently
     * @param {number} concurrency - Number of concurrent workers
     * @returns {Promise<Object>} Concurrent processing results
     */
    async simulateConcurrentProcessing(data, concurrency) {
        const chunkSize = Math.ceil(data.length / concurrency);
        const chunks = [];
        
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        
        const processingPromises = chunks.map(async (chunk, index) => {
            // Simulate async processing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            
            return chunk.map(item => ({
                ...item,
                workerId: index,
                processed: true
            }));
        });
        
        const results = await Promise.all(processingPromises);
        const flatResults = results.flat();
        
        return {
            workersUsed: chunks.length,
            processedItems: flatResults.length,
            averageChunkSize: (flatResults.length / chunks.length).toFixed(2)
        };
    }

    /**
     * Generate performance recommendations
     * @param {Object} benchmarkResults - All benchmark results
     * @returns {Array} Performance recommendations
     */
    generatePerformanceRecommendations(benchmarkResults) {
        const recommendations = [];
        
        // Analyze timeline parsing performance
        if (benchmarkResults.timelineParsing) {
            const largeDataset = benchmarkResults.timelineParsing.large;
            if (largeDataset && parseFloat(largeDataset.statistics.averageTime) > 1000) {
                recommendations.push({
                    type: 'TIMELINE_PARSING',
                    priority: 'HIGH',
                    message: 'Timeline parsing is slow for large datasets',
                    suggestion: 'Consider implementing streaming parsing or data chunking'
                });
            }
        }
        
        // Analyze memory usage
        if (benchmarkResults.memoryUsage) {
            const memoryResults = Object.values(benchmarkResults.memoryUsage);
            const highMemoryUsage = memoryResults.some(result => 
                result.memoryAnalysis?.peakMemory?.heapUsed > 500 * 1024 * 1024
            );
            
            if (highMemoryUsage) {
                recommendations.push({
                    type: 'MEMORY_USAGE',
                    priority: 'MEDIUM',
                    message: 'High memory usage detected during processing',
                    suggestion: 'Implement memory optimization and garbage collection strategies'
                });
            }
        }
        
        // Analyze throughput
        if (benchmarkResults.throughput) {
            const throughputResults = Object.values(benchmarkResults.throughput);
            const bestThroughput = Math.max(...throughputResults.map(r => 
                parseFloat(r.throughput?.recordsPerSecond || 0)
            ));
            
            if (bestThroughput < 100) {
                recommendations.push({
                    type: 'THROUGHPUT',
                    priority: 'MEDIUM',
                    message: 'Low throughput detected',
                    suggestion: 'Optimize batch processing and consider parallel processing'
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Get environment information
     * @returns {Object} Environment details
     */
    getEnvironmentInfo() {
        return {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cpuCount: require('os').cpus().length,
            totalMemory: require('os').totalmem(),
            freeMemory: require('os').freemem(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Export benchmark results
     * @returns {Object} Exportable benchmark data
     */
    exportResults() {
        return {
            benchmarkResults: Object.fromEntries(this.benchmarkResults),
            environment: this.getEnvironmentInfo(),
            config: this.config,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Clear benchmark results
     */
    clearResults() {
        this.benchmarkResults.clear();
        this.testData.clear();
        this.logger.info('Benchmark results cleared');
    }
}

/**
 * Create a performance benchmark instance
 * @param {Object} options - Benchmark options
 * @returns {PerformanceBenchmark} Benchmark instance
 */
export function createPerformanceBenchmark(options = {}) {
    return new PerformanceBenchmark(options);
}
