// config.js - Centralized configuration
require('dotenv').config();
const path = require('path');
const os = require('os');

module.exports = {
    // Environment to S3 bucket mapping
    environments: {
        dev: process.env.S3_BUCKET_DEV,
        stage: process.env.S3_BUCKET_STAGE,
        prod: process.env.S3_BUCKET_PROD
    },

    // AWS configuration
    aws: {
        // Environment to region mapping
        regions: {
            dev: process.env.AWS_REGION_DEV || 'ap-south-1',
            stage: process.env.AWS_REGION_STAGE || 'eu-south-1',
            prod: process.env.AWS_REGION_PROD || 'eu-south-1'
        },
        profiles: process.env.AWS_PROFILES ? process.env.AWS_PROFILES.split(',') : ['dev', 'stage', 'prod', 'default']
    },

    // PostgreSQL configuration
    postgres: {
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT) || 5432
    },

    // Application settings
    app: {
        localTempDir: process.env.LOCAL_TEMP_DIR || path.join(os.tmpdir(), 'db-restore'),
        supportedFormats: ['.tar.gz', '.tar'],
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3
    },

    // DBeaver configuration with Ubuntu-specific settings
    dbeaver: {
        // Ubuntu-specific workspace detection paths
        ubuntuWorkspacePaths: [
            // Snap installation
            path.join(os.homedir(), 'snap', 'dbeaver-ce', 'current', '.local', 'share', 'DBeaverData'),
            path.join(os.homedir(), 'snap', 'dbeaver-ce', 'common', '.local', 'share', 'DBeaverData'),
            
            // Flatpak installation
            path.join(os.homedir(), '.var', 'app', 'io.dbeaver.DBeaverCommunity', 'data', 'DBeaverData'),
            path.join(os.homedir(), '.var', 'app', 'io.dbeaver.DBeaverCommunity', 'config', 'DBeaverData'),
            
            // Standard Linux paths
            path.join(os.homedir(), '.local', 'share', 'DBeaverData'),
            path.join(os.homedir(), '.dbeaver'),
            path.join(os.homedir(), '.config', 'dbeaver')
        ],
        
        // Folder naming preferences for Ubuntu
        ubuntuFolderNames: {
            local: "PostgreSQL - Local Restores",
            dev: "PostgreSQL - Development", 
            stage: "PostgreSQL - Staging",
            prod: "PostgreSQL - Production"
        },
        
        // Default folder names for other platforms
        defaultFolderNames: {
            local: "2.Postgres - LOCAL",
            dev: "Postgres - 1.DEV",
            stage: "Postgres - 2.STAGE", 
            prod: "Postgres - 3.PROD"
        },
        
        // Workspace detection settings
        workspaceVersions: ['workspace6', 'workspace5', 'workspace4', '.metadata'],
        configSubPaths: ['General/.dbeaver', '.dbeaver', ''],
        
        // Connection naming templates
        connectionNameTemplates: {
            local: '{dbName} [LOCAL] - Restored {date}',
            cloud: '{dbName} [{backupDate}] - Restored {date} ({env})'
        }
    }
};
