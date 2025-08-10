# Timeline Geolocation Test Suite

A comprehensive test suite for the GPS extraction and timeline augmentation functionality.

## Overview

This test suite validates the core functionality of the timeline geolocation system, including:

- **GPS Extraction**: Reading GPS coordinates from EXIF data in images
- **GPS Writing**: Writing GPS coordinates to image EXIF data
- **Coordinate Utilities**: Converting between different coordinate formats
- **Timeline Augmentation**: Adding GPS data to timeline records

## Test Structure

```
tests/
├── README.md                 # This file
├── test-runner.js            # Main test orchestrator
├── gps-extraction.test.js    # GPS reading tests
├── gps-writing.test.js       # GPS writing tests
└── coordinates.test.js       # Coordinate utility tests
```

## Running Tests

### Run All Tests
```bash
# From project root
node tests/test-runner.js

# Or using npm script
npm test
```

### Run Specific Test Suite
```bash
# Coordinate utilities only
node tests/test-runner.js coordinates

# GPS extraction only
node tests/test-runner.js gps-extraction

# GPS writing only
node tests/test-runner.js gps-writing
```

### Run Individual Test Files
```bash
# Run GPS extraction tests directly
node tests/gps-extraction.test.js

# Run GPS writing tests directly
node tests/gps-writing.test.js

# Run coordinate tests directly
node tests/coordinates.test.js
```

## Test Categories

### 1. GPS Extraction Tests (`gps-extraction.test.js`)

Tests the ability to extract GPS coordinates from image EXIF data:

- **GPS Extraction Test**: Validates extraction from known GPS-enabled image
- **No GPS Image Test**: Confirms proper handling of images without GPS data
- **Coordinate Accuracy**: Verifies extracted coordinates match expected values
- **Fallback System**: Tests exiftool fallback when custom parsing fails

**Expected Results:**
- Extracts coordinates: `78.22118333, 15.639725` from test image
- Matches expected DMS: `78°13'16.26"N, 15°38'23.01"E`
- Correctly identifies images without GPS data

### 2. GPS Writing Tests (`gps-writing.test.js`)

Tests the ability to write GPS coordinates to image EXIF data:

- **GPS Writing Test**: Validates writing and reading back coordinates
- **Invalid GPS Test**: Confirms rejection of invalid coordinates
- **Format Verification**: Ensures coordinates are written in proper DMS format
- **Round-trip Accuracy**: Verifies written coordinates can be read back accurately

**Expected Results:**
- Writes coordinates in standard EXIF DMS format
- Round-trip accuracy within 0.00001 degrees
- Properly rejects invalid coordinates (lat > 90, lng > 180)

### 3. Coordinate Utilities Tests (`coordinates.test.js`)

Tests coordinate conversion and validation functions:

- **E7 Conversion**: Google Maps E7 format ↔ decimal degrees
- **Coordinate Validation**: Latitude/longitude range validation
- **DMS Conversion**: Degrees/Minutes/Seconds ↔ decimal degrees
- **Longitude Normalization**: Wrapping longitude to -180/+180 range
- **Center Calculation**: Computing center point of coordinate arrays

**Expected Results:**
- Accurate conversion between all coordinate formats
- Proper validation of coordinate ranges
- Correct DMS ↔ decimal conversion with hemisphere handling

## Test Data

The test suite uses real image files from the user's photo collection:

- **GPS-enabled image**: `~/pics/svalbard/pics/0T4A2011.JPG`
  - Contains GPS coordinates: 78°13'16.26"N, 15°38'23.01"E
  - Used for GPS extraction and writing tests

- **Non-GPS image**: `~/pics/Glenna Wedding/0T4A1973.JPG`
  - Used to test handling of images without GPS data

## Test Output

### Success Example
```
🧪 Running GPS Extraction Test Suite...

=== GPS Extraction Test ===

Testing GPS extraction from: /Users/user/pics/svalbard/pics/0T4A2011.JPG
Expected coordinates: 78°13'16.26"N, 15°38'23.01"E

✅ GPS extraction successful!
Extracted coordinates: 78.22118333333333, 15.639725
Altitude: 42.81 meters

Expected: 78.22118333, 15.639725
Difference: lat=0.000000, lon=0.000000
✅ Coordinates match expected values!

📊 GPS Extraction Test Results: 2/2 passed
```

### Test Report

The test runner generates a detailed JSON report (`test-results.json`) containing:

- Test execution timestamps
- Individual test results and timings
- System environment information
- Memory usage statistics
- Overall success/failure status

## Troubleshooting

### Common Issues

1. **Image files not found**: Ensure test images exist in expected locations
2. **exiftool not available**: Some tests require exiftool for verification
3. **Permission errors**: Ensure write permissions for temporary test files

### Debug Mode

For detailed debugging output, the GPS extraction tests include comprehensive logging:

```bash
# GPS extraction includes detailed EXIF parsing logs
node tests/gps-extraction.test.js
```

This will show:
- EXIF marker detection
- GPS IFD parsing details
- GPS tag extraction process
- Coordinate conversion steps

## Integration

The test suite is designed to integrate with CI/CD pipelines:

- **Exit codes**: 0 for success, 1 for failure
- **JSON reports**: Machine-readable test results
- **Modular design**: Individual test suites can be run independently

## Extending Tests

To add new tests:

1. Create new test functions in existing files
2. Add them to the respective `run*Tests()` function
3. Or create new test files following the existing pattern
4. Update the test runner to include new test suites

Example test function:
```javascript
export async function testNewFeature() {
    console.log('=== New Feature Test ===\n');
    
    try {
        // Test implementation
        const result = await someFunction();
        
        if (result.isValid) {
            console.log('✅ New feature test passed');
            return { success: true, result };
        } else {
            console.log('❌ New feature test failed');
            return { success: false, error: 'Validation failed' };
        }
    } catch (error) {
        console.error('❌ New feature test error:', error.message);
        return { success: false, error: error.message };
    }
}
