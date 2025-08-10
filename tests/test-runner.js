/**
 * Main Test Runner
 * Orchestrates all test suites and provides comprehensive reporting
 */

import { runGpsExtractionTests } from './gps-extraction.test.js';
import { runGpsWritingTests } from './gps-writing.test.js';
import { runCoordinateTests } from './coordinates.test.js';
import { runCR3GpsTests } from './cr3-gps.test.js';

/**
 * Format test duration
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print test suite header
 */
function printHeader(title) {
    const border = '='.repeat(60);
    console.log(`\n${border}`);
    console.log(`🧪 ${title}`);
    console.log(border);
}

/**
 * Print test results summary
 */
function printSummary(results) {
    const border = '='.repeat(60);
    console.log(`\n${border}`);
    console.log('📊 TEST SUITE SUMMARY');
    console.log(border);
    
    let totalTests = 0;
    let totalPassed = 0;
    let allPassed = true;
    
    for (const [suiteName, result] of Object.entries(results)) {
        const status = result.success ? '✅' : '❌';
        const percentage = result.totalTests > 0 ? ((result.passedTests / result.totalTests) * 100).toFixed(1) : '0.0';
        
        console.log(`${status} ${suiteName}: ${result.passedTests}/${result.totalTests} (${percentage}%)`);
        
        totalTests += result.totalTests;
        totalPassed += result.passedTests;
        
        if (!result.success) {
            allPassed = false;
        }
    }
    
    console.log(border);
    const overallPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
    const overallStatus = allPassed ? '✅' : '❌';
    
    console.log(`${overallStatus} OVERALL: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
    console.log(border);
    
    return {
        totalTests,
        totalPassed,
        success: allPassed,
        percentage: parseFloat(overallPercentage)
    };
}

/**
 * Run individual test suite with timing and error handling
 */
async function runTestSuite(name, testFunction) {
    const startTime = Date.now();
    
    try {
        console.log(`\n🚀 Starting ${name}...`);
        const result = await testFunction();
        const duration = Date.now() - startTime;
        
        const status = result.success ? '✅' : '❌';
        console.log(`\n${status} ${name} completed in ${formatDuration(duration)}`);
        
        return {
            ...result,
            duration,
            error: null
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`\n❌ ${name} failed with error:`, error.message);
        console.error(error.stack);
        
        return {
            totalTests: 0,
            passedTests: 0,
            success: false,
            duration,
            error: error.message
        };
    }
}

/**
 * Run all test suites
 */
async function runAllTests() {
    printHeader('TIMELINE GEOLOCATION TEST SUITE');
    
    const overallStartTime = Date.now();
    
    console.log('🔧 Running comprehensive test suite for GPS extraction and timeline augmentation...\n');
    
    // Run all test suites
    const results = {
        'Coordinate Utilities': await runTestSuite('Coordinate Utilities Tests', runCoordinateTests),
        'GPS Extraction': await runTestSuite('GPS Extraction Tests', runGpsExtractionTests),
        'GPS Writing': await runTestSuite('GPS Writing Tests', runGpsWritingTests),
        'CR3 GPS Operations': await runTestSuite('CR3 GPS Operations Tests', runCR3GpsTests)
    };
    
    const overallDuration = Date.now() - overallStartTime;
    
    // Print comprehensive summary
    const summary = printSummary(results);
    
    console.log(`⏱️  Total execution time: ${formatDuration(overallDuration)}`);
    console.log(`🧠 Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // Generate detailed report
    const report = {
        timestamp: new Date().toISOString(),
        duration: overallDuration,
        summary,
        results,
        environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage()
        }
    };
    
    // Save test report
    try {
        const fs = await import('fs');
        await fs.promises.writeFile(
            'test-results.json', 
            JSON.stringify(report, null, 2)
        );
        console.log('📄 Test report saved to test-results.json');
    } catch (error) {
        console.warn('⚠️  Could not save test report:', error.message);
    }
    
    if (summary.success) {
        console.log('\n🎉 All tests passed! The GPS extraction and timeline augmentation system is working correctly.');
    } else {
        console.log('\n💥 Some tests failed. Please review the results above.');
    }
    
    return summary;
}

/**
 * Run specific test suite
 */
async function runSpecificTest(suiteName) {
    const suites = {
        'coordinates': runCoordinateTests,
        'gps-extraction': runGpsExtractionTests,
        'gps-writing': runGpsWritingTests,
        'cr3-gps': runCR3GpsTests
    };
    
    const testFunction = suites[suiteName.toLowerCase()];
    
    if (!testFunction) {
        console.error(`❌ Unknown test suite: ${suiteName}`);
        console.log('Available test suites:', Object.keys(suites).join(', '));
        process.exit(1);
    }
    
    printHeader(`${suiteName.toUpperCase()} TEST SUITE`);
    
    const result = await runTestSuite(`${suiteName} Tests`, testFunction);
    
    console.log(`\n📊 Results: ${result.passedTests}/${result.totalTests} tests passed`);
    console.log(`⏱️  Duration: ${formatDuration(result.duration)}`);
    
    return result;
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Run specific test suite
        const suiteName = args[0];
        runSpecificTest(suiteName).then(result => {
            process.exit(result.success ? 0 : 1);
        });
    } else {
        // Run all tests
        runAllTests().then(summary => {
            process.exit(summary.success ? 0 : 1);
        });
    }
}

export { runAllTests, runSpecificTest };
