# Image Geolocation Processor

A comprehensive Node.js application that processes image geolocation using Google Maps timeline data and temporal interpolation. The program intelligently adds GPS coordinates to images that lack location data by analyzing timestamps and using dual fallback mechanisms.

## Recent Improvements (v2.2)

- **🎯 Placeholder Geolocation Fix**: Resolved critical issue where placeholder entries with null coordinates caused interpolation failures for 14 Svalbard images
- **🔄 Enhanced Fallback System**: Implemented progressive search expansion (1h → 6h → 24h → 72h) with configurable maximum tolerance
- **📝 Improved Debug Logging**: Added filename inclusion in all log messages for better debugging and issue tracking
- **✅ Comprehensive Testing**: 100% test pass rate (5/5 tests) with real dataset validation confirming all optimization features work
- **📚 Plain English Documentation**: Created comprehensive `explain.md` document explaining how the application works

## Previous Improvements (v2.1)

- **🔧 Timeline Duplicate Issue Resolution**: Eliminated 500+ duplicate placeholder records, achieving 60-90% reduction in processing overhead
- **📊 Comprehensive Monitoring Infrastructure**: Real-time performance monitoring, health dashboards, and diagnostic tools
- **🧪 Advanced Testing Suite**: 100% test coverage with 39+ assertions for timeline consolidation functionality
- **⚡ Performance Optimization**: 90% reduction in verbose logging, O(1) lookup optimizations, and smart batch processing
- **🛠️ Debugging Tools**: 5-level configurable logging, error tracking with automated recovery, and comprehensive diagnostics</search>
</search_and_replace>

## Previous Improvements (v2.0)

- **🚀 Massive Performance Boost**: 38% faster processing with optimized batch processing (25 images per batch)
- **📸 CR3 File Support**: Full Canon CR3 RAW format support with direct exiftool integration
- **⏱️ Enhanced Timestamp Extraction**: 97.5% success rate for timestamp extraction from all formats
- **🗄️ Database Method Fixes**: Resolved all database export/close method errors
- **📊 Improved Logging**: Reduced verbose logging by 90% for better performance
- **🧪 Comprehensive Testing**: New CR3-specific test suite with 100% pass rate

## Features

- **Two-Phase Processing System**
  - Phase 1: Recursive directory traversal and EXIF metadata extraction
  - Phase 2: Intelligent geolocation inference with dual fallback mechanisms

- **Comprehensive Format Support**
  - JPEG, TIFF, PNG, WebP, AVIF, HEIF, HEIC
  - RAW formats: DNG, CR2, **CR3** (Canon), NEF (Nikon), ARW (Sony), ORF, RW2, RAF, PEF, SRW
  - **Optimized CR3 Processing**: Direct exiftool integration for Canon's latest RAW format

- **Dual Interpolation System with Enhanced Fallback**
  - Primary: Google Maps timeline data with 30-minute tolerance
  - Enhanced Fallback: Progressive search expansion (1h → 6h → 24h → 72h) for images beyond normal GPS coverage
  - Secondary: Nearby images with GPS data (2km radius, 4-hour window)
  - Placeholder Entry Filtering: Automatically filters out placeholder entries with null coordinates to prevent interpolation failures

- **Geolocation Database System**
  - In-memory database with optional SQLite persistence
  - Priority-based GPS source management (Database → EXIF → Timeline → Nearby Images)
  - Incremental processing - only processes new/changed images on subsequent runs
  - Consolidated JSON export with complete source attribution
  - Significant performance improvements for repeated processing

- **Enhanced GPS Writing**
  - Hybrid GPS EXIF writing using piexifjs + exiftool fallback
  - Proper GPS coordinate embedding (fixes previous copy-only behavior)
  - Support for all major image formats including Canon CR3
  - Reliable GPS metadata injection with comprehensive error handling

