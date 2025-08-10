# Usage Examples and Scenarios

This document provides practical examples and common usage scenarios for the Image Geolocation Processor.

## Example 1: Basic Usage with Timeline Data

### Scenario
You have a collection of photos from a trip and want to add GPS coordinates using your Google Maps timeline data.

### Setup
1. Export your Google Maps timeline data from Google Takeout
2. Place the `Timeline Edits.json` file in the `data/` directory
3. Organize your photos in a directory structure like:
```
/Users/john/Photos/Trip2025/
├── Day1/
│   ├── IMG_001.jpg (no GPS)
│   ├── IMG_002.jpg (no GPS)
│   └── IMG_003.jpg (has GPS)
├── Day2/
│   ├── IMG_004.jpg (no GPS)
│   └── IMG_005.jpg (no GPS)
└── Day3/
    ├── IMG_006.jpg (no GPS)
    └── IMG_007.jpg (has GPS)
```

### Running the Application
```bash
npm start
```

### Expected Output
```
🚀 Starting Image Geolocation Processor...

=== Image Geolocation Processor ===
This application will process images in a directory and add GPS coordinates using timeline data.

Enter the target directory path: /Users/john/Photos/Trip2025
📁 Target directory: /Users/john/Photos/Trip2025
Proceed with this directory? [y/N] y

📋 PHASE 1: Image Discovery and EXIF Extraction
==================================================

🔍 Step 1: Discovering image files...
✅ Discovered 7 image files

📊 Step 2: Creating image index...
Processing images [████████████████████████████████████████████████] 100% (7/7)

✅ Phase 1 Complete:
   📸 Total images indexed: 7
   🗺️  Images with GPS: 2
   ⏰ Images with timestamp: 7
   📍 Images needing geolocation: 5

📍 PHASE 2: Geolocation Inference
==================================================

🗺️  Step 1: Loading timeline data...
   📍 Loaded 1,234 position records
   📅 Time range: 1/15/2025 - 2/15/2025

🎯 Step 2: Filtering images for processing...
📍 Found 5 images needing geolocation
🗺️  Found 2 images with GPS coordinates

🔄 Step 3: Processing 5 images...
Processing images [████████████████████████████████████████████████] 100% (5/5)

✅ Phase 2 Complete:
   🎯 Primary interpolations: 4
   🥈 Secondary interpolations: 1
   💾 GPS coordinates written: 5
```

### Result
- 5 images now have GPS coordinates added to their EXIF data
- 4 coordinates were derived from timeline data
- 1 coordinate was interpolated from nearby images with GPS

## Example 2: Processing Without Timeline Data

### Scenario
You don't have timeline data but have some images with GPS coordinates that can be used for interpolation.

### Setup
```
/Users/jane/Photos/Wedding/
├── ceremony/
│   ├── IMG_001.jpg (has GPS - church location)
│   ├── IMG_002.jpg (no GPS - 10 minutes later)
│   └── IMG_003.jpg (no GPS - 15 minutes later)
├── reception/
│   ├── IMG_004.jpg (has GPS - venue location)
│   ├── IMG_005.jpg (no GPS - 30 minutes later)
│   └── IMG_006.jpg (no GPS - 1 hour later)
```

### Expected Behavior
- Timeline interpolation will be skipped (no timeline file)
- Secondary interpolation will use images with GPS coordinates
- Images taken within 4 hours and 2km of GPS-enabled images will get coordinates

### Output
```
🗺️  Step 1: Loading timeline data...
⚠️  Timeline file not found, skipping timeline-based interpolation

🔄 Step 3: Processing 4 images...
🔍 Primary interpolation for IMG_002.jpg at 2025-02-10T14:25:00Z
❌ No timeline match found within 30 minutes
🔍 Secondary interpolation for IMG_002.jpg
✅ Secondary interpolation successful

✅ Phase 2 Complete:
   🎯 Primary interpolations: 0
   🥈 Secondary interpolations: 4
   💾 GPS coordinates written: 4
```

## Example 3: Large Photo Collection

### Scenario
Processing a large collection of 10,000+ photos from multiple years.

### Recommendations
1. **Enable batch processing optimization**:
```javascript
// In src/index.js, modify config:
this.config = {
    batchSize: 20,              // Increase batch size for better performance
    createBackups: false,       // Disable backups to save space
    timelineTolerance: 60       // Increase tolerance for older photos
};
```

2. **Monitor memory usage**:
```bash
# Run with memory monitoring
node --max-old-space-size=4096 src/index.js
```

3. **Process in chunks**:
   - Process photos by year or event
   - Use subdirectories to organize processing

### Expected Performance
- ~100-200 images per minute (depending on system)
- Peak memory usage: 200-500MB for 10,000 images
- Processing time: 1-2 hours for 10,000 images

## Example 4: RAW Photo Processing

### Scenario
Processing RAW photos from a professional camera shoot.

### Supported RAW Formats
- Canon: `.cr2`, `.cr3`
- Nikon: `.nef`
- Sony: `.arw`
- Olympus: `.orf`
- Panasonic: `.rw2`
- Fujifilm: `.raf`
- Pentax: `.pef`
- Samsung: `.srw`
- Adobe: `.dng`

