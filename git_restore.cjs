const { execSync } = require('child_process');
try {
  execSync('git checkout src/services/telegramService.ts');
  console.log('Git checkout successful');
} catch (e) {
  console.error('Git checkout failed', e);
}