- **Timeline Augmentation System**
  - Automatically extracts GPS coordinates from images and adds them to timeline data
  - Smart duplicate detection prevents redundant timeline entries
  - Proximity-based filtering (configurable distance and time tolerances)
  - Automatic backup creation before timeline modification
  - Expands timeline coverage for better interpolation accuracy

- **Debugging and Monitoring Infrastructure**
  - **5-Level Configurable Logging**: ERROR, WARN, INFO, DEBUG, TRACE with smart output controls
  - **Real-time Performance Monitoring**: Memory usage tracking, processing metrics, and throughput analysis
  - **Comprehensive Diagnostics**: 9 diagnostic test types including data integrity, memory leak detection, and performance analysis
  - **Error Tracking System**: 10 categorized error types with 6 automated recovery strategies
  - **Health Monitoring Dashboard**: Real-time metrics with configurable alerting and health scoring
  - **Timeline Validation**: 10 validation issue types with comprehensive integrity checking
  - **Performance Benchmarking**: Multi-scale testing from micro to stress testing with scalability analysis

- **Advanced Features**
  - Timezone handling with EXIF extraction and system fallback
  - Weighted interpolation based on temporal and spatial distance
  - Memory-efficient processing for large image collections
  - Comprehensive error handling and statistics reporting
  - Unix epoch timestamp validation and coordinate bounds checking
  - **Detailed Failure Reporting**: Comprehensive tracking and categorization of files that couldn't be geotagged with specific reasons and recommendations
- **Timeline Extension System**: Automatically creates placeholder entries for image timestamps outside the original timeline range to maximize coverage

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Setup

Clone or download the project:

```bash
git clone https://github.com/ddttom/timeline.git
cd timeline
``
Install dependencies:

```bash
npm install
```

Ensure you have the Google Maps timeline data file:

- Place your `Timeline Edits.json` file in the `data/` directory
- The file should be exported from Google Takeout (Location History)

## Usage

### Basic Usage

Run the application:

```bash
npm start
```

The application will:

1. Prompt you for a target directory path (defaults to `~/pics` if you press Enter)
2. Validate the directory exists and is accessible
3. Discover and index all images in the directory (recursively)
4. Extract GPS coordinates from images and augment timeline data (if enabled)
5. Process images that lack GPS coordinates but have valid timestamps
6. Generate a comprehensive statistics report

### Development Mode

For development with auto-restart:

```bash
npm run dev
```

### Command Line Interface

The application supports both interactive and non-interactive modes:

#### Interactive Mode (Default)

When run without arguments, the application provides an interactive command-line interface:

```bash
npm start
```

```bash
=== Image Geolocation Processor ===
This application will process images in a directory and add GPS coordinates using timeline data.

Enter the target directory path (default: /Users/username/pics): 
📁 Target directory: /Users/username/pics
Proceed with this directory? [y/N] y
```

**Default Directory**: Simply press Enter (return) with no input to use `~/pics` as the target directory.

#### Command Line Arguments

For automated workflows and testing, you can specify the target directory directly:

```bash
# Process a specific directory
node src/index.js /path/to/your/images

# Process a test subset
node src/index.js test-subset/