### Setup
```
/Users/photographer/Shoot2025/
├── RAW/
│   ├── DSC_001.nef (no GPS)
│   ├── DSC_002.nef (no GPS)
│   └── DSC_003.nef (no GPS)
└── JPEG/
    ├── DSC_001.jpg (has GPS)
    ├── DSC_002.jpg (has GPS)
    └── DSC_003.jpg (has GPS)
```

### Processing Strategy
1. Process JPEG files first to establish GPS reference points
2. Process RAW files using JPEG coordinates for interpolation
3. RAW files will inherit GPS coordinates based on matching timestamps

## Example 5: Timezone Handling

### Scenario
Photos taken across multiple timezones during travel.

### Timeline Data Considerations
- Google timeline data is stored in UTC
- Image timestamps may be in local timezone
- Application handles timezone conversion automatically

### Example Timeline
```
Day 1: New York (UTC-5)
- IMG_001.jpg: 2025-02-10 09:00:00 EST
- Timeline: 2025-02-10 14:00:00 UTC

Day 2: London (UTC+0)  
- IMG_002.jpg: 2025-02-11 15:00:00 GMT
- Timeline: 2025-02-11 15:00:00 UTC

Day 3: Tokyo (UTC+9)
- IMG_003.jpg: 2025-02-12 10:00:00 JST
- Timeline: 2025-02-12 01:00:00 UTC
```

### Processing Result
- Application detects timezone from EXIF data
- Normalizes all timestamps to UTC for comparison
- Matches images with timeline data accurately

## Example 6: Error Recovery Scenarios

### Scenario 1: Corrupted Images
```
⚠️  Warning: Failed to process IMG_corrupted.jpg: Invalid EXIF data
Processing images [████████████████████████████████████████████████] 100% (100/100)
```
- Application continues processing other images
- Corrupted images are logged but don't stop processing

### Scenario 2: Permission Issues
```
❌ Permission denied accessing directory: /restricted/photos
```
- Application validates permissions before processing
- Clear error messages guide user to fix issues

### Scenario 3: Insufficient Timeline Data
```
📍 Found 0 images needing geolocation
🗺️  Found 0 images with GPS coordinates
❌ No interpolation possible - insufficient reference data
```
- Application gracefully handles cases with no reference data
- Provides clear feedback about why processing cannot continue

## Performance Optimization Tips

### 1. Directory Organization
```
Good:
/Photos/2025/
├── January/
├── February/
└── March/

Avoid:
/Photos/
├── 10000_mixed_photos/
```

### 2. Timeline Data Quality
- Use recent timeline exports (within 1 year)
- Ensure timeline covers the photo date range
- Higher GPS accuracy improves interpolation quality

### 3. System Resources
```bash
# For large collections
node --max-old-space-size=8192 src/index.js

# Monitor progress
tail -f processing-report.json
```

### 4. Batch Processing
```javascript
// Optimal batch sizes by system:
// 8GB RAM: batchSize: 20
// 16GB RAM: batchSize: 50  
// 32GB RAM: batchSize: 100
```

## Integration Examples

### 1. Automated Workflow
```bash
#!/bin/bash
# Process new photos automatically

PHOTO_DIR="/Users/photographer/NewPhotos"
PROCESSED_DIR="/Users/photographer/ProcessedPhotos"

# Run geolocation processor
cd /path/to/image-geolocation-processor
npm start -- --directory "$PHOTO_DIR" --output "$PROCESSED_DIR"

# Move processed photos
mv "$PHOTO_DIR"/* "$PROCESSED_DIR"/
```

### 2. Photo Management Integration
```javascript
// Example integration with photo management software
import ImageGeolocationProcessor from './src/index.js';

async function processPhotoLibrary(libraryPath) {
    const processor = new ImageGeolocationProcessor();
    processor.config.createBackups = true;
    
    const results = await processor.processDirectory(libraryPath);
    
    // Update photo database with new GPS coordinates
    await updatePhotoDatabase(results);
}
```

## Troubleshooting Common Issues

### Issue: "No images need geolocation processing"
**Cause**: All images already have GPS coordinates or lack valid timestamps
**Solution**: 
- Check if images have timestamps after 1970-01-01
- Verify some images are missing GPS coordinates
- Use `--force` flag to reprocess images with existing GPS

### Issue: Low interpolation success rate
**Cause**: Poor timeline data coverage or sparse reference images
**Solution**:
- Increase timeline tolerance: `timelineTolerance: 60`
- Increase secondary search radius: `secondaryRadius: 5000`
- Ensure timeline data covers photo date range

### Issue: High memory usage
**Cause**: Processing too many images simultaneously
**Solution**:
- Reduce batch size: `batchSize: 5`
- Process subdirectories separately
- Increase Node.js memory limit

### Issue: Timeline data not loading
**Cause**: Invalid JSON format or file permissions
**Solution**:
- Validate JSON format: `node -e "JSON.parse(require('fs').readFileSync('data/Timeline Edits.json'))"`
- Check file permissions: `ls -la data/`
- Re-export timeline data from Google Takeout

This comprehensive guide covers the most common usage scenarios and should help users successfully process their image collections.
