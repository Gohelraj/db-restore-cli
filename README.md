# Database Restore CLI Tool

A comprehensive interactive CLI tool for restoring PostgreSQL databases from S3 backups or local dump files. Features automatic DBeaver integration, multi-environment support, and intelligent backup format detection.

## 🚀 Features

### Core Functionality
- **Dual Source Support**: Restore from AWS S3 backups or local dump files
- **Interactive Navigation**: Keyboard-driven menu system with arrow key navigation
- **Multi-Environment Support**: Separate dev, staging, and production environments
- **AWS Profile Management**: Support for multiple AWS profiles and regions
- **Format Intelligence**: Automatic detection and handling of various backup formats

### Supported Backup Formats
- **SQL Dumps** (`.sql`)
- **Custom PostgreSQL Dumps** (`.dump`, `.dmp`)
- **Compressed Archives** (`.tar.gz`, `.tgz`, `.tar`)
- **Gzipped SQL** (`.gz`)
- **Binary Dumps** (PostgreSQL custom format)

### Database Management
- **Flexible Database Options**:
  - Create new database with auto-generated names
  - Create database with custom names
  - Restore to existing databases
  - Replace existing databases (drop and recreate)
- **Intelligent Naming**: Environment and date-based database naming
- **Ownership Management**: Automatic database ownership and permission fixes
- **Verification System**: Post-restore validation and health checks

### DBeaver Integration
- **Automatic Connection Creation**: Seamlessly adds restored databases to DBeaver
- **Folder Organization**: Environment-based folder structure
- **Connection Naming**: Descriptive connection names with source information
- **Backup & Recovery**: Safe configuration file handling with backups

### Advanced Features
- **Multi-format Extraction**: Handles nested archives and compression
- **Error Recovery**: Alternative restoration methods for failed attempts
- **Progress Monitoring**: Real-time feedback and status updates
- **Cleanup Management**: Automatic temporary file cleanup
- **Comprehensive Logging**: Detailed operation logs and error reporting

## 📋 Requirements

### System Requirements
- **Node.js** 14.x or higher
- **PostgreSQL** 12.x or higher
- **AWS CLI** (for S3 operations)
- **tar/gzip** utilities (usually pre-installed)

### Database Requirements
- PostgreSQL server running and accessible
- User with database creation privileges
- Network connectivity to PostgreSQL server

### AWS Requirements (for S3 operations)
- AWS CLI configured with appropriate profiles
- S3 bucket access permissions
- Valid AWS credentials for each environment

## 🛠️ Installation

### Option 1: Global Installation

**Important:** Global installation requires setting up PostgreSQL credentials via environment variables since the global installation won't have access to a local `.env` file.

```bash
# Clone the repository
git clone https://github.com/Gohelraj/db-restore-cli.git
cd db-restore-cli

# Install dependencies
npm install

# Install globally
npm run install-global

# Set required environment variables for PostgreSQL
export PG_USER=postgres
export PG_PASSWORD=your_postgres_password
export PG_HOST=localhost
export PG_PORT=5432

# Use from anywhere
db-restore
```

**Alternative approach for persistent global configuration:**
```bash
# Create a global .env file in your home directory
echo "PG_USER=postgres" >> ~/.db-restore.env
echo "PG_PASSWORD=your_postgres_password" >> ~/.db-restore.env
echo "PG_HOST=localhost" >> ~/.db-restore.env
echo "PG_PORT=5432" >> ~/.db-restore.env

# Set the environment variable to point to this file
export DOTENV_CONFIG_PATH=~/.db-restore.env

# Then run the tool
db-restore
```

**On Windows:**
```cmd
# Set environment variables
set PG_USER=postgres
set PG_PASSWORD=your_postgres_password
set PG_HOST=localhost
set PG_PORT=5432

# Run the tool
db-restore
```

### Option 2: Local Usage
```bash
# Clone and install
git clone https://github.com/Gohelraj/db-restore-cli.git
cd db-restore-cli
npm install

# Run directly
npm start
# or
node restore.js
```

## ⚙️ Configuration

