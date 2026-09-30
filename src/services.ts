// Starts the two local helpers every run needs: the API recorder and the Appium server.
// The kiosk app is launched by Appium, so it inherits HTTP_PROXY and sends its API calls through the recorder.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startApiRecorder } from './api-recorder';
import { config } from './config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function appiumIsUp(port: number) {
  try {
    return (await fetch(`http://127.0.0.1:${port}/status`)).ok;
  } catch {
    return false;
  }
}

/**
 * The first NovaWindows session after Appium starts often never answers on this PC (the test waited 3 min for it),
 * while every later session starts in seconds. Open a throwaway desktop session first and give up on it after 30 s,
 * so the first test's kiosk starts quickly.
 */
async function warmUpDriver(port: number) {
  const capabilities = { alwaysMatch: { platformName: 'Windows', 'appium:automationName': 'NovaWindows', 'appium:app': 'Root' } };
  try {
    const res = await fetch(`http://127.0.0.1:${port}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capabilities }),
      signal: AbortSignal.timeout(30_000),
    });
    const sessionId = ((await res.json()) as { value?: { sessionId?: string } }).value?.sessionId;
    if (sessionId) await fetch(`http://127.0.0.1:${port}/session/${sessionId}`, { method: 'DELETE' });
  } catch {
    /* timed out: the tests' own session will start normally */
  }
}

export async function startServices(logDir: string) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(path.dirname(config.apiCallsFile), { recursive: true });

  if (await appiumIsUp(config.appiumPort)) {
    throw new Error(`Something is already running on the Appium port ${config.appiumPort}. Stop it (e.g. "npm run appium" in another terminal) and run again.`);
  }

  const recorder = await startApiRecorder({ port: config.recorderPort, file: config.apiCallsFile });

  const log = fs.openSync(path.join(logDir, 'appium.log'), 'w');
  const appiumMain = path.join(path.dirname(require.resolve('appium/package.json')), 'index.js');
  const appium: ChildProcess = spawn(process.execPath, [appiumMain, '--port', String(config.appiumPort), '--log-no-colors'], {
    env: { ...process.env, HTTP_PROXY: recorder.url, NO_PROXY: 'localhost,127.0.0.1' },
    stdio: ['ignore', log, log],
  });

  const deadline = Date.now() + 60_000;
  while (!(await appiumIsUp(config.appiumPort))) {
    if (appium.exitCode !== null || Date.now() > deadline) {
      await recorder.close();
      throw new Error(`Appium did not start. See ${path.join(logDir, 'appium.log')}.`);
    }
    await sleep(1_000);
  }
  await warmUpDriver(config.appiumPort);

  return {
    stop: async () => {
      appium.kill();
      await recorder.close();
    },
  };
}
