import { TimeSession } from './time-session.model';
import { WorkStartEnd } from '../work-context/work-context.model';

/**
 * Converts an array of TimeSession objects into work start/end maps keyed by date.
 * Work start = earliest session start time on a given date.
 * Work end = latest session end time (start + duration) on a given date.
 */
export const sessionsToWorkStartEndMaps = (
  sessions: TimeSession[],
): {
  workStart: WorkStartEnd;
  workEnd: WorkStartEnd;
} => {
  const workStart: Record<string, number> = {};
  const workEnd: Record<string, number> = {};

  for (const session of sessions) {
    if (session.s === undefined) continue;

    const date = session.d;
    const start = session.s;
    const end = start + session.t;

    if (workStart[date] === undefined || start < workStart[date]) {
      workStart[date] = start;
    }
    if (workEnd[date] === undefined || end > workEnd[date]) {
      workEnd[date] = end;
    }
  }

  return { workStart, workEnd };
};
