// KUI-05: the seat type screen lists the areas with prices, and the total follows the ticket quantity.
import { test, expect } from '../src/fixtures';
import { openUpcomingShow, seatAreas, totalTicketPrice } from '../src/flows';

test('KUI-05 Seat type and ticket quantity: total = price x quantity', async ({ kiosk }) => {
  const show = await openUpcomingShow(kiosk);

  const areas = await kiosk.step('Seat areas are listed with free seats and a KWD price', async () => {
    const list = await seatAreas(kiosk);
    expect(list.length, 'Seat areas').toBeGreaterThan(0);
    for (const a of list) expect.soft(a.price, `${a.name} price`).toBeGreaterThan(0);
    expect(await kiosk.hasText('Ticket Quantity'), 'Ticket Quantity').toBe(true);
    return list;
  });
  // Prefer General; otherwise the area with most free seats.
  const area = areas!.find((a) => a.name === 'General') ?? [...areas!].sort((a, b) => b.available - a.available)[0];

  await kiosk.step(`Choose ${area.name}: total = 1 x KWD ${area.price.toFixed(3)}`, async () => {
    await kiosk.tap(area.name);
    expect(await totalTicketPrice(kiosk)).toBeCloseTo(area.price, 3);
  });

  for (const quantity of [2, 3]) {
    await kiosk.step(`Quantity ${quantity}: total = ${quantity} x KWD ${area.price.toFixed(3)}`, async () => {
      await kiosk.tap('+', { settleMs: 600 });
      expect(await totalTicketPrice(kiosk)).toBeCloseTo(area.price * quantity, 3);
    });
  }

  await kiosk.step(`Quantity back to 2 with −: total = 2 x KWD ${area.price.toFixed(3)}`, async () => {
    await kiosk.tap('−', { settleMs: 600 });
    expect(await totalTicketPrice(kiosk)).toBeCloseTo(area.price * 2, 3);
  });

  await kiosk.step('Terms: "By clicking proceed, I agree to the terms & conditions" is shown', async () => {
    expect(await kiosk.hasText('By clicking proceed, I agree to the')).toBe(true);
    expect(await kiosk.hasButton('terms & conditions')).toBe(true);
  });

  await kiosk.step('Cancel leaves the booking and returns to the film', async () => {
    await kiosk.tap('Cancel', { settleMs: 1500 });
    await kiosk.waitForText(show.film);
    expect(await kiosk.hasButton('MOVIES'), 'Back on the film screen').toBe(true);
  });
});