### 1. Environment Setup
Copy the example environment file and configure:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

#### For Local Installation:
Edit `.env` with your specific settings:

```bash
# Environment Configuration
NODE_ENV=development

# S3 Bucket Configuration
S3_BUCKET_DEV=my-dev-backups
S3_BUCKET_STAGE=my-stage-backups
S3_BUCKET_PROD=my-prod-backups

# AWS Region Configuration
AWS_REGION_DEV=ap-south-1
AWS_REGION_STAGE=eu-south-1
AWS_REGION_PROD=eu-south-1

# AWS Profiles (comma-separated)
AWS_PROFILES=dev,stage,prod,default

# PostgreSQL Configuration
PG_USER=postgres
PG_PASSWORD=your_postgres_password
PG_HOST=localhost
PG_PORT=5432

# Application Settings
LOCAL_TEMP_DIR=/tmp/db-restore
MAX_RETRIES=3
```

#### For Global Installation:
Since global installations don't have access to local `.env` files, you must set environment variables:

**Unix/Linux/macOS:**
```bash
# Add these to your ~/.bashrc, ~/.zshrc, or ~/.profile
export PG_USER=postgres
export PG_PASSWORD=your_postgres_password
export PG_HOST=localhost
export PG_PORT=5432

# Optional: S3 configuration for cloud backups
export S3_BUCKET_DEV=my-dev-backups
export S3_BUCKET_STAGE=my-stage-backups
export S3_BUCKET_PROD=my-prod-backups
export AWS_REGION_DEV=ap-south-1
export AWS_REGION_STAGE=eu-south-1
export AWS_REGION_PROD=eu-south-1
```

**Windows:**
```cmd
# Set permanently via System Properties > Environment Variables, or use setx
setx PG_USER postgres
setx PG_PASSWORD your_postgres_password
setx PG_HOST localhost
setx PG_PORT 5432
```

**PowerShell:**
```powershell
# Add to your PowerShell profile
[Environment]::SetEnvironmentVariable("PG_USER", "postgres", "User")
[Environment]::SetEnvironmentVariable("PG_PASSWORD", "your_postgres_password", "User")
[Environment]::SetEnvironmentVariable("PG_HOST", "localhost", "User")
[Environment]::SetEnvironmentVariable("PG_PORT", "5432", "User")
```

### 3. AWS Configuration

Ensure AWS CLI is configured with appropriate profiles:

```bash
# Configure AWS profiles
aws configure --profile dev
aws configure --profile stage
aws configure --profile prod

# Verify profiles
aws configure list-profiles
```

### 4. PostgreSQL Setup

Ensure PostgreSQL is running and accessible:

```bash
# Test connection
psql -h localhost -p 5432 -U postgres -c "SELECT version();"

# Set password if needed
export PGPASSWORD=your_password
```

## 🎯 Usage

### Interactive Mode (Recommended)

Simply run the tool and follow the interactive prompts:

```bash
db-restore
# or if installed locally
npm start
```

### Step-by-Step Process

1. **Source Selection**
   - Choose between cloud (S3) or local file restoration

2. **Environment Configuration** (for S3)
   - Select AWS profile
   - Choose environment (dev/stage/prod)

3. **Service Selection** (for S3)
   - Browse available services in S3 bucket
   - Select specific service to restore

4. **Backup Selection**
   - Choose from available backup files
   - View file details (size, date, etc.)

5. **Database Configuration**
   - Choose database creation options
   - Set custom database names if desired

6. **DBeaver Integration**
   - Configure automatic DBeaver connection
   - Organize connections in appropriate folders

7. **Execution**
   - Review restore summary
   - Confirm and execute restoration

### Example Workflows

#### Cloud Restoration
```bash
# 1. Start the tool
db-restore

# 2. Select "Cloud (AWS S3)"
# 3. Choose AWS profile: "dev"
# 4. Choose environment: "DEV"
# 5. Select service: "user-service"
# 6. Pick backup: "user-service-2024-01-15.tar.gz"
# 7. Choose: "Create new database with date suffix"
# 8. Database created: "dev_user_service_2024_01_15"
```