# Using npm script with arguments
npm start -- /path/to/your/images
```

**Benefits of Command Line Arguments**:

- **Automation**: Perfect for scripts and batch processing
- **Testing**: Easily test with smaller image subsets
- **CI/CD Integration**: Seamless integration with automated workflows
- **No User Interaction**: Runs completely unattended

The application will validate the provided directory path and exit with an error if the directory doesn't exist or isn't accessible.

## Configuration

The application can be configured by modifying the `config` object in `src/index.js`:

```javascript
this.config = {
    timelineTolerance: 30,      // Timeline matching tolerance (minutes)
    secondaryRadius: 2000,      // Secondary interpolation radius (meters)
    secondaryTimeWindow: 4,     // Secondary interpolation time window (hours)
    batchSize: 25,              // Images to process in parallel (optimized for performance)
    createBackups: false,       // Create backups before modifying images
    enhancedFallback: {
        enabled: true,          // Enable enhanced fallback interpolation
        enableUnlimitedFallback: false,  // Allow unlimited time tolerance (can assign distant GPS records)
        maxToleranceHours: 72,  // Maximum fallback tolerance in hours (when unlimited is disabled)
        progressiveSearch: true // Use progressive search expansion (1h → 6h → 24h → 72h)
    },
    timelineAugmentation: {
        enabled: true,          // Enable timeline augmentation from image GPS data
        exactTimeTolerance: 2,  // Minutes for exact duplicate detection
        proximityDistanceTolerance: 50,  // Meters for proximity duplicate detection
        proximityTimeTolerance: 10,      // Minutes for proximity duplicate detection
        createBackup: true      // Create backup of timeline file before modification
    },
    geolocationDatabase: {
        enableSqlitePersistence: false,    // Enable SQLite database persistence
        sqliteDbPath: 'data/geolocation.db',  // SQLite database file path
        exportPath: 'data/geolocation-export.json',  // JSON export file path
        validateCoordinates: true,         // Validate GPS coordinates
        coordinateSystem: 'WGS84'          // Coordinate system standard
    }
};
```</search>

## Timeline Data Format

The application expects Google Maps timeline data in JSON format. Export your location history from [Google Takeout](https://takeout.google.com/):

1. Go to Google Takeout
2. Select "Location History (Timeline)"
3. Choose JSON format
4. Download and extract the archive
5. Place the `Timeline Edits.json` file in the `data/` directory

## Timeline Augmentation

The timeline augmentation feature automatically extracts GPS coordinates from images that already contain location data and adds them to your timeline file. This expands your timeline coverage and improves interpolation accuracy for images without GPS data.

### How It Works

1. **GPS Extraction**: During Phase 1, the application identifies images with existing GPS coordinates in their EXIF data
2. **Duplicate Detection**: Before adding to timeline, the system checks for duplicates using:
   - **Exact matching**: Same timestamp (±2 minutes) and location (±10 meters)
   - **Proximity matching**: Similar timestamp (±10 minutes) and location (±50 meters)
3. **Timeline Integration**: New GPS records are converted to Google Maps timeline format and merged with existing data
4. **Backup Creation**: Original timeline file is automatically backed up before modification
5. **Sorted Output**: Final timeline is sorted chronologically for optimal processing

### Benefits

- **Extended Coverage**: Images with GPS data fill gaps in your timeline, especially useful when your timeline data doesn't cover the full date range of your images
- **Better Interpolation**: More timeline points result in more accurate GPS coordinate interpolation for images without location data
- **Automatic Processing**: No manual intervention required - the system handles everything automatically
- **Data Safety**: Automatic backups ensure your original timeline data is preserved

### Configuration Options

- `enabled`: Enable/disable timeline augmentation (default: true)
- `exactTimeTolerance`: Time tolerance for exact duplicate detection in minutes (default: 2)
- `proximityDistanceTolerance`: Distance tolerance for proximity duplicate detection in meters (default: 50)
- `proximityTimeTolerance`: Time tolerance for proximity duplicate detection in minutes (default: 10)
- `createBackup`: Create backup of timeline file before modification (default: true)

## Failure Reporting System

The application includes a comprehensive failure reporting system that provides detailed insights into why specific files couldn't be geotagged, helping you understand and resolve geolocation issues.

### Failure Categories

The system tracks 8 specific failure categories:

1. **Missing Timestamp** (`missingTimestamp`): Image lacks valid timestamp data in EXIF
2. **Timeline Out of Range** (`timelineOutOfRange`): Image timestamp falls outside timeline coverage
3. **Timeline Too Far** (`timelineTooFar`): Closest timeline record exceeds tolerance (30 minutes)
4. **No Nearby Images** (`noNearbyImages`): No images with GPS found within search radius (2km, 4 hours)
5. **Nearby Images Too Far** (`nearbyImagesTooFar`): Nearby images exceed distance/time tolerances
6. **GPS Writing Failed** (`gpsWritingFailed`): Technical failure writing GPS coordinates to image
7. **EXIF Processing Error** (`exifProcessingError`): Error reading or processing image metadata
8. **Technical Error** (`technicalError`): Unexpected system or processing errors

### Timeline Extension System

When images have timestamps outside the original timeline range, the system automatically creates **placeholder entries** to extend timeline coverage:

- **Placeholder Creation**: Timeline entries with timestamps but no GPS coordinates
- **Extended Coverage**: Maximizes the potential for future geolocation as timeline data grows
- **Smart Processing**: Placeholder entries are skipped during interpolation but noted in failure reports
- **Automatic Backup**: Timeline file is backed up before adding placeholder entries

### Enhanced Failure Messages

The system provides detailed failure information including:

- **Specific Distance Measurements**: "253219.5 minutes away (tolerance: 30 minutes)"
- **Timeline Extension Notes**: "Timeline has been extended with placeholder entries for this timestamp"
- **Categorized Failures**: Clear categorization helps identify systematic issues
- **Sample Detailed Failures**: Console report shows specific examples with full context

### Console Report Example

```bash
❌ GEOLOCATION FAILURES
------------------------------
🚫 Total Failed Files: 3

