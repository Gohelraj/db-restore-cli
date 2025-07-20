const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const CONFIG = require('../config');
const PlatformUtils = require('./platform-utils');

class DBeaverManager {
    async detectPaths() {
        const homeDir = os.homedir();
        const possible = [];
        
        if (process.platform === 'darwin') {
            possible.push(
                path.join(homeDir, 'Library', 'DBeaverData', 'workspace6'),
                path.join(homeDir, 'Documents', 'DBeaver', 'workspace6'),
                path.join(homeDir, '.dbeaver', 'workspace6')
            );
        } else if (process.platform === 'win32') {
            possible.push(
                path.join(homeDir, 'AppData', 'Roaming', 'DBeaverData', 'workspace6'),
                path.join(homeDir, 'Documents', 'DBeaver', 'workspace6')
            );
        } else {
            // Enhanced Linux/Ubuntu path detection
            possible.push(
                // Snap installation paths
                path.join(homeDir, 'snap', 'dbeaver-ce', 'current', '.local', 'share', 'DBeaverData', 'workspace6'),
                path.join(homeDir, 'snap', 'dbeaver-ce', 'common', '.local', 'share', 'DBeaverData', 'workspace6'),
                
                // Flatpak installation paths
                path.join(homeDir, '.var', 'app', 'io.dbeaver.DBeaverCommunity', 'data', 'DBeaverData', 'workspace6'),
                path.join(homeDir, '.var', 'app', 'io.dbeaver.DBeaverCommunity', 'config', 'DBeaverData', 'workspace6'),
                
                // Standard Linux paths
                path.join(homeDir, '.local', 'share', 'DBeaverData', 'workspace6'),
                path.join(homeDir, '.dbeaver', 'workspace6'),
                path.join(homeDir, '.config', 'dbeaver', 'workspace6'),
                
                // Manual installation paths
                path.join(homeDir, 'dbeaver', 'workspace6'),
                path.join(homeDir, 'Documents', 'DBeaver', 'workspace6'),
                path.join(homeDir, 'Applications', 'DBeaver', 'workspace6'),
                
                // System-wide installation paths
                '/opt/dbeaver/workspace6',
                '/usr/share/dbeaver/workspace6',
                
                // Ubuntu-specific paths
                path.join(homeDir, '.local', 'share', 'applications', 'dbeaver', 'workspace6'),
                
                // Legacy paths for older versions
                path.join(homeDir, '.dbeaver4', 'workspace6'),
                path.join(homeDir, '.metadata', '.plugins', 'org.eclipse.core.runtime', '.settings')
            );
            
            // Add version-specific paths for different workspace versions
            const workspaceVersions = ['workspace6', 'workspace5', 'workspace4', '.metadata'];
            const basePaths = [
                path.join(homeDir, 'snap', 'dbeaver-ce', 'current', '.local', 'share', 'DBeaverData'),
                path.join(homeDir, '.var', 'app', 'io.dbeaver.DBeaverCommunity', 'data', 'DBeaverData'),
                path.join(homeDir, '.local', 'share', 'DBeaverData'),
                path.join(homeDir, '.dbeaver')
            ];
            
            for (const basePath of basePaths) {
                for (const wsVersion of workspaceVersions) {
                    const fullPath = path.join(basePath, wsVersion);
                    if (!possible.includes(fullPath)) {
                        possible.push(fullPath);
                    }
                }
            }
        }

        // Try to detect installation type for better path prioritization on Ubuntu
        if (PlatformUtils.isUbuntu()) {
            const installationTypes = PlatformUtils.detectDbeaverInstallationType();
            console.log(`🔍 Detected DBeaver installation types on Ubuntu: ${installationTypes.join(', ')}`);
            
            // Reorder paths based on detected installation types
            const prioritizedPaths = this.prioritizePathsByInstallationType(possible, installationTypes);
            possible.splice(0, possible.length, ...prioritizedPaths);
        }

        console.log(`🔍 Checking ${possible.length} possible DBeaver workspace paths...`);
        
        for (const workspacePath of possible) {
            console.log(`🔍 Checking: ${workspacePath}`);
            
            if (fs.existsSync(workspacePath)) {
                console.log(`✅ Found workspace directory: ${workspacePath}`);
                
                // Check for different possible data-sources.json locations
                const possibleDataSourcesPaths = [
                    path.join(workspacePath, 'General', '.dbeaver', 'data-sources.json'),
                    path.join(workspacePath, '.dbeaver', 'data-sources.json'),
                    path.join(workspacePath, 'data-sources.json')
                ];
                
                for (const dataSourcesPath of possibleDataSourcesPaths) {
                    const credentialsPath = path.join(path.dirname(dataSourcesPath), 'credentials-config.json');
                    
                    if (fs.existsSync(path.dirname(dataSourcesPath))) {
                        console.log(`✅ Found DBeaver configuration directory: ${path.dirname(dataSourcesPath)}`);
                        
                        CONFIG.dbeaver.workspaceDir = workspacePath;
                        CONFIG.dbeaver.dataSourcesFile = dataSourcesPath;
                        CONFIG.dbeaver.credentialsFile = credentialsPath;
                        
                        console.log(`✅ DBeaver workspace configured:`);
                        console.log(`   Workspace: ${workspacePath}`);
                        console.log(`   Data Sources: ${dataSourcesPath}`);
                        console.log(`   Credentials: ${credentialsPath}`);
                        
                        return true;
                    }
                }
            }
        }
        
        console.log('❌ No DBeaver workspace found in any of the checked paths');
        return false;
    }

