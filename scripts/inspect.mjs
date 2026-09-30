// Kiosk inspector: explore the kiosk screens by hand to find element names for new tests.
//
//   npm run appium                                (in a second terminal; keeps Appium running)
//   node scripts/inspect.mjs start                starts the kiosk and remembers the session
//   node scripts/inspect.mjs dump home            saves inspect/home.png + home.xml and lists the controls
//   node scripts/inspect.mjs click "NOW SHOWING"  clicks the first control with that Name
//   node scripts/inspect.mjs click "NOW SHOWING" 2  clicks the 2nd match
//   node scripts/inspect.mjs id HomeNowShowing    clicks the control with that AutomationId
//   node scripts/inspect.mjs xpath "//Button[3]"  clicks the element found by an XPath
//   node scripts/inspect.mjs type "Edit" "hello"  types into the first control with that Name (or ControlType when no Name)
//   node scripts/inspect.mjs outage on|off       simulate the UAT API being down (HTTP 503)
//   node scripts/inspect.mjs stop                 closes the kiosk and ends the session
//
// Output goes to the inspect/ folder, which git ignores.
import fs from 'node:fs';
import path from 'node:path';
import { attach, remote } from 'webdriverio';
import { settings } from './settings.mjs';

const root = path.join(import.meta.dirname, '..');
const outDir = path.join(root, 'inspect');
const sessionFile = path.join(outDir, '.session.json');
const [command, ...args] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const connection = { hostname: '127.0.0.1', port: settings.appiumPort, logLevel: 'warn' };

// Reconnect to the session saved by "start".
async function current() {
  if (!fs.existsSync(sessionFile)) throw new Error('No session. Run: node scripts/inspect.mjs start');
  const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  return attach({ ...connection, sessionId: saved.sessionId, capabilities: saved.capabilities });
}

// Lists visible controls, one per line: type, #AutomationId, "Name" and position.
// Unnamed controls are listed only when they have an AutomationId or are buttons/inputs.
function summarise(xml) {
  const attr = (tag, key) => (tag.match(new RegExp(`\\b${key}="([^"]*)"`)) || [])[1] ?? '';
  return [...xml.matchAll(/<(\w+)\b[^>]*>/g)]
    .map(([tag, type]) => ({ type, tag }))
    .filter(({ tag }) => attr(tag, 'IsOffscreen') !== 'True')
    .map(({ type, tag }) => ({ type, id: attr(tag, 'AutomationId'), name: attr(tag, 'Name'),
      pos: `@${attr(tag, 'x')},${attr(tag, 'y')} ${attr(tag, 'width')}x${attr(tag, 'height')}` }))
    .filter(({ type, id, name }) => name || id || /Button|Edit|CheckBox|ComboBox|ListItem/.test(type))
    .map(({ type, id, name, pos }) =>
      `${type}${id ? ' #' + id : ''}${name ? ' "' + (name.length > 80 ? name.slice(0, 80) + '…' : name) + '"' : ''} ${pos}`);
}

const byName = (app, name, nth = 1) => app.$$(`//*[@Name="${name}"]`).then((all) => {
  if (all.length < nth) throw new Error(`Found ${all.length} control(s) named "${name}", wanted #${nth}`);
  return all[nth - 1];
});

if (command === 'start') {
  const app = await remote({
    ...connection,
    connectionRetryTimeout: 180_000,
    capabilities: {
      platformName: 'Windows',
      'appium:automationName': 'NovaWindows',
      'appium:app': settings.appPath,
      'appium:appWorkingDir': path.dirname(settings.appPath),
      // Keep the session alive for 30 minutes between commands while exploring by hand.
      'appium:newCommandTimeout': 1800,
    },
  });
  fs.writeFileSync(sessionFile, JSON.stringify({ sessionId: app.sessionId, capabilities: app.capabilities }));
  console.log(`Kiosk started, session ${app.sessionId}`);
} else if (command === 'dump') {
  const app = await current();
  const name = args[0] || `screen-${Date.now()}`;
  const xml = await app.getPageSource();
  fs.writeFileSync(path.join(outDir, `${name}.xml`), xml);
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(await app.takeScreenshot(), 'base64'));
  console.log(summarise(xml).join('\n'));
  console.log(`\nSaved inspect/${name}.png and inspect/${name}.xml`);
} else if (command === 'click') {
  const app = await current();
  await (await byName(app, args[0], Number(args[1] || 1))).click();
  console.log(`Clicked "${args[0]}"`);
} else if (command === 'id') {
  const app = await current();
  await app.$(`~${args[0]}`).click();
  console.log(`Clicked #${args[0]}`);
} else if (command === 'xpath') {
  const app = await current();
  await app.$(args[0]).click();
  console.log(`Clicked ${args[0]}`);
} else if (command === 'type') {
  const app = await current();
  const target = (await app.$$(`//*[@Name="${args[0]}"]`))[0] ?? (await app.$(`//${args[0]}`));
  await target.setValue(args[1]);
  console.log(`Typed into "${args[0]}"`);
} else if (command === 'outage') {
  // Simulated API outage: while the switch file exists the recorder answers kiosk API calls with 503.
  const file = path.join(root, 'test-results', 'kiosk-api-calls.outage');
  if (args[0] === 'on') fs.writeFileSync(file, 'on'); else fs.rmSync(file, { force: true });
  console.log(`API outage ${args[0] === 'on' ? 'ON' : 'OFF'}`);
} else if (command === 'stop') {
  const app = await current();
  await app.deleteSession().catch(() => undefined);
  fs.rmSync(sessionFile, { force: true });
  console.log('Session ended');
} else {
  console.log('Commands: start | dump [name] | click "<Name>" [n] | xpath "<xpath>" | type "<Name>" "<text>" | stop');
}
