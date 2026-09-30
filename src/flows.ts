// Booking steps shared by several tests. None of them goes past "Preview and Checkout":
// no mobile number, no sign-in and no payment.
import { expect } from '@playwright/test';
import type { Kiosk } from './kiosk';
import { pickShow, showsFromCalls, type Show } from './programme';

/** "KWD 3.500" → 3.5 */
export const kwd = (text: string) => Number((text.match(/KWD\s*([\d.]+)/) || [])[1] ?? NaN);

/** Picks a show later today with free seats, from the programme the kiosk loaded at start-up. */
export async function upcomingShow(kiosk: Kiosk, options?: Parameters<typeof pickShow>[1]): Promise<Show> {
  await kiosk.waitForApiCall('content/csessions');
  return pickShow(showsFromCalls(kiosk.apiCalls()), options);
}

/**
 * Home → NOW SHOWING → a film on the first screen (no scrolling) that has a show later today →
 * that show, ending on "Select Seat Type". Returns the chosen show.
 * Standard shows by default: VIP and other experiences have different seat types (no "General").
 */
export async function openUpcomingShow(kiosk: Kiosk, options?: Parameters<typeof pickShow>[1]): Promise<Show> {
  await kiosk.waitForApiCall('content/csessions');
  const programme = showsFromCalls(kiosk.apiCalls());
  const show = (await kiosk.step('Open NOW SHOWING', async () => {
    await kiosk.tap('NOW SHOWING', { settleMs: 1500 });
    const onScreen = new Set((await kiosk.visibleTexts()).map((t) => t.name));
    return pickShow(programme.filter((s) => onScreen.has(s.film)), { experience: 'Standard', ...options });
  }))!;
  await kiosk.step(`Choose "${show.film}"`, async () => {
    await kiosk.tap(show.film, { settleMs: 1500 });
    await kiosk.waitForText(show.time);
  });
  await kiosk.step(`Choose the ${show.time} ${show.experience} show`, async () => {
    await kiosk.tap(show.time, { settleMs: 2500 });
    await kiosk.waitForText('Select Seat Type');
  });
  return show;
}

/** Seat areas on "Select Seat Type" with their free seats and price, e.g. General: 138 seats, 3.5 KWD. */
export async function seatAreas(kiosk: Kiosk) {
  const texts = await kiosk.texts();
  const areas: { name: string; available: number; price: number }[] = [];
  texts.forEach((t, i) => {
    const m = texts[i + 1]?.match(/^(\d+) Available\s+KWD ([\d.]+)$/);
    if (m) areas.push({ name: t, available: Number(m[1]), price: Number(m[2]) });
  });
  return areas;
}

/** Reads "Total Ticket Price   KWD 7.000" (NaN when no price is shown yet). */
export async function totalTicketPrice(kiosk: Kiosk) {
  return kwd(await kiosk.textStartingWith('Total Ticket Price'));
}

/** Seat type + quantity, then Proceed to the seat map. */
export async function chooseSeatsType(kiosk: Kiosk, area: string, quantity: number) {
  await kiosk.step(`Choose ${area} and ${quantity} ticket(s), then proceed to the seat map`, async () => {
    await kiosk.tap(area);
    for (let i = 1; i < quantity; i++) await kiosk.tap('+', { settleMs: 500 });
    await kiosk.tap('Proceed', { settleMs: 2500 });
    await kiosk.waitForText('Select Seat');
  });
}

/**
 * Chooses `count` free seats next to each other at the edge of a free block, so the kiosk's
 * "no single empty seat" rule never blocks them. Returns labels like ["K27", "K26"].
 */
export async function pickFreeSeats(kiosk: Kiosk, count: number): Promise<string[]> {
  const states = await kiosk.seatStates();
  const seats = await kiosk.seats();
  const rows = [...new Set(seats.map((s) => s.row))];
  for (const row of rows.reverse()) {
    const inRow = seats.filter((s) => s.row === row).sort((a, b) => a.x - b.x);
    // Split the row into runs of neighbouring free seats (a gap in x means an aisle).
    let run: typeof inRow = [];
    const runs: (typeof inRow)[] = [];
    inRow.forEach((s, i) => {
      const free = states.get(`${s.row}${s.number}`) === 'available';
      const adjacent = i > 0 && s.x - inRow[i - 1].x < s.width * 1.6;
      if (free && run.length && adjacent) run.push(s);
      else { if (run.length) runs.push(run); run = free ? [s] : []; }
    });
    if (run.length) runs.push(run);
    const block = runs.find((r) => r.length === count || r.length >= count + 2);
    if (block) {
      const chosen = block.slice(0, count).map((s) => `${s.row}${s.number}`);
      for (const label of chosen) await selectSeat(kiosk, label);
      return chosen;
    }
  }
  throw new Error(`No block of ${count} free seat(s) found on the seat map`);
}

/**
 * Taps a seat and waits until it shows in the selection bar. The seat map redraws after every
 * selection and a tap during the redraw is lost, so it taps once more if the seat does not appear.
 */
export async function selectSeat(kiosk: Kiosk, label: string) {
  const seat = () => kiosk.seat(label.slice(0, 1), label.slice(1));
  for (let attempt = 1; attempt <= 2; attempt++) {
    await seat().click();
    try {
      await kiosk.waitForText(label, 5_000);
      // Let the map finish redrawing before the next tap.
      await new Promise((r) => setTimeout(r, 1_000));
      return;
    } catch {
      if (attempt === 2) throw new Error(`Seat ${label} was tapped twice but did not appear in the selection`);
    }
  }
}

/** Checks the kiosk reserved the seats (content/trans/reserveseats) and returns the reservation. */
export async function expectReservation(kiosk: Kiosk, since: number, seats: string[]) {
  const call = await kiosk.waitForApiCall('content/trans/reserveseats', since);
  const body = call.responseBody as { code: number; output: { transid: string; seats: string; totalPrice: string; ticketPrice: string } };
  expect(call.status, 'reserveseats HTTP status').toBe(200);
  expect(body.code, 'reserveseats response code').toBe(10001);
  for (const seat of seats) expect(body.output.seats, 'Reserved seats').toContain(seat);
  return body.output;
}

/** The cheapest item on the menu, used by the paying food tests to keep the club card spending low. */
export const CHEAP_FOOD = { tab: 'Beverages', name: 'Aquafina Water UAT', price: 0.5 };

/** On "Select Food": opens the item's tab and taps its ADD button (for items without options). */
export async function addFood(kiosk: Kiosk, item = CHEAP_FOOD) {
  await kiosk.tap(item.tab, { settleMs: 1500 });
  // Each menu row is a DataItem named "FoodItem { ..., Name = <item name>, ... }" holding its ADD button.
  await kiosk.app.$(`//DataItem[contains(@Name, "Name = ${item.name},")]//Button`).click();
  await new Promise((r) => setTimeout(r, 1500));
}