#### Local File Restoration
```bash
# 1. Start the tool
db-restore

# 2. Select "Local File"
# 3. Enter path: "/path/to/backup.sql"
# 4. Choose: "Create new database with custom name"
# 5. Enter name: "restored_database"
# 6. Database created: "restored_database"
```

## 🔧 Advanced Usage

### Manual Database Connection
```bash
# Connect to restored database
psql -h localhost -p 5432 -U postgres -d your_database_name

# List tables
\dt

# Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

### Troubleshooting Commands

#### Check PostgreSQL Status
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# View PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log
```

#### Global Installation Issues
```bash
# Check if environment variables are set correctly
echo $PG_USER
echo $PG_HOST
echo $PG_PORT

# Test PostgreSQL connection with your credentials
psql -h $PG_HOST -p $PG_PORT -U $PG_USER -c "SELECT version();"

# If global installation can't find PostgreSQL credentials:
# 1. Verify environment variables are set
# 2. Try running with explicit environment variables:
PG_USER=postgres PG_PASSWORD=yourpass PG_HOST=localhost PG_PORT=5432 db-restore
```

#### Environment Variable Troubleshooting
```bash
# Check all PostgreSQL-related environment variables
env | grep PG_

# For global installation, ensure variables persist across sessions
# Add to your shell profile (.bashrc, .zshrc, etc.):
echo 'export PG_USER=postgres' >> ~/.bashrc
echo 'export PG_PASSWORD=your_password' >> ~/.bashrc
source ~/.bashrc
```

#### AWS S3 Operations
```bash
# List S3 buckets
aws s3 ls --profile dev

# Check bucket contents
aws s3 ls s3://your-bucket-name --profile dev

# Test S3 access
aws s3 cp s3://your-bucket-name/test-file . --profile dev
```

#### DBeaver Integration
```bash
# DBeaver workspace locations:
# macOS: ~/Library/DBeaverData/workspace6
# Linux: ~/.local/share/DBeaverData/workspace6
# Windows: %APPDATA%/DBeaverData/workspace6

# Manual DBeaver refresh
# File → Refresh (F5) or restart DBeaver
```

## 🐛 Troubleshooting

### Common Issues

#### 1. AWS Authentication Errors
```bash
# Verify AWS credentials
aws sts get-caller-identity --profile dev

# Re-configure profile if needed
aws configure --profile dev
```

#### 2. PostgreSQL Connection Issues
```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Verify connection settings
psql -h localhost -p 5432 -U postgres -c "SELECT 1"

# Check postgresql.conf for connection settings
```

#### 3. Permission Errors
```bash
# Grant database creation privileges
psql -h localhost -p 5432 -U postgres -c "ALTER USER postgres CREATEDB;"

# Check user permissions
psql -h localhost -p 5432 -U postgres -c "\du"
```

#### 4. Backup Format Issues
```bash
# Check file format
file /path/to/backup.tar.gz

# Manual extraction test
tar -tzf /path/to/backup.tar.gz

# Verify SQL dump
head -20 /path/to/backup.sql
```

#### 5. DBeaver Integration Issues
```bash
# Check DBeaver workspace
ls -la ~/Library/DBeaverData/workspace6/General/.dbeaver/

# Verify data-sources.json
cat ~/Library/DBeaverData/workspace6/General/.dbeaver/data-sources.json
```

#### 6. Windows DBeaver SCRAM Authentication Error
If you encounter "The server requested SCRAM-based authentication, but no password was provided" error in DBeaver on Windows:

**Quick Fix:**
1. Open DBeaver
2. Right-click on the connection created by the tool
3. Select "Edit Connection"
4. Go to "Main" tab and enter your PostgreSQL password
5. Click "Test Connection" to verify
6. Click "OK" to save

**Alternative Solutions:**

**Method 1: Manual Password Entry (Recommended)**
```
1. In DBeaver, find the restored database connection
2. Double-click to connect (it will prompt for password)
3. Enter your PostgreSQL password
4. Check "Save password" if you want it remembered
5. Click "OK"
```

