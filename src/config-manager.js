const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.db-restore');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
    S3_BUCKET_DEV: '',
    S3_BUCKET_STAGE: '',
    S3_BUCKET_PROD: '',
    AWS_REGION_DEV: 'ap-south-1',
    AWS_REGION_STAGE: 'eu-south-1',
    AWS_REGION_PROD: 'eu-south-1',
    AWS_PROFILES: 'dev,stage,prod,default',
    PG_USER: 'postgres',
    PG_PASSWORD: '',
    PG_HOST: 'localhost',
    PG_PORT: '5432',
    LOCAL_TEMP_DIR: path.join(os.tmpdir(), 'db-restore'),
    MAX_RETRIES: '3'
};

const CONFIG_PROMPTS = [
    { key: 'S3_BUCKET_DEV', label: 'S3 Bucket (Dev)', required: false },
    { key: 'S3_BUCKET_STAGE', label: 'S3 Bucket (Stage)', required: false },
    { key: 'S3_BUCKET_PROD', label: 'S3 Bucket (Prod)', required: false },
    { key: 'AWS_REGION_DEV', label: 'AWS Region (Dev)', required: false },
    { key: 'AWS_REGION_STAGE', label: 'AWS Region (Stage)', required: false },
    { key: 'AWS_REGION_PROD', label: 'AWS Region (Prod)', required: false },
    { key: 'AWS_PROFILES', label: 'AWS Profiles (comma-separated)', required: false },
    { key: 'PG_USER', label: 'PostgreSQL User', required: true },
    { key: 'PG_PASSWORD', label: 'PostgreSQL Password', required: false, sensitive: true },
    { key: 'PG_HOST', label: 'PostgreSQL Host', required: true },
    { key: 'PG_PORT', label: 'PostgreSQL Port', required: true }
];

class ConfigManager {
    constructor() {
        this.config = {};
    }

    configExists() {
        return fs.existsSync(CONFIG_FILE);
    }

    load() {
        if (this.configExists()) {
            try {
                const data = fs.readFileSync(CONFIG_FILE, 'utf8');
                this.config = JSON.parse(data);
                return true;
            } catch (error) {
                console.error(`⚠️  Error reading config: ${error.message}`);
                return false;
            }
        }
        return false;
    }

    save() {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    }

    get(key) {
        return this.config[key] ?? DEFAULTS[key] ?? '';
    }

    set(key, value) {
        this.config[key] = value;
    }

    applyToEnv() {
        // Merge defaults with saved config and apply to process.env
        const merged = { ...DEFAULTS, ...this.config };
        for (const [key, value] of Object.entries(merged)) {
            if (!process.env[key] && value) {
                process.env[key] = value;
            }
        }
    }

    async prompt(question, defaultValue = '', sensitive = false) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const defaultHint = defaultValue ? ` [${sensitive ? '****' : defaultValue}]` : '';
            rl.question(`${question}${defaultHint}: `, (answer) => {
                rl.close();
                resolve(answer.trim() || defaultValue);
            });
        });
    }

    async runSetup(force = false) {
        console.clear();
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║           🔧 Database Restore CLI - Configuration          ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        if (!force && this.configExists()) {
            console.log('✅ Configuration already exists.\n');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('Do you want to reconfigure? (y/N): ', async (answer) => {
                    rl.close();
                    if (answer.toLowerCase() !== 'y') {
                        resolve(false);
                        return;
                    }
                    await this.collectConfig();
                    resolve(true);
                });
            });
        }

        await this.collectConfig();
        return true;
    }

    async collectConfig() {
        console.log('Press Enter to use default values shown in brackets.\n');
        console.log('─────────────────────────────────────────────────────────────\n');

        // Load existing config for defaults
        this.load();

        console.log('📦 S3 Bucket Configuration\n');
        for (const item of CONFIG_PROMPTS.filter(p => p.key.startsWith('S3_'))) {
            const current = this.get(item.key);
            const value = await this.prompt(item.label, current);
            this.set(item.key, value);
        }

        console.log('\n☁️  AWS Configuration\n');
        for (const item of CONFIG_PROMPTS.filter(p => p.key.startsWith('AWS_'))) {
            const current = this.get(item.key);
            const value = await this.prompt(item.label, current);
            this.set(item.key, value);
        }

        console.log('\n🐘 PostgreSQL Configuration\n');
        for (const item of CONFIG_PROMPTS.filter(p => p.key.startsWith('PG_'))) {
            const current = this.get(item.key);
            const value = await this.prompt(item.label, current, item.sensitive);
            this.set(item.key, value);
        }

        this.save();

        console.log('\n─────────────────────────────────────────────────────────────');
        console.log(`\n✅ Configuration saved to: ${CONFIG_FILE}`);
        console.log('💡 Run with --config to modify settings anytime.\n');
    }

    static getConfigPath() {
        return CONFIG_FILE;
    }
}

module.exports = ConfigManager;
