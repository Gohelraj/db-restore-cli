const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const { fromIni } = require('@aws-sdk/credential-provider-ini');
const CONFIG = require('../config');

class AWSService {
    constructor() {
        this.s3 = null;
    }

    /**
     * Trigger AWS SSO login for the given profile
     */
    async triggerSSOLogin(profile) {
        console.log(`\n🔐 SSO session expired or not found for profile "${profile}"`);
        console.log(`🌐 Opening browser for SSO authentication...\n`);

        try {
            // Use spawnSync with stdio: 'inherit' to allow interactive browser auth
            const result = spawnSync('aws', ['sso', 'login', '--profile', profile], {
                stdio: 'inherit',
                shell: true
            });

            if (result.status !== 0) {
                throw new Error(`SSO login failed with exit code ${result.status}`);
            }

            console.log(`\n✅ SSO login successful for profile "${profile}"`);
            return true;
        } catch (error) {
            throw new Error(`SSO login failed: ${error.message}`);
        }
    }

    async initialize() {
        const region = CONFIG.aws.regions[CONFIG.selectedEnvironment];
        if (!region) {
            throw new Error(`No AWS region configured for environment: ${CONFIG.selectedEnvironment}`);
        }

        const profile = CONFIG.selectedProfile;

        // Try SSO credentials first, fall back to INI file credentials
        let credentials;
        try {
            credentials = fromSSO({ profile });
            // Test if SSO credentials work
            await credentials();
        } catch (ssoError) {
            // Check if this is an SSO profile by looking at the config
            const isSSO = this.isProfileSSO(profile);

            if (isSSO) {
                // Automatically trigger SSO login
                await this.triggerSSOLogin(profile);

                // Retry SSO credentials after login
                try {
                    credentials = fromSSO({ profile });
                    await credentials();
                } catch (retryError) {
                    throw new Error(`SSO authentication failed after login attempt: ${retryError.message}`);
                }
            } else {
                // Try standard INI credentials for non-SSO profiles
                console.log(`⚠️  SSO credentials not available for profile "${profile}", trying standard credentials...`);
                try {
                    credentials = fromIni({ profile });
                    await credentials();
                } catch (iniError) {
                    throw new Error(
                        `Failed to load AWS credentials for profile "${profile}".\n` +
                        `Ensure profile exists in ~/.aws/credentials or ~/.aws/config`
                    );
                }
            }
        }

        this.s3 = new S3Client({
            region,
            credentials
        });

        // Verify bucket access
        await this.s3.send(new HeadBucketCommand({ Bucket: CONFIG.s3Bucket }));
    }

    /**
     * Check if a profile is configured for SSO
     */
    isProfileSSO(profile) {
        try {
            const homeDir = require('os').homedir();
            const configPath = path.join(homeDir, '.aws', 'config');

            if (!fs.existsSync(configPath)) {
                return false;
            }

            const configContent = fs.readFileSync(configPath, 'utf8');

            // Find the profile section and check for sso_start_url
            const profileRegex = new RegExp(`\\[profile ${profile}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
            const match = configContent.match(profileRegex);

            if (match) {
                return match[1].includes('sso_start_url') || match[1].includes('sso_session');
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    async listServices() {
        const command = new ListObjectsV2Command({
            Bucket: CONFIG.s3Bucket,
            Delimiter: '/',
            Prefix: ''
        });
        const result = await this.s3.send(command);
        return (result.CommonPrefixes || []).map(p => p.Prefix.replace('/', '')).sort();
    }

    async listBackupFiles(serviceName) {
        const command = new ListObjectsV2Command({
            Bucket: CONFIG.s3Bucket,
            Prefix: `${serviceName}/`
        });
        const result = await this.s3.send(command);
        return (result.Contents || [])
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
        const command = new GetObjectCommand({ Bucket: CONFIG.s3Bucket, Key: key });
        const response = await this.s3.send(command);

        // Stream directly to file instead of loading into memory
        const writeStream = fs.createWriteStream(local);
        
        return new Promise((resolve, reject) => {
            response.Body.pipe(writeStream)
                .on('error', reject)
                .on('finish', () => resolve(local));
        });
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = AWSService;
