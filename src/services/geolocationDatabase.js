/**
 * Geolocation Database Service
 * Manages GPS metadata storage with in-memory performance and optional SQLite persistence
 */

import fs from 'fs';
import path from 'path';
import { isValidCoordinatePair } from '../utils/coordinates.js';

/**
 * GPS data sources in priority order (highest to lowest)
 */
export const GPS_SOURCES = {
    DATABASE: 'DATABASE',           // From previous runs (highest priority)
    EXIF_GPS: 'EXIF_GPS',          // Direct from image EXIF
    TIMELINE_INTERPOLATED: 'TIMELINE_INTERPOLATED',  // Google Maps timeline
    NEARBY_INTERPOLATED: 'NEARBY_INTERPOLATED'       // Nearby images (lowest priority)
};

/**
 * GPS data confidence levels
 */
export const GPS_CONFIDENCE = {
    HIGH: 'HIGH',       // EXIF GPS data
    MEDIUM: 'MEDIUM',   // Timeline interpolation
    LOW: 'LOW'          // Nearby image interpolation
};

/**
 * Geolocation Database Service
 * Provides in-memory storage with optional SQLite persistence
 */
export class GeolocationDatabase {
    constructor(config = {}) {
        this.config = {
            enableSqlitePersistence: config.enableSqlitePersistence || false,
            sqliteDbPath: config.sqliteDbPath || 'data/geolocation.db',
            exportPath: config.exportPath || 'data/geolocation-export.json',
            validateCoordinates: config.validateCoordinates !== false,
            coordinateSystem: config.coordinateSystem || 'WGS84',
            ...config
        };
        
        // In-memory storage for performance
        this.records = new Map();
        this.statistics = {
            totalRecords: 0,
            sourceBreakdown: {
                [GPS_SOURCES.DATABASE]: 0,
                [GPS_SOURCES.EXIF_GPS]: 0,
                [GPS_SOURCES.TIMELINE_INTERPOLATED]: 0,
                [GPS_SOURCES.NEARBY_INTERPOLATED]: 0
            },
            lastUpdated: null
        };
        
        // SQLite database instance (lazy loaded)
        this.sqliteDb = null;
        this.isInitialized = false;
    }
    
