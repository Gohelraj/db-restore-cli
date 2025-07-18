const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const keypress = require('keypress');
const AWS = require('aws-sdk');
const os = require('os');
const crypto = require('crypto');

const CONFIG = require('../config.js');
const PlatformUtils = require('./platform-utils');
const AWSService = require('./aws-service');
const DBeaverManager = require('./dbeaver');

// Extend CONFIG with runtime properties
Object.assign(CONFIG, {
    selectedProfile: null,
    selectedEnvironment: null,
    s3Bucket: null,
    sourceType: null, // 'cloud' or 'local'
    localDumpFile: null,
    dbeaver: {
        workspaceDir: null,
        dataSourcesFile: null,
        credentialsFile: null,
        autoDetect: true
    }
});

// Configure readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Enable keypress for navigation
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

class DatabaseRestoreManager {
    constructor() {
        this.s3 = null;
        this.selectedService = null;
        this.selectedBackup = null;
        this.targetDatabase = null;
        this.createNewDB = false;
        this.replaceExisting = false;
        this.skipDBeaver = false;
        this.sourceType = null;
        this.localDumpPath = null;
        this.extractedDbFile = null;
        this.cleanupDone = false;
        this.awsService = new AWSService();
        this.dbeaverManager = new DBeaverManager();
    }

    async selectSourceType() {
        try {
            const options = [
                'Cloud (AWS S3) - Restore from S3 backup storage',
                'Local File - Restore from local dump file'
            ];

            const selectedIndex = await this.selectFromMenu(
                '📁 Database Restoration Source',
                options
            );

            const sourceTypes = ['cloud', 'local'];
            this.sourceType = sourceTypes[selectedIndex];
            CONFIG.sourceType = this.sourceType;

            console.log(`\n✅ Selected: ${options[selectedIndex]}`);
            return this.sourceType;

        } catch (error) {
            throw new Error(`Source selection failed: ${error.message}`);
        }
    }

    async selectLocalDumpFile() {
        try {
            console.log('\n📂 Local Dump File Selection');
            console.log('============================');
            console.log('Supported formats:');
            console.log('• .sql - Plain SQL dump');
            console.log('• .tar.gz - Compressed tar archive');
            console.log('• .gz - Gzipped SQL dump');
            console.log('• .tar - Tar archive');
            console.log('• .dump - Custom PostgreSQL dump');
            console.log('');

            const dumpPath = await this.prompt('Enter path to dump file: ');

            if (!dumpPath.trim()) {
                throw new Error('Dump file path is required');
            }

            // Normalize the path for the current platform
            let resolvedPath = dumpPath.trim();

            // Remove surrounding quotes if present (common on Windows)
            if ((resolvedPath.startsWith('"') && resolvedPath.endsWith('"')) ||
                (resolvedPath.startsWith("'") && resolvedPath.endsWith("'"))) {
                resolvedPath = resolvedPath.slice(1, -1);
            }

            // If it's already an absolute path, use it as-is, otherwise resolve it
            if (path.isAbsolute(resolvedPath)) {
                // On Windows, normalize the path separators
                if (PlatformUtils.isWindows()) {
                    resolvedPath = path.normalize(resolvedPath);
                }
            } else {
                resolvedPath = path.resolve(resolvedPath);
            }

            // Check if file exists
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`File not found: ${resolvedPath}`);
            }

            // Check file size
            const stats = fs.statSync(resolvedPath);
            if (stats.size === 0) {
                throw new Error('Dump file is empty');
            }

            // Validate file extension
            const ext = path.extname(resolvedPath).toLowerCase();
            const validExtensions = ['.sql', '.tar.gz', '.gz', '.tar', '.dump'];
            const isValidExtension = validExtensions.some(validExt =>
                resolvedPath.toLowerCase().endsWith(validExt)
            );

            if (!isValidExtension) {
                console.warn('⚠️  Warning: Unrecognized file extension. Supported: .sql, .tar.gz, .gz, .tar, .dump');
                const continueChoice = await this.prompt('Continue anyway? (y/n): ');
                if (continueChoice.toLowerCase() !== 'y') {
                    throw new Error('Operation cancelled');
                }
            }

            this.localDumpPath = resolvedPath;
            CONFIG.localDumpFile = resolvedPath;

