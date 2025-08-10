/**
 * Coordinate Utilities Test Suite
 * Tests coordinate conversion and validation functions
 */

import { 
    e7ToDecimal, 
    decimalToE7, 
    isValidLatitude, 
    isValidLongitude, 
    isValidCoordinatePair,
    dmsToDecimal,
    decimalToDms,
    normalizeLongitude,
    calculateCenter
} from '../src/utils/coordinates.js';

/**
 * Test E7 coordinate conversion
 */
export function testE7Conversion() {
    console.log('=== E7 Conversion Test ===\n');
    
    const testCases = [
        { e7: 782211833, decimal: 78.2211833 },
        { e7: 156397250, decimal: 15.6397250 },
        { e7: -782211833, decimal: -78.2211833 },
        { e7: 0, decimal: 0 }
    ];
    
    let passed = 0;
    let total = testCases.length * 2; // Test both directions
    
    for (const testCase of testCases) {
        // Test E7 to decimal
        const decimal = e7ToDecimal(testCase.e7);
        const decimalMatch = Math.abs(decimal - testCase.decimal) < 0.0000001;
        
        if (decimalMatch) {
            console.log(`✅ E7 to decimal: ${testCase.e7} -> ${decimal}`);
            passed++;
        } else {
            console.log(`❌ E7 to decimal: ${testCase.e7} -> ${decimal} (expected ${testCase.decimal})`);
        }
        
        // Test decimal to E7
        const e7 = decimalToE7(testCase.decimal);
        const e7Match = e7 === testCase.e7;
        
        if (e7Match) {
            console.log(`✅ Decimal to E7: ${testCase.decimal} -> ${e7}`);
            passed++;
        } else {
            console.log(`❌ Decimal to E7: ${testCase.decimal} -> ${e7} (expected ${testCase.e7})`);
        }
    }
    
    console.log(`\nE7 Conversion: ${passed}/${total} tests passed`);
    return { success: passed === total, passed, total };
}

/**
 * Test coordinate validation
 */
export function testCoordinateValidation() {
    console.log('\n=== Coordinate Validation Test ===\n');
    
    const latitudeTests = [
        { value: 0, valid: true },
        { value: 90, valid: true },
        { value: -90, valid: true },
        { value: 78.2211833, valid: true },
        { value: 91, valid: false },
        { value: -91, valid: false },
        { value: 'invalid', valid: false }
    ];
    
    const longitudeTests = [
        { value: 0, valid: true },
        { value: 180, valid: true },
        { value: -180, valid: true },
        { value: 15.6397250, valid: true },
        { value: 181, valid: false },
        { value: -181, valid: false },
        { value: 'invalid', valid: false }
    ];
    
    let passed = 0;
    let total = latitudeTests.length + longitudeTests.length;
    
    // Test latitude validation
    for (const test of latitudeTests) {
        const result = isValidLatitude(test.value);
        if (result === test.valid) {
            console.log(`✅ Latitude validation: ${test.value} -> ${result}`);
            passed++;
        } else {
            console.log(`❌ Latitude validation: ${test.value} -> ${result} (expected ${test.valid})`);
        }
    }
    
    // Test longitude validation
    for (const test of longitudeTests) {
        const result = isValidLongitude(test.value);
        if (result === test.valid) {
            console.log(`✅ Longitude validation: ${test.value} -> ${result}`);
            passed++;
        } else {
            console.log(`❌ Longitude validation: ${test.value} -> ${result} (expected ${test.valid})`);
        }
    }
    
    // Test coordinate pair validation
    const pairTests = [
        { lat: 78.2211833, lng: 15.6397250, valid: true },
        { lat: 0, lng: 0, valid: true },
        { lat: 91, lng: 15, valid: false },
        { lat: 78, lng: 181, valid: false }
    ];
    
    total += pairTests.length;
    
    for (const test of pairTests) {
        const result = isValidCoordinatePair(test.lat, test.lng);
        if (result === test.valid) {
            console.log(`✅ Coordinate pair validation: (${test.lat}, ${test.lng}) -> ${result}`);
            passed++;
        } else {
            console.log(`❌ Coordinate pair validation: (${test.lat}, ${test.lng}) -> ${result} (expected ${test.valid})`);
        }
    }
    
    console.log(`\nCoordinate Validation: ${passed}/${total} tests passed`);
    return { success: passed === total, passed, total };
}

/**
 * Test DMS conversion
 */
