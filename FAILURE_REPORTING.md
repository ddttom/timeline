# Geolocation Failure Reporting

This document describes the comprehensive failure reporting system that tracks and reports files that could not be geotagged during processing.

## Overview

The failure reporting system provides detailed information about why specific files could not be assigned GPS coordinates, helping users understand processing limitations and potentially adjust their approach or data.

## Failure Categories

The system categorizes failures into the following types:

### 1. Missing Timestamp (`missingTimestamp`)

- **Description**: Image files that do not contain valid timestamp information in their EXIF data
- **Common Causes**:
  - Camera clock not set
  - EXIF data corruption
  - File format limitations
- **Resolution**: Ensure camera time is set correctly before taking photos

### 2. Invalid Timestamp (`invalidTimestamp`)

- **Description**: Image files with timestamp data that cannot be parsed or is in an invalid format
- **Common Causes**:
  - Corrupted EXIF data
  - Non-standard timestamp formats
  - Date/time values outside valid ranges
- **Resolution**: Check EXIF data integrity and format

### 3. Timeline Unavailable (`timelineUnavailable`)

- **Description**: No timeline data is available for primary interpolation
- **Common Causes**:
  - Timeline file missing or corrupted
  - Timeline file contains no valid position records
- **Resolution**: Ensure timeline data file exists and contains valid GPS records

### 4. Timeline Out of Range (`timelineOutOfRange`)

- **Description**: Image timestamp falls outside the time range covered by timeline data
- **Details Provided**:
  - Timeline start and end dates
  - How many days before/after timeline range
- **Resolution**: Expand timeline data coverage or adjust image timestamps

### 5. Timeline Too Far (`timelineTooFar`)

- **Description**: Closest timeline record exceeds the configured time tolerance
- **Details Provided**:
  - Distance to closest timeline record (in minutes)
  - Configured tolerance setting
- **Resolution**: Increase time tolerance or improve timeline data density

### 6. No Nearby Images (`noNearbyImages`)

- **Description**: No other images with GPS coordinates are available for secondary interpolation
- **Details Provided**:
  - Total count of images with GPS data
- **Resolution**: Ensure some images in the set have GPS coordinates

### 7. Nearby Images Too Far (`nearbyImagesTooFar`)

- **Description**: Available images with GPS coordinates are too far away spatially or temporally
- **Details Provided**:
  - Distance to closest image (meters)
  - Time difference to closest image (minutes)
  - Number of nearby images considered
  - Configured radius and time window settings
- **Resolution**: Adjust secondary interpolation tolerances or improve GPS coverage

### 8. Technical Error (`technicalError`)

- **Description**: Processing failed due to technical issues
- **Details Provided**:
  - Specific error message
  - Which interpolation methods were attempted
- **Resolution**: Check file integrity and system configuration

## Report Structure

### Console Output

The failure report appears as a new section in the main processing report:

```bash
❌ GEOLOCATION FAILURES
------------------------------
🚫 Total Failed Files: 5

📊 Failure Categories:
   📅 Timeline Out of Range: 2
   ⏰ Timeline Too Far: 1
   📸 No Nearby Images: 1
   🔧 Technical Errors: 1

🔍 Sample Detailed Failures:

   1. IMG_001.JPG
      Category: timelineOutOfRange
      Image Time: 8/5/2025, 6:34:13 PM
      Error: Image timestamp is 176 days after timeline end

   2. IMG_002.JPG
      Category: timelineTooFar
      Image Time: 8/15/2024, 2:15:30 PM
      Closest Timeline: 45.2 minutes away
```

### JSON Export

Detailed failure information is also included in the JSON statistics export:

```json
{
  "geolocationFailures": {
    "totalFailed": 5,
    "failuresByCategory": {
      "timelineOutOfRange": 2,
      "timelineTooFar": 1,
      "noNearbyImages": 1,
      "technicalError": 1
    },
    "detailedFailures": [
      {
        "filePath": "/path/to/IMG_001.JPG",
        "fileName": "IMG_001.JPG",
        "category": "timelineOutOfRange",
        "timestamp": "2025-08-11T07:36:14.000Z",
        "details": {
          "imageTimestamp": "2025-08-05T14:34:13.000Z",
          "timelineRange": {
            "start": "2024-08-21T08:01:39.000Z",
            "end": "2025-02-10T18:14:43.081Z"
          },
          "errorMessage": "Image timestamp is 176 days after timeline end",
          "primaryAttempted": true,
          "secondaryAttempted": false
        }
      }
    ]
  }
}
```

## Configuration Impact

Several configuration settings affect failure reporting:

- **`timelineTolerance`**: Primary interpolation time tolerance (default: 30 minutes)
- **`secondaryRadius`**: Secondary interpolation spatial radius (default: 2000 meters)
- **`secondaryTimeWindow`**: Secondary interpolation time window (default: 4 hours)

Adjusting these values can reduce failures but may impact interpolation accuracy.

## Troubleshooting Common Issues

### High Timeline Out of Range Failures

- **Solution**: Expand timeline data collection period
- **Alternative**: Filter images to match timeline coverage period

### High Timeline Too Far Failures

- **Solution**: Increase `timelineTolerance` setting
- **Alternative**: Improve timeline data density (more frequent position records)

### High Nearby Images Too Far Failures

- **Solution**: Increase `secondaryRadius` or `secondaryTimeWindow` settings
- **Alternative**: Ensure better GPS coverage in image sets

### Technical Errors

- **Solution**: Check file permissions and EXIF data integrity
- **Alternative**: Verify system dependencies (exiftool, etc.)

## Implementation Details

The failure reporting system:

1. **Tracks failures at multiple levels**: During timestamp validation, primary interpolation, and secondary interpolation
2. **Provides contextual information**: Includes relevant measurements and comparisons
3. **Categorizes systematically**: Uses consistent failure categories across the system
4. **Exports comprehensive data**: Both human-readable console output and machine-readable JSON
5. **Maintains performance**: Minimal overhead during normal processing

This system helps users understand processing limitations and optimize their workflow for better geolocation coverage.

## Timeline Extension System

The application automatically extends timeline coverage by creating placeholder entries for image timestamps that fall outside the original timeline range. This feature:

### How It Works

1. **Timestamp Collection**: During Phase 1, the system collects all image timestamps
2. **Range Analysis**: Compares image timestamps against existing timeline coverage
3. **Placeholder Creation**: Creates timeline entries for out-of-range timestamps
4. **Timeline Integration**: Adds placeholder entries to the timeline file with backup creation

### Benefits

- **Eliminates Timeline Out of Range errors** for images with valid timestamps
- **Preserves timeline structure** while expanding coverage
- **Enables future interpolation** when more GPS data becomes available
- **Maintains data integrity** with automatic backup creation

### Limitations

- Placeholder entries don't provide GPS coordinates for immediate interpolation
- Images with timestamps outside the original range may still fail interpolation
- Requires actual GPS data (from other images or manual entry) to enable interpolation

### Timeline Extension Report

The system reports timeline extension activity:

```bash
📅 Timeline extensions: 4
➕ New records added: 4
```

This indicates that 4 placeholder entries were added to extend timeline coverage for out-of-range image timestamps.
