## Cinescape kiosk UI tests: 15/17 passed, 1 failed, 1 skipped

**Run** #local · **commit** `abf4569` Publish results of the last run without re-running; commit locally until a GitHub remote exists · **by** Chaithu200926 · **trigger** published from QA PC  
**App** CinescapeKiosk build CinescapeKioskNew13 · UAT API · **Driver** CinescapeKiosk (Appium NovaWindows) · **Node** v24.21.0 · **Playwright** 1.63.0 · **Duration** 1464.00s  
**Pass-rate trend** (oldest → newest): 88%  


| Test | Result | Duration | Steps | Last 10 runs | Failure |
|---|---|---|---|---|---|
| KUI-01 App start: the home screen loads with all menu buttons | ✅ Passed | 17.32s | 5 | ✅ |  |
| KUI-02 Language switch: Arabic translates and mirrors the screens, HOME returns to English | ✅ Passed | 27.47s | 6 | ✅ |  |
| KUI-03 Films and show times match today's programme | ✅ Passed | 26.41s | 5 | ✅ |  |
| KUI-04 Coming soon: films show opening dates and details, not on sale yet | ✅ Passed | 19.70s | 4 | ✅ |  |
| KUI-05 Seat type and ticket quantity: total = price x quantity | ✅ Passed | 29.88s | 10 | ✅ |  |
| KUI-06 Seat selection: unavailable seats are blocked and Proceed needs every seat | ✅ Passed | 125.84s | 10 | ✅ |  |
| KUI-07 Ticket purchase end to end, paid by club card | ✅ Passed | 142.59s | 13 | ✅ |  |
| KUI-16 Pickup tickets by BOOKING ID; a second pickup is refused | ✅ Passed | 68.98s | 3 | ✅ |  |
| KUI-08 Food purchase end to end, paid by club card | ✅ Passed | 116.42s | 8 | ✅ |  |
| KUI-09 Food combo options carry through to checkout | ✅ Passed | 91.02s | 10 | ✅ |  |
| KUI-10 Tickets and food in one order, paid once by club card | ✅ Passed | 207.34s | 14 | ✅ |  |
| KUI-11 Club card (wallet) payment deducts the balance | ✅ Passed | 97.35s | 8 | ✅ |  |
| KUI-14 Cancel during booking releases the reserved seats | ✅ Passed | 75.76s | 8 | ✅ |  |
| KUI-15 Idle timeout: the kiosk returns home and releases held seats | ✅ Passed | 145.94s | 9 | ✅ |  |
| KUI-17 Email my tickets after a purchase | ❌ Failed | 230.32s | 15 | ❌ | Error: history/resend answered "Something went wrong!", so the kiosk shows "The email could not be sent. Your paper tickets are all you need." |
| KUI-21 Printer out of paper: clear message, nothing printed | ⏭️ Skipped | 0.00s | 0 | ⏭️ |  |
| KUI-23 API unavailable: friendly messages, no crash, recovers when the API is back | ✅ Passed | 37.19s | 6 | ✅ |  |

### Failed steps

| Test | Step | Error |
|---|---|---|
| KUI-17 Email my tickets after a purchase | The email is sent: "Your tickets are on their way to your email." | Error: history/resend answered "Something went wrong!", so the kiosk shows "The email could not be sent. Your paper tickets are all you need." |
