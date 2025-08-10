# Image Geolocation Processor

A comprehensive Node.js application that processes image geolocation using Google Maps timeline data and temporal interpolation. The program intelligently adds GPS coordinates to images that lack location data by analyzing timestamps and using dual fallback mechanisms.

## Features

- **Two-Phase Processing System**
  - Phase 1: Recursive directory traversal and EXIF metadata extraction
  - Phase 2: Intelligent geolocation inference with dual fallback mechanisms

- **Comprehensive Format Support**
  - JPEG, TIFF, PNG, WebP, AVIF, HEIF, HEIC
  - RAW formats: DNG, CR2, CR3, NEF, ARW, ORF, RW2, RAF, PEF, SRW

- **Dual Interpolation System**
  - Primary: Google Maps timeline data with 30-minute tolerance
  - Secondary: Nearby images with GPS data (2km radius, 4-hour window)

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

- **Advanced Features**
  - Timezone handling with EXIF extraction and system fallback
  - Weighted interpolation based on temporal and spatial distance
  - Memory-efficient processing for large image collections
  - Comprehensive error handling and statistics reporting
  - Unix epoch timestamp validation and coordinate bounds checking

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
    batchSize: 10,              // Images to process in parallel
    createBackups: false,       // Create backups before modifying images
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
```

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
3. **Image Detection**: Identifies supported image formats (including CR3)
4. **Priority GPS Checking**:
   - First checks geolocation database for existing GPS data
   - Extracts EXIF GPS metadata if not in database
   - Stores new GPS data for future runs
5. **Timeline Augmentation**: Extracts GPS coordinates from images and adds them to timeline data (if enabled)
6. **Indexing**: Creates a comprehensive metadata index keyed by file paths

### Phase 2: Geolocation Inference

1. **Database Query**: Checks if GPS data already exists (skips interpolation if found)
2. **Filtering**: Identifies images lacking GPS coordinates but with valid timestamps
3. **Primary Interpolation**: Matches image timestamps with timeline data (±30 minutes)
4. **Secondary Interpolation**: Uses nearby images with GPS data for weighted interpolation
5. **Coordinate Writing**: Injects calculated GPS coordinates into EXIF data using hybrid approach
6. **Database Storage**: Stores interpolated GPS data for future runs
7. **JSON Export**: Generates consolidated geolocation database export

### Interpolation Algorithms

#### Primary Interpolation (Timeline Data)

- Finds closest timeline record within 30-minute tolerance
- Performs temporal interpolation between two timeline records
- Handles timezone conversion and normalization

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
  }
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

- Processes images in configurable batches (default: 10)
- Releases memory between batches
- Tracks peak memory usage in statistics

### Processing Optimization

- Parallel processing within batches
- Efficient coordinate calculations using Haversine formula
- Minimal file system operations

### Large Collections

- Designed to handle thousands of images
- Progress reporting for long-running operations
- Graceful degradation when timeline data is unavailable

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

**Performance on subsequent runs**

- First run processes all images and builds geolocation database
- Subsequent runs are significantly faster by leveraging cached GPS data
- Database is automatically loaded from `data/geolocation-export.json`

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
