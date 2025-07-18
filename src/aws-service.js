const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const CONFIG = require('../config');

class AWSService {
    constructor() {
        this.s3 = null;
    }

    async initialize() {
        const credentials = new AWS.SharedIniFileCredentials({ profile: CONFIG.selectedProfile });
        AWS.config.credentials = credentials;
        const region = CONFIG.aws.regions[CONFIG.selectedEnvironment];
        if (!region) {
            throw new Error(`No AWS region configured for environment: ${CONFIG.selectedEnvironment}`);
        }
        AWS.config.region = region;
        this.s3 = new AWS.S3();
        await this.s3.headBucket({ Bucket: CONFIG.s3Bucket }).promise();
    }

    async listServices() {
        const params = { Bucket: CONFIG.s3Bucket, Delimiter: '/', Prefix: '' };
        const result = await this.s3.listObjectsV2(params).promise();
        return result.CommonPrefixes.map(p => p.Prefix.replace('/', '')).sort();
    }

    async listBackupFiles(serviceName) {
        const params = { Bucket: CONFIG.s3Bucket, Prefix: `${serviceName}/` };
        const result = await this.s3.listObjectsV2(params).promise();
        return result.Contents
            .filter(o => o.Key.endsWith('.tar.gz') || o.Key.endsWith('.tar') || o.Key.endsWith('.sql.gz'))
            .map(o => ({
                key: o.Key,
                filename: path.basename(o.Key),
                lastModified: o.LastModified,
                size: this.formatFileSize(o.Size)
            }))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    }

    async downloadBackup(key, destDir) {
        const filename = path.basename(key);
        const local = path.join(destDir, filename);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const data = await this.s3.getObject({ Bucket: CONFIG.s3Bucket, Key: key }).promise();
        fs.writeFileSync(local, data.Body);
        return local;
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = AWSService;