    prioritizePathsByInstallationType(paths, installationTypes) {
        const prioritized = [];
        const remaining = [...paths];
        
        // Prioritize based on detected installation types
        for (const installType of installationTypes) {
            const typeSpecificPaths = [];
            
            for (let i = remaining.length - 1; i >= 0; i--) {
                const path = remaining[i];
                let matches = false;
                
                switch (installType) {
                    case 'snap':
                        matches = path.includes('/snap/dbeaver-ce/');
                        break;
                    case 'flatpak':
                        matches = path.includes('/.var/app/io.dbeaver.DBeaverCommunity/');
                        break;
                    case 'system':
                        matches = path.startsWith('/opt/') || path.startsWith('/usr/');
                        break;
                    case 'manual':
                        matches = path.includes('/dbeaver/') && !path.includes('/snap/') && !path.includes('/.var/');
                        break;
                    default:
                        matches = path.includes('/.local/share/DBeaverData/') || path.includes('/.dbeaver/');
                        break;
                }
                
                if (matches) {
                    typeSpecificPaths.push(path);
                    remaining.splice(i, 1);
                }
            }
            
            prioritized.push(...typeSpecificPaths);
        }
        
        // Add remaining paths at the end
        prioritized.push(...remaining);
        
        return prioritized;
    }

    async readDataSources() {
        if (!fs.existsSync(CONFIG.dbeaver.dataSourcesFile)) {
            const dir = path.dirname(CONFIG.dbeaver.dataSourcesFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const defaultData = { folders: {}, connections: {} };
            fs.writeFileSync(CONFIG.dbeaver.dataSourcesFile, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const content = fs.readFileSync(CONFIG.dbeaver.dataSourcesFile, 'utf8');
        return JSON.parse(content);
    }

    generateConnectionId() {
        const timestamp = Date.now().toString(16);
        const random = crypto.randomBytes(8).toString('hex');
        return `postgres-jdbc-${timestamp}-${random}`;
    }

    async addConnection(dbName, folderName) {
        const dataSources = await this.readDataSources();
        if (!dataSources.connections) dataSources.connections = {};

        const connectionId = this.generateConnectionId();
        dataSources.connections[connectionId] = {
            provider: 'postgresql',
            driver: 'postgres-jdbc',
            name: dbName,
            'save-password': true,
            folder: folderName,
            configuration: {
                host: CONFIG.postgres.host,
                port: CONFIG.postgres.port.toString(),
                database: dbName,
                url: `jdbc:postgresql://${CONFIG.postgres.host}:${CONFIG.postgres.port}/${dbName}`,
                configurationType: 'MANUAL',
                type: 'dev',
                closeIdleConnection: true,
                'provider-properties': {
                    '@dbeaver-show-non-default-db@': 'false',
                    '@dbeaver-chosen-role@': ''
                },
                'auth-model': 'native',
                user: CONFIG.postgres.user,
                password: CONFIG.postgres.password
            }
        };

        this.ensureFolder(dataSources, folderName);
        fs.writeFileSync(CONFIG.dbeaver.dataSourcesFile, JSON.stringify(dataSources, null, 2));
        return connectionId;
    }

    ensureFolder(dataSources, folderName) {
        if (!dataSources.folders) dataSources.folders = {};
        if (!dataSources.folders[folderName]) {
            dataSources.folders[folderName] = {};
        }
    }
}

module.exports = DBeaverManager;
