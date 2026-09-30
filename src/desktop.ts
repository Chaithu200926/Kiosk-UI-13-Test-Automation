// Windows desktop helpers used before and after tests.
import { execFileSync } from 'node:child_process';

/** Closes every running kiosk app (with its child process), so each test starts from a clean app. */
export function closeAllKiosks() {
  try {
    execFileSync('taskkill', ['/IM', 'CinescapeKiosk.exe', '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* none running */
  }
}

/** Windows shows the lock screen through LogonUI.exe. While it runs, screenshots and taps cannot work. */
export function desktopIsLocked() {
  try {
    return execFileSync('tasklist', ['/FI', 'IMAGENAME eq LogonUI.exe', '/NH'], { encoding: 'utf8' }).includes('LogonUI.exe');
  } catch {
    return false;
  }
}
