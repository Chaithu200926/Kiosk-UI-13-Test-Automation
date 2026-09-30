// Run the kiosk UI tests on this PC and publish the results to GitHub.
//
//   npm run publish-results -- "Add KUI-05 seat type test"
//
// 1. Commits any code/test changes (everything except reports/) with the given message.
// 2. Runs all tests. Test failures do not stop publishing; they are reported.
// 3. Builds the dashboard into reports/ (index.html, assets/, history.json, summary.md, results.json).
//    The Playwright HTML report is NOT published: it holds raw screen layouts and API call logs.
// 4. Commits reports/ and pushes to origin/main. The "KIOSK UI Testing" workflow then
//    deploys reports/ to GitHub Pages and shows summary.md on the Actions run page.
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Project folder, output folder and the commit message given on the command line.
const root = path.join(__dirname, '..');
const reportDir = path.join(root, 'reports');
const message = process.argv.slice(2).join(' ').trim();

// Optional trailer lines (e.g. "Co-Authored-By: ...") appended to both commits.
const trailer = process.env.COMMIT_TRAILER ? `\n\n${process.env.COMMIT_TRAILER}` : '';

// Run a shell command in the project folder and return its output.
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
// Commit staged files; the message goes via stdin so multi-line messages survive on every shell.
const commit = (msg) => execSync('git commit -q -F -', { cwd: root, input: msg, stdio: ['pipe', 'pipe', 'pipe'] });
// Print a progress heading.
const step = (text) => console.log(`\n▶ ${text}`);

// Safety: stop if the secrets file (.env) is tracked by git.
if (/(^|\n)\.env$/m.test(sh('git ls-files'))) {
  console.error('.env is tracked by git. Remove it from the index before publishing.');
  process.exit(1);
}

// Step 1: commit code/test changes (not reports/) with the given message.
step('Committing code changes');
sh('git add -A -- . ":(exclude)reports"');
if (sh('git diff --cached --name-only')) {
  commit((message || 'Update tests') + trailer);
  console.log(`  committed: ${sh('git log -1 --pretty="%h %s"')}`);
} else {
  console.log('  no code changes');
}

// Step 2: run all tests; keep going even if some fail. The kiosk opens full screen while they run.
step('Running kiosk UI tests (the kiosk app will open full screen)');
const testRun = spawnSync('npx playwright test', { cwd: root, stdio: 'inherit', shell: true });
if (!fs.existsSync(path.join(root, 'test-results', 'results.json'))) {
  console.error('No results.json produced. Aborting publish.');
  process.exit(1);
}

// Step 3: build the dashboard (with its screenshots and videos) in reports/.
step('Building dashboard in reports/');
fs.mkdirSync(reportDir, { recursive: true });
fs.copyFileSync(path.join(root, 'test-results', 'results.json'), path.join(reportDir, 'results.json'));
execSync('node scripts/generate-dashboard.js', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, REPORT_DIR: 'reports', KIOSK_TRIGGER: 'published from QA PC' },
});
// results.json holds the screenshots inline; the dashboard has them as files, so keep only the stats.
const results = JSON.parse(fs.readFileSync(path.join(reportDir, 'results.json'), 'utf8'));
fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ stats: results.stats }, null, 2));

// Step 4: commit reports/ with a pass/fail summary as the message, then push to GitHub.
step('Committing and pushing results');
const s = results.stats || {};
const total = (s.expected || 0) + (s.unexpected || 0) + (s.skipped || 0) + (s.flaky || 0);
const summary = `${s.expected || 0}/${total} passed${s.unexpected ? `, ${s.unexpected} failed` : ''}`;
sh('git add reports');
commit(`Test results: ${summary}` + trailer);
execSync('git push -q origin HEAD:main', { cwd: root, stdio: 'inherit' });

// Step 5: print where to see the results.
const remote = sh('git remote get-url origin');
const slug = (remote.match(/github\.com[/:]([^/]+\/[^/.]+)/) || [])[1];
console.log(`\n✔ Published: ${summary}`);
if (slug) {
  console.log(`  Actions:   https://github.com/${slug}/actions`);
  console.log(`  Dashboard: https://${slug.split('/')[0].toLowerCase()}.github.io/${slug.split('/')[1]}/  (updates in ~1 minute)`);
}
// Test failures are reported on the dashboard and the Actions run, not as a publish error.
if (testRun.status !== 0) console.log('  Note: some tests failed. See the dashboard for details.');
