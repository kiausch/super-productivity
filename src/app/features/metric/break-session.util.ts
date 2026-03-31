import { BreakNr, BreakTime } from '../work-context/work-context.model';
import { TimeSession } from '../time-session/time-session.model';

/**
 * Converts an array of break sessions into date-keyed BreakNr and BreakTime maps,
 * matching the format expected by mapSimpleMetrics().
 */
export const breakSessionsToBreakMaps = (
  breakSessions: TimeSession[],
): { breakNr: BreakNr; breakTime: BreakTime } => {
  const breakNr: { [key: string]: number } = {};
  const breakTime: { [key: string]: number } = {};

  for (const session of breakSessions) {
    breakNr[session.d] = (breakNr[session.d] || 0) + 1;
    breakTime[session.d] = (breakTime[session.d] || 0) + session.t;
  }

  return { breakNr, breakTime };
};