    /**
     * Initialize the database service
     */
    async initialize() {
        try {
            console.log('🗄️  Initializing geolocation database...');
            
            // Ensure data directory exists
            const dataDir = path.dirname(this.config.exportPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // Load existing data from JSON export
            await this.loadFromJson();
            
            // Initialize SQLite if enabled
            if (this.config.enableSqlitePersistence) {
                await this.initializeSqlite();
            }
            
            this.isInitialized = true;
            console.log(`✅ Geolocation database initialized with ${this.records.size} existing records`);
            
        } catch (error) {
            console.error('❌ Failed to initialize geolocation database:', error.message);
            throw error;
        }
    }
    
    /**
     * Initialize SQLite database
     */
    async initializeSqlite() {
        try {
            // Dynamic import to handle optional dependency
            const Database = (await import('better-sqlite3')).default;
            
            // Ensure SQLite directory exists
            const sqliteDir = path.dirname(this.config.sqliteDbPath);
            if (!fs.existsSync(sqliteDir)) {
                fs.mkdirSync(sqliteDir, { recursive: true });
            }
            
            this.sqliteDb = new Database(this.config.sqliteDbPath);
            
            // Create table if it doesn't exist
            this.sqliteDb.exec(`
                CREATE TABLE IF NOT EXISTS gps_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    image_id TEXT UNIQUE NOT NULL,
                    file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    altitude REAL,
                    bearing REAL,
                    accuracy REAL,
                    timestamp TEXT NOT NULL,
                    coordinate_system TEXT NOT NULL DEFAULT 'WGS84',
                    source TEXT NOT NULL,
                    confidence TEXT NOT NULL,
                    interpolation_details TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            console.log('✅ SQLite database initialized');
            
        } catch (error) {
            console.warn('⚠️  SQLite initialization failed, continuing with in-memory only:', error.message);
            this.config.enableSqlitePersistence = false;
        }
    }
    
    /**
     * Load existing GPS data from JSON export
     */
    async loadFromJson() {
        try {
            if (!fs.existsSync(this.config.exportPath)) {
                console.log('📄 No existing geolocation export found, starting fresh');
                return;
            }
            
            const jsonData = JSON.parse(fs.readFileSync(this.config.exportPath, 'utf8'));
            
            if (jsonData.records && Array.isArray(jsonData.records)) {
                for (const record of jsonData.records) {
                    const gpsRecord = this.createGpsRecord(record);
                    if (gpsRecord) {
                        this.records.set(record.filePath, gpsRecord);
                        this.statistics.sourceBreakdown[GPS_SOURCES.DATABASE]++;
                    }
                }
                
                this.statistics.totalRecords = this.records.size;
                console.log(`📄 Loaded ${this.records.size} GPS records from existing export`);
            }
            
        } catch (error) {
            console.warn('⚠️  Failed to load existing GPS data:', error.message);
        }
    }
    
    /**
     * Store GPS data for an image
     * @param {string} filePath - Path to the image file
     * @param {Object} gpsData - GPS coordinates and metadata
     * @param {string} source - GPS data source
     * @param {Object} interpolationDetails - Additional details for interpolated data
     * @returns {boolean} Success status
     */
    async store(filePath, gpsData, source, interpolationDetails = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Database not initialized');
            }
            
            // Validate GPS data
            if (!this.validateGpsData(gpsData)) {
                throw new Error('Invalid GPS data provided');
            }
            
            // Create GPS record
            const gpsRecord = {
                imageId: this.generateImageId(filePath),
                filePath: path.resolve(filePath),
                fileName: path.basename(filePath),
                coordinates: {
                    latitude: gpsData.latitude,
                    longitude: gpsData.longitude,
                    altitude: gpsData.altitude || null,
                    bearing: gpsData.bearing || null,
                    accuracy: gpsData.accuracy || null
                },
                timestamp: gpsData.timestamp || new Date().toISOString(),
                coordinateSystem: this.config.coordinateSystem,
                source: source,
                confidence: this.getConfidenceLevel(source),
                interpolationDetails: interpolationDetails,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Store in memory
            this.records.set(filePath, gpsRecord);
            
            // Store in SQLite if enabled
            if (this.config.enableSqlitePersistence && this.sqliteDb) {
                await this.storeInSqlite(gpsRecord);
            }
            
            // Update statistics
            this.updateStatistics(source);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to store GPS data for ${filePath}:`, error.message);
            return false;
        }
    }
    
    /**
     * Retrieve GPS data for an image
     * @param {string} filePath - Path to the image file
     * @returns {Object|null} GPS record or null if not found
     */
    async getGpsData(filePath) {
        try {
            const resolvedPath = path.resolve(filePath);
            return this.records.get(resolvedPath) || null;
        } catch (error) {
            console.error(`❌ Failed to retrieve GPS data for ${filePath}:`, error.message);
            return null;
        }
    }
    
    /**
     * Check if GPS data exists for an image
     * @param {string} filePath - Path to the image file
     * @returns {boolean} True if GPS data exists
     */
    async hasGpsData(filePath) {
        const gpsData = await this.getGpsData(filePath);
        return gpsData !== null;
    }
    
    /**
     * Get all GPS records
     * @returns {Array} Array of GPS records
     */
    getAllRecords() {
        return Array.from(this.records.values());
    }
    
    /**
     * Get records by source
     * @param {string} source - GPS data source
     * @returns {Array} Array of GPS records from specified source
     */
    getRecordsBySource(source) {
        return this.getAllRecords().filter(record => record.source === source);
    }
    
    /**
     * Export GPS data to JSON file
     * @returns {boolean} Success status
     */
    async exportToJson() {
        try {
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    totalRecords: this.records.size,
                    sourceBreakdown: { ...this.statistics.sourceBreakdown },
                    coordinateSystem: this.config.coordinateSystem,
                    version: '1.0.0'
                },
                records: this.getAllRecords()
            };
            
            // Ensure directory exists
            const exportDir = path.dirname(this.config.exportPath);
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            // Write JSON file
            fs.writeFileSync(
                this.config.exportPath, 
                JSON.stringify(exportData, null, 2), 
                'utf8'
            );
            
            console.log(`📄 Exported ${this.records.size} GPS records to ${this.config.exportPath}`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to export GPS data to JSON:', error.message);
            return false;
        }
    }
    
    /**
     * Get database statistics
     * @returns {Object} Database statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            totalRecords: this.records.size,
            lastUpdated: new Date().toISOString()
        };
    }
    
    /**
     * Cleanup database resources
     */
    async cleanup() {
        try {
            if (this.sqliteDb) {
                this.sqliteDb.close();
                this.sqliteDb = null;
            }
            
            console.log('🗄️  Geolocation database cleanup completed');
            
        } catch (error) {
            console.error('❌ Database cleanup error:', error.message);
        }
    }
    