export function testDmsConversion() {
    console.log('\n=== DMS Conversion Test ===\n');
    
    const testCases = [
        { 
            dms: [78, 13, 16.26], 
            ref: 'N', 
            decimal: 78.22118333,
            description: 'Svalbard latitude'
        },
        { 
            dms: [15, 38, 23.01], 
            ref: 'E', 
            decimal: 15.639725,
            description: 'Svalbard longitude'
        },
        { 
            dms: [40, 45, 0], 
            ref: 'S', 
            decimal: -40.75,
            description: 'Southern latitude'
        },
        { 
            dms: [120, 30, 30], 
            ref: 'W', 
            decimal: -120.508333,
            description: 'Western longitude'
        }
    ];
    
    let passed = 0;
    let total = testCases.length * 2; // Test both directions
    
    for (const testCase of testCases) {
        // Test DMS to decimal
        const decimal = dmsToDecimal(testCase.dms, testCase.ref);
        const decimalMatch = Math.abs(decimal - testCase.decimal) < 0.000001;
        
        if (decimalMatch) {
            console.log(`✅ DMS to decimal (${testCase.description}): ${testCase.dms.join('°')}' ${testCase.ref} -> ${decimal}`);
            passed++;
        } else {
            console.log(`❌ DMS to decimal (${testCase.description}): ${testCase.dms.join('°')}' ${testCase.ref} -> ${decimal} (expected ${testCase.decimal})`);
        }
        
        // Test decimal to DMS
        const isLatitude = testCase.ref === 'N' || testCase.ref === 'S';
        const dmsResult = decimalToDms(testCase.decimal, isLatitude);
        
        const expectedRef = testCase.ref;
        const refMatch = dmsResult.ref === expectedRef;
        const degreesMatch = Math.abs(dmsResult.degrees - testCase.dms[0]) < 0.1;
        const minutesMatch = Math.abs(dmsResult.minutes - testCase.dms[1]) < 0.1;
        const secondsMatch = Math.abs(dmsResult.seconds - testCase.dms[2]) < 0.1;
        
        if (refMatch && degreesMatch && minutesMatch && secondsMatch) {
            console.log(`✅ Decimal to DMS (${testCase.description}): ${testCase.decimal} -> ${dmsResult.degrees}°${dmsResult.minutes}'${dmsResult.seconds.toFixed(2)}" ${dmsResult.ref}`);
            passed++;
        } else {
            console.log(`❌ Decimal to DMS (${testCase.description}): ${testCase.decimal} -> ${dmsResult.degrees}°${dmsResult.minutes}'${dmsResult.seconds.toFixed(2)}" ${dmsResult.ref}`);
        }
    }
    
    console.log(`\nDMS Conversion: ${passed}/${total} tests passed`);
    return { success: passed === total, passed, total };
}

/**
 * Test longitude normalization
 */
export function testLongitudeNormalization() {
    console.log('\n=== Longitude Normalization Test ===\n');
    
    const testCases = [
        { input: 0, expected: 0 },
        { input: 180, expected: 180 },
        { input: -180, expected: -180 },
        { input: 181, expected: -179 },
        { input: -181, expected: 179 },
        { input: 360, expected: 0 },
        { input: 450, expected: 90 },
        { input: -270, expected: 90 }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        const result = normalizeLongitude(testCase.input);
        if (result === testCase.expected) {
            console.log(`✅ Normalize longitude: ${testCase.input} -> ${result}`);
            passed++;
        } else {
            console.log(`❌ Normalize longitude: ${testCase.input} -> ${result} (expected ${testCase.expected})`);
        }
    }
    
    console.log(`\nLongitude Normalization: ${passed}/${total} tests passed`);
    return { success: passed === total, passed, total };
}

/**
 * Test center calculation
 */
export function testCenterCalculation() {
    console.log('\n=== Center Calculation Test ===\n');
    
    const testCases = [
        {
            coordinates: [
                { lat: 0, lng: 0 },
                { lat: 10, lng: 10 }
            ],
            expected: { lat: 5, lng: 5 },
            description: 'Simple two-point center'
        },
        {
            coordinates: [
                { lat: 78.2211833, lng: 15.6397250 },
                { lat: 78.2211833, lng: 15.6397250 },
                { lat: 78.2211833, lng: 15.6397250 }
            ],
            expected: { lat: 78.2211833, lng: 15.6397250 },
            description: 'Same point multiple times'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const result = calculateCenter(testCase.coordinates);
            const latMatch = Math.abs(result.lat - testCase.expected.lat) < 0.000001;
            const lngMatch = Math.abs(result.lng - testCase.expected.lng) < 0.000001;
            
            if (latMatch && lngMatch) {
                console.log(`✅ Center calculation (${testCase.description}): (${result.lat}, ${result.lng})`);
                passed++;
            } else {
                console.log(`❌ Center calculation (${testCase.description}): (${result.lat}, ${result.lng}) (expected (${testCase.expected.lat}, ${testCase.expected.lng}))`);
            }
        } catch (error) {
            console.log(`❌ Center calculation (${testCase.description}): Error - ${error.message}`);
        }
    }
    
    console.log(`\nCenter Calculation: ${passed}/${total} tests passed`);
    return { success: passed === total, passed, total };
}

/**
 * Run all coordinate utility tests
 */
export function runCoordinateTests() {
    console.log('🧪 Running Coordinate Utilities Test Suite...\n');
    
    const results = {
        e7Conversion: testE7Conversion(),
        coordinateValidation: testCoordinateValidation(),
        dmsConversion: testDmsConversion(),
        longitudeNormalization: testLongitudeNormalization(),
        centerCalculation: testCenterCalculation()
    };
    
    const totalTests = Object.values(results).reduce((sum, r) => sum + r.total, 0);
    const passedTests = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
    
    console.log(`\n📊 Coordinate Utilities Test Results: ${passedTests}/${totalTests} passed`);
    
    return {
        totalTests,
        passedTests,
        results,
        success: passedTests === totalTests
    };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const results = runCoordinateTests();
    process.exit(results.success ? 0 : 1);
}
