# Image Geolocation Processing System Architecture

## System Overview

This Node.js application processes image geolocation using Google Maps timeline data and temporal interpolation through a two-phase processing system.

## Architecture Diagram

```mermaid
flowchart TD
    A[User Input: Target Directory] --> B[Directory Validation]
    B --> C[Phase 1: Image Discovery & EXIF Extraction]
    
    C --> D[Recursive Directory Traversal]
    D --> E[Image File Detection]
    E --> F[EXIF Metadata Extraction using Sharp]
    F --> G[Image Index Creation]
    
    G --> H[Phase 2: Geolocation Inference]
    H --> I[Filter Images Without GPS]
    I --> J[Validate Timestamps > Unix Epoch]
    
    J --> K[Primary Interpolation: Timeline Data]
    K --> L[Load Google Maps Timeline JSON]
    L --> M[Parse Position Records with Timestamps]
    M --> N[Timezone Handling & Conversion]
    N --> O[30-minute Tolerance Matching]
    
    O --> P{Timeline Match Found?}
    P -->|Yes| Q[Extract Coordinates from Timeline]
    P -->|No| R[Secondary Interpolation: Nearby Images]
    
    R --> S[Find Images within 2km & 4-hour Window]
    S --> T[Calculate Temporal & Spatial Distances]
    T --> U[Weighted Interpolation Algorithm]
    U --> V{Coordinates Calculated?}
    
    Q --> W[Write GPS Coordinates to EXIF]
    V -->|Yes| W
    V -->|No| X[Log Failed Interpolation]
    
    W --> Y[Update Statistics]
    X --> Y
    Y --> Z[Generate Completion Report]
    
    subgraph "Core Services"
        AA[Coordinate Conversion Utils]
        BB[Distance Calculation Utils]
        CC[Timezone Service]
        DD[Error Handling Service]
        EE[Memory Management]
        FF[Progress Logging]
    end
    
    subgraph "Data Structures"
        GG[Image Index: Map<filepath, metadata>]
        HH[Timeline Position Records]
        II[Processing Statistics]
    end
```

## Key Components

### Phase 1: Image Discovery & EXIF Extraction
- **Directory Traversal**: Recursive scanning for image files
- **Format Support**: JPEG, TIFF, PNG, RAW formats via Sharp library
- **Metadata Extraction**: Complete EXIF data extraction and indexing
- **Memory Management**: Efficient handling of large image collections

### Phase 2: Geolocation Inference
- **Primary Method**: Google Maps timeline interpolation with 30-minute tolerance
- **Secondary Method**: Nearby image interpolation within 2km radius and 4-hour window
- **Weighted Algorithm**: Temporal and spatial distance-based coordinate calculation

### Core Services
- **Coordinate Conversion**: E7 format to decimal degrees conversion
- **Distance Calculations**: Haversine formula for spatial proximity
- **Timezone Handling**: EXIF timezone extraction with system fallback
- **Error Handling**: Comprehensive I/O and parsing error management

## Data Flow

1. **Input Validation**: Verify target directory exists and is accessible
2. **Image Indexing**: Create comprehensive metadata index of all images
3. **Timeline Processing**: Parse Google Maps data and extract position records
4. **Interpolation Logic**: Apply dual fallback mechanism for coordinate inference
5. **EXIF Writing**: Inject calculated GPS coordinates back to image files
6. **Statistics Reporting**: Generate detailed completion statistics

## Technical Specifications

- **Language**: Modern JavaScript with ES modules
- **Dependencies**: Sharp (image processing), readline-sync (user input)
- **Architecture**: Modular service-oriented design
- **Error Handling**: Comprehensive try-catch with detailed logging
- **Performance**: Memory-efficient processing for large image collections
- **Validation**: Unix epoch timestamp and coordinate bounds checking