    // Private helper methods
    
    /**
     * Validate GPS data
     * @param {Object} gpsData - GPS data to validate
     * @returns {boolean} True if valid
     */
    validateGpsData(gpsData) {
        if (!gpsData || typeof gpsData !== 'object') {
            return false;
        }
        
        if (!this.config.validateCoordinates) {
            return true;
        }
        
        return isValidCoordinatePair(gpsData.latitude, gpsData.longitude);
    }
    
    /**
     * Generate unique image ID
     * @param {string} filePath - Path to the image file
     * @returns {string} Unique image ID
     */
    generateImageId(filePath) {
        const fileName = path.basename(filePath);
        const hash = this.simpleHash(filePath);
        return `${fileName}_${hash}`;
    }
    
    /**
     * Simple hash function for generating IDs
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Get confidence level based on GPS source
     * @param {string} source - GPS data source
     * @returns {string} Confidence level
     */
    getConfidenceLevel(source) {
        switch (source) {
            case GPS_SOURCES.EXIF_GPS:
                return GPS_CONFIDENCE.HIGH;
            case GPS_SOURCES.TIMELINE_INTERPOLATED:
                return GPS_CONFIDENCE.MEDIUM;
            case GPS_SOURCES.NEARBY_INTERPOLATED:
                return GPS_CONFIDENCE.LOW;
            default:
                return GPS_CONFIDENCE.MEDIUM;
        }
    }
    
    /**
     * Create GPS record from raw data
     * @param {Object} rawData - Raw GPS data
     * @returns {Object|null} GPS record or null if invalid
     */
    createGpsRecord(rawData) {
        try {
            if (!this.validateGpsData(rawData.coordinates)) {
                return null;
            }
            
            return {
                imageId: rawData.imageId,
                filePath: rawData.filePath,
                fileName: rawData.fileName,
                coordinates: rawData.coordinates,
                timestamp: rawData.timestamp,
                coordinateSystem: rawData.coordinateSystem || this.config.coordinateSystem,
                source: rawData.source,
                confidence: rawData.confidence,
                interpolationDetails: rawData.interpolationDetails || null,
                createdAt: rawData.createdAt || new Date().toISOString(),
                updatedAt: rawData.updatedAt || new Date().toISOString()
            };
        } catch (error) {
            console.warn('⚠️  Failed to create GPS record:', error.message);
            return null;
        }
    }
    
    /**
     * Store GPS record in SQLite
     * @param {Object} gpsRecord - GPS record to store
     */
    async storeInSqlite(gpsRecord) {
        try {
            const stmt = this.sqliteDb.prepare(`
                INSERT OR REPLACE INTO gps_records (
                    image_id, file_path, file_name, latitude, longitude, altitude, 
                    bearing, accuracy, timestamp, coordinate_system, source, confidence,
                    interpolation_details, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                gpsRecord.imageId,
                gpsRecord.filePath,
                gpsRecord.fileName,
                gpsRecord.coordinates.latitude,
                gpsRecord.coordinates.longitude,
                gpsRecord.coordinates.altitude,
                gpsRecord.coordinates.bearing,
                gpsRecord.coordinates.accuracy,
                gpsRecord.timestamp,
                gpsRecord.coordinateSystem,
                gpsRecord.source,
                gpsRecord.confidence,
                JSON.stringify(gpsRecord.interpolationDetails),
                gpsRecord.createdAt,
                gpsRecord.updatedAt
            );
            
        } catch (error) {
            console.error('❌ SQLite storage error:', error.message);
        }
    }
    
    /**
     * Update statistics
     * @param {string} source - GPS data source
     */
    updateStatistics(source) {
        if (this.statistics.sourceBreakdown[source] !== undefined) {
            this.statistics.sourceBreakdown[source]++;
        }
        this.statistics.totalRecords = this.records.size;
        this.statistics.lastUpdated = new Date().toISOString();
    }
}

/**
 * Create and initialize geolocation database instance
 * @param {Object} config - Database configuration
 * @returns {GeolocationDatabase} Initialized database instance
 */
export async function createGeolocationDatabase(config = {}) {
    const database = new GeolocationDatabase(config);
    await database.initialize();
    return database;
}
