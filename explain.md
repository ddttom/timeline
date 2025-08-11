# How the Image Geolocation Processor Works

## What This Application Does

The Image Geolocation Processor is a smart tool that **adds GPS location data to your photos** when they don't already have it. Think of it as a detective that figures out where your photos were taken by looking at when they were taken and matching that with your Google Maps location history.

## The Problem It Solves

Many photos don't have GPS coordinates embedded in them, especially:

- Photos from older cameras
- Photos where GPS was turned off
- Photos from cameras without GPS capability
- Screenshots or edited images

Without GPS data, you can't see where these photos were taken on a map, and they can't be organized by location.

## How It Works - The Simple Version

1. **You give it a folder of photos** - The app looks through all your image files
2. **It checks your Google Maps timeline** - It reads your location history from Google Maps
3. **It matches photos with locations** - For each photo, it finds where you were when the photo was taken
4. **It adds GPS data to the photos** - The location information gets written into the photo files

## The Two-Phase Process

### Phase 1: Discovery and Preparation

**What happens:** The app examines all your photos and prepares the data

1. **Find all image files** in the folder you specify
2. **Read photo information** like when each photo was taken
3. **Check which photos already have GPS** data (these get skipped)
4. **Load your Google Maps timeline** data
5. **Extend the timeline** by adding placeholder entries for photos taken outside your normal timeline range

### Phase 2: Location Matching

**What happens:** The app figures out where each photo was taken

1. **Process photos in batches** (25 at a time for efficiency)
2. **For each photo without GPS:**
   - Look at when the photo was taken
   - Find where you were at that time in your Google Maps timeline
   - Use smart algorithms to estimate the location if there's no exact match
3. **Write the GPS coordinates** into the photo file
4. **Generate a report** showing what was accomplished

## The Smart Matching System

The app uses several intelligent strategies to figure out where photos were taken:

### Primary Interpolation

- **Exact Match:** If your timeline shows you were at a specific location at the exact time the photo was taken, it uses that location
- **Close Match:** If there's a timeline record within 30 minutes of when the photo was taken, it uses that location
- **Time-based Interpolation:** If you were at two different locations before and after the photo, it estimates where you were in between

### Enhanced Fallback System

When the primary system can't find a match, the app tries progressively wider searches:

- **1 hour tolerance:** Looks for timeline records within 1 hour
- **6 hour tolerance:** Expands to 6 hours if nothing found
- **24 hour tolerance:** Expands to 24 hours
- **72 hour tolerance:** Expands to 72 hours (maximum by default)

The system stops at 72 hours to ensure location accuracy. Using GPS records from much further away in time could result in very inaccurate location assignments.

### Secondary Interpolation

For photos that still can't be matched, the app tries:

- **Geographic proximity:** Finds other photos taken nearby and uses their locations
- **Pattern recognition:** Looks for location patterns in your photo collection
- **Smart estimation:** Uses advanced algorithms to make educated guesses

## Key Features

### Timeline Extension

The app automatically extends your Google Maps timeline to cover dates when you took photos but don't have location history. This ensures photos from trips or special occasions can still be geolocated.

### Duplicate Prevention

The system is smart about not adding duplicate location data and avoiding conflicts with existing GPS information.

### Performance Optimization

- Processes photos in efficient batches
- Uses smart caching to avoid repeated calculations
- Includes comprehensive monitoring and diagnostics

### Safety Features

- **Creates backups** before modifying any files
- **Validates all GPS coordinates** before writing them
- **Comprehensive error handling** to prevent data loss
- **Detailed logging** so you can see exactly what happened

## What You Need

### Required Files

1. **Your photos** - In any folder on your computer
2. **Google Maps Timeline export** - A JSON file from Google Takeout containing your location history

### File Location

The app expects your Google Maps timeline file to be at:

```bash
data/Timeline Edits.json
```

## How to Use It

### Basic Usage

```bash
node src/index.js /path/to/your/photos
```

### With Command Line

```bash
node src/index.js "/Users/yourname/Pictures/Vacation Photos"
```

### Interactive Mode

If you don't specify a folder, the app will ask you where your photos are located.

## What Happens to Your Photos

The app **modifies your original photo files** by adding GPS data to their metadata (EXIF data). This means:

- ✅ **Your photos gain location information** that works with all photo apps
- ✅ **The image quality is not affected** - only metadata is changed
- ✅ **Photo apps can now show your photos on maps**
- ✅ **You can search and organize photos by location**

### Backup Recommendation

While the app includes safety features, it's always good practice to backup your photos before running any tool that modifies them.

## Understanding the Results

After processing, you'll see a detailed report showing:

- **Total photos processed**
- **How many already had GPS data**
- **How many got new GPS coordinates**
- **Success rate and performance statistics**
- **Any photos that couldn't be geolocated and why**