**Method 2: Edit Connection Properties**
```
1. Right-click connection → Properties
2. Go to Connection Settings → Main
3. Enter password in "Password" field
4. Check "Save password locally"
5. Apply changes
```

**Method 3: Windows Environment Variable Setup**
```cmd
# Set PostgreSQL password environment variable
setx PGPASSWORD your_postgres_password

# Restart DBeaver after setting this
```

**Method 4: Configure PostgreSQL for Trust Authentication (Development Only)**
```bash
# Edit pg_hba.conf file (usually in PostgreSQL data directory)
# Change the authentication method from 'scram-sha-256' to 'trust' for localhost
# Find line like:
host    all             all             127.0.0.1/32            scram-sha-256

# Change to:
host    all             all             127.0.0.1/32            trust

# Restart PostgreSQL service
net stop postgresql-x64-14
net start postgresql-x64-14
```

**⚠️ Security Note:** Method 4 removes password authentication for localhost connections. Only use this for development environments.

### Error Codes and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `S3 bucket not accessible` | Missing AWS permissions | Check AWS profile and S3 permissions |
| `PostgreSQL connection failed` | Database server down or wrong credentials | Start PostgreSQL service, check PG_* environment variables |
| `No backup files found` | Incorrect S3 path/prefix | Verify S3 bucket and service name |
| `Backup extraction failed` | Corrupted file | Re-download backup file |
| `Database creation failed` | Permission issues | Check user privileges |
| `DBeaver integration failed` | Workspace not found | Manually specify DBeaver workspace path |
| `Missing PostgreSQL credentials (global)` | Environment variables not set | Set PG_USER, PG_PASSWORD, PG_HOST, PG_PORT environment variables |
| `dotenv config not found` | Global installation without env vars | Use environment variables instead of .env file |
| `SCRAM authentication error in DBeaver (Windows)` | Password not saved in DBeaver connection | Manually enter password in DBeaver connection settings |
| `DBeaver connection created but password required` | Tool doesn't store passwords in DBeaver | Right-click connection → Edit Connection → Enter password |

### Performance Tips

#### Large Backup Files
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 restore.js

# Use faster temporary directory
export LOCAL_TEMP_DIR=/dev/shm/db-restore  # RAM disk on Linux
```

#### Network Optimization
```bash
# For slow S3 downloads, configure AWS CLI
aws configure set max_concurrent_requests 1 --profile dev
aws configure set max_bandwidth 50MB/s --profile dev
```

## 📦 Building and Distribution

### Creating Standalone Binaries

You can create standalone executable binaries that others can use without installing Node.js. This is useful for distributing the tool to team members or deploying to production servers.

#### Prerequisites for Building

```bash
# Install pkg globally
npm install -g pkg

# Or use npx (no global installation needed)
npx pkg --version
```

#### Quick Build Commands

```bash
# Clone and prepare the project
git clone https://github.com/Gohelraj/db-restore-cli.git
cd db-restore-cli
npm install

# Build for current platform (using Node.js 18 - most stable with pkg)
npx pkg . --targets node18 --output ./build/db-restore

# Build for all major platforms
npx pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --out-path ./build/
```

#### Platform-Specific Builds

```bash
# Windows (64-bit)
npx pkg . --targets node18-win-x64 --output ./build/db-restore-win.exe

# Linux (64-bit)
npx pkg . --targets node18-linux-x64 --output ./build/db-restore-linux

# macOS (64-bit Intel)
npx pkg . --targets node18-macos-x64 --output ./build/db-restore-macos

# macOS (64-bit Apple Silicon)
npx pkg . --targets node18-macos-arm64 --output ./build/db-restore-macos-arm64

# All platforms at once
npx pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64,node18-macos-arm64 --out-path ./build/
```

#### Troubleshooting Build Issues

**Error: "No available node version satisfies 'nodeXX'"**
```bash
# Use specific supported versions instead of 'latest'
# pkg supports these Node.js versions: 14, 16, 18, 20
npx pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --out-path ./build/

