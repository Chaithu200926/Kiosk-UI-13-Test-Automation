// KUI-14: seats the kiosk reserved are released again when the customer cancels.
import { test, expect } from '../src/fixtures';
import { chooseSeatsType, expectReservation, openUpcomingShow, pickFreeSeats } from '../src/flows';

test('KUI-14 Cancel during booking releases the reserved seats', async ({ kiosk }) => {
  const show = await openUpcomingShow(kiosk);
  await chooseSeatsType(kiosk, 'General', 1);

  const since = Date.now();
  const [seat] = (await kiosk.step('Choose a free seat and proceed (the kiosk reserves it)', async () => {
    const seats = await pickFreeSeats(kiosk, 1);
    await kiosk.tap('Proceed', { settleMs: 2500 });
    await kiosk.waitForText('Select Food');
    return seats;
  }))!;

  const reservation = await kiosk.step(`The backend reserved ${seat}`, async () => expectReservation(kiosk, since, [seat]));

  await kiosk.step('Cancel on the food screen: the kiosk cancels the reservation', async () => {
    const cancelSince = Date.now();
    await kiosk.tap('Cancel', { settleMs: 2500 });
    const cancel = await kiosk.waitForApiCall('content/trans/cancel', cancelSince);
    expect(cancel.status, 'cancel HTTP status').toBe(200);
    expect((cancel.responseBody as { code: number }).code, 'cancel response code').toBe(10001);
    expect(String((cancel.requestBody as { transid: unknown }).transid), 'Cancelled transaction').toBe(String(reservation!.transid));
  });

  await kiosk.step(`Back on the seat map, ${seat} is free again`, async () => {
    await kiosk.waitForText('Select Seat');
    // The kiosk reloads the seat map after the cancel.
    await expect.poll(async () => (await kiosk.seatStates()).get(seat), { timeout: 15_000 }).toBe('available');
  });
});