### Typical Success Rates

- **90-95% success rate** for photos taken during periods covered by your Google Maps timeline
- **Lower success rates** for photos taken when location services were off or in areas with poor GPS coverage

## Configuration Options

The app includes many customizable settings:

### Timeline Matching

- **Time tolerance:** How close in time a timeline record needs to be (default: 30 minutes)
- **Distance tolerance:** How close geographically records need to be
- **Fallback settings:** How aggressively to search for matches

### Performance Settings

- **Batch size:** How many photos to process at once (default: 25)
- **Memory limits:** Controls for large photo collections
- **Parallel processing:** Options for faster processing

### Safety Settings

- **Backup creation:** Whether to create backups before modifying files
- **Validation levels:** How strictly to validate GPS coordinates
- **Error handling:** How to handle problematic photos

## Troubleshooting Common Issues

### "No GPS data found for image"

- **Cause:** The photo was taken when you weren't tracking location, or outside your timeline coverage
- **Solution:** Check if you have Google Maps timeline data for that date

### "Timeline file not found"

- **Cause:** The Google Maps timeline export isn't in the expected location
- **Solution:** Make sure `data/Timeline Edits.json` exists and contains your location history

### "Processing is slow"

- **Cause:** Large photo collections or complex timeline data
- **Solution:** The app processes photos in batches - just let it run

### "Some photos couldn't be processed"

- **Cause:** Various reasons like corrupted files, missing timestamps, or no nearby location data
- **Solution:** Check the detailed report for specific reasons and solutions

## Privacy and Security

### Your Data Stays Local

- **All processing happens on your computer** - no data is sent to external servers
- **Your photos and location data never leave your device**
- **No internet connection required** after downloading your Google Maps data

### What Data Is Used

- **Photo timestamps** - When each photo was taken
- **Google Maps timeline** - Your location history from Google
- **Photo metadata** - Technical information about your photos

### What Data Is Created

- **GPS coordinates** added to photo metadata
- **Processing logs** for troubleshooting
- **Statistics reports** showing what was accomplished

## Advanced Features

### Diagnostic Tools

The app includes comprehensive diagnostic capabilities:

- **Timeline validation** - Checks your Google Maps data for issues
- **Performance monitoring** - Tracks processing speed and memory usage
- **Error analysis** - Detailed reporting of any problems
- **Health monitoring** - System status and recommendations

### Extensibility

The app is designed to be extensible:

- **Modular architecture** - Easy to add new features
- **Plugin system** - Support for additional data sources
- **API interfaces** - Can be integrated with other tools

### Batch Processing

For large photo collections:

- **Efficient memory usage** - Handles thousands of photos without running out of memory
- **Progress tracking** - Shows how much work is remaining
- **Resumable processing** - Can continue if interrupted

## Technical Details (For the Curious)

### How Location Matching Works

1. **Timestamp Normalization** - Converts photo timestamps to UTC for accurate comparison
2. **Timeline Parsing** - Extracts location records from Google Maps data
3. **Spatial-Temporal Matching** - Uses algorithms to find the best location match
4. **Coordinate Validation** - Ensures GPS coordinates are valid and reasonable
5. **Metadata Writing** - Safely adds GPS data to photo files

### File Format Support

- **JPEG/JPG** - Full support with EXIF metadata
- **TIFF** - Full support with EXIF metadata
- **RAW formats** - Limited support (CR3, NEF, etc.)
- **PNG** - Limited metadata support

### Performance Characteristics

- **Processing Speed** - Typically 1-2ms per photo
- **Memory Usage** - Efficient handling of large photo collections
- **Disk Usage** - Minimal temporary files, processes in-place

## Getting Help

### Log Files

The app creates detailed logs showing:

- **What photos were processed**
- **What GPS coordinates were added**
- **Any errors or warnings**
- **Performance statistics**

### Common Solutions

1. **Check your Google Maps timeline export** - Make sure it covers the dates of your photos
2. **Verify photo timestamps** - Photos need valid timestamps to be processed
3. **Review the processing report** - It shows exactly what happened and why
4. **Check file permissions** - The app needs to read photos and write GPS data

### Support Resources

- **Detailed error messages** - The app explains what went wrong and how to fix it
- **Comprehensive documentation** - Technical details for advanced users
- **Diagnostic tools** - Built-in troubleshooting capabilities

---

## Summary

The Image Geolocation Processor is a powerful but easy-to-use tool that automatically adds location information to your photos by matching them with your Google Maps location history. It uses intelligent algorithms to figure out where photos were taken, even when there's no exact match in your timeline data.

The result is a photo collection where every image has GPS coordinates, making it possible to view your photos on maps, search by location, and organize your memories geographically.