# Check available targets
npx pkg --help
```

**Alternative Node.js versions if node18 doesn't work:**
```bash
# Try Node.js 20 (newer but stable)
npx pkg . --targets node20-win-x64,node20-linux-x64,node20-macos-x64 --out-path ./build/

# Or Node.js 16 (older but very stable)
npx pkg . --targets node16-win-x64,node16-linux-x64,node16-macos-x64 --out-path ./build/
```

#### Advanced Build Configuration

Add this to your `package.json` for more control:

```json
{
  "name": "database-restore-manager",
  "version": "1.0.0",
  "bin": {
    "db-restore": "./restore.js"
  },
  "pkg": {
    "scripts": [
      "restore.js",
      "config.js"
    ],
    "assets": [
      ".env.example"
    ],
    "targets": [
      "node18-win-x64",
      "node18-linux-x64",
      "node18-macos-x64",
      "node18-macos-arm64"
    ],
    "outputPath": "build"
  }
}
```

Then simply run:
```bash
npx pkg .
```

#### Build Script for package.json

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "build": "pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64,node18-macos-arm64 --out-path ./build/",
    "build:win": "pkg . --targets node18-win-x64 --output ./build/db-restore-win.exe",
    "build:linux": "pkg . --targets node18-linux-x64 --output ./build/db-restore-linux",
    "build:macos": "pkg . --targets node18-macos-x64 --output ./build/db-restore-macos",
    "build:macos-arm": "pkg . --targets node18-macos-arm64 --output ./build/db-restore-macos-arm64",
    "build:all": "npm run build:win && npm run build:linux && npm run build:macos && npm run build:macos-arm"
  }
}
```

Then use:
```bash
npm run build:all
```

### Distribution Guide

#### 1. Prepare Distribution Package

```bash
# Create distribution directory
mkdir -p dist/db-restore-cli-v1.0.0

# Copy binaries
cp build/db-restore-* dist/db-restore-cli-v1.0.0/

# Copy documentation and examples
cp README.md dist/db-restore-cli-v1.0.0/
cp .env.example dist/db-restore-cli-v1.0.0/

# Create setup instructions
cat > dist/db-restore-cli-v1.0.0/SETUP.md << 'EOF'
# Database Restore CLI - Setup Instructions

## Prerequisites
- PostgreSQL client tools (psql, pg_restore, pg_isready)
- AWS CLI (for S3 operations)

## Quick Start
1. Set environment variables for PostgreSQL:
   - PG_USER=postgres
   - PG_PASSWORD=your_password
   - PG_HOST=localhost
   - PG_PORT=5432

2. Run the appropriate binary for your system:
   - Windows: db-restore-win.exe
   - Linux: ./db-restore-linux
   - macOS: ./db-restore-macos

## Full Documentation
See README.md for complete setup and usage instructions.
EOF

# Create archive
cd dist
tar -czf db-restore-cli-v1.0.0.tar.gz db-restore-cli-v1.0.0/
zip -r db-restore-cli-v1.0.0.zip db-restore-cli-v1.0.0/
```

#### 2. GitHub Releases - Step by Step Guide

##### Step 1: Build Your Binaries
```bash
# First, build all binaries
npm run build:all

# Verify the build output
ls -la build/
# Should show:
# db-restore-win.exe
# db-restore-linux
# db-restore-macos
# db-restore-macos-arm64
```

##### Step 2: Prepare Release Files
```bash
# Create release directory structure
mkdir -p releases/v1.0.0

# Copy binaries with descriptive names
cp build/db-restore-win.exe releases/v1.0.0/db-restore-windows-x64.exe
cp build/db-restore-linux releases/v1.0.0/db-restore-linux-x64
cp build/db-restore-macos releases/v1.0.0/db-restore-macos-x64
cp build/db-restore-macos-arm64 releases/v1.0.0/db-restore-macos-arm64

# Make Linux and macOS binaries executable
chmod +x releases/v1.0.0/db-restore-linux-x64
chmod +x releases/v1.0.0/db-restore-macos-x64
chmod +x releases/v1.0.0/db-restore-macos-arm64

# Create checksums for verification
cd releases/v1.0.0
sha256sum * > checksums.txt

# Check file sizes and checksums
ls -lah
cat checksums.txt
cd ../..
```

