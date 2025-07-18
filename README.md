# Database Restore CLI Tool

A comprehensive interactive CLI tool for restoring PostgreSQL databases from S3 backups or local dump files. Features automatic DBeaver integration, multi-environment support, and intelligent backup format detection.

## 🚀 Quick Start with Binary Release

Download the appropriate binary for your operating system from the [latest release](https://github.com/Gohelraj/db-restore-cli/releases/latest) and follow the setup instructions below.

### 📦 Download Binary

Choose the appropriate binary for your system:

| Platform | Download | Size |
|----------|----------|------|
| **Windows** | `db-restore-windows-x64.exe` | ~45MB |
| **Linux** | `db-restore-linux-x64` | ~42MB |
| **macOS (Intel)** | `db-restore-macos-x64` | ~43MB |
| **macOS (Apple Silicon)** | `db-restore-macos-arm64` | ~43MB |

### 📋 Prerequisites

Before using the tool, ensure you have:

1. **PostgreSQL client tools** installed:
   - `psql`, `pg_restore`, `pg_isready`
   - Usually included with PostgreSQL installation

2. **AWS CLI** (for S3 operations):
   - Install from [AWS CLI official page](https://aws.amazon.com/cli/)
   - Configure with `aws configure`

3. **PostgreSQL server** running and accessible

### ⚙️ Setup Instructions

#### Windows Setup

1. **Download the binary:**
   ```cmd
   # Download db-restore-windows-x64.exe from releases
   ```

2. **Set environment variables (required):**
   ```cmd
   # PostgreSQL Configuration (Required)
   setx PG_USER postgres
   setx PG_PASSWORD your_postgres_password
   setx PG_HOST localhost
   setx PG_PORT 5432
   
   # AWS S3 Configuration (Required for S3 restore)
   setx S3_BUCKET_DEV your-dev-bucket-name
   setx S3_BUCKET_STAGE your-stage-bucket-name
   setx S3_BUCKET_PROD your-prod-bucket-name
   setx AWS_REGION_DEV ap-south-1
   setx AWS_REGION_STAGE eu-south-1
   setx AWS_REGION_PROD eu-south-1
   
   # Or set via PowerShell
   [Environment]::SetEnvironmentVariable("PG_USER", "postgres", "User")
   [Environment]::SetEnvironmentVariable("PG_PASSWORD", "your_password", "User")
   [Environment]::SetEnvironmentVariable("PG_HOST", "localhost", "User")
   [Environment]::SetEnvironmentVariable("PG_PORT", "5432", "User")
   
   # AWS S3 via PowerShell
   [Environment]::SetEnvironmentVariable("S3_BUCKET_DEV", "your-dev-bucket", "User")
   [Environment]::SetEnvironmentVariable("S3_BUCKET_STAGE", "your-stage-bucket", "User")
   [Environment]::SetEnvironmentVariable("S3_BUCKET_PROD", "your-prod-bucket", "User")
   [Environment]::SetEnvironmentVariable("AWS_REGION_DEV", "ap-south-1", "User")
   [Environment]::SetEnvironmentVariable("AWS_REGION_STAGE", "eu-south-1", "User")
   [Environment]::SetEnvironmentVariable("AWS_REGION_PROD", "eu-south-1", "User")
   ```

3. **Run the tool:**
   ```cmd
   db-restore-windows-x64.exe
   ```

#### Linux Setup

1. **Download and make executable:**
   ```bash
   # Download the binary
   wget https://github.com/Gohelraj/db-restore-cli/releases/latest/download/db-restore-linux-x64
   
   # Make executable
   chmod +x db-restore-linux-x64
   ```

2. **Set environment variables:**
   ```bash
   # PostgreSQL Configuration (Required)
   export PG_USER=postgres
   export PG_PASSWORD=your_postgres_password
   export PG_HOST=localhost
   export PG_PORT=5432
   
   # AWS S3 Configuration (Required for S3 restore)
   export S3_BUCKET_DEV=your-dev-bucket-name
   export S3_BUCKET_STAGE=your-stage-bucket-name
   export S3_BUCKET_PROD=your-prod-bucket-name
   export AWS_REGION_DEV=ap-south-1
   export AWS_REGION_STAGE=eu-south-1
   export AWS_REGION_PROD=eu-south-1
   
   # Make permanent by adding to ~/.bashrc or ~/.zshrc
   echo 'export PG_USER=postgres' >> ~/.bashrc
   echo 'export PG_PASSWORD=your_password' >> ~/.bashrc
   echo 'export PG_HOST=localhost' >> ~/.bashrc
   echo 'export PG_PORT=5432' >> ~/.bashrc
   
   # AWS S3 variables (for S3 restore)
   echo 'export S3_BUCKET_DEV=your-dev-bucket-name' >> ~/.bashrc
   echo 'export S3_BUCKET_STAGE=your-stage-bucket-name' >> ~/.bashrc
   echo 'export S3_BUCKET_PROD=your-prod-bucket-name' >> ~/.bashrc
   echo 'export AWS_REGION_DEV=ap-south-1' >> ~/.bashrc
   echo 'export AWS_REGION_STAGE=eu-south-1' >> ~/.bashrc
   echo 'export AWS_REGION_PROD=eu-south-1' >> ~/.bashrc
   
   source ~/.bashrc
   ```

3. **Run the tool:**
   ```bash
   ./db-restore-linux-x64
   ```

#### macOS Setup

1. **Download and make executable:**
   ```bash
   # For Intel Macs
   wget https://github.com/Gohelraj/db-restore-cli/releases/latest/download/db-restore-macos-x64
   chmod +x db-restore-macos-x64
   
   # For Apple Silicon Macs
   wget https://github.com/Gohelraj/db-restore-cli/releases/latest/download/db-restore-macos-arm64
   chmod +x db-restore-macos-arm64
   ```

2. **Set environment variables:**
   ```bash
   # PostgreSQL Configuration (Required)
   export PG_USER=postgres
   export PG_PASSWORD=your_postgres_password
   export PG_HOST=localhost
   export PG_PORT=5432
   
   # AWS S3 Configuration (Required for S3 restore)
   export S3_BUCKET_DEV=your-dev-bucket-name
   export S3_BUCKET_STAGE=your-stage-bucket-name
   export S3_BUCKET_PROD=your-prod-bucket-name
   export AWS_REGION_DEV=ap-south-1
   export AWS_REGION_STAGE=eu-south-1
   export AWS_REGION_PROD=eu-south-1
   
   # Make permanent by adding to ~/.zshrc (macOS default)
   echo 'export PG_USER=postgres' >> ~/.zshrc
   echo 'export PG_PASSWORD=your_password' >> ~/.zshrc
   echo 'export PG_HOST=localhost' >> ~/.zshrc
   echo 'export PG_PORT=5432' >> ~/.zshrc
   
   # AWS S3 variables (for S3 restore)
   echo 'export S3_BUCKET_DEV=your-dev-bucket-name' >> ~/.zshrc
   echo 'export S3_BUCKET_STAGE=your-stage-bucket-name' >> ~/.zshrc
   echo 'export S3_BUCKET_PROD=your-prod-bucket-name' >> ~/.zshrc
   echo 'export AWS_REGION_DEV=ap-south-1' >> ~/.zshrc
   echo 'export AWS_REGION_STAGE=eu-south-1' >> ~/.zshrc
   echo 'export AWS_REGION_PROD=eu-south-1' >> ~/.zshrc
   
   source ~/.zshrc
   ```

3. **Run the tool:**
   ```bash
   # For Intel Macs
   ./db-restore-macos-x64
   
   # For Apple Silicon Macs
   ./db-restore-macos-arm64
   ```

### 🎯 How to Use

1. **Start the tool** by running the binary
2. **Choose source**: Cloud (S3) or Local File
3. **Follow the interactive prompts:**
   - Select AWS profile and environment (for S3)
   - Choose service and backup file
   - Configure database options
   - Confirm restoration

The tool provides a user-friendly menu interface with arrow key navigation.

### 💡 Example Usage

**For S3 Backups:**
```bash
# 1. Run the tool
./db-restore-linux-x64

# 2. Select "Cloud (AWS S3)"
# 3. Choose AWS profile: "dev"
# 4. Select environment: "DEV" 
# 5. Pick service: "user-service"
# 6. Choose backup: "user-service-2024-01-15.tar.gz"
# 7. Select: "Create new database with date suffix"
# 8. ✅ Database restored: "dev_user_service_2024_01_15"
```

**For Local Files:**
```bash
# 1. Run the tool
./db-restore-linux-x64

# 2. Select "Local File"
# 3. Enter path: "/path/to/backup.sql"
# 4. Choose database option
# 5. ✅ Database restored successfully
```

## 🔧 Supported Features

- **Multiple backup formats**: `.sql`, `.dump`, `.tar.gz`, `.tgz`, `.gz`
- **S3 integration**: Direct restore from AWS S3 buckets
- **DBeaver integration**: Automatic connection creation
- **Multi-environment support**: Dev, staging, production
- **Interactive interface**: Arrow key navigation
- **Database flexibility**: Create new, replace existing, or restore to existing databases

## 🐛 Common Issues & Solutions

### Windows DBeaver Password Issue
If DBeaver asks for password after restore:
1. Right-click the connection in DBeaver
2. Select "Edit Connection" 
3. Enter your PostgreSQL password
4. Click "Test Connection" → "OK"

### Environment Variables Not Set
```bash
# Check if variables are set
echo $PG_USER

# If empty, set them again and restart terminal
```

### PostgreSQL Connection Failed
```bash
# Test PostgreSQL connection
psql -h localhost -p 5432 -U postgres -c "SELECT 1"

# If fails, check if PostgreSQL is running
# Windows: Check services
# Linux/macOS: sudo systemctl status postgresql
```

## 📖 Complete Documentation

For detailed information including:
- Development setup and source installation
- Advanced configuration options
- Comprehensive troubleshooting guide
- Building from source
- Contributing guidelines

See: **[DOCUMENTATION.md](DOCUMENTATION.md)**

## 🆘 Support

**Need help?**
1. Check [Common Issues](#-common-issues--solutions) above
2. Review the [complete documentation](DOCUMENTATION.md)
3. [Open an issue](https://github.com/Gohelraj/db-restore-cli/issues) with:
   - Your operating system
   - PostgreSQL version
   - Complete error message
   - Steps to reproduce

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🔗 Links

- **[Download Latest Release](https://github.com/Gohelraj/db-restore-cli/releases/latest)**
- **[Complete Documentation](DOCUMENTATION.md)**
- **[Report Issues](https://github.com/Gohelraj/db-restore-cli/issues)**
- **[Source Code](https://github.com/Gohelraj/db-restore-cli)**

---

**Quick Reference:**
- Windows: `db-restore-windows-x64.exe`
- Linux: `./db-restore-linux-x64` 
- macOS Intel: `./db-restore-macos-x64`
- macOS Apple Silicon: `./db-restore-macos-arm64`

*Remember to set PostgreSQL environment variables before running!*
