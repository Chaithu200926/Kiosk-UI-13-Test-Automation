// Runs once before all tests: starts the API recorder and Appium; the returned function stops them at the end.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { closeAllKiosks, desktopIsLocked } from './desktop';
import { startServices } from './services';

export default async function globalSetup() {
  if (!fs.existsSync(config.appPath)) {
    throw new Error(`Kiosk app not found at ${config.appPath}. Set KIOSK_APP_PATH in .env.`);
  }
  if (desktopIsLocked()) {
    throw new Error('Windows is locked. UI tests need an unlocked, logged-in desktop: unlock the PC and run again.');
  }
  const services = await startServices(path.resolve(__dirname, '..', 'test-results'));
  return async () => {
    await services.stop();
    // Never leave a kiosk open after the run.
    closeAllKiosks();
  };
}
