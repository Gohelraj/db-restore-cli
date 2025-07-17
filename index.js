const RestoreCLI = require('./src/restore-cli');

if (require.main === module) {
  const manager = new RestoreCLI();
  manager.run();
}
