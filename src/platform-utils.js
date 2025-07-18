const { execSync } = require('child_process');
const path = require('path');

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
