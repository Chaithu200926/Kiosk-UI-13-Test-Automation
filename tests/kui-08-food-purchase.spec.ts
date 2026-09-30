// KUI-08: a food-only order from the home screen, paid by club card, completes with a food pickup number
// and the kiosk returns home. Uses the cheapest item (KWD 0.500) to keep the club card spending low;
// the order is recorded as a "paid booking" note.
import { test, expect } from '../src/fixtures';
import { addFood, CHEAP_FOOD, kwd } from '../src/flows';
import { expectReturnsHome, payByClubCard, successDetails } from '../src/payment';

test('KUI-08 Food purchase end to end, paid by club card', async ({ kiosk }) => {
  test.setTimeout(6 * 60_000);

  await kiosk.step(`FOOD: add "${CHEAP_FOOD.name}" and check the total`, async () => {
    await kiosk.tap('FOOD', { settleMs: 2500 });
    await kiosk.waitForText('Select Food');
    expect(kwd(await kiosk.textStartingWith('Total')), 'Empty order').toBe(0);
    await addFood(kiosk);
    expect(kwd(await kiosk.textStartingWith('Total')), 'Total after adding the item').toBeCloseTo(CHEAP_FOOD.price, 3);
  });

  await kiosk.step('"Preview and Checkout" lists the item, the total and when it is prepared', async () => {
    await kiosk.tap('Proceed', { settleMs: 2500 });
    await kiosk.waitForText('Preview and Checkout');
    expect(await kiosk.hasText(`1 x ${CHEAP_FOOD.name}`), 'Food line').toBe(true);
    expect(await kiosk.hasText('Your food order will be prepared IMMEDIATELY'), 'Preparation note').toBe(true);
    expect(kwd(await kiosk.textStartingWith('Total '))).toBeCloseTo(CHEAP_FOOD.price, 3);
  });

  const payment = await payByClubCard(kiosk);

  await kiosk.step('"Booking Success!" shows the food pickup number, the item, the BOOKING ID and the amount', async () => {
    await kiosk.waitForText('Booking Success!', 30_000);
    expect(await kiosk.hasText('Your food is being prepared now. Please go to the pickup counter and show your receipt.'), 'Pickup instructions').toBe(true);
    expect(await kiosk.hasText(`1 x ${CHEAP_FOOD.name}`), 'Item').toBe(true);
    const d = await successDetails(kiosk);
    expect(d.foodPickupNumber, 'FOOD PICKUP NO.').toMatch(/^\d+$/);
    expect(d.reference, 'BOOKING ID = the confirmed booking').toBe(payment.reference);
    expect(d.totalPaid, 'Total paid').toBeCloseTo(CHEAP_FOOD.price, 3);
  });

  await expectReturnsHome(kiosk);
});
