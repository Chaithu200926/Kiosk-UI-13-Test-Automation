// Paying by club card and reading the result, shared by the purchase tests (KUI-07, 08, 10, 11, 16, 17, 21).
// These tests spend real UAT club card money. Kiosk bookings are not in the customer's web account, so they
// cannot be cancelled online: every paid BOOKING ID is recorded as a "paid booking" note in the report instead.
import { expect, test } from '@playwright/test';
import { config } from './config';
import { kwd } from './flows';
import type { Kiosk } from './kiosk';

export interface Payment {
  /** Amount charged to the club card, in KWD. */
  amount: number;
  /** Internal booking number, e.g. "2003465". */
  bookingId: string;
  /** BOOKING ID the kiosk confirmed (content/trans/tckbooked "kioskId"), e.g. "WK4TD8Q". */
  reference: string;
  /** The kiosk's calls after PAY started (payment, booking confirmation, ...). */
  since: number;
}

/**
 * From "Preview and Checkout": mobile number → PROCEED TO PAYMENT → CLUB CARD → card number → PAY,
 * until the club card payment is answered. The video pauses while the mobile and card number are on screen,
 * and screenshots black them out.
 */
export async function payByClubCard(kiosk: Kiosk): Promise<Payment> {
  if (!config.mobile || !config.customer.clubCard) throw new Error('Set KIOSK_TEST_MOBILE and KIOSK_TEST_CLUB_CARD in .env');
  const total = kwd(await kiosk.textStartingWith('Total '));
  kiosk.privateOnScreen = true;
  await kiosk.video?.pause();

  await kiosk.step('Enter the mobile number and proceed to payment', async () => {
    await kiosk.typeDigits(config.mobile);
    await kiosk.tap('PROCEED TO PAYMENT', { settleMs: 2500 });
    await kiosk.waitForText('Select Payment Method');
    expect(await kiosk.hasText(`KWD ${total.toFixed(3)}`), `Amount to be paid KWD ${total.toFixed(3)}`).toBe(true);
  });

  await kiosk.step('Choose CLUB CARD', async () => {
    await kiosk.tap('CLUB CARD', { settleMs: 800 });
    await kiosk.tap('Proceed', { settleMs: 2500 });
    await kiosk.waitForText('Pay with your club card');
    expect(await kiosk.hasText('The whole amount is paid from the card.')).toBe(true);
  });

  const since = Date.now();
  await kiosk.step('Enter the club card number and PAY', async () => {
    await kiosk.typeDigits(config.customer.clubCard);
    expect(await kiosk.hasText(config.mobile), 'The mobile on the card is filled in from checkout').toBe(true);
    await kiosk.tap('PAY', { settleMs: 500 });
  });

  const payment = await kiosk.step('The club card payment is approved and the booking confirmed (clubcard/kiosk/pay, content/trans/tckbooked)', async () => {
    const call = await kiosk.waitForApiCall('clubcard/kiosk/pay', since, 90_000);
    const body = call.responseBody as { code: number; msg: string; output?: { amount: string; PAID: string; bookingId: string } };
    expect(call.status, 'HTTP status').toBe(200);
    expect(body.code, `Payment answer: ${body.msg}`).toBe(10001);
    expect(body.output?.PAID, 'PAID').toBe('YES');
    const bookingId = body.output!.bookingId;
    // Record the paid booking straight away, so it is in the report even if a later check fails.
    const note = { type: 'paid booking', description: paidNote(`booking ${bookingId}`, total) };
    test.info().annotations.push(note);
    expect(kwd(body.output!.amount), 'Amount charged').toBeCloseTo(total, 3);

    const booked = await kiosk.waitForApiCall('content/trans/tckbooked', since, 60_000);
    const confirmation = booked.responseBody as { code: number; msg: string; output?: { bookingId: string; kioskId: string } };
    expect(confirmation.code, `Booking confirmation: ${confirmation.msg}`).toBe(10001);
    expect(confirmation.output?.bookingId, 'Same booking as the payment').toBe(bookingId);
    const reference = confirmation.output!.kioskId;
    note.description = paidNote(`BOOKING ID ${reference} (booking ${bookingId})`, total);
    return { amount: total, bookingId, reference, since };
  });
  // The payment screen is gone once the kiosk has moved on to the result.
  for (let i = 0; i < 60 && (await kiosk.hasText('Pay with your club card')); i++) await new Promise((r) => setTimeout(r, 500));
  kiosk.video?.resume();
  return payment!;
}

/** Text of the report note for a paid booking, so it can be cancelled or refunded in the back office. */
function paidNote(booking: string, amount: number) {
  return `${booking}, KWD ${amount.toFixed(3)} paid by club card. Not cancelled: kiosk bookings cannot be cancelled online.`;
}

/**
 * The details on "Booking Success!": BOOKING ID, DATE & TIME, CATEGORY, SCREEN, SEATS, FOOD PICKUP NO. and
 * TOTAL PAID. (Ticket orders show "TOTAL PAID   KWD 3.500" as one text; food-only orders as two.)
 */
export async function successDetails(kiosk: Kiosk) {
  const texts = await kiosk.texts();
  const has = (label: string) => texts.includes(label);
  const after = (label: string) => (has(label) ? texts[texts.indexOf(label) + 1] ?? '' : '');
  const seatsAt = texts.indexOf('SEATS');
  const totalAt = texts.findIndex((t) => t.startsWith('TOTAL PAID'));
  const totalText = totalAt < 0 ? '' : texts[totalAt] === 'TOTAL PAID' ? texts[totalAt + 1] ?? '' : texts[totalAt];
  return {
    reference: after('BOOKING ID'),
    dateTime: after('DATE & TIME').replace(/\s+/g, ' '),
    category: after('CATEGORY'),
    screen: after('SCREEN'),
    seats: seatsAt >= 0 && totalAt > seatsAt ? texts.slice(seatsAt + 1, totalAt) : [],
    foodPickupNumber: after('FOOD PICKUP NO.'),
    totalPaid: kwd(totalText),
  };
}

/** After a purchase the kiosk goes back to the home screen by itself (about 30 s on this kiosk). */
export async function expectReturnsHome(kiosk: Kiosk) {
  await kiosk.step('The kiosk returns to the home screen by itself', async () => {
    const start = Date.now();
    await kiosk.waitForText('UPCOMING SHOWS', 120_000);
    test.info().annotations.push({ type: 'timing', description: `Back on the home screen ${Math.round((Date.now() - start) / 1000)} s after the success screen was read.` });
  });
}
