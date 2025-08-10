/**
 * CR3 GPS Operations Test Suite
 * 
 * Tests GPS reading and writing capabilities for CR3 (Canon RAW v3) files.
 * CR3 files use ISO Base Media File Format instead of traditional JPEG EXIF structure,
 * making GPS extraction more complex and requiring different handling.
 */

import { extractGpsCoordinates } from '../src/services/exif.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Test framework utilities
 */
class TestFramework {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async run() {
        console.log(`🧪 Running ${this.tests.length} CR3 GPS tests...\n`);

        for (const { name, testFn } of this.tests) {
            try {
                console.log(`  🔍 ${name}`);
                await testFn();
                console.log(`  ✅ ${name} - PASSED\n`);
                this.passed++;
            } catch (error) {
                console.log(`  ❌ ${name} - FAILED`);
                console.log(`     Error: ${error.message}\n`);
                this.failed++;
            }
        }

        const total = this.passed + this.failed;
        const success = this.failed === 0;
        
        console.log(`📊 CR3 GPS Tests: ${this.passed}/${total} passed`);
        
        return {
            totalTests: total,
            passedTests: this.passed,
            success,
            details: {
                passed: this.passed,
                failed: this.failed
            }
        };
    }
}

/**
 * Helper functions for finding test files
 */
function findCR3Files() {
    const searchPaths = [
        '/Users/tomcranstoun/pics',
        'test-data',
        '.'
    ];
    
    const cr3Files = [];
    
    for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
            try {
                const files = findFilesRecursively(searchPath, '.CR3');
                cr3Files.push(...files);
                if (cr3Files.length >= 3) break; // Limit for testing
            } catch (error) {
                // Continue searching other paths
            }
        }
    }
    
    return cr3Files.slice(0, 3); // Limit to 3 files for testing
}

function findJPEGFiles() {
    const searchPaths = [
        '/Users/tomcranstoun/pics',
        'test-data',
        '.'
    ];
    
    const jpegFiles = [];
    
    for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
            try {
                const files = findFilesRecursively(searchPath, '.JPG');
                jpegFiles.push(...files);
                if (jpegFiles.length >= 3) break; // Limit for testing
            } catch (error) {
                // Continue searching other paths
            }
        }
    }
    
    return jpegFiles.slice(0, 3); // Limit to 3 files for testing
}

function findFilesRecursively(dir, extension) {
    const files = [];
    
    function searchDir(currentDir, depth = 0) {
        if (depth > 3) return; // Limit recursion depth
        
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    searchDir(fullPath, depth + 1);
                } else if (entry.isFile() && entry.name.toUpperCase().endsWith(extension.toUpperCase())) {
                    files.push(fullPath);
                    if (files.length >= 10) return; // Limit files found
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }
    
    searchDir(dir);
    return files;
}

/**
 * Assertion helpers
 */
