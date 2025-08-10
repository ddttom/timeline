# Image Geolocation Processor

A comprehensive Node.js application that processes image geolocation using Google Maps timeline data and temporal interpolation. The program intelligently adds GPS coordinates to images that lack location data by analyzing timestamps and using dual fallback mechanisms.

## Features

- **Two-Phase Processing System**
  - Phase 1: Recursive directory traversal and EXIF metadata extraction
  - Phase 2: Intelligent geolocation inference with dual fallback mechanisms

- **Comprehensive Format Support**
  - JPEG, TIFF, PNG, WebP, AVIF, HEIF, HEIC
  - RAW formats: DNG, CR2, NEF, ARW, ORF, RW2, RAF, PEF, SRW

- **Dual Interpolation System**
  - Primary: Google Maps timeline data with 30-minute tolerance
  - Secondary: Nearby images with GPS data (2km radius, 4-hour window)

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

1. Clone or download the project:
```bash
git clone <repository-url>
cd image-geolocation-processor
```

2. Install dependencies:
```bash
npm install
```

3. Ensure you have the Google Maps timeline data file:
   - Place your `Timeline Edits.json` file in the `data/` directory
   - The file should be exported from Google Takeout (Location History)

## Usage

### Basic Usage

Run the application:
```bash
npm start
```

The application will:
1. Prompt you for a target directory path
2. Validate the directory exists and is accessible
3. Discover and index all images in the directory (recursively)
4. Process images that lack GPS coordinates but have valid timestamps
5. Generate a comprehensive statistics report

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

### Command Line Interface

The application provides an interactive command-line interface:

```
=== Image Geolocation Processor ===
This application will process images in a directory and add GPS coordinates using timeline data.

Enter the target directory path: /path/to/your/images
📁 Target directory: /path/to/your/images
Proceed with this directory? [y/N] y
```

## Configuration

The application can be configured by modifying the `config` object in `src/index.js`:

```javascript
this.config = {
    timelineTolerance: 30,      // Timeline matching tolerance (minutes)
    secondaryRadius: 2000,      // Secondary interpolation radius (meters)
    secondaryTimeWindow: 4,     // Secondary interpolation time window (hours)
    batchSize: 10,              // Images to process in parallel
    createBackups: false        // Create backups before modifying images
};
```

## Timeline Data Format

The application expects Google Maps timeline data in JSON format. Export your location history from [Google Takeout](https://takeout.google.com/):

1. Go to Google Takeout
2. Select "Location History (Timeline)"
3. Choose JSON format
4. Download and extract the archive
5. Place the `Timeline Edits.json` file in the `data/` directory

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

### Phase 1: Image Discovery and EXIF Extraction

1. **Directory Traversal**: Recursively scans the target directory
2. **Image Detection**: Identifies supported image formats
3. **Metadata Extraction**: Extracts complete EXIF data using Sharp library
4. **Indexing**: Creates a comprehensive metadata index keyed by file paths

### Phase 2: Geolocation Inference

1. **Filtering**: Identifies images lacking GPS coordinates but with valid timestamps
2. **Primary Interpolation**: Matches image timestamps with timeline data (±30 minutes)
3. **Secondary Interpolation**: Uses nearby images with GPS data for weighted interpolation
4. **Coordinate Writing**: Injects calculated GPS coordinates into EXIF data

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

```
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

```
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
```
⚠️  Timeline file not found, skipping timeline-based interpolation
```
- Ensure `Timeline Edits.json` is in the `data/` directory
- Check file permissions and format

**No images need geolocation**
```
✅ No images need geolocation processing!
```
- All images already have GPS coordinates
- No images have valid timestamps post-Unix epoch

**Permission denied**
```
❌ Permission denied accessing directory: /path/to/directory
```
- Check directory permissions
- Run with appropriate user privileges

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
