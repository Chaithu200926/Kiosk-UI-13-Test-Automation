// Today's programme as the kiosk itself received it (content/csessions), read from the recorded API calls.
// Tests use it to pick a film and a show time that is still ahead, instead of hard-coding them.
import type { RecordedCall } from './api-recorder';

export interface Show {
  film: string;
  experience: string;
  // "16:45", as shown on the kiosk.
  time: string;
  startsAt: Date;
  seatsAvailable: number;
}

interface DaySession {
  movie: { title: string };
  experienceSessions: { experience: string; shows: { showTime: string; showtime: string; seatsAvailable: number; soldoutStatus: number; allowTicketSales: string }[] }[];
}

/** All bookable shows from the latest programme call the kiosk made. */
export function showsFromCalls(calls: RecordedCall[]): Show[] {
  const programme = [...calls].reverse().find((c) => c.path.startsWith('content/csessions') && c.status === 200
    && (c.responseBody as { output?: { daySessions?: unknown[] } })?.output?.daySessions?.length);
  if (!programme) return [];
  const daySessions = (programme.responseBody as { output: { daySessions: DaySession[] } }).output.daySessions;
  return daySessions.flatMap((day) => day.experienceSessions.flatMap((exp) => exp.shows
    .filter((s) => s.soldoutStatus === 0 && s.allowTicketSales === 'true')
    .map((s) => ({ film: day.movie.title, experience: exp.experience, time: s.showTime, startsAt: new Date(s.showtime), seatsAvailable: s.seatsAvailable }))));
}

/** The first show that starts at least `minutesAhead` from now and has at least `minSeats` free seats. */
export function pickShow(shows: Show[], options: { minutesAhead?: number; minSeats?: number; experience?: string } = {}): Show {
  const earliest = Date.now() + (options.minutesAhead ?? 30) * 60_000;
  const show = shows
    .filter((s) => s.startsAt.getTime() >= earliest && s.seatsAvailable >= (options.minSeats ?? 10))
    .filter((s) => !options.experience || s.experience === options.experience)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  if (!show) throw new Error('No show later today with free seats. The kiosk only sells today\'s shows; run the test earlier in the day.');
  return show;
}
