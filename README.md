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