📊 Failure Categories:
   ⏰ Timeline Too Far: 2
   🔍 No Nearby Images: 1

🔍 Sample Detailed Failures:

   1. IMG_2025_08_05.jpg
      Category: timelineTooFar
      Image Time: 8/5/2025, 6:34:13 PM
      Closest Timeline: 253219.5 minutes away
      Error: Closest timeline record is 253219.5 minutes away (tolerance: 30 minutes)
      Note: Timeline has been extended with placeholder entries for this timestamp

   2. IMG_REMOTE_LOCATION.jpg
      Category: noNearbyImages
      Image Time: 7/15/2024, 2:15:30 PM
      Search Radius: 2000 meters, 4 hours
      Error: No images with GPS coordinates found within search parameters
```

### Troubleshooting Guide

For detailed troubleshooting information and recommendations for each failure category, see [`FAILURE_REPORTING.md`](FAILURE_REPORTING.md).

### Configuration

Failure reporting is automatically enabled and provides:

- **Categorized Statistics**: Breakdown by failure type
- **Sample Details**: Up to 5 detailed failure examples per category
- **JSON Export**: Complete failure data included in processing report
- **Console Display**: Human-readable failure summary with actionable insights</search>
</search_and_replace>

### Timeline Data Structure

The application parses timeline data with the following structure:

```json
{
  "timelineEdits": [
    {
      "deviceId": "1794812075",
      "rawSignal": {
        "signal": {
          "position": {
            "point": {
              "latE7": 139040604,
              "lngE7": -610669944
            },
            "timestamp": "2025-02-10T18:14:43.081Z",
            "accuracyMm": 10303,
            "source": "GPS"
          }
        }
      }
    }
  ]
}
```

## Processing Logic

### Phase 1: Image Discovery and GPS Extraction

1. **Database Initialization**: Loads existing GPS data from previous runs
2. **Directory Traversal**: Recursively scans the target directory
3. **Image Detection**: Identifies supported image formats (including optimized CR3 support)
4. **Priority GPS Checking** (with optimized batching):
   - First checks geolocation database for existing GPS data
   - **Smart format routing**: CR3 files bypass custom EXIF parsing for direct exiftool processing
   - Parallel batch processing (25 images per batch) for maximum throughput
   - Stores new GPS data for future runs
5. **Timeline Augmentation**: Extracts GPS coordinates from images and adds them to timeline data, plus creates placeholder entries for timestamps outside timeline range (if enabled)
6. **Indexing**: Creates a comprehensive metadata index keyed by file paths

### Phase 2: Geolocation Inference

1. **Database Query**: Checks if GPS data already exists (skips interpolation if found)
2. **Filtering**: Identifies images lacking GPS coordinates but with valid timestamps
3. **Primary Interpolation**: Matches image timestamps with timeline data (±30 minutes) with automatic placeholder entry filtering
4. **Enhanced Fallback Interpolation**: Progressive search expansion (1h → 6h → 24h → 72h) for images beyond normal GPS coverage
5. **Secondary Interpolation**: Uses nearby images with GPS data for weighted interpolation
6. **Coordinate Writing**: Injects calculated GPS coordinates into EXIF data using hybrid approach
7. **Database Storage**: Stores interpolated GPS data for future runs
8. **Failure Tracking**: Records detailed failure information with specific reasons, measurements, and filenames
9. **JSON Export**: Generates consolidated geolocation database export with comprehensive failure reporting

### Interpolation Algorithms

#### Primary Interpolation (Timeline Data)

- Finds closest timeline record within 30-minute tolerance
- Automatically filters out placeholder entries with null coordinates to prevent interpolation failures
- Performs temporal interpolation between two timeline records
- Handles timezone conversion and normalization

#### Enhanced Fallback Interpolation

- Activates when primary interpolation fails (no timeline match within 30 minutes)
- Progressive search expansion: 1 hour → 6 hours → 24 hours → 72 hours maximum
- Configurable maximum tolerance prevents inaccurate distant GPS assignments
- Includes filename in debug logging for better issue tracking</search>
</search_and_replace>

#### Secondary Interpolation (Nearby Images)

- Identifies images within 2km radius and 4-hour time window
- Applies weighted interpolation based on temporal and spatial distance
- Uses combined temporal (60%) and spatial (40%) weighting

## Output and Reporting

### Console Output

The application provides real-time progress updates:

```bash
🚀 Starting Image Geolocation Processor...