            console.log(`✅ Selected dump file: ${resolvedPath}`);
            console.log(`📏 File size: ${this.formatFileSize(stats.size)}`);
            console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);

            // Create mock backup object for compatibility with existing code
            this.selectedBackup = {
                filename: path.basename(resolvedPath),
                size: this.formatFileSize(stats.size),
                lastModified: stats.mtime,
                key: resolvedPath, // Use full path as key for local files
                isLocal: true
            };

            return resolvedPath;

        } catch (error) {
            throw new Error(`Local dump file selection failed: ${error.message}`);
        }
    }


    // NE
    getServiceFromLocalFile(filename) {
        // Try to extract service name from filename
        // Common patterns: service-name-date.extension, service_name_date.extension
        const baseName = path.basename(filename, path.extname(filename));

        // Remove common date patterns
        let serviceName = baseName
            .replace(/[-_]\d{4}[-_]\d{2}[-_]\d{2}.*$/, '') // Remove date suffix
            .replace(/[-_]\d{8}.*$/, '') // Remove 8-digit date
            .replace(/[-_]\d{14}.*$/, '') // Remove timestamp
            .replace(/\.tar$/, '') // Remove .tar if it's .tar.gz
            .replace(/[-_]backup.*$/, '') // Remove backup suffix
            .replace(/[-_]dump.*$/, ''); // Remove dump suffix

        return serviceName || 'unknown_service';
    }

    async processLocalDumpFile(dumpPath) {
        try {
            console.log('\n🔄 Processing local dump file...');

            const filename = path.basename(dumpPath);
            const tempDir = CONFIG.app.localTempDir;

            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // First, detect what we're working with
            const initialFormat = this.detectDumpFormat(dumpPath);
            console.log(`🔍 Initial format detection: ${initialFormat}`);

            // Determine if extraction is needed
            if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
                console.log('📦 Extracting .tar.gz archive...');
                return await this.extractTarGz(dumpPath, tempDir);

            } else if (filename.endsWith('.tar')) {
                console.log('📦 Extracting .tar archive...');
                return await this.extractTar(dumpPath, tempDir);

            } else if (filename.endsWith('.gz') && !filename.endsWith('.tar.gz')) {
                console.log('📦 Extracting .gz file...');
                return await this.extractGz(dumpPath, tempDir);

            } else if (filename.endsWith('.sql') || filename.endsWith('.dump') || initialFormat === 'custom') {
                console.log('📄 Using dump file directly...');
                return dumpPath; // Use file directly

            } else {
                console.log('📄 Treating as raw dump file...');
                // Try to determine if it's actually compressed
                const buffer = Buffer.alloc(10);
                const fd = fs.openSync(dumpPath, 'r');
                fs.readSync(fd, buffer, 0, 10, 0);
                fs.closeSync(fd);

                // Check for gzip magic number
                if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
                    console.log('🔍 Detected gzip compression, extracting...');
                    return await this.extractGz(dumpPath, tempDir);
                }

                return dumpPath; // Use as-is
            }

        } catch (error) {
            throw new Error(`Failed to process local dump file: ${error.message}`);
        }
    }



    async extractTarGz(tarGzPath, extractDir) {
        try {
            const tarCmd = PlatformUtils.getTarCommand();

            let extractCommand;
            if (tarCmd === '7z') {
                // 7-Zip command for Windows - use proper Windows path quoting
                const normalizedInput = path.resolve(tarGzPath);
                const normalizedOutput = path.resolve(extractDir);
                extractCommand = `7z x ${PlatformUtils.escapeShellArg(normalizedInput)} -so | 7z x -aoa -si -ttar -o${PlatformUtils.escapeShellArg(normalizedOutput)}`;
            } else {
                // Standard tar command - use absolute paths with proper escaping
                const absoluteTarPath = path.resolve(tarGzPath);
                const absoluteExtractDir = path.resolve(extractDir);

                if (PlatformUtils.isWindows()) {
                    // Use tar directly with absolute paths instead of cd
                    extractCommand = `${tarCmd} -xzf ${PlatformUtils.escapeShellArg(absoluteTarPath)} -C ${PlatformUtils.escapeShellArg(absoluteExtractDir)}`;
                } else {
                    extractCommand = `cd ${PlatformUtils.escapeShellArg(absoluteExtractDir)} && ${tarCmd} -xzf ${PlatformUtils.escapeShellArg(absoluteTarPath)}`;
                }
            }

            console.log(`Executing: ${extractCommand}`);
            execSync(extractCommand, { stdio: 'inherit' });

            // Find the extracted .sql file
            return this.findExtractedSqlFile(extractDir);

        } catch (error) {
            throw new Error(`Failed to extract .tar.gz: ${error.message}`);
        }
    }

    async extractTar(tarPath, extractDir) {
        try {
            const tarCmd = PlatformUtils.getTarCommand();

            let extractCommand;
            if (tarCmd === '7z') {
                // 7-Zip command for Windows - use proper Windows path quoting
                const normalizedInput = path.resolve(tarPath);
                const normalizedOutput = path.resolve(extractDir);
                extractCommand = `7z x ${PlatformUtils.escapeShellArg(normalizedInput)} -o${PlatformUtils.escapeShellArg(normalizedOutput)}`;
            } else {
                // Standard tar command - use absolute paths with proper escaping
                const absoluteTarPath = path.resolve(tarPath);
                const absoluteExtractDir = path.resolve(extractDir);

                if (PlatformUtils.isWindows()) {
                    // Use tar directly with absolute paths instead of cd
                    extractCommand = `${tarCmd} -xf ${PlatformUtils.escapeShellArg(absoluteTarPath)} -C ${PlatformUtils.escapeShellArg(absoluteExtractDir)}`;
                } else {
                    extractCommand = `cd ${PlatformUtils.escapeShellArg(absoluteExtractDir)} && ${tarCmd} -xf ${PlatformUtils.escapeShellArg(absoluteTarPath)}`;
                }
            }

            console.log(`Executing: ${extractCommand}`);
            execSync(extractCommand, { stdio: 'inherit' });

            // Find the extracted .sql file
            return this.findExtractedSqlFile(extractDir);

        } catch (error) {
            throw new Error(`Failed to extract .tar: ${error.message}`);
        }
    }

    async extractGz(gzPath, extractDir) {
        try {
            let filename = path.basename(gzPath, '.gz');

            // If the filename doesn't have an extension, add .sql
            if (!path.extname(filename)) {
                filename += '.sql';
            }

            const outputPath = path.join(extractDir, filename);
            const extractCommand = PlatformUtils.getGunzipCommand(gzPath, outputPath);

            console.log(`🔧 Executing: ${extractCommand}`);
            execSync(extractCommand, { stdio: 'inherit' });

            // Verify the extracted file exists and has content
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`✅ Extracted file: ${filename} (${this.formatFileSize(stats.size)})`);
                return outputPath;
            } else {
                throw new Error('Extraction completed but file not found');
            }

        } catch (error) {
            throw new Error(`Failed to extract .gz: ${error.message}`);
        }
    }

    findExtractedSqlFile(directory) {
        try {
            const files = fs.readdirSync(directory);

            // Look for .sql files first
            const sqlFiles = files.filter(file =>
                file.endsWith('.sql') || file.endsWith('.dump')
            );

            if (sqlFiles.length === 0) {
                throw new Error('No .sql or .dump files found in extracted archive');
            }

            if (sqlFiles.length === 1) {
                const sqlFile = path.join(directory, sqlFiles[0]);
                console.log(`✅ Found SQL file: ${sqlFiles[0]}`);
                return sqlFile;
            }

            // Multiple SQL files found, let user choose
            console.log('\n📋 Multiple SQL files found:');
            sqlFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${file}`);
            });

            // For automated selection, choose the largest file
            let largestFile = sqlFiles[0];
            let largestSize = 0;

            sqlFiles.forEach(file => {
                const filePath = path.join(directory, file);
                const stats = fs.statSync(filePath);
                if (stats.size > largestSize) {
                    largestSize = stats.size;
                    largestFile = file;
                }
            });

            const selectedFile = path.join(directory, largestFile);
            console.log(`✅ Auto-selected largest file: ${largestFile} (${this.formatFileSize(largestSize)})`);
            return selectedFile;

        } catch (error) {
            throw new Error(`Failed to find SQL file: ${error.message}`);
        }
    }

    generateDatabaseNameForLocal() {
        const serviceName = this.getServiceFromLocalFile(this.selectedBackup.filename);
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        return `${serviceName}_local_${timestamp}`;
    }

    // Enhanced navigation system with keyboard controls
    async selectFromMenu(title, options, description = '') {
        return new Promise((resolve, reject) => {
            let currentIndex = 0;
            const maxIndex = options.length - 1;

            // Ensure we're in raw mode for keyboard navigation
            if (!process.stdin.isRaw) {
                process.stdin.setRawMode(true);
            }

            const displayMenu = () => {
                console.clear();
                console.log(`\n${title}`);
                console.log('='.repeat(title.length));

                if (description) {
                    console.log(description);
                    console.log('');
                }

                options.forEach((option, index) => {
                    const marker = index === currentIndex ? '▶ ' : '  ';
                    const highlight = index === currentIndex ? '\x1b[36m' : '';
                    const reset = index === currentIndex ? '\x1b[0m' : '';
                    console.log(`${highlight}${marker}${index + 1}. ${option}${reset}`);
                });

                console.log('\n📋 Navigation: ↑/↓ Arrow keys, Enter to select, Ctrl+C to exit');
            };

            const onKeyPress = (ch, key) => {
                if (!key) return;

                switch (key.name) {
                    case 'up':
                        currentIndex = currentIndex > 0 ? currentIndex - 1 : maxIndex;
                        displayMenu();
                        break;

                    case 'down':
                        currentIndex = currentIndex < maxIndex ? currentIndex + 1 : 0;
                        displayMenu();
                        break;

                    case 'return':
                        process.stdin.removeListener('keypress', onKeyPress);
                        resolve(currentIndex);
                        break;

                    case 'c':
                        if (key.ctrl) {
                            process.stdin.removeListener('keypress', onKeyPress);
                            process.stdin.setRawMode(false);
                            console.log('\n❌ Operation cancelled by user');
                            process.exit(0);
                        }
                        break;
                }
            };

            displayMenu();
            process.stdin.on('keypress', onKeyPress);
        });
    }

    // Simple text input for when keyboard navigation isn't needed
    async prompt(question) {
        return new Promise((resolve) => {
            // Temporarily disable raw mode for text input
            process.stdin.setRawMode(false);
            rl.question(question, (answer) => {
                process.stdin.setRawMode(true);
                resolve(answer.trim());
            });
        });
    }

    // List available AWS profiles
    async getAvailableProfiles() {
        try {
            const homeDir = require('os').homedir();
            const credentialsPath = path.join(homeDir, '.aws', 'credentials');
            const configPath = path.join(homeDir, '.aws', 'config');

            const profiles = new Set();

            // Check credentials file
            if (fs.existsSync(credentialsPath)) {
                const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
                const credentialMatches = credentialsContent.match(/^\[([^\]]+)\]/gm);
                if (credentialMatches) {
                    credentialMatches.forEach(match => {
                        const profile = match.replace(/^\[|\]$/g, '');
                        if (profile !== 'default') {
                            profiles.add(profile);
                        }
                    });
                }
            }

            // Check config file
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const configMatches = configContent.match(/^\[profile ([^\]]+)\]/gm);
                if (configMatches) {
                    configMatches.forEach(match => {
                        const profile = match.replace(/^\[profile |\]$/g, '');
                        profiles.add(profile);
                    });
                }
            }

            // Add default profile if credentials exist
            if (fs.existsSync(credentialsPath)) {
                const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
                if (credentialsContent.includes('[default]')) {
                    profiles.add('default');
                }
            }

            return Array.from(profiles);
        } catch (error) {
            console.warn('Warning: Could not read AWS profiles, using predefined list');
            return CONFIG.aws.profiles;
        }
    }

    // Select AWS profile and environment
    async selectProfileAndEnvironment() {
        try {
            const availableProfiles = await this.getAvailableProfiles();

            if (availableProfiles.length === 0) {
                throw new Error('No AWS profiles found. Please configure AWS CLI first.');
            }

            // Select AWS Profile
            const profileIndex = await this.selectFromMenu(
                '🔧 AWS Profile Selection',
                availableProfiles
            );

            CONFIG.selectedProfile = availableProfiles[profileIndex];
            console.log(`\n✅ Selected AWS profile: ${CONFIG.selectedProfile}`);

            // Select Environment
            const environments = Object.keys(CONFIG.environments);
            const envOptions = environments.map(env =>
                `${env.toUpperCase()} (${CONFIG.environments[env]})`
            );

            const envIndex = await this.selectFromMenu(
                '🌍 Environment Selection',
                envOptions
            );

            CONFIG.selectedEnvironment = environments[envIndex];
            CONFIG.s3Bucket = CONFIG.environments[CONFIG.selectedEnvironment];

            console.log(`\n✅ Selected environment: ${CONFIG.selectedEnvironment.toUpperCase()}`);
            console.log(`✅ S3 bucket: ${CONFIG.s3Bucket}`);

        } catch (error) {
            throw new Error(`Profile/Environment selection failed: ${error.message}`);
        }
    }

    // Initialize AWS S3 client with selected profile
    async initializeS3() {
        await this.awsService.initialize();
        this.s3 = this.awsService.s3;
    }

    // List all services (directories) in S3
    async listServices() {
        return this.awsService.listServices();
    }

    // List backup files for a specific service
    async listBackupFiles(serviceName) {
        return this.awsService.listBackupFiles(serviceName);
    }

    // Format file size in human readable format
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Format date for display
    formatDate(date) {
        return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
    }

    // Download backup file from S3
    async downloadBackupFile(s3Key) {
        return this.awsService.downloadBackup(s3Key, CONFIG.app.localTempDir);
    }

    // Handle direct compressed SQL files
    async handleCompressedFile(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const baseName = path.basename(filePath, ext);

            console.log(`\n🔍 Checking file format: ${ext}`);

            if (ext === '.gz' && !filePath.endsWith('.tar.gz')) {
                console.log('📦 Detected compressed SQL file, extracting...');

                const extractedPath = path.join(CONFIG.app.localTempDir, 'extracted', baseName);

                const extractDir = path.dirname(extractedPath);
                if (!fs.existsSync(extractDir)) {
                    fs.mkdirSync(extractDir, { recursive: true });
                }

                const extractCommand = PlatformUtils.getGunzipCommand(filePath, extractedPath);
                execSync(extractCommand, { stdio: 'pipe' });

                return {
                    path: extractedPath,
                    format: baseName.endsWith('.sql') ? 'sql' : 'custom',
                    priority: 1,
                    size: fs.statSync(extractedPath).size
                };
            }

            return null;
        } catch (error) {
            console.warn(`Warning: Could not handle compressed file: ${error.message}`);
            return null;
        }
    }

    // List directory contents recursively
    listDirectoryContents(dir, prefix = '') {
        try {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    console.log(`${prefix}📁 ${item}/`);
                    this.listDirectoryContents(fullPath, prefix + '  ');
                } else {
                    const size = this.formatFileSize(stat.size);
                    console.log(`${prefix}📄 ${item} (${size})`);
                }
            });
        } catch (error) {
            console.log(`${prefix}❌ Error reading directory: ${error.message}`);
        }
    }

    // Get all files recursively
    getAllFiles(dir) {
        let files = [];

        try {
            const items = fs.readdirSync(dir);

            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    files = files.concat(this.getAllFiles(fullPath));
                } else {
                    files.push(fullPath);
                }
            });
        } catch (error) {
            console.error(`Error getting files: ${error.message}`);
        }

        return files;
    }

    // Recursively search for database files
    searchForDatabaseFile(dir) {
        try {
            const items = fs.readdirSync(dir);

            const supportedFormats = [
                { ext: '.sql', format: 'sql', priority: 1 },
                { ext: '.dump', format: 'custom', priority: 2 },
                { ext: '.dmp', format: 'custom', priority: 3 },
                { ext: '.pg_dump', format: 'custom', priority: 4 },
                { ext: '.backup', format: 'custom', priority: 5 },
                { ext: '.bak', format: 'custom', priority: 6 }
            ];

            let foundFiles = [];

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    const subResult = this.searchForDatabaseFile(fullPath);
                    if (subResult) {
                        foundFiles.push(subResult);
                    }
                } else {
                    for (const format of supportedFormats) {
                        if (item.toLowerCase().endsWith(format.ext)) {
                            foundFiles.push({
                                path: fullPath,
                                format: format.format,
                                priority: format.priority,
                                size: stat.size
                            });
                            break;
                        }
                    }
                }
            }

            if (foundFiles.length > 0) {
                return foundFiles.sort((a, b) => a.priority - b.priority)[0];
            }

            return null;
        } catch (error) {
            console.error(`Error searching for database files: ${error.message}`);
            return null;
        }
    }

    // Find database files
    findDatabaseFile(dir) {
        return this.searchForDatabaseFile(dir);
    }

    // Find binary dumps
    findBinaryDump(dir) {
        try {
            const allFiles = this.getAllFiles(dir);

            for (const filePath of allFiles) {
                const fileName = path.basename(filePath);
                const stat = fs.statSync(filePath);

                if (!fileName.includes('.') && stat.size > 1024) {
                    try {
                        const buffer = fs.readFileSync(filePath, { start: 0, end: 5 });
                        const magic = buffer.toString();

                        if (magic.includes('PGDMP')) {
                            return {
                                path: filePath,
                                format: 'custom',
                                priority: 2,
                                size: stat.size
                            };
                        }
                    } catch (error) {
                        // Ignore read errors, continue checking
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn(`Warning: Error checking for binary dumps: ${error.message}`);
            return null;
        }
    }

    // Find any file that might be a database dump
    findAnyDatabaseFile(dir) {
        try {
            const allFiles = this.getAllFiles(dir);

            const dbPatterns = [
                /database/i,
                /backup/i,
                /dump/i,
                /\.db$/i,
                /\.bak$/i,
                /postgres/i,
                /pg_/i
            ];

            for (const filePath of allFiles) {
                const fileName = path.basename(filePath);
                const stat = fs.statSync(filePath);

                for (const pattern of dbPatterns) {
                    if (pattern.test(fileName) && stat.size > 0) {
                        return {
                            path: filePath,
                            format: 'unknown',
                            priority: 10,
                            size: stat.size
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.warn(`Warning: Error checking for database files: ${error.message}`);
            return null;
        }
    }

    // Extract backup file and handle various formats
    async extractBackupFile(filePath) {
        try {
            const extractDir = path.join(CONFIG.app.localTempDir, 'extracted');

            console.log('\n📦 Analyzing backup file...');

            if (fs.existsSync(extractDir)) {
                execSync(`rm -rf "${extractDir}"`);
            }
            fs.mkdirSync(extractDir, { recursive: true });

            const compressedResult = await this.handleCompressedFile(filePath);
            if (compressedResult) {
                return compressedResult;
            }

            console.log('📦 Extracting tar archive...');

            const isGzipped = filePath.endsWith('.gz');
            const extractCommand = isGzipped
                ? `tar -xzf "${filePath}" -C "${extractDir}"`
                : `tar -xf "${filePath}" -C "${extractDir}"`;

            execSync(extractCommand, { stdio: 'pipe' });

            console.log('\n📋 Extracted contents:');
            this.listDirectoryContents(extractDir, '  ');

            let dbFile = this.findDatabaseFile(extractDir);

            if (!dbFile) {
                dbFile = this.findBinaryDump(extractDir);
            }

            if (!dbFile) {
                dbFile = this.findAnyDatabaseFile(extractDir);
            }

            if (!dbFile) {
                const allFiles = this.getAllFiles(extractDir);
                console.log('\n📁 All extracted files:');
                allFiles.forEach(file => {
                    const stat = fs.statSync(file);
                    console.log(`  - ${path.relative(extractDir, file)} (${this.formatFileSize(stat.size)})`);
                });

                throw new Error(`No database file found in the backup archive. 
Supported formats: .sql, .dump, .dmp, .pg_dump, .backup, binary dumps
Found files: ${allFiles.map(f => path.basename(f)).join(', ')}

Please check if this is a valid PostgreSQL backup file.`);
            }

            console.log(`✅ Found database file: ${path.basename(dbFile.path)} (${dbFile.format} format, ${this.formatFileSize(dbFile.size)})`);
            return dbFile;

        } catch (error) {
            throw new Error(`Failed to extract backup file: ${error.message}`);
        }
    }

    // Get PostgreSQL environment with password
    getPostgresEnv() {
        const env = { ...process.env };

        // Set PGPASSWORD if a password is configured
        if (CONFIG.postgres.password) {
            env.PGPASSWORD = CONFIG.postgres.password;
        } else if (process.env.PGPASSWORD) {
            // Use existing PGPASSWORD from environment
            env.PGPASSWORD = process.env.PGPASSWORD;
        } else {
            // Set empty password to avoid prompts for trust authentication
            env.PGPASSWORD = '';
        }

        return env;
    }

    // Check if PostgreSQL is running
    async checkPostgreSQL() {
        try {
            const pgIsReadyCmd = PlatformUtils.getCommandPath('pg_isready');
            const env = this.getPostgresEnv();
            execSync(`${pgIsReadyCmd} -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port}`, { stdio: 'pipe', env });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Check if database exists
    async checkDatabaseExists(dbName) {
        try {
            const psqlCmd = PlatformUtils.getCommandPath('psql');
            const env = this.getPostgresEnv();
            const query = `SELECT 1 FROM pg_database WHERE datname='${dbName}'`;
            const result = execSync(
                `${psqlCmd} -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d postgres -t -c "${query}"`,
                { stdio: 'pipe', env }
            ).toString().trim();

            return result === '1';
        } catch (error) {
            console.warn(`Warning: Could not check database existence: ${error.message}`);
            return false;
        }
    }

    // Create new database
    async createDatabase(dbName) {
        try {
            console.log(`🗄️  Creating database: ${dbName}...`);

            const psqlCmd = PlatformUtils.getCommandPath('psql');
            const env = this.getPostgresEnv();
            execSync(
                `${psqlCmd} -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d postgres -c "CREATE DATABASE \\"${dbName}\\""`,
                { stdio: 'pipe', env }
            );

            console.log('✅ Database created successfully');
        } catch (error) {
            throw new Error(`Failed to create database: ${error.message}`);
        }
    }

    // Drop database
    async dropDatabase(dbName) {
        try {
            console.log(`🗑️  Dropping existing database: ${dbName}...`);

            const psqlCmd = PlatformUtils.getCommandPath('psql');
            const env = this.getPostgresEnv();
            const terminateQuery = `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`;
            execSync(
                `${psqlCmd} -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d postgres -c "${terminateQuery}"`,
                { stdio: 'pipe', env }
            );

            execSync(
                `${psqlCmd} -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d postgres -c "DROP DATABASE \\"${dbName}\\""`,
                { stdio: 'pipe', env }
            );

            console.log('✅ Database dropped successfully');
        } catch (error) {
            throw new Error(`Failed to drop database: ${error.message}`);
        }
    }

    // Get restore options description
    getRestoreOptionsDescription(format) {
        switch (format) {
            case 'sql':
                return 'SQL format with error stopping enabled';
            case 'custom':
                return 'Custom format with --no-owner, --no-privileges, --clean, --if-exists';
            case 'unknown':
                return 'Attempting SQL format restoration';
            default:
                return 'Default options';
        }
    }

    // Handle restore errors with alternative approaches
    async handleRestoreError(execError, dbFile, dbName, baseOptions) {
        const errorMsg = execError.message || execError.toString();
        console.log(`⚠️  Restore error details: ${errorMsg.substring(0, 200)}...`);

        if (dbFile.format === 'custom') {
            console.log('🔄 Retrying pg_restore without verbose flag...');
            try {
                const simpleCommand = `pg_restore ${baseOptions} -d "${dbName}" --no-owner --no-privileges --clean --if-exists "${dbFile.path}"`;
                execSync(simpleCommand, { stdio: 'pipe' });
                return;
            } catch (retryError) {
                console.log('⚠️  Still having issues, trying without --clean flag...');
                try {
                    const noCleanCommand = `pg_restore ${baseOptions} -d "${dbName}" --no-owner --no-privileges "${dbFile.path}"`;
                    execSync(noCleanCommand, { stdio: 'pipe' });
                    return;
                } catch (finalError) {
                    // Continue to throw original error
                }
            }
        } else if (dbFile.format === 'sql') {
            console.log('🔄 Retrying SQL restore without error stopping...');
            try {
                const tolerantCommand = `psql ${baseOptions} -d "${dbName}" -f "${dbFile.path}"`;
                execSync(tolerantCommand, { stdio: 'pipe' });
                return;
            } catch (retryError) {
                // Continue to throw original error
            }
        }

        throw execError;
    }

    // Fix database ownership after restore
    async fixDatabaseOwnership(dbName) {
        try {
            console.log('\n🔧 Fixing database ownership and permissions...');

            const baseOptions = `-h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user}`;
            const env = this.getPostgresEnv();

            // Basic ownership commands
            const ownershipCommands = [
                `ALTER DATABASE "${dbName}" OWNER TO ${CONFIG.postgres.user};`,
                `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO ${CONFIG.postgres.user};`
            ];

            for (const cmd of ownershipCommands) {
                try {
                    execSync(`psql ${baseOptions} -d "${dbName}" -c "${cmd}"`, { stdio: 'pipe', env });
                } catch (cmdError) {
                    console.warn(`Warning: Could not execute: ${cmd}`);
                }
            }

            // Fix schema ownership using a simpler approach
            try {
                const schemaQuery = `SELECT schemaname FROM pg_tables WHERE schemaname NOT IN ('information_schema', 'pg_catalog') GROUP BY schemaname;`;
                const schemas = execSync(
                    `psql ${baseOptions} -d "${dbName}" -t -c "${schemaQuery}"`,
                    { stdio: 'pipe', encoding: 'utf8', env }
                ).trim().split('\n').filter(s => s.trim());

                for (const schema of schemas) {
                    const cleanSchema = schema.trim();
                    if (cleanSchema) {
                        try {
                            execSync(`psql ${baseOptions} -d "${dbName}" -c "ALTER SCHEMA \\"${cleanSchema}\\" OWNER TO ${CONFIG.postgres.user};"`, { stdio: 'pipe', env });
                        } catch (err) {
                            console.warn(`Warning: Could not change ownership of schema: ${cleanSchema}`);
                        }
                    }
                }
            } catch (schemaError) {
                console.warn(`Warning: Could not fix schema ownership`);
            }

            // Fix table ownership using a simpler approach
            try {
                const tableQuery = `SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('information_schema', 'pg_catalog');`;
                const tables = execSync(
                    `psql ${baseOptions} -d "${dbName}" -t -c "${tableQuery}"`,
                    { stdio: 'pipe', encoding: 'utf8', env }
                ).trim().split('\n').filter(t => t.trim());

                for (const table of tables) {
                    const parts = table.trim().split('|');
                    if (parts.length >= 2) {
                        const schema = parts[0].trim();
                        const tableName = parts[1].trim();
                        try {
                            execSync(`psql ${baseOptions} -d "${dbName}" -c "ALTER TABLE \\"${schema}\\".\\"${tableName}\\" OWNER TO ${CONFIG.postgres.user};"`, { stdio: 'pipe', env });
                        } catch (err) {
                            console.warn(`Warning: Could not change ownership of table: ${schema}.${tableName}`);
                        }
                    }
                }
            } catch (tableError) {
                console.warn(`Warning: Could not fix table ownership`);
            }

            console.log('✅ Ownership and permissions updated');

        } catch (error) {
            console.warn(`Warning: Could not fully fix ownership: ${error.message}`);
        }
    }

    // Verify that the restore was successful
    async verifyRestore(dbName) {
        try {
            console.log('\n🔍 Verifying restore...');

            const baseOptions = `-h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user}`;
            const env = this.getPostgresEnv();

            const connectTest = `psql ${baseOptions} -d "${dbName}" -c "SELECT 1;" -t`;
            execSync(connectTest, { stdio: 'pipe', env });

            const tableCountQuery = `
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
      `;
            const tableCountResult = execSync(
                `psql ${baseOptions} -d "${dbName}" -t -c "${tableCountQuery}"`,
                { stdio: 'pipe', encoding: 'utf8', env }
            ).trim();

            const tableCount = parseInt(tableCountResult) || 0;

            const sizeQuery = `SELECT pg_size_pretty(pg_database_size('${dbName}'));`;
            const sizeResult = execSync(
                `psql ${baseOptions} -d postgres -t -c "${sizeQuery}"`,
                { stdio: 'pipe', encoding: 'utf8', env }
            ).trim();

            console.log(`📊 Restore verification:`);
            console.log(`   - Database connection: ✅ Success`);
            console.log(`   - Tables restored: ${tableCount}`);
            console.log(`   - Database size: ${sizeResult}`);

            if (tableCount === 0) {
                console.warn('⚠️  Warning: No user tables found in restored database');
            }

        } catch (error) {
            console.warn(`Warning: Could not verify restore completely: ${error.message}`);
        }
    }

    detectDumpFormat(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const filename = path.basename(filePath).toLowerCase();

            // Check by extension first
            if (ext === '.sql') {
                return 'sql';
            } else if (ext === '.dump') {
                return 'custom';
            }

            // For files without clear extensions, check content
            if (fs.existsSync(filePath)) {
                // Read first few bytes to detect format
                const buffer = Buffer.alloc(512);
                const fd = fs.openSync(filePath, 'r');
                const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
                fs.closeSync(fd);

                const header = buffer.toString('utf8', 0, bytesRead);

                // Check for PostgreSQL custom dump format magic header
                if (buffer[0] === 0x50 && buffer[1] === 0x47 && buffer[2] === 0x44 && buffer[3] === 0x4D && buffer[4] === 0x50) {
                    return 'custom';
                }

                // Check for common SQL patterns
                if (header.includes('--') ||
                    header.includes('CREATE') ||
                    header.includes('INSERT') ||
                    header.includes('SET ') ||
                    header.includes('\connect') ||
                    header.includes('BEGIN;')) {
                    return 'sql';
                }

                // Check for PostgreSQL directory format (should not happen for single files)
                if (header.includes('toc.dat') || header.includes('restore.sql')) {
                    return 'directory';
                }
            }

            // Default fallback
            console.log('⚠️  Could not detect format, assuming SQL format');
            return 'sql';

        } catch (error) {
            console.warn(`Warning: Format detection failed: ${error.message}`);
            return 'sql'; // Default fallback
        }
    }

    // Restore database from file (handles different formats)
    async restoreDatabase(dbFile, dbName) {
        try {
            console.log(`\n🔄 Restoring database: ${dbName} from ${this.sourceType} source...`);

            // Handle both object and string inputs
            let filePath, format;

            if (typeof dbFile === 'object' && dbFile.path) {
                // dbFile is an object with path and format properties
                filePath = dbFile.path;
                format = dbFile.format || this.detectDumpFormat(filePath);
                console.log(`📄 Using format from extraction: ${format}`);
            } else if (typeof dbFile === 'string') {
                // dbFile is a direct file path
                filePath = dbFile;
                format = this.detectDumpFormat(filePath);
                console.log(`📄 Detected format: ${format}`);
            } else {
                throw new Error(`Invalid database file parameter: ${typeof dbFile}`);
            }

            // Verify the dump file exists and is readable
            if (!fs.existsSync(filePath)) {
                throw new Error(`Dump file not found: ${filePath}`);
            }

            const stats = fs.statSync(filePath);
            console.log(`📏 Dump file size: ${this.formatFileSize(stats.size)}`);

            if (stats.size === 0) {
                throw new Error(`Dump file is empty: ${filePath}`);
            }

            // Check if target database exists, create if needed
            const dbExists = await this.checkDatabaseExists(dbName);
            if (!dbExists) {
                console.log(`📝 Database '${dbName}' doesn't exist, creating it...`);
                await this.createDatabase(dbName);
            }

            let restoreCommand;
            const env = this.getPostgresEnv();

            switch (format) {
                case 'sql':
                    console.log('📥 Restoring from SQL dump...');
                    restoreCommand = `psql -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${dbName} -v ON_ERROR_STOP=1 -f "${filePath}"`;
                    break;

                case 'custom':
                    console.log('📥 Restoring from custom dump format...');
                    restoreCommand = `pg_restore -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${dbName} --clean --if-exists --no-owner --no-privileges --verbose --exit-on-error "${filePath}"`;
                    break;

                case 'directory':
                    console.log('📥 Restoring from directory format...');
                    restoreCommand = `pg_restore -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${dbName} --clean --if-exists --no-owner --no-privileges --verbose --exit-on-error "${filePath}"`;
                    break;

                default:
                    console.log(`⚠️  Unknown format, attempting SQL restore...`);
                    restoreCommand = `psql -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${dbName} -v ON_ERROR_STOP=1 -f "${filePath}"`;
                    break;
            }

            console.log(`🔧 Executing: ${restoreCommand.replace(env.PGPASSWORD || '', '[password]')}`);

            try {
                const result = execSync(restoreCommand, {
                    stdio: 'pipe',
                    env: env,
                    maxBuffer: 1024 * 1024 * 100, // 100MB buffer for large outputs
                    encoding: 'utf8'
                });

                console.log('✅ Database restore command completed');
                if (result && result.trim()) {
                    console.log('📋 Restore output:', result.substring(0, 500) + (result.length > 500 ? '...' : ''));
                }

            } catch (execError) {
                const errorOutput = execError.stderr ? execError.stderr.toString() : '';
                const stdOutput = execError.stdout ? execError.stdout.toString() : '';
                const exitCode = execError.status;

                console.log(`\n❌ Restore command failed with exit code: ${exitCode}`);

                if (stdOutput && stdOutput.trim()) {
                    console.log('\n📋 Standard Output:');
                    console.log(stdOutput);
                }

                if (errorOutput && errorOutput.trim()) {
                    console.log('\n🚨 Error Output:');
                    console.log(errorOutput);
                }

                // Check for specific recoverable errors
                const recoverableErrors = [
                    'already exists',
                    'does not exist, skipping',
                    'multiple primary key',
                    'relation already exists'
                ];

                const hasRecoverableErrors = recoverableErrors.some(err =>
                    errorOutput.toLowerCase().includes(err) || stdOutput.toLowerCase().includes(err)
                );

                // Check for fatal errors that definitely indicate failure
                const fatalErrors = [
                    'fatal',
                    'could not connect',
                    'authentication failed',
                    'permission denied',
                    'database does not exist',
                    'invalid command',
                    'syntax error',
                    'no such file or directory'
                ];

                const hasFatalErrors = fatalErrors.some(err =>
                    errorOutput.toLowerCase().includes(err)
                );

                if (hasFatalErrors) {
                    throw new Error(`Database restore failed with fatal error: ${errorOutput || stdOutput || 'Unknown error'}`);
                } else if (exitCode !== 0 && !hasRecoverableErrors) {
                    // If exit code is non-zero and we don't have clearly recoverable errors,
                    // still try to verify if the restore actually worked
                    console.log('⚠️  Restore command failed, but checking if data was actually restored...');
                } else {
                    console.log('ℹ️  Restore completed with warnings (checking results...)');
                }
            }

            // Always verify restoration results
            await this.verifyRestoration(dbName);

        } catch (error) {
            throw new Error(`Failed to restore database: ${error.message}`);
        }
    }

    async verifyRestoration(dbName) {
        try {
            console.log('\n🔍 Verifying restoration...');

            const baseOptions = `-h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user}`;
            const env = this.getPostgresEnv();

            // Test basic connectivity first
            try {
                const connectTest = `psql ${baseOptions} -d ${dbName} -c "SELECT 1;" -t`;
                execSync(connectTest, { stdio: 'pipe', env });
                console.log('✅ Database connection: Success');
            } catch (connectError) {
                throw new Error(`Cannot connect to database: ${connectError.message}`);
            }

            // Count all tables (including those not in public schema)
            const allTablesQuery = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog');`;

            let allTablesResult;
            try {
                allTablesResult = execSync(
                    `psql ${baseOptions} -d "${dbName}" -t -A -c "${allTablesQuery}"`,
                    { encoding: 'utf8', env }
                );

                // Clean up the result more thoroughly for Windows
                const cleanResult = allTablesResult
                    .replace(/\r\n/g, '\n')  // Normalize Windows line endings
                    .replace(/\r/g, '\n')     // Handle old Mac line endings
                    .split('\n')              // Split into lines
                    .map(line => line.trim()) // Trim each line
                    .filter(line => line.length > 0 && !isNaN(parseInt(line))) // Keep only numeric lines
                    .join('');                // Join back

                console.log(`🔍 Raw table count result: "${allTablesResult}"`);
                console.log(`🧹 Cleaned result: "${cleanResult}"`);

            } catch (queryError) {
                console.warn(`Warning: Could not execute table count query: ${queryError.message}`);
                allTablesResult = '0';
            }

            const totalTableCount = parseInt(allTablesResult.trim().replace(/\r?\n/g, '').replace(/[^0-9]/g, '')) || 0;
            console.log(`📊 Total tables found: ${totalTableCount}`);

            // Get detailed table information
            const tablesListQuery = `
                SELECT schemaname, tablename, rowcount 
                FROM (
                    SELECT schemaname, tablename, 
                           (xpath('/row/cnt/text()', xml_count))[1]::text::int as rowcount
                    FROM (
                        SELECT schemaname, tablename, 
                               query_to_xml(format('SELECT count(*) as cnt FROM %I.%I', schemaname, tablename), false, true, '') as xml_count
                        FROM pg_tables 
                        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
                        LIMIT 10
                    ) t
                ) counted_tables
                ORDER BY rowcount DESC NULLS LAST;
            `;

            try {
                const tablesResult = execSync(
                    `psql ${baseOptions} -d ${dbName} -t -c "${tablesListQuery}"`,
                    { encoding: 'utf8', env }
                ).trim();

                if (tablesResult) {
                    const tableLines = tablesResult.split('\n').filter(line => line.trim().length > 0);
                    console.log('📋 Tables with data:');
                    tableLines.slice(0, 5).forEach(line => {
                        const parts = line.trim().split('|');
                        if (parts.length >= 3) {
                            const schema = parts[0].trim();
                            const table = parts[1].trim();
                            const rows = parts[2].trim();
                            console.log(`   • ${schema}.${table} (${rows} rows)`);
                        }
                    });

                    if (tableLines.length > 5) {
                        console.log(`   ... and ${tableLines.length - 5} more tables`);
                    }
                }
            } catch (detailError) {
                // Fallback to simpler table listing
                console.log('📋 Listing tables (simple method):');
                try {
                    const simpleTablesResult = execSync(
                        `psql ${baseOptions} -d ${dbName} -c "\\dt" -t`,
                        { encoding: 'utf8', env }
                    ).trim();

                    if (simpleTablesResult) {
                        const tableLines = simpleTablesResult.split('\n').filter(line => line.trim().length > 0);
                        tableLines.slice(0, 10).forEach(line => {
                            const parts = line.split('|');
                            if (parts.length >= 2) {
                                const tableName = parts[1]?.trim();
                                if (tableName) {
                                    console.log(`   • ${tableName}`);
                                }
                            }
                        });
                    }
                } catch (simpleError) {
                    console.warn('Could not list tables');
                }
            }

            // Check database size
            try {
                const sizeQuery = `SELECT pg_size_pretty(pg_database_size('${dbName}'));`;
                const sizeResult = execSync(
                    `psql ${baseOptions} -d postgres -t -c "${sizeQuery}"`,
                    { encoding: 'utf8', env }
                ).trim();
                console.log(`💾 Database size: ${sizeResult}`);
            } catch (sizeError) {
                console.warn('Could not determine database size');
            }

            // Check for sequences
            try {
                const sequenceQuery = `
                    SELECT COUNT(*) 
                    FROM information_schema.sequences 
                    WHERE sequence_schema NOT IN ('information_schema', 'pg_catalog');
                `;
                const sequenceCount = execSync(
                    `psql ${baseOptions} -d ${dbName} -t -c "${sequenceQuery}"`,
                    { encoding: 'utf8', env }
                ).trim();

                if (parseInt(sequenceCount) > 0) {
                    console.log(`🔢 Sequences found: ${sequenceCount}`);
                }
            } catch (seqError) {
                // Ignore sequence check errors
            }

            // Check for views
            try {
                const viewQuery = `
                    SELECT COUNT(*) 
                    FROM information_schema.views 
                    WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
                `;
                const viewCount = execSync(
                    `psql ${baseOptions} -d ${dbName} -t -c "${viewQuery}"`,
                    { encoding: 'utf8', env }
                ).trim();

                if (parseInt(viewCount) > 0) {
                    console.log(`👁️  Views found: ${viewCount}`);
                }
            } catch (viewError) {
                // Ignore view check errors
            }

            // Final assessment
            if (totalTableCount === 0) {
                console.log('\n❌ VERIFICATION FAILED: No tables found in restored database');
                console.log('🔍 Possible issues:');
                console.log('   • Dump file may be empty or corrupted');
                console.log('   • Restore command may have failed silently');
                console.log('   • Permission issues preventing table creation');
                console.log('   • Database format not compatible with pg_restore/psql');

                // Suggest manual inspection
                console.log('\n💡 Manual verification steps:');
                console.log(`   1. Connect: psql ${baseOptions} -d ${dbName}`);
                console.log('   2. Run: \\dt+ (list all tables with details)');
                console.log('   3. Run: \\dn (list all schemas)');
                console.log('   4. Check restore logs above for specific errors');

                throw new Error('Database restoration verification failed - no tables found');
            } else {
                console.log(`\n✅ VERIFICATION PASSED: Successfully restored ${totalTableCount} table(s)`);
                return true;
            }

        } catch (error) {
            console.error(`\n❌ Verification failed: ${error.message}`);
            throw error;
        }
    }

    // Generate database name with environment and date
    generateDatabaseName(serviceName, date, includeEnv = true) {
        const envPrefix = includeEnv ? `${CONFIG.selectedEnvironment}_` : '';
        const cleanDate = date.replace(/-/g, '_');
        return `${envPrefix}${serviceName}_${cleanDate}`;
    }

    // Clean up temporary files
    cleanup() {
        if (this.cleanupDone) {
            return; // Prevent multiple cleanup executions
        }

        this.cleanupDone = true;

        try {
            if (fs.existsSync(CONFIG.app.localTempDir)) {
                const removeCommand = PlatformUtils.getRemoveCommand(CONFIG.app.localTempDir);
                try {
                    execSync(removeCommand, { stdio: 'pipe' });
                    console.log('🧹 Temporary files cleaned up');
                } catch (err) {
                    // Fallback to manual file deletion
                    this.manualCleanup(CONFIG.app.localTempDir);
                }
            }
        } catch (error) {
            console.warn(`Warning: Could not clean up temporary files: ${error.message}`);
        }
    }

    manualCleanup(dir) {
        try {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    this.manualCleanup(filePath);
                    fs.rmdirSync(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            });
            console.log('🧹 Manual cleanup completed');
        } catch (error) {
            console.warn(`Manual cleanup failed: ${error.message}`);
        }
    }

    async detectDbeaverPaths() {
        return this.dbeaverManager.detectPaths();
    }


    generateConnectionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateConnectionName(dbName) {
        const timestamp = new Date().toISOString().split('T')[0];

        if (this.sourceType === 'local') {
            return `${dbName} [LOCAL] - Restored ${timestamp}`;
        } else {
            const envLabel = CONFIG.selectedEnvironment.toUpperCase();
            const backupDate = this.selectedBackup ?
                this.selectedBackup.filename.match(/(\d{4}-\d{2}-\d{2})/) : null;
            const backupDateStr = backupDate ? `[${backupDate[1]}]` : '';

            return `${dbName} ${backupDateStr} - Restored ${timestamp} (${envLabel})`;
        }
    }

    async readDbeaverDataSources() {
        return this.dbeaverManager.readDataSources();
    }

    async showDbeaverDebugInfo() {
        try {
            console.log('\n🔍 DBeaver Debug Information:');
            console.log('============================');
            console.log(`Workspace: ${CONFIG.dbeaver.workspaceDir}`);
            console.log(`Data Sources File: ${CONFIG.dbeaver.dataSourcesFile}`);
            console.log(`File Exists: ${fs.existsSync(CONFIG.dbeaver.dataSourcesFile) ? '✅ Yes' : '❌ No'}`);

            if (fs.existsSync(CONFIG.dbeaver.dataSourcesFile)) {
                const stats = fs.statSync(CONFIG.dbeaver.dataSourcesFile);
                console.log(`File Size: ${stats.size} bytes`);
                console.log(`Last Modified: ${stats.mtime}`);

                // Show a preview of the file content
                const content = fs.readFileSync(CONFIG.dbeaver.dataSourcesFile, 'utf8');
                const parsed = JSON.parse(content);
                console.log(`Connections Count: ${Object.keys(parsed.connections || {}).length}`);
                console.log(`Folders Count: ${Object.keys(parsed.folders || {}).length}`);

                if (Object.keys(parsed.connections || {}).length > 0) {
                    console.log('📋 Existing Connection Names:');
                    Object.values(parsed.connections).forEach(conn => {
                        console.log(`   • ${conn.name}`);
                    });
                }
            }

            console.log('');
        } catch (error) {
            console.warn(`Debug info error: ${error.message}`);
        }
    }

    async addDbeaverConnection(dbName) {
        const folderName = this.selectedDbeaverFolder || this.getDbeaverFolderName();
        return this.dbeaverManager.addConnection(dbName, folderName);
    }


    getDbeaverFolderName() {
        if (this.sourceType === 'local') {
            return "2.Postgres - LOCAL";
        }

        // Cloud logic remains the same
        switch (CONFIG.selectedEnvironment) {
            case 'dev':
                return "Postgres - 1.DEV";
            case 'stage':
                return "Postgres - 2.STAGE";
            case 'prod':
                return "Postgres - 3.PROD";
            default:
                return "2.Postgres - LOCAL";
        }
    }

    async ensureDbeaverFolder(dataSources, folderName) {
        this.dbeaverManager.ensureFolder(dataSources, folderName);
    }

    supportCustomMetadata() {
        // Most modern DBeaver versions support some form of metadata
        // We can add this as a comment in the connection name instead
        return false; // Conservative approach
    }

    async updateDbeaverCredentials(connectionId, dbName) {
        try {
            // DBeaver handles PostgreSQL with trust authentication automatically
            // For password-based auth, you might need to handle credentials-config.json

            if (fs.existsSync(CONFIG.dbeaver.credentialsFile)) {
                console.log('📋 DBeaver will prompt for password on first connection');
            }

            // If you need to store password automatically, you can implement
            // credentials-config.json handling here, but it's more secure to let
            // DBeaver handle authentication interactively

        } catch (error) {
            console.warn(`Warning: Could not update DBeaver credentials: ${error.message}`);
        }
    }

    async validateDbeaverConnection(connectionId) {
        try {
            const dataSources = await this.readDbeaverDataSources();
            const connection = dataSources.connections && dataSources.connections[connectionId];

            if (connection) {
                console.log('✅ DBeaver connection validated');
                console.log(`   Provider: ${connection.provider}`);
                console.log(`   Driver: ${connection.driver}`);
                console.log(`   Database: ${connection.configuration.database}`);
                console.log(`   Folder: ${connection.folder}`);
                return true;
            } else {
                console.log('❌ DBeaver connection validation failed');
                return false;
            }
        } catch (error) {
            console.warn(`Warning: Could not validate DBeaver connection: ${error.message}`);
            return false;
        }
    }

    async showExistingConnections() {
        try {
            const dataSources = await this.readDbeaverDataSources();
            if (dataSources.folders && Object.keys(dataSources.folders).length > 0) {
                console.log('📁 Available Folders:');
                Object.keys(dataSources.folders).forEach(folder => {
                    console.log(`  • ${folder}`);
                });
                console.log('');
            }

        } catch (error) {
            console.warn(`Could not show existing connections: ${error.message}`);
        }
    }

    async selectDbeaverFolder() {
        try {
            const dataSources = await this.readDbeaverDataSources();

            if (!dataSources.folders || Object.keys(dataSources.folders).length === 0) {
                console.log('\n📁 No existing folders found, will create default folder');
                return this.getDbeaverFolderName();
            }

            const folders = Object.keys(dataSources.folders).filter(f => f.includes('Postgres'));

            if (folders.length === 0) {
                return this.getDbeaverFolderName();
            }

            // Add recommended marker to options
            const folderOptions = folders.map(folder => {
                const isRecommended = folder === this.getDbeaverFolderName();
                return `${folder} ${isRecommended ? '⭐ (Recommended)' : ''}`;
            });
            folderOptions.push('Create new folder');

            const choice = await this.selectFromMenu(
                '📁 Available PostgreSQL Folders',
                folderOptions
            );

            if (choice === folderOptions.length - 1) {
                const customFolder = await this.prompt('\nEnter custom folder name: ');
                return customFolder.trim() || this.getDbeaverFolderName();
            }

            return folders[choice];

        } catch (error) {
            console.warn(`Warning: Could not select folder: ${error.message}`);
            return this.getDbeaverFolderName();
        }
    }

    showManualDbeaverSetup() {
        console.log('\n📋 Manual DBeaver Connection Setup:');
        console.log('===================================');
        console.log('If automatic integration failed, create connection manually:');
        console.log('');
        console.log('1. Open DBeaver');
        console.log('2. Click "New Database Connection" (+)');
        console.log('3. Select "PostgreSQL"');
        console.log('4. Enter these details:');
        console.log(`   • Host: ${CONFIG.postgres.host}`);
        console.log(`   • Port: ${CONFIG.postgres.port}`);
        console.log(`   • Database: ${this.targetDatabase}`);
        console.log(`   • Username: ${CONFIG.postgres.user}`);
        console.log(`   • Password: (your postgres password)`);
        console.log('5. Test connection and save');
        console.log('');
        console.log('📝 Suggested connection name:');
        console.log(`   ${this.generateConnectionName(this.targetDatabase)}`);
    }

    async organizeDatabaseInDBeaver(connectionId) {
        try {
            const dataSources = await this.readDbeaverDataSources();

            // Initialize folders if they don't exist
            if (!dataSources.folders) {
                dataSources.folders = {};
            }

            // Create environment folder
            const envFolderId = `folder:${CONFIG.selectedEnvironment}`;
            if (!dataSources.folders[envFolderId]) {
                dataSources.folders[envFolderId] = {
                    "id": envFolderId,
                    "label": `${CONFIG.selectedEnvironment.toUpperCase()} Environment`,
                    "description": `Databases restored from ${CONFIG.selectedEnvironment} environment`
                };
            }

            // Move connection to environment folder
            if (dataSources.connections[connectionId]) {
                dataSources.connections[connectionId].folder = envFolderId;
            }

            // Write updated configuration
            fs.writeFileSync(CONFIG.dbeaver.dataSourcesFile, JSON.stringify(dataSources, null, 2));

            console.log(`📁 Connection organized in "${CONFIG.selectedEnvironment.toUpperCase()} Environment" folder`);

        } catch (error) {
            console.warn(`Warning: Could not organize DBeaver folders: ${error.message}`);
        }
    }

    // Main interactive flow
    async run() {
        try {
            console.log('🚀 Database Restore Manager');
            console.log('============================');
            console.log('Universal Database Restore Tool\n');

            // Platform validation
            console.log(`🖥️  Platform: ${PlatformUtils.isWindows() ? 'Windows' : PlatformUtils.isLinux() ? 'Linux' : 'macOS'}`);

            // Validate PostgreSQL tools before proceeding
            try {
                console.log('🔍 Validating PostgreSQL tools...');
                PlatformUtils.validatePostgreSQLTools();
                console.log('✅ PostgreSQL tools validated successfully\n');
            } catch (validationError) {
                console.error(`❌ ${validationError.message}\n`);
                const continueChoice = await this.prompt('Continue anyway? (y/n): ');
                if (continueChoice.toLowerCase() !== 'y') {
                    console.log('❌ Operation cancelled');
                    return;
                }
            }

            // Step 1: Select source type
            await this.selectSourceType();

            if (this.sourceType === 'cloud') {
                // Cloud restoration flow
                // Step 2: Select AWS Profile and Environment
                await this.selectProfileAndEnvironment();

                // Step 3: Initialize S3
                await this.initializeS3();

                // Step 4: Detect DBeaver (optional)
                const dbeaverDetected = await this.detectDbeaverPaths();
                if (dbeaverDetected) {
                    await this.showExistingConnections();
                } else {
                    const skipChoice = await this.prompt('DBeaver not detected. Continue without DBeaver integration? (y/n): ');
                    if (skipChoice.toLowerCase() !== 'y') {
                        console.log('❌ Operation cancelled');
                        return;
                    }
                    this.skipDBeaver = true;
                }

                // Step 5: Select Service
                const services = await this.listServices();
                const serviceIndex = await this.selectFromMenu(
                    `📋 Available Services in ${CONFIG.selectedEnvironment.toUpperCase()}`,
                    services
                );

                this.selectedService = services[serviceIndex];
                console.log(`\n✅ Selected service: ${this.selectedService}`);

                // Step 6: Select Backup File from S3
                const backupFiles = await this.listBackupFiles(this.selectedService);
                const backupOptions = backupFiles.map(backup =>
                    `${backup.filename} (${this.formatDate(backup.lastModified)}, ${backup.size})`
                );

                const backupIndex = await this.selectFromMenu(
                    `📋 Available Backup Files for ${this.selectedService}`,
                    backupOptions
                );

                this.selectedBackup = backupFiles[backupIndex];
                console.log(`\n✅ Selected backup: ${this.selectedBackup.filename}`);

            } else {
                // Local file restoration flow
                // Step 2: Detect DBeaver (optional)
                const dbeaverDetected = await this.detectDbeaverPaths();
                if (dbeaverDetected) {
                    await this.showExistingConnections();
                } else {
                    const skipChoice = await this.prompt('DBeaver not detected. Continue without DBeaver integration? (y/n): ');
                    if (skipChoice.toLowerCase() !== 'y') {
                        console.log('❌ Operation cancelled');
                        return;
                    }
                    this.skipDBeaver = true;
                }

                // Step 3: Select Local Dump File
                await this.selectLocalDumpFile();

                // Set service name from filename for consistency
                this.selectedService = this.getServiceFromLocalFile(this.selectedBackup.filename);
                console.log(`📋 Detected service: ${this.selectedService}`);
            }

            // Step 7: Database Configuration (same for both flows)
            const dbOptions = [
                'Create new database with date and environment suffix',
                'Create new database with custom name',
                'Restore to existing database (will create if not exists)',
                'Replace existing database (drop and recreate)'
            ];

            const dbChoice = await this.selectFromMenu(
                '🗄️ Database Configuration Options',
                dbOptions
            );

            switch (dbChoice) {
                case 0:
                    this.createNewDB = true;
                    if (this.sourceType === 'local') {
                        this.targetDatabase = this.generateDatabaseNameForLocal();
                    } else {
                        const dateMatch = this.selectedBackup.filename.match(/(\d{4}-\d{2}-\d{2})/);
                        const dateSuffix = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
                        this.targetDatabase = this.generateDatabaseName(this.selectedService, dateSuffix);
                    }
                    console.log(`\n📅 New database name: ${this.targetDatabase}`);
                    break;

                case 1:
                    this.createNewDB = true;
                    this.targetDatabase = await this.prompt('\nEnter custom database name: ');
                    break;

                case 2:
                    this.createNewDB = false;
                    this.replaceExisting = false;
                    this.targetDatabase = await this.prompt('\nEnter database name (will be created if not exists): ');
                    break;

                case 3:
                    this.createNewDB = false;
                    this.replaceExisting = true;
                    this.targetDatabase = await this.prompt('\nEnter database name to replace: ');
                    break;
            }

            // Step 8: DBeaver Integration Option
            if (!this.skipDBeaver) {
                const dbeaverOptions = [
                    'Add connection automatically (recommended folder)',
                    'Add connection with folder selection',
                    'Skip DBeaver integration'
                ];

                const dbeaverChoice = await this.selectFromMenu(
                    '🔗 DBeaver Integration Options',
                    dbeaverOptions
                );

                switch (dbeaverChoice) {
                    case 1:
                        this.customFolderSelection = true;
                        break;
                    case 2:
                        this.skipDBeaver = true;
                        break;
                    default:
                        this.customFolderSelection = false;
                        break;
                }
            }

            // Step 9: Verify PostgreSQL
            console.log('\n🔍 Checking PostgreSQL connection...');
            if (!await this.checkPostgreSQL()) {
                throw new Error(`PostgreSQL is not running or not accessible at ${CONFIG.postgres.host}:${CONFIG.postgres.port}`);
            }
            console.log('✅ PostgreSQL is running');

            // Step 10: Database existence check
            const dbExists = await this.checkDatabaseExists(this.targetDatabase);

            if (this.replaceExisting && dbExists) {
                console.log(`\n🗑️  Database '${this.targetDatabase}' will be dropped and recreated`);
            } else if (this.createNewDB && dbExists) {
                const overwriteChoice = await this.prompt(`\n⚠️  Database '${this.targetDatabase}' already exists. Overwrite? (y/n): `);
                if (overwriteChoice.toLowerCase() !== 'y' && overwriteChoice.toLowerCase() !== 'yes') {
                    console.log('❌ Operation cancelled');
                    return;
                }
                this.replaceExisting = true;
            } else if (!dbExists) {
                console.log(`\n📝 Database '${this.targetDatabase}' will be created automatically`);
            }

            // Step 11: Confirm restore
            console.log('\n📋 Restore Summary:');
            console.log('==================');
            console.log(`Source Type: ${this.sourceType.toUpperCase()}`);

            if (this.sourceType === 'cloud') {
                console.log(`AWS Profile: ${CONFIG.selectedProfile}`);
                console.log(`Environment: ${CONFIG.selectedEnvironment.toUpperCase()}`);
                console.log(`S3 Bucket: ${CONFIG.s3Bucket}`);
                console.log(`Service: ${this.selectedService}`);
                console.log(`Backup File: ${this.selectedBackup.filename}`);
                console.log(`Backup Date: ${this.formatDate(this.selectedBackup.lastModified)}`);
            } else {
                console.log(`Local File: ${this.localDumpPath}`);
                console.log(`Service: ${this.selectedService}`);
                console.log(`File Size: ${this.selectedBackup.size}`);
                console.log(`Last Modified: ${this.selectedBackup.lastModified.toLocaleString()}`);
            }

            console.log(`Target Database: ${this.targetDatabase}`);
            console.log(`Action: ${this.createNewDB ? 'Create new database' : 'Restore to existing database'}`);
            console.log(`DBeaver Integration: ${this.skipDBeaver ? '❌ Disabled' : '✅ Enabled'}`);

            if (this.replaceExisting) {
                console.log('⚠️  Warning: Existing database will be dropped and recreated');
            }

            const confirmChoice = await this.prompt('\nProceed with restore? (y/n): ');
            if (confirmChoice.toLowerCase() !== 'y' && confirmChoice.toLowerCase() !== 'yes') {
                console.log('❌ Operation cancelled');
                return;
            }

            // Step 12: Execute restore
            console.log('\n🔄 Starting restore process...');
            console.log('==============================');

            let dbFile;

            if (this.sourceType === 'cloud') {
                // Download and extract from S3
                const localFilePath = await this.downloadBackupFile(this.selectedBackup.key);
                dbFile = await this.extractBackupFile(localFilePath);
            } else {
                // Process local file
                dbFile = await this.processLocalDumpFile(this.localDumpPath);
                console.log(`📁 Using processed file: ${dbFile}`);

                // Verify the processed file exists
                if (!fs.existsSync(dbFile)) {
                    throw new Error(`Processed dump file not found: ${dbFile}`);
                }

                const stats = fs.statSync(dbFile);
                console.log(`📏 File size: ${this.formatFileSize(stats.size)}`);
            }

            this.extractedDbFile = dbFile;

            // Handle database creation/recreation
            if (this.replaceExisting || this.createNewDB) {
                const dbExists = await this.checkDatabaseExists(this.targetDatabase);

                if (this.replaceExisting && dbExists) {
                    await this.dropDatabase(this.targetDatabase);
                }

                if (this.createNewDB || !dbExists) {
                    await this.createDatabase(this.targetDatabase);
                }
            }

            // Restore database with enhanced error handling
            try {
                await this.restoreDatabase(dbFile, this.targetDatabase);
            } catch (restoreError) {
                console.error(`❌ Restore failed: ${restoreError.message}`);

                // Offer troubleshooting options
                console.log('\n🔧 Troubleshooting suggestions:');
                console.log('1. Check if PostgreSQL is accepting connections');
                console.log('2. Verify database user permissions');
                console.log('3. Ensure the dump file is not corrupted');
                console.log('4. Check PostgreSQL logs for more details');

                const retryChoice = await this.prompt('\nWould you like to try with different restore options? (y/n): ');
                if (retryChoice.toLowerCase() === 'y') {
                    await this.tryAlternativeRestore(dbFile);
                } else {
                    throw restoreError;
                }
            }

            // Step 13: Add DBeaver connection
            let dbeaverConnectionId = null;
            if (!this.skipDBeaver) {
                try {
                    if (this.customFolderSelection) {
                        const selectedFolder = await this.selectDbeaverFolder();
                        this.selectedDbeaverFolder = selectedFolder;
                    }

                    dbeaverConnectionId = await this.addDbeaverConnection(this.targetDatabase);
                    await this.validateDbeaverConnection(dbeaverConnectionId);

                } catch (dbeaverError) {
                    console.warn(`⚠️  DBeaver integration failed: ${dbeaverError.message}`);
                    this.showManualDbeaverSetup();
                }
            }

            console.log('\n🎉 Database restore completed successfully!');
            console.log('===========================================');
            console.log(`Source: ${this.sourceType.toUpperCase()}`);

            if (this.sourceType === 'cloud') {
                console.log(`Environment: ${CONFIG.selectedEnvironment.toUpperCase()}`);
                console.log(`Restored from: ${this.selectedBackup.filename}`);
            } else {
                console.log(`Local file: ${path.basename(this.localDumpPath)}`);
            }

            console.log(`Database: ${this.targetDatabase}`);
            console.log(`Connection: psql -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${this.targetDatabase}`);

            if (!this.skipDBeaver && dbeaverConnectionId) {
                console.log(`\n🔗 DBeaver Integration:`);
                console.log(`✅ Connection added successfully`);
                console.log(`📁 Located in appropriate folder`);
                console.log(`📝 Refresh DBeaver (F5) or restart to see: ${this.generateConnectionName(this.targetDatabase)}`);
            }

        } catch (error) {
            console.error(`\n❌ Error: ${error.message}`);
            process.exit(1);
        } finally {
            this.cleanup();
            rl.close();
        }
    }

    async tryAlternativeRestore(dbFile) {
        try {
            console.log('\n🔄 Trying alternative restore methods...');

            // Handle both object and string inputs (same as in restoreDatabase)
            let filePath, format;

            if (typeof dbFile === 'object' && dbFile.path) {
                filePath = dbFile.path;
                format = dbFile.format || this.detectDumpFormat(filePath);
            } else if (typeof dbFile === 'string') {
                filePath = dbFile;
                format = this.detectDumpFormat(filePath);
            } else {
                throw new Error(`Invalid database file parameter: ${typeof dbFile}`);
            }

            if (format === 'sql') {
                console.log('🔧 Trying with different psql options...');

                // Try with single transaction mode
                const altCommand = `psql -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${this.targetDatabase} --single-transaction -f "${filePath}"`;

                try {
                    execSync(altCommand, {
                        stdio: 'inherit',
                        env: this.getPostgresEnv()
                    });
                    console.log('✅ Alternative restore method succeeded');
                    return;
                } catch (altError) {
                    console.log('❌ Alternative method also failed');
                }
            }

            if (format === 'custom') {
                console.log('🔧 Trying pg_restore without --clean and --exit-on-error flags...');

                const altCommand = `pg_restore -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${this.targetDatabase} --no-owner --no-privileges --verbose "${filePath}"`;

                try {
                    execSync(altCommand, {
                        stdio: 'inherit',
                        env: this.getPostgresEnv()
                    });
                    console.log('✅ Alternative restore method succeeded');
                    return;
                } catch (altError) {
                    console.log('⚠️  Alternative method also had issues, trying minimal restore...');

                    // Last resort: try with minimal flags
                    try {
                        const minimalCommand = `pg_restore -h ${CONFIG.postgres.host} -p ${CONFIG.postgres.port} -U ${CONFIG.postgres.user} -d ${this.targetDatabase} --no-owner --no-privileges "${filePath}"`;
                        execSync(minimalCommand, {
                            stdio: 'inherit',
                            env: this.getPostgresEnv()
                        });
                        console.log('✅ Minimal restore method succeeded');
                        return;
                    } catch (minimalError) {
                        console.log('❌ All pg_restore methods failed');
                    }
                }
            }

            throw new Error('All restore methods failed');

        } catch (error) {
            throw new Error(`Alternative restore failed: ${error.message}`);
        }
    }
}

// Handle process termination
const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.removeAllListeners('keypress');
    const manager = new DatabaseRestoreManager();
    manager.cleanup();
};

process.on('SIGINT', () => {
    console.log('\n\n⚠️  Process interrupted. Cleaning up...');
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Process terminated. Cleaning up...');
    cleanup();
    process.exit(0);
});

process.on('exit', () => {
    cleanup();
});

// Main execution
if (require.main === module) {
    const manager = new DatabaseRestoreManager();
    manager.run().catch((error) => {
        console.error(`Fatal error: ${error.message}`);
        cleanup();
        process.exit(1);
    });
}

module.exports = DatabaseRestoreManager;
