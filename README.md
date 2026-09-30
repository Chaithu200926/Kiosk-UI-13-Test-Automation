# CinescapeKiosk UI Automation

End-to-end UI tests for the **CinescapeKiosk** Windows app (WPF, build `CinescapeKioskNew13`) against the UAT API.
The kiosk is driven with [Appium](https://appium.io) and its **NovaWindows** driver (Windows UI Automation);
[Playwright Test](https://playwright.dev) is the test runner and report, the same as the web and API projects.

Every test gets a freshly started kiosk and its report contains:

- a **screenshot for every step** (cropped to the kiosk screen),
- a **video** of the whole test (recorded with ffmpeg),
- the kiosk's own **API calls** during the test (server address hidden; passwords, OTPs, PINs, card numbers,
  keys and terminal names masked).

## What is tested

KNET / credit card is disabled in UAT, so the paying tests pay with the test customer's **club card**. Kiosk
bookings cannot be cancelled online: every paid BOOKING ID is recorded as a "paid booking" note in the report.

| Test | File | What it does |
|---|---|---|
| **KUI-01 App start** | [`kui-01-home-screen.spec.ts`](tests/kui-01-home-screen.spec.ts) | Starts the kiosk; checks clock, date, cinema name, all six menu buttons, Arabic and help buttons, promo banner, UPCOMING SHOWS, and that the programme loaded from the API. |
| **KUI-02 Language switch** | [`kui-02-language-switch.spec.ts`](tests/kui-02-language-switch.spec.ts) | Arabic translates and mirrors the screens; HOME returns to English. |
| **KUI-03 Films and show times** | [`kui-03-films-and-showtimes.spec.ts`](tests/kui-03-films-and-showtimes.spec.ts) | NOW SHOWING tiles are in today's programme; a film's details are shown; its show times match the programme (the kiosk sells today only); MOVIES goes back. |
| **KUI-04 Coming soon** | [`kui-04-coming-soon.spec.ts`](tests/kui-04-coming-soon.spec.ts) | Upcoming films with opening dates and details, not on sale yet. |
| **KUI-05 Seat type and quantity** | [`kui-05-seat-type-and-quantity.spec.ts`](tests/kui-05-seat-type-and-quantity.spec.ts) | Seat areas list free seats and KWD prices; total = price x quantity for 1, 2, 3 and back to 2; terms shown; Cancel returns to the film. |
| **KUI-06 Seat selection rules** | [`kui-06-seat-selection-rules.spec.ts`](tests/kui-06-seat-selection-rules.spec.ts) | Legend shown; an unavailable seat cannot be chosen; Proceed only when all seats are chosen; tapping a seat again releases it; Reset clears. Nothing is reserved. |
| **KUI-07 Ticket purchase** (pays ~KWD 3.500) | [`kui-07-16-ticket-purchase-and-pickup.spec.ts`](tests/kui-07-16-ticket-purchase-and-pickup.spec.ts) | 1 ticket end to end, paid by club card; "Booking Success!" details; tickets printed; returns home. |
| **KUI-08 Food purchase** (pays KWD 0.500) | [`kui-08-food-purchase.spec.ts`](tests/kui-08-food-purchase.spec.ts) | Food-only order of the cheapest item; FOOD PICKUP NO. on "Booking Success!". |
| **KUI-09 Food combo options** | [`kui-09-food-combo-options.spec.ts`](tests/kui-09-food-combo-options.spec.ts) | Reserves a seat, adds a combo with a popcorn flavour and a drink, checks cart and totals up to "Preview and Checkout", then cancels (the kiosk cancels the reservation). |
| **KUI-10 Tickets and food** (pays ~KWD 4.000) | [`kui-10-tickets-and-food.spec.ts`](tests/kui-10-tickets-and-food.spec.ts) | 1 ticket + food in one order, one payment; both BOOKING ID and FOOD PICKUP NO. shown. |
| **KUI-11 Club card payment** (pays KWD 0.500) | [`kui-11-club-card-payment.spec.ts`](tests/kui-11-club-card-payment.spec.ts) | The club card balance on the UAT website goes down by exactly the amount paid. |
| **KUI-14 Cancel releases seats** | [`kui-14-cancel-releases-seats.spec.ts`](tests/kui-14-cancel-releases-seats.spec.ts) | Reserves a seat (`content/trans/reserveseats`), cancels on the food screen, checks `content/trans/cancel` succeeded for the same transaction and the seat is free again. |
| **KUI-15 Idle timeout** | [`kui-15-idle-timeout.spec.ts`](tests/kui-15-idle-timeout.spec.ts) | An untouched kiosk returns home and releases held seats. |
| **KUI-16 Pickup** | [`kui-07-16-ticket-purchase-and-pickup.spec.ts`](tests/kui-07-16-ticket-purchase-and-pickup.spec.ts) | Picks up KUI-07's booking by BOOKING ID; unknown IDs and a second pickup are refused. |
| **KUI-17 Email my tickets** (pays ~KWD 3.500) | [`kui-17-email-my-tickets.spec.ts`](tests/kui-17-email-my-tickets.spec.ts) | After a ticket purchase: EMAIL MY TICKETS, name + ending (or OTHER + domain), "Is this correct?", Send; checks `history/resend` and the sent message. |
| **KUI-21 Printer not ready** | [`kui-21-printer-not-ready.spec.ts`](tests/kui-21-printer-not-ready.spec.ts) | Blocked (not run): the fake printer cannot be put out of paper. |
| **KUI-23 API unavailable** | [`kui-23-api-unavailable.spec.ts`](tests/kui-23-api-unavailable.spec.ts) | Simulated API outage: friendly messages, no crash, recovers when the API is back. |

Not automated: sign-in / register (KUI-18/19, excluded on request), KNET payments and top-up (KUI-12/13/20, KNET
disabled in UAT), admin tool (KUI-22, needs the admin PIN).

The full list of 23 approved test cases and their status is in `C:\softwares\KNCC testing\KNCC-Test-Cases-All-Projects.xlsx`.

## Requirements (QA PC)

- Windows 10/11, **logged in and unlocked** while tests run (the kiosk opens full screen; Windows blocks
  screenshots and taps while the PC is locked).
- The kiosk app at `C:\ProgramData\KNCC\CinescapeKioskNew13\CinescapeKiosk.exe` (or set `KIOSK_APP_PATH`),
  with `UseFakeTerminal` and `UseFakePrinter` set to `true` in its `kiosk.settings.json`. The app reads that file
  from its own folder, and a new build's folder has none: copy it over from the previous build.
  Logs, the paper counter and other state stay in `C:\ProgramData\KNCC\CinescapeKioskNew` for every build.
- [Node.js](https://nodejs.org) 22 or later.
- ffmpeg unpacked under `%LOCALAPPDATA%\ffmpeg` (or set `FFMPEG_DIR`) for the videos.

```bash
npm ci                          # installs Playwright, WebdriverIO, Appium and the NovaWindows driver
cp .env.example .env            # optional for now: only on-hold tests need values
```

## Run

```bash
npm test                        # run all tests (starts Appium, the API recorder and the kiosk automatically)
npx playwright test kui-05      # run one test
npm run report                  # open the Playwright HTML report (steps, screenshots, video, API calls)
npm run dashboard               # build dashboard/index.html from the last run
npm run publish-results -- "message"   # commit, run the tests, build reports/ and push (see below)
```

A running kiosk app is closed before each test, and the kiosk is closed again afterwards. If a test stops
in the middle of a booking, the kiosk is backed out to the home screen first, so held seats are released.

## Publishing (GitHub Pages dashboard)

The kiosk app and the UAT API are only reachable from the QA PC, so tests run there and
`npm run publish-results` pushes the results to `reports/`. The **KIOSK UI Testing** workflow
([`.github/workflows/kiosk-ui-testing.yml`](.github/workflows/kiosk-ui-testing.yml)) then publishes the dashboard
(summary tiles, trend, and every test's steps with screenshots and video) to GitHub Pages and turns red when a
test failed. The Playwright HTML report is kept local only.

## How it works

| File | Purpose |
|---|---|
| `src/fixtures.ts` | Starts a fresh kiosk per test, records the video, attaches screenshots / API calls, closes the kiosk. |
| `src/kiosk.ts` | Tap buttons by their visible text, wait for texts, keypad typing with a check, seat map and seat colours, cropped screenshots, `kiosk.step()`. |
| `src/flows.ts` | Shared booking steps (open a show, seat type, pick free seats, check the reservation). They never go past "Preview and Checkout". |
| `src/api-recorder.ts` | Local HTTP proxy: the kiosk inherits `HTTP_PROXY` from Appium, so every API call it makes is recorded to `test-results/kiosk-api-calls.jsonl`. |
| `src/programme.ts` | Picks a film and a show time later today from the programme the kiosk itself loaded. |
| `src/video.ts` | Screen video of the kiosk area with ffmpeg. |
| `scripts/inspect.mjs` | **Inspector** for writing new tests: `npm run appium` in one terminal, then `npm run inspect -- start`, `-- dump name`, `-- click "NOW SHOWING"`, `-- stop`. |

Locator notes (the kiosk has only a few automation IDs):

- Most buttons have no name of their own; they are found by the text inside them (`//Button[.//Text[@Name="…"]]`).
- Seats are `Place` buttons with a `Number` text inside a row item; their state is read from the screen colour
  (white = available, grey = unavailable, red = selected).
- The kiosk drops taps that come too fast, so keypad digits and seats are checked after each tap.

## Findings so far

- `content/trans/reserveseats` returned `ticketPrice` **KWD 3.000** for a General seat while the kiosk showed and
  charged **KWD 3.500** (29 Sep 2026). To be confirmed with the developers (booking fee or price mismatch).
- The kiosk keeps polling `payment/knet/kiosk/status` for an old booking (2003638) and gets "There are no
  active bookings." every few minutes.
- Tickets printed at purchase are not marked as collected, so the first pickup prints them again (KUI-16).
- EMAIL MY TICKETS fails: `history/resend` answers code 12002 "Something went wrong!" for a valid booking and
  address, and the kiosk shows "The email could not be sent..." (30 Sep 2026, build CinescapeKioskNew13, KUI-17).
- Error banners (e.g. "The email could not be sent...", "Tickets have already been collected...") are drawn but not
  exposed to UI Automation, so tests check the API answer and keep the screenshot as evidence.
