const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PlatformUtils {
    static isWindows() {
        return process.platform === 'win32';
    }

    static isLinux() {
        return process.platform === 'linux';
    }

    static isMacOS() {
        return process.platform === 'darwin';
    }

    static isUbuntu() {
        if (!this.isLinux()) return false;
        
        try {
            // Check /etc/os-release for Ubuntu
            if (fs.existsSync('/etc/os-release')) {
                const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                return osRelease.toLowerCase().includes('ubuntu');
            }
            
            // Fallback: check lsb_release command
            const result = execSync('lsb_release -i', { stdio: 'pipe', encoding: 'utf8' });
            return result.toLowerCase().includes('ubuntu');
        } catch (error) {
            // If we can't determine, assume it might be Ubuntu if it's Linux
            return false;
        }
    }

    static getUbuntuDistribution() {
        if (!this.isUbuntu()) return null;
        
        try {
            if (fs.existsSync('/etc/os-release')) {
                const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                const nameMatch = osRelease.match(/^NAME="([^"]+)"/m);
                if (nameMatch) {
                    return nameMatch[1];
                }
            }
            
            const result = execSync('lsb_release -d', { stdio: 'pipe', encoding: 'utf8' });
            const match = result.match(/Description:\s*(.+)/);
            return match ? match[1].trim() : 'Ubuntu';
        } catch (error) {
            return 'Ubuntu';
        }
    }

    static detectDbeaverInstallationType() {
        if (!this.isLinux()) return null;
        
        const homeDir = os.homedir();
        const installationTypes = [];
        
        // Check for Snap installation
        if (fs.existsSync(path.join(homeDir, 'snap', 'dbeaver-ce'))) {
            installationTypes.push('snap');
        }
        
        // Check for Flatpak installation
        if (fs.existsSync(path.join(homeDir, '.var', 'app', 'io.dbeaver.DBeaverCommunity'))) {
            installationTypes.push('flatpak');
        }
        
        // Check for AppImage in common locations
        const appImagePaths = [
            path.join(homeDir, 'Applications'),
            path.join(homeDir, '.local', 'share', 'applications'),
            path.join(homeDir, 'Desktop'),
            path.join(homeDir, 'Downloads')
        ];
        
        for (const appPath of appImagePaths) {
            if (fs.existsSync(appPath)) {
                try {
                    const files = fs.readdirSync(appPath);
                    if (files.some(file => file.toLowerCase().includes('dbeaver') && file.endsWith('.AppImage'))) {
                        installationTypes.push('appimage');
                        break;
                    }
                } catch (error) {
                    // Ignore read errors
                }
            }
        }
        
        // Check for system-wide installation
        if (fs.existsSync('/usr/share/dbeaver') || fs.existsSync('/opt/dbeaver')) {
            installationTypes.push('system');
        }
        
        // Check for manual installation in home directory
        if (fs.existsSync(path.join(homeDir, 'dbeaver'))) {
            installationTypes.push('manual');
        }
        
        return installationTypes.length > 0 ? installationTypes : ['unknown'];
    }

    static getCommandPath(command) {
        if (this.isWindows()) {
            const extensions = ['', '.exe', '.cmd', '.bat'];
            for (const ext of extensions) {
                try {
                    execSync(`where ${command}${ext}`, { stdio: 'pipe' });
                    return command + ext;
                } catch (e) {
                    // continue searching
                }
            }
        }
        return command;
    }

    static getTarCommand() {
        if (this.isWindows()) {
            try {
                execSync('tar --version', { stdio: 'pipe' });
                return 'tar';
            } catch (e) {
                try {
                    execSync('7z', { stdio: 'pipe' });
                    return '7z';
                } catch (e2) {
                    throw new Error('No suitable archive extraction tool found. Please install 7-Zip or use Windows 10+ built-in tar.');
                }
            }
        }
        return 'tar';
    }

    static getRemoveCommand(dirPath) {
        if (this.isWindows()) {
            return `rmdir /s /q "${dirPath}"`;
        }
        return `rm -rf "${dirPath}"`;
    }

    static escapeShellArg(arg) {
        if (this.isWindows()) {
            // Windows cmd escaping - wrap in double quotes and escape internal quotes
            return `"${arg.replace(/"/g, '""')}"`;
        } else {
            // Unix/Linux shell escaping - use single quotes and handle embedded single quotes
            return `'${arg.replace(/'/g, "'\"'\"'")}'`;
        }
    }

    static getGunzipCommand(inputPath, outputPath) {
        if (this.isWindows()) {
            const powershellCmd = `powershell -Command "& {$input = [System.IO.File]::OpenRead('${inputPath.replace(/\\/g, '\\\\')}'); $gzip = New-Object System.IO.Compression.GzipStream($input, [System.IO.Compression.CompressionMode]::Decompress); $output = [System.IO.File]::Create('${outputPath.replace(/\\/g, '\\\\')}'); $gzip.CopyTo($output); $gzip.Close(); $output.Close(); $input.Close()}"`;
            try {
                execSync('powershell -Command "Get-Command Expand-Archive"', { stdio: 'pipe' });
                return powershellCmd;
            } catch (e) {
                return `7z x "${inputPath}" -o"${path.dirname(outputPath)}"`;
            }
        }
        return `gunzip -c ${this.escapeShellArg(inputPath)} > ${this.escapeShellArg(outputPath)}`;
    }

    static validatePostgreSQLTools() {
        const tools = ['psql', 'pg_restore', 'pg_isready'];
        const missing = [];

        for (const tool of tools) {
            try {
                const cmd = this.getCommandPath(tool);
                execSync(`${cmd} --version`, { stdio: 'pipe' });
            } catch (e) {
                missing.push(tool);
            }
        }

        if (missing.length > 0) {
            const platform = this.isWindows() ? 'Windows' : this.isLinux() ? 'Linux' : 'macOS';
            let installMsg = '';

            if (this.isWindows()) {
                installMsg = 'Please install PostgreSQL and ensure tools are in PATH, or download from https://www.postgresql.org/download/windows/';
            } else if (this.isLinux()) {
                installMsg = 'Please install postgresql-client: sudo apt-get install postgresql-client (Debian/Ubuntu) or sudo yum install postgresql (RHEL/CentOS)';
            } else {
                installMsg = 'Please install PostgreSQL: brew install postgresql';
            }

            throw new Error(`Missing PostgreSQL tools on ${platform}: ${missing.join(', ')}.\n${installMsg}`);
        }

        return true;
    }
}

module.exports = PlatformUtils;