##### Step 3: Create GitHub Release (Web Interface)

**Option A: Using GitHub Web Interface (Recommended for beginners)**

1. **Go to your GitHub repository** in a web browser
2. **Click on "Releases"** (on the right side of the repository page)
3. **Click "Create a new release"** or "Draft a new release"
4. **Fill in the release details:**
   - **Tag version**: `v1.0.0` (this will create a new tag)
   - **Release title**: `Database Restore CLI v1.0.0`
   - **Describe this release**: Use the template below

5. **Upload binary files:**
   - Drag and drop OR click "Attach binaries by dropping them here or selecting them"
   - Upload these files from `releases/v1.0.0/`:
     - `db-restore-windows-x64.exe`
     - `db-restore-linux-x64`
     - `db-restore-macos-x64`
     - `db-restore-macos-arm64`
     - `checksums.txt`

6. **Choose release type:**
   - ✅ Check "Set as the latest release" (for stable releases)
   - ⚠️ Check "Set as a pre-release" (for beta/test releases)

7. **Click "Publish release"**

##### Step 4: Release Description Template

Copy this template for your release description:

```markdown
# Database Restore CLI v1.0.0

A comprehensive interactive CLI tool for restoring PostgreSQL databases from S3 backups or local dump files.

## 🚀 New Features
- Interactive menu-driven interface
- Support for multiple backup formats (SQL, tar.gz, custom dumps)
- Automatic DBeaver integration
- Multi-environment S3 support
- Windows SCRAM authentication fixes

## 📦 Download Instructions

Choose the appropriate binary for your operating system:

### Windows
📥 **Download**: [`db-restore-windows-x64.exe`](link-will-be-auto-generated)

**Setup:**
```cmd
# Set environment variables (one-time setup)
setx PG_USER postgres
setx PG_PASSWORD your_postgres_password
setx PG_HOST localhost
setx PG_PORT 5432

# Run the tool
db-restore-windows-x64.exe
```

### Linux
📥 **Download**: [`db-restore-linux-x64`](link-will-be-auto-generated)

**Setup:**
```bash
# Download and make executable
wget https://github.com/Gohelraj/db-restore-cli/releases/download/v1.0.0/db-restore-linux-x64
chmod +x db-restore-linux-x64

# Set environment variables
export PG_USER=postgres
export PG_PASSWORD=your_postgres_password

# Run the tool
./db-restore-linux-x64
```

### macOS (Intel)
📥 **Download**: [`db-restore-macos-x64`](link-will-be-auto-generated)

### macOS (Apple Silicon)
📥 **Download**: [`db-restore-macos-arm64`](link-will-be-auto-generated)

**Setup for both macOS versions:**
```bash
# Download and make executable
chmod +x db-restore-macos-*

# Set environment variables
export PG_USER=postgres
export PG_PASSWORD=your_postgres_password

# Run the tool
./db-restore-macos-x64
# or
./db-restore-macos-arm64
```

## 🔧 Prerequisites

All platforms require:
- **PostgreSQL client tools** (`psql`, `pg_restore`, `pg_isready`)
- **AWS CLI** (for S3 operations) - `aws configure` must be set up
- **PostgreSQL server** running and accessible

## 📋 Quick Start

1. Download the appropriate binary for your system
2. Set the required environment variables (see platform-specific instructions above)
3. Make sure PostgreSQL client tools are installed
4. Run the binary and follow the interactive prompts

## 🔍 File Verification

Verify your download using the checksums:

```bash
# Download checksums file
wget https://github.com/Gohelraj/db-restore-cli/releases/download/v1.0.0/checksums.txt

# Verify file integrity (Linux/macOS)
sha256sum -c checksums.txt

