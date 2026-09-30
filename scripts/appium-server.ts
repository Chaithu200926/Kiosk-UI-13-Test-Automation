// "npm run appium": starts the API recorder and Appium for exploring the kiosk with scripts/inspect.mjs.
// Keep it running in its own terminal and press Ctrl+C to stop. (The tests start their own copy.)
import path from 'node:path';
import { config } from '../src/config';
import { startServices } from '../src/services';

async function main() {
  const services = await startServices(path.resolve(__dirname, '..', 'inspect'));
  console.log(`Appium on port ${config.appiumPort}; kiosk API calls are recorded to ${config.apiCallsFile}`);
  process.on('SIGINT', async () => {
    await services.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