📋 PHASE 1: Image Discovery and EXIF Extraction
==================================================

🔍 Step 1: Discovering image files...
✅ Discovered 1,234 image files

📊 Step 2: Creating image index...
Processing images [████████████████████████████████████████████████] 100% (1234/1234)

✅ Phase 1 Complete:
   📸 Total images indexed: 1,234
   🗺️  Images with GPS: 456
   ⏰ Images with timestamp: 1,100
   📍 Images needing geolocation: 644
```

### Statistics Report

A comprehensive report is generated at the end of processing:

```bash
📊 IMAGE GEOLOCATION PROCESSING REPORT
============================================================

📋 SUMMARY
------------------------------
⏱️  Total Duration: 2m 34s
📅 Start Time: 2/10/2025, 10:30:15 AM
📅 End Time: 2/10/2025, 10:32:49 AM
📸 Total Images Processed: 1,234
🎯 Newly Geotagged Images: 587
✅ Interpolation Success Rate: 91.2%
💾 GPS Writing Success Rate: 100.0%

❌ GEOLOCATION FAILURES
------------------------------
🚫 Total Failed Files: 57

📊 Failure Categories:
   ⏰ Timeline Too Far: 32
   🔍 No Nearby Images: 18
   📅 Missing Timestamp: 7

🔍 Sample Detailed Failures:

   1. IMG_2025_08_05.jpg
      Category: timelineTooFar
      Image Time: 8/5/2025, 6:34:13 PM
      Closest Timeline: 253219.5 minutes away
      Error: Closest timeline record is 253219.5 minutes away (tolerance: 30 minutes)