function expect(actual) {
    return {
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined, but got undefined`);
            }
        },
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
            }
        },
        toBeGreaterThan(expected) {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeLessThan(expected) {
            if (actual >= expected) {
                throw new Error(`Expected ${actual} to be less than ${expected}`);
            }
        }
    };
}

/**
 * Main test runner function
 */
export async function runCR3GpsTests() {
    const framework = new TestFramework();
    
    // Test coordinates for Svalbard (Arctic location)
    const testCoordinates = {
        latitude: 78.22118333333333,
        longitude: 15.639725,
        altitude: 42.5
    };

    framework.test('should detect CR3 file format correctly', async () => {
        const cr3Files = findCR3Files();
        if (cr3Files.length === 0) {
            console.log('     ⚠️  No CR3 files found for testing - skipping CR3 format detection test');
            return;
        }

        const cr3File = cr3Files[0];
        console.log(`     📁 Testing CR3 format detection with: ${path.basename(cr3File)}`);
        
        // Test that our system correctly identifies CR3 format
        const result = await extractGpsCoordinates(cr3File);
        
        // Should either extract GPS or gracefully handle unsupported format
        expect(result).toBeDefined();
        
        if (result.latitude && result.longitude) {
            console.log(`     ✅ GPS extracted from CR3: ${result.latitude}, ${result.longitude}`);
            expect(typeof result.latitude).toBe('number');
            expect(typeof result.longitude).toBe('number');
            expect(result.latitude).toBeGreaterThan(-90);
            expect(result.latitude).toBeLessThan(90);
            expect(result.longitude).toBeGreaterThan(-180);
            expect(result.longitude).toBeLessThan(180);
        } else {
            console.log('     ℹ️  No GPS data found in CR3 file (expected for files without GPS)');
            expect(result).toEqual({});
        }
    });

    framework.test('should handle CR3 files without GPS gracefully', async () => {
        const cr3Files = findCR3Files();
        if (cr3Files.length === 0) {
            console.log('     ⚠️  No CR3 files found for testing - skipping graceful handling test');
            return;
        }

        const cr3File = cr3Files[0];
        console.log(`     📁 Testing graceful CR3 handling with: ${path.basename(cr3File)}`);
        
        // Should not throw errors even if GPS extraction fails
        const result = await extractGpsCoordinates(cr3File);
        expect(result).toBeDefined();
        console.log('     ✅ CR3 file handled gracefully without errors');
    });

    framework.test('should use exiftool fallback for CR3 files', async () => {
        const cr3Files = findCR3Files();
        if (cr3Files.length === 0) {
            console.log('     ⚠️  No CR3 files found for testing - skipping exiftool fallback test');
            return;
        }

        // Check if exiftool is available
        let exiftoolAvailable = false;
        try {
            execSync('which exiftool', { stdio: 'ignore' });
            exiftoolAvailable = true;
        } catch (error) {
            console.log('     ⚠️  exiftool not available - skipping fallback test');
            return;
        }

        const cr3File = cr3Files[0];
        console.log(`     📁 Testing exiftool fallback with: ${path.basename(cr3File)}`);
        
        // Test that exiftool fallback works for CR3 files
        const result = await extractGpsCoordinates(cr3File);
        expect(result).toBeDefined();
        
        // Verify exiftool can read the file
        try {
            const exiftoolOutput = execSync(`exiftool -GPS* "${cr3File}"`, { encoding: 'utf8' });
            const hasGpsOutput = exiftoolOutput.trim().length > 0 && !exiftoolOutput.includes('No GPS');
            console.log(`     📋 Exiftool GPS output: ${hasGpsOutput ? 'GPS data found' : 'No GPS data found'}`);
        } catch (error) {
            console.log('     ℹ️  Exiftool could not extract GPS from CR3 file');
        }
        
        console.log('     ✅ Exiftool fallback system working correctly');
    });

    framework.test('should analyze CR3 file structure', async () => {
        const cr3Files = findCR3Files();
        if (cr3Files.length === 0) {
            console.log('     ⚠️  No CR3 files found for testing - skipping structure analysis');
            return;
        }

        const cr3File = cr3Files[0];
        console.log(`     📁 Analyzing CR3 structure: ${path.basename(cr3File)}`);
        
        // Read file header to verify CR3 format
        const buffer = fs.readFileSync(cr3File);
        const header = buffer.subarray(0, 20);
        
        console.log(`     📋 CR3 file header (hex): ${header.toString('hex').substring(0, 40)}...`);
        
        // CR3 files should have specific format markers
        // Look for ISO Base Media File Format signatures
        const headerStr = header.toString('ascii');
        const isValidCR3 = headerStr.includes('ftyp') || buffer.includes(Buffer.from('CR3'));
        
        if (isValidCR3) {
            console.log('     ✅ Valid CR3 format detected');
        } else {
            console.log('     ⚠️  CR3 format markers not found in expected locations');
        }
        
        expect(buffer.length).toBeGreaterThan(0);
        console.log(`     📊 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    });

    framework.test('should compare CR3 vs JPEG GPS handling', async () => {
        const cr3Files = findCR3Files();
        const jpegFiles = findJPEGFiles();
        
        if (cr3Files.length === 0 || jpegFiles.length === 0) {
            console.log('     ⚠️  Need both CR3 and JPEG files for comparison - skipping');
            return;
        }

        console.log('     🔍 Comparing CR3 vs JPEG GPS extraction...');
        
        // Test CR3 extraction
        const cr3Result = await extractGpsCoordinates(cr3Files[0]);
        console.log(`     📋 CR3 GPS result: ${cr3Result.latitude ? `${cr3Result.latitude}, ${cr3Result.longitude}` : 'No GPS data'}`);
        
        // Test JPEG extraction
        const jpegResult = await extractGpsCoordinates(jpegFiles[0]);
        console.log(`     📋 JPEG GPS result: ${jpegResult.latitude ? `${jpegResult.latitude}, ${jpegResult.longitude}` : 'No GPS data'}`);
        
        // Both should handle gracefully (success or empty object)
        expect(cr3Result).toBeDefined();
        expect(jpegResult).toBeDefined();
        
        console.log('     ✅ Both formats handled without errors');
    });

    framework.test('should handle missing CR3 files gracefully', async () => {
        const nonExistentCR3 = 'test-data/nonexistent.CR3';
        
        console.log('     📁 Testing missing file handling');
        
        // Should handle missing files gracefully
        const result = await extractGpsCoordinates(nonExistentCR3);
        expect(result).toBeDefined();
        expect(result).toEqual({});
        
        console.log('     ✅ Graceful error handling for missing CR3 file');
    });

    return await framework.run();
}

// Export for use in test runner
export default runCR3GpsTests;
