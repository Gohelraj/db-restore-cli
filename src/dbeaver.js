const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const CONFIG = require('../config');

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
            possible.push(
                path.join(homeDir, 'snap', 'dbeaver-ce', 'current', '.local', 'share', 'DBeaverData', 'workspace6'),
                path.join(homeDir, '.local', 'share', 'DBeaverData', 'workspace6'),
                path.join(homeDir, '.dbeaver', 'workspace6'),
                path.join(homeDir, 'Documents', 'DBeaver', 'workspace6')
            );
        }

        for (const workspacePath of possible) {
            if (fs.existsSync(workspacePath)) {
                const dataSourcesPath = path.join(workspacePath, 'General', '.dbeaver', 'data-sources.json');
                const credentialsPath = path.join(workspacePath, 'General', '.dbeaver', 'credentials-config.json');
                if (fs.existsSync(path.dirname(dataSourcesPath))) {
                    CONFIG.dbeaver.workspaceDir = workspacePath;
                    CONFIG.dbeaver.dataSourcesFile = dataSourcesPath;
                    CONFIG.dbeaver.credentialsFile = credentialsPath;
                    return true;
                }
            }
        }
        return false;
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
