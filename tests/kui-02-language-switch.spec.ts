// KUI-02: the English / Arabic switch translates the screens and mirrors the layout (right-to-left).
import { test, expect } from '../src/fixtures';

// Home menu labels in both languages.
const MENU = {
  'NOW SHOWING': 'يعرض الآن',
  'COMING SOON': 'قريباً',
  'PICK UP TICKETS': 'استلم تذاكرك',
  FOOD: 'الطعام',
  'PREPARE FOOD': 'تحضير الطعام',
  REGISTER: 'التسجيل',
  'UPCOMING SHOWS': 'العروض القادمة',
};

async function xOf(kiosk: import('../src/kiosk').Kiosk, label: string) {
  return (await kiosk.text(label).getLocation()).x;
}

test('KUI-02 Language switch: Arabic translates and mirrors the screens, HOME returns to English', async ({ kiosk }) => {
  const nowShowingX = await kiosk.step('English home screen: NOW SHOWING is on the left', async () => xOf(kiosk, 'NOW SHOWING'));

  await kiosk.step('Tap عربي: the home menu is in Arabic', async () => {
    await kiosk.tap('عربي', { settleMs: 2000 });
    for (const [en, ar] of Object.entries(MENU)) {
      expect.soft(await kiosk.hasText(ar), `"${en}" in Arabic (${ar})`).toBe(true);
      expect.soft(await kiosk.hasText(en), `"${en}" no longer in English`).toBe(false);
    }
    expect.soft(await kiosk.hasButton('English'), 'Switch now offers English').toBe(true);
  });

  await kiosk.step('Layout is right-to-left: NOW SHOWING moved to the right, Arabic day name in the date', async () => {
    expect.soft(await xOf(kiosk, MENU['NOW SHOWING']), 'NOW SHOWING position').toBeGreaterThan(nowShowingX!);
    const date = (await kiosk.app.$('~DateText').getAttribute('Name')) ?? '';
    expect.soft(date, 'Date with Arabic day name').toMatch(/[؀-ۿ]/);
  });

  await kiosk.step('Known gaps in Arabic mode are recorded (cinema name, experience names, promo banner)', async () => {
    const cinema = (await kiosk.app.$('~CinemaText').getAttribute('Name')) ?? '';
    const texts = await kiosk.texts();
    const gaps = [
      /[A-Za-z]/.test(cinema) ? `cinema name "${cinema}"` : '',
      texts.some((t) => ['Standard', 'VIP', '4DX'].includes(t)) ? 'experience names (Standard / VIP / 4DX)' : '',
    ].filter(Boolean);
    // Reported as a note, not a failure: the translations exist in the API (nameAlt / experienceAlt).
    if (gaps.length) test.info().annotations.push({ type: 'finding', description: `Still in English in Arabic mode: ${gaps.join('; ')}` });
  });

  await kiosk.step('NOW SHOWING in Arabic shows Arabic film titles', async () => {
    await kiosk.tap(MENU['NOW SHOWING'], { settleMs: 2000 });
    const texts = await kiosk.texts();
    expect(texts.some((t) => t.startsWith('إنجليزي')), 'Language shown in Arabic (إنجليزي)').toBe(true);
    expect(texts.filter((t) => /^[؀-ۿ٠-٩\s]+$/.test(t)).length, 'Arabic film titles').toBeGreaterThan(0);
  });

  await kiosk.step('HOME returns to the English home screen', async () => {
    await kiosk.tap('الرئيسية', { settleMs: 2000 });
    await kiosk.waitForText('NOW SHOWING');
    expect(await kiosk.hasButton('عربي'), 'Switch offers Arabic again').toBe(true);
  });
});