# Verify file integrity (Windows PowerShell)
Get-FileHash db-restore-windows-x64.exe -Algorithm SHA256
```

## 📖 Full Documentation

For complete setup instructions, troubleshooting, and advanced usage, see the [README](https://github.com/Gohelraj/db-restore-cli/blob/main/README.md).

## 🐛 Known Issues

- Windows users may need to manually enter passwords in DBeaver connections
- Requires PostgreSQL client tools to be in PATH
- S3 operations require AWS CLI configuration

## 🆘 Support

If you encounter issues:
1. Check the [troubleshooting section](https://github.com/Gohelraj/db-restore-cli/blob/main/README.md#-troubleshooting) in the README
2. [Open an issue](https://github.com/Gohelraj/db-restore-cli/issues) with detailed error information
3. Include your OS, PostgreSQL version, and error messages

---

**File Sizes:**
- Windows: ~45MB
- Linux: ~42MB  
- macOS: ~43MB

**SHA256 Checksums:** See `checksums.txt`
```

##### Step 5: Using GitHub CLI (Advanced Users)

**Option B: Using GitHub CLI**

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Linux: See https://cli.github.com/
# Windows: Download from https://cli.github.com/

# Login to GitHub
gh auth login

# Create release with files
gh release create v1.0.0 \
  releases/v1.0.0/db-restore-windows-x64.exe \
  releases/v1.0.0/db-restore-linux-x64 \
  releases/v1.0.0/db-restore-macos-x64 \
  releases/v1.0.0/db-restore-macos-arm64 \
  releases/v1.0.0/checksums.txt \
  --title "Database Restore CLI v1.0.0" \
  --notes-file release-notes.md