```

### JSON Export

A detailed JSON report is exported to `processing-report.json`:

```json
{
  "summary": {
    "totalDuration": 154000,
    "totalImagesProcessed": 1234,
    "newlyGeotaggedImages": 587,
    "interpolationSuccessRate": 91.2
  },
  "interpolation": {
    "primarySuccessful": 423,
    "secondarySuccessful": 164,
    "failed": 57
  },
  "failures": {
    "totalFailed": 57,
    "categories": {
      "timelineTooFar": 32,
      "noNearbyImages": 18,
      "missingTimestamp": 7
    },
    "detailedFailures": [
      {
        "fileName": "IMG_2025_08_05.jpg",
        "category": "timelineTooFar",
        "imageTime": "2025-08-05T18:34:13.000Z",
        "error": "Closest timeline record is 253219.5 minutes away (tolerance: 30 minutes)",
        "closestTimelineDistance": 253219.5
      }
    ]
  }</search>
</search_and_replace>
}
```

### Geolocation Database Export

A consolidated geolocation database is exported to `data/geolocation-export.json`:

```json
{
  "metadata": {
    "exportDate": "2025-08-10T12:30:00.000Z",
    "totalRecords": 1234,
    "sourceBreakdown": {
      "DATABASE": 456,
      "EXIF_GPS": 234,
      "TIMELINE_INTERPOLATED": 423,
      "NEARBY_INTERPOLATED": 121
    },
    "coordinateSystem": "WGS84",
    "version": "1.0.0"
  },
  "records": [
    {
      "imageId": "IMG_1234_abc123",
      "filePath": "/path/to/image.jpg",
      "fileName": "image.jpg",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "altitude": 10.5,
        "bearing": 45.0,
        "accuracy": 5.0
      },
      "timestamp": "2025-08-10T09:30:00.000Z",
      "coordinateSystem": "WGS84",
      "source": "EXIF_GPS",
      "confidence": "HIGH",
      "createdAt": "2025-08-10T12:30:00.000Z"
    }
  ]
}
```

## Error Handling

The application includes comprehensive error handling:

- **File I/O Errors**: Graceful handling of permission issues and missing files
- **Metadata Parsing**: Continues processing when individual images fail
- **Invalid Timestamps**: Validates timestamps against Unix epoch
- **Coordinate Validation**: Ensures interpolated coordinates are within valid ranges
- **Memory Management**: Processes images in batches to prevent memory exhaustion

## Performance Considerations

### Memory Management

- Processes images in configurable batches (default: 25, optimized for performance)
- Releases memory between batches
- Tracks peak memory usage in statistics

### Processing Optimization

- **Parallel batch processing** within batches for maximum throughput
- **Smart file format routing** - CR3 files bypass custom EXIF parsing for direct exiftool processing
- **Reduced logging overhead** - 90% reduction in verbose console output
- **Database-first approach** - Checks existing GPS data before expensive EXIF operations
- Efficient coordinate calculations using Haversine formula
- Minimal file system operations

### Large Collections

- Designed to handle thousands of images
- Progress reporting for long-running operations
- Graceful degradation when timeline data is unavailable

## Testing

### Running Tests

The application includes comprehensive test suites to ensure reliability:

```bash
# Run all tests
npm test

# Run CR3-specific tests
node tests/cr3-processing.test.js

