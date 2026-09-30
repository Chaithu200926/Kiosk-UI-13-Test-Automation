// KUI-15: a kiosk left untouched returns to the home screen, and seats held by an abandoned booking are released.
import { test, expect } from '../src/fixtures';
import { chooseSeatsType, expectReservation, openUpcomingShow, pickFreeSeats } from '../src/flows';
import type { Kiosk } from '../src/kiosk';

/** Waits (without touching the kiosk) until the home screen is back; returns the seconds it took. */
async function waitUntilHome(kiosk: Kiosk, maxSeconds: number) {
  const started = Date.now();
  while (Date.now() - started < maxSeconds * 1000) {
    if (await kiosk.hasText('UPCOMING SHOWS')) return Math.round((Date.now() - started) / 1000);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`The kiosk did not return to the home screen within ${maxSeconds} s of inactivity`);
}

test('KUI-15 Idle timeout: the kiosk returns home and releases held seats', async ({ kiosk }) => {
  test.setTimeout(900_000);

  await kiosk.step('Open NOW SHOWING, then leave the kiosk untouched', async () => {
    await kiosk.tap('NOW SHOWING', { settleMs: 1000 });
    await kiosk.waitForText('FILTER');
  });

  await kiosk.step('The kiosk returns to the home screen by itself', async () => {
    const seconds = await waitUntilHome(kiosk, 180);
    test.info().annotations.push({ type: 'idle timeout', description: `Film list → home after about ${seconds} s` });
    expect(seconds, 'Seconds until home').toBeGreaterThanOrEqual(15);
  });

  const show = await openUpcomingShow(kiosk);
  await chooseSeatsType(kiosk, 'General', 1);
  const since = Date.now();
  const [seat] = (await kiosk.step('Choose a free seat and proceed (the kiosk reserves it), then leave the kiosk', async () => {
    const seats = await pickFreeSeats(kiosk, 1);
    await kiosk.tap('Proceed', { settleMs: 2500 });
    await kiosk.waitForText('Select Food');
    return seats;
  }))!;
  const reservation = await expectReservation(kiosk, since, [seat]);

  await kiosk.step('Abandoned booking: the kiosk returns home by itself', async () => {
    // The booking timer on the checkout screen is about 7 minutes; allow 8.
    const seconds = await waitUntilHome(kiosk, 480);
    test.info().annotations.push({ type: 'idle timeout', description: `Food screen with a held seat → home after about ${seconds} s` });
  });

  await kiosk.step(`The held seat ${seat} was released (content/trans/cancel)`, async () => {
    const cancel = kiosk.apiCalls().filter((c) => c.path.startsWith('content/trans/cancel')
      && String((c.requestBody as { transid?: unknown })?.transid) === String(reservation.transid)).pop();
    expect(cancel, `A cancel call for transaction ${reservation.transid}`).toBeTruthy();
    expect((cancel!.responseBody as { code: number }).code, 'cancel response code').toBe(10001);
  });
});
