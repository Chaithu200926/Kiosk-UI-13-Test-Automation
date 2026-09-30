// KUI-04: COMING SOON lists the upcoming films with their opening dates and details.
import { test, expect } from '../src/fixtures';

test('KUI-04 Coming soon: films show opening dates and details, not on sale yet', async ({ kiosk }) => {
  const films = await kiosk.step('Open COMING SOON: films are listed with an opening date', async () => {
    await kiosk.tap('COMING SOON', { settleMs: 2000 });
    await kiosk.waitForText('Coming Soon');
    const texts = await kiosk.texts();
    // Each tile is a title followed by "Opens <date>".
    const list = texts.flatMap((t, i) => (texts[i + 1]?.startsWith('Opens ') ? [{ title: t, opens: texts[i + 1] }] : []));
    expect(list.length, 'Coming-soon films').toBeGreaterThan(0);
    for (const f of list) {
      const date = new Date(f.opens.replace('Opens ', ''));
      expect.soft(date.getTime(), `${f.title}: "${f.opens}" is a future date`).toBeGreaterThan(Date.now() - 24 * 3600_000);
    }
    return list;
  });

  await kiosk.step('The kiosk loaded the list from content/comingsoon', async () => {
    const call = await kiosk.waitForApiCall('content/comingsoon');
    expect(call.status).toBe(200);
    expect((call.responseBody as { code: number }).code).toBe(10001);
  });

  const first = films![0];
  await kiosk.step(`Open "${first.title}": details and "Tickets are not on sale yet."`, async () => {
    await kiosk.tap(first.title, { settleMs: 1500 });
    await kiosk.waitForText('Tickets are not on sale yet.');
    const texts = await kiosk.texts();
    expect.soft(texts.some((t) => /\|\s+\d+ hr( \d+ min)?$/.test(t)), 'Language | genre | run time').toBe(true);
    expect.soft(texts.filter((t) => t === first.opens).length, 'Opening date in the details').toBeGreaterThan(1);
    expect.soft(texts.some((t) => t.length > 40), 'Synopsis').toBe(true);
  });

  await kiosk.step('Close the details, then HOME', async () => {
    await kiosk.tap('Close', { settleMs: 1000 });
    expect(await kiosk.hasText('Tickets are not on sale yet.'), 'Details closed').toBe(false);
    await kiosk.tap('HOME', { settleMs: 2000 });
    await kiosk.waitForText('UPCOMING SHOWS');
  });
});