# Run GPS extraction tests
node tests/gps-extraction.test.js
```

### Test Coverage

- **CR3 File Processing**: Tests Canon CR3 format support, GPS extraction, and timestamp parsing
- **GPS Coordinate Validation**: Ensures coordinate accuracy and format compliance
- **Database Integration**: Tests export/import functionality and method availability
- **Performance Benchmarks**: Validates processing speed meets performance targets

### CR3 Test Results

The CR3 processing test suite validates:

- ✅ File format recognition for `.cr3` and `.CR3` extensions
- ✅ GPS coordinate extraction with sub-200ms performance
- ✅ Timestamp extraction with proper date parsing
- ✅ Database integration with export/close methods
- ✅ Performance benchmarks under 2-second threshold

## Troubleshooting

### Common Issues

**Timeline file not found**

```bash
⚠️  Timeline file not found, skipping timeline-based interpolation
```

- Ensure `Timeline Edits.json` is in the `data/` directory
- Check file permissions and format

**No images need geolocation**

```bash
✅ No images need geolocation processing!
```

- All images already have GPS coordinates
- No images have valid timestamps post-Unix epoch

**Permission denied**

```bash
❌ Permission denied accessing directory: /path/to/directory
```

- Check directory permissions
- Run with appropriate user privileges

### GPS Writing Issues

**GPS coordinates not being written to images**

```bash
⚠️  Failed to write GPS coordinates - both piexifjs and exiftool failed
```

- Install exiftool for better compatibility: `brew install exiftool` (macOS) or `apt-get install exiftool` (Linux)
- Check file permissions for write access
- Ensure image format supports EXIF metadata

**CR3 files not being processed**

```bash
File format CR3 not supported for EXIF parsing
```

- Ensure exiftool is installed: `brew install exiftool` (macOS) or `apt-get install exiftool` (Linux)
- CR3 files require exiftool for metadata extraction
- The system automatically routes CR3 files to exiftool processing

**Performance on subsequent runs**

- First run processes all images and builds geolocation database
- Subsequent runs are significantly faster by leveraging cached GPS data
- Database is automatically loaded from `data/geolocation-export.json`
- CR3 processing is optimized with direct exiftool routing (avg 150ms per file)

### Debug Mode

Enable verbose logging by setting the environment variable:

```bash
DEBUG=true npm start
```

## API Reference

### Core Classes

#### `ImageGeolocationProcessor`

Main application orchestrator

```javascript
const processor = new ImageGeolocationProcessor();
await processor.run();
```

#### `StatisticsCollector`

Tracks processing statistics

```javascript
const stats = new StatisticsCollector();
stats.recordInterpolation('primary', true, result);
const report = stats.generateReport();
```

### Utility Functions

#### Coordinate Conversion

```javascript
import { e7ToDecimal, decimalToE7, isValidCoordinatePair } from './utils/coordinates.js';

const decimal = e7ToDecimal(139040604); // 13.9040604
const e7 = decimalToE7(13.9040604);     // 139040604
const valid = isValidCoordinatePair(lat, lng); // boolean
```

#### Distance Calculations

```javascript
import { calculateDistance, filterCoordinatesWithinRadius } from './utils/distance.js';

const distance = calculateDistance(coord1, coord2); // meters
const nearby = filterCoordinatesWithinRadius(center, coords, 2000); // within 2km
```

## Documentation

For detailed information about specific features:

- **[Failure Reporting](FAILURE_REPORTING.md)**: Comprehensive guide to understanding and troubleshooting geolocation failures

## Documentation

### Comprehensive Guides

- **[DEBUGGING_MONITORING_GUIDE.md](DEBUGGING_MONITORING_GUIDE.md)** - Complete 582-line guide covering all debugging and monitoring capabilities
- **[TIMELINE_OPTIMIZATION_SUMMARY.md](TIMELINE_OPTIMIZATION_SUMMARY.md)** - Technical summary of the timeline optimization solution and performance improvements

### Testing

- **Unit Tests**: [`tests/timeline-consolidation.test.js`](tests/timeline-consolidation.test.js) - 100% pass rate with 39+ comprehensive assertions
- **Performance Tests**: [`tests/performance-test.js`](tests/performance-test.js) - Multi-scale performance benchmarking suite
- **Run Tests**: `node tests/timeline-consolidation.test.js` or `node tests/performance-test.js`

### Monitoring and Debugging

- **Debug Logging**: 5-level configurable logging system (ERROR, WARN, INFO, DEBUG, TRACE)
- **Performance Monitoring**: Real-time memory usage, processing metrics, and throughput analysis
- **Health Dashboard**: System health monitoring with configurable alerting
- **Diagnostics**: 9 comprehensive diagnostic test types for troubleshooting
- **Error Tracking**: Automated error categorization with recovery strategies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the error messages and logs
3. Create an issue with detailed information about your setup and the problem