# Or create release interactively
gh release create v1.0.0 releases/v1.0.0/* --generate-notes
```

##### Step 6: Post-Release Tasks

1. **Test the release:**
   ```bash
   # Download and test your own release
   wget https://github.com/YOUR_USERNAME/db-restore-cli/releases/download/v1.0.0/db-restore-linux-x64
   chmod +x db-restore-linux-x64
   ./db-restore-linux-x64
   ```

2. **Update documentation:**
   - Update README badges if you have them
   - Add release to changelog
   - Update installation instructions

3. **Announce the release:**
   - Share on social media
   - Update project documentation
   - Notify users/team members

##### Automated Release Workflow (Optional)

Create `.github/workflows/release.yml` for automatic releases:

```yaml
name: Release Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install pkg
        run: npm install -g pkg

      - name: Build binaries
        run: npm run build:all

      - name: Prepare release files
        run: |
          mkdir -p release-files
          cp build/db-restore-win.exe release-files/db-restore-windows-x64.exe
          cp build/db-restore-linux release-files/db-restore-linux-x64
          cp build/db-restore-macos release-files/db-restore-macos-x64
          cp build/db-restore-macos-arm64 release-files/db-restore-macos-arm64
          cd release-files
          sha256sum * > checksums.txt

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release-files/db-restore-windows-x64.exe
            release-files/db-restore-linux-x64
            release-files/db-restore-macos-x64
            release-files/db-restore-macos-arm64
            release-files/checksums.txt
          body: |
            ## Database Restore CLI ${{ github.ref_name }}
            
            Standalone binaries for Windows, Linux, and macOS.
            
            See [README](https://github.com/${{ github.repository }}/blob/main/README.md) for setup instructions.
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This workflow will automatically create releases when you push a tag like `v1.0.0`.

#### 3. Docker Distribution

Create a Dockerfile for containerized distribution:

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install PostgreSQL client tools
RUN apk add --no-cache postgresql-client aws-cli

# Create app directory
WORKDIR /app

# Copy application files
COPY package*.json ./
RUN npm ci --only=production

COPY restore.js config.js ./

# Create non-root user
RUN addgroup -g 1001 -S dbuser && \
    adduser -S dbuser -u 1001

USER dbuser

ENTRYPOINT ["node", "restore.js"]
```

Build and distribute:
```bash
# Build Docker image
docker build -t db-restore-cli:latest .

# Create distributable image
docker save db-restore-cli:latest > db-restore-cli-docker.tar

# Or push to registry
docker tag db-restore-cli:latest yourusername/db-restore-cli:latest
docker push yourusername/db-restore-cli:latest
```

### Important Distribution Notes

#### 1. **Dependencies Requirements**
The binary includes Node.js runtime and your application code, but users still need:
- PostgreSQL client tools (`psql`, `pg_restore`, `pg_isready`)
- AWS CLI (for S3 operations)
- Network access to PostgreSQL and S3

#### 2. **Environment Variables**
Since binaries can't use local `.env` files, users must set environment variables:
```bash
# Required for PostgreSQL access
PG_USER=postgres
PG_PASSWORD=your_password
PG_HOST=localhost
PG_PORT=5432

# Optional for S3 operations
S3_BUCKET_DEV=your-dev-bucket
S3_BUCKET_STAGE=your-stage-bucket
S3_BUCKET_PROD=your-prod-bucket
```

#### 3. **File Paths and Permissions**
- Ensure temporary directory permissions
- Consider different path separators (Windows vs Unix)
- Test file extraction on target platforms

#### 4. **Testing Distribution**
```bash
# Test on clean systems
# Windows
db-restore-windows-x64.exe

# Linux (test on different distributions)
./db-restore-linux-x64

# macOS
./db-restore-macos-x64
```

### Alternative Distribution Methods

#### 1. **NPM Global Package** (Requires Node.js)
```bash
# Publish to npm (if public)
npm publish

# Users install with:
npm install -g database-restore-manager
```

#### 2. **Homebrew (macOS/Linux)**
Create a Homebrew formula for easy installation.

#### 3. **Windows Package Manager**
Submit to winget or chocolatey for Windows users.

#### 4. **AppImage (Linux)**
Create a portable AppImage for Linux distribution.

### Build Automation

Create a GitHub Action for automated builds:

```yaml
# .github/workflows/build.yml
name: Build Binaries
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm install -g pkg
      
      - run: pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64,node18-macos-arm64 --out-path ./build/
      
      - uses: actions/upload-artifact@v3
        with:
          name: binaries
          path: build/
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit changes: `git commit -am 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Raj Gohel**

## 🔗 Links

- [Repository](https://github.com/Gohelraj/db-restore-cli)
- [Issues](https://github.com/Gohelraj/db-restore-cli/issues)
- [Releases](https://github.com/Gohelraj/db-restore-cli/releases)

---

## 📊 Quick Reference

### Supported File Types
| Extension | Type | Handling |
|-----------|------|----------|
| `.sql` | Plain SQL | Direct psql import |
| `.dump` | PostgreSQL custom | pg_restore |
| `.tar.gz` | Compressed archive | Extract → Auto-detect |
| `.tgz` | Compressed archive | Extract → Auto-detect |
| `.tar` | Archive | Extract → Auto-detect |
| `.gz` | Gzipped SQL | Decompress → psql |

### Environment Variables Reference
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_BUCKET_DEV` | Yes* | - | Development S3 bucket |
| `S3_BUCKET_STAGE` | Yes* | - | Staging S3 bucket |
| `S3_BUCKET_PROD` | Yes* | - | Production S3 bucket |
| `PG_USER` | **Yes*** | postgres | PostgreSQL username |
| `PG_PASSWORD` | **Yes*** | - | PostgreSQL password |
| `PG_HOST` | No | localhost | PostgreSQL host |
| `PG_PORT` | No | 5432 | PostgreSQL port |
| `LOCAL_TEMP_DIR` | No | /tmp/db-restore | Temporary directory |

*Required only for S3 operations  
**Required for global installation (strongly recommended for local installation)

### Installation Method Comparison

| Feature | Local Installation | Global Installation |
|---------|-------------------|-------------------|
| Configuration | `.env` file in project directory | Environment variables only |
| Setup Complexity | Simple (copy .env.example) | Requires setting system env vars |
| Portability | Project-specific settings | System-wide availability |
| Updates | `git pull` and restart | Reinstall via npm |
| Recommended for | Development, testing | Production use, system tools |

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate menu options |
| `Enter` | Select option |
| `Ctrl+C` | Exit application |
| `F5` | Refresh DBeaver (in DBeaver) |
