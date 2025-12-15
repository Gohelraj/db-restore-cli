const ConfigManager = require('./src/config-manager');
const RestoreCLI = require('./src/restore-cli');

async function main() {
  const args = process.argv.slice(2);
  const configManager = new ConfigManager();

  // Handle --config flag to force reconfiguration
  if (args.includes('--config')) {
    await configManager.runSetup(true);
    process.exit(0);
  }

  // First run setup if no config exists
  if (!configManager.configExists()) {
    console.log('👋 Welcome! First-time setup required.\n');
    await configManager.runSetup();
  }

  // Load and apply config to environment
  configManager.load();
  configManager.applyToEnv();

  // Now require config.js after env is set
  const manager = new RestoreCLI();
  manager.run();
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
