// config.js - Centralized configuration
require('dotenv').config();

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
        localTempDir: process.env.LOCAL_TEMP_DIR || require('path').join(require('os').tmpdir(), 'db-restore'),
        supportedFormats: ['.tar.gz', '.tar'],
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3
    }
};
