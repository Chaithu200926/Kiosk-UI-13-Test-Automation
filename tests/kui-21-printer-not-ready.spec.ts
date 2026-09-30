// KUI-21: printer not ready (paper out / offline) — BLOCKED on this test kiosk, so the test is not run.
//
// Tried 2026-09-29: marking the paper roll as used up in the kiosk's paper counter
// (C:\ProgramData\KNCC\CinescapeKioskNew\state\paper-roll.json, UsedCm = RollLengthCm) does not stop printing:
// with UseFakePrinter=true the kiosk sold a food order, "printed" it and showed "Booking Success!" (booking WKTQHLD).
// kiosk.settings.json has no switch to make the fake printer report "out of paper" or "offline".
// To automate this, the developers need to add such a switch (or the test needs a real printer without paper).
// Expected then: "The ticket printer is not ready, so nothing was printed..." and "Please show this screen...".
import { test } from '../src/fixtures';

test.fixme('KUI-21 Printer out of paper: clear message, nothing printed', async () => {
  // Blocked: see the note above.
});
