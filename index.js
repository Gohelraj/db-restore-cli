const ConfigManager = require('./src/config-manager');

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

  // Load and apply config to environment BEFORE requiring other modules
  configManager.load();
  configManager.applyToEnv();

  // Clear require cache for config.js to pick up new env vars
  delete require.cache[require.resolve('./config.js')];

  // Now require RestoreCLI after env is set
  const RestoreCLI = require('./src/restore-cli');
  const manager = new RestoreCLI();
  manager.run();
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
