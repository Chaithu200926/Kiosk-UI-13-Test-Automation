// The test customer's account on the Cinescape UAT website, used to read the club card (wallet) balance.
// Kiosk bookings are not listed in the web account, so they cannot be cancelled there: the paying tests
// record their BOOKING IDs instead (see src/payment.ts).
import { chromium, type Page } from '@playwright/test';
import { config } from './config';

/** Signs in on the website (email + password, then the email OTP). */
async function signIn(page: Page) {
  const { username, password, otp } = config.customer;
  if (!username || !password || !otp) throw new Error('Set KIOSK_TEST_USERNAME, KIOSK_TEST_PASSWORD and KIOSK_TEST_OTP in .env');
  // The UAT site sometimes takes over 30 s to finish loading, so wait only for the profile button.
  await page.goto(config.webUrl, { waitUntil: 'commit', timeout: 60_000 });
  await page.locator('nav.header-nav .user-profile:visible').first().click({ timeout: 60_000 });
  const login = page.locator('[role="dialog"]:visible').last();
  await login.locator('input[name="email"], input[type="email"]').first().fill(username);
  await login.locator('input[name="password"], input[type="password"]').first().fill(password);
  await login.getByRole('button', { name: /^sign in$/i }).last().click();

  const otpDialog = page.locator('[role="dialog"]:visible').last();
  const otpInputs = otpDialog.locator('input[type="tel"]');
  await otpInputs.first().waitFor();
  if ((await otpInputs.count()) >= otp.length) {
    for (let i = 0; i < otp.length; i++) await otpInputs.nth(i).fill(otp[i]);
  } else {
    await otpInputs.first().fill(otp);
  }
  await otpDialog.getByRole('button', { name: /submit|verify|continue/i }).last().click();
  await page.locator('a[href="/myaccount"]').first().waitFor({ timeout: 30_000 });
}

/**
 * The customer's club card number and balance, as the website's My Account page loads them
 * (customer/action/getprofile). Uses its own headless browser, signed in as the test customer.
 */
export async function clubCardBalance(): Promise<{ cardNumber: string; kwd: number; text: string }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await signIn(page);
    const profile = page.waitForResponse((r) => r.url().includes('/api/customer/action/getprofile'), { timeout: 60_000 });
    await page.locator('a[href="/myaccount"]').first().click();
    const user = (await (await profile).json()).output.user as { cardNumber: string; balance: string; balanceInCent: number };
    // balanceInCent is in hundredths of a KWD: KWD 213.500 → 21350.
    return { cardNumber: user.cardNumber, kwd: user.balanceInCent / 100, text: user.balance };
  } finally {
    await browser.close();
  }
}
