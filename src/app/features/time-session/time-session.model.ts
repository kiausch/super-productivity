/**
 * Individual time tracking session
 * Uses shortened property names to reduce storage size
 * id: unique identifier (UUID/nanoid) - required for editing/sync
 * tid: task ID
 * d: date in 'YYYY-MM-DD' format (user's local date)
 * s: start timestamp in ms (UTC) - optional for manual entries
 * t: duration in milliseconds
 */
export interface TimeSession {
  id: string;
  tid: string;
  d: string;
  s?: number;
  t: number;
}

export interface TimeSessionState {
  sessions: TimeSession[];
}

export const BREAK_TASK_ID = 'BREAK';

/**
 * Special task ID for work start marker sessions.
 * These sessions have t: 0 and s: timestamp indicating when work started.
 * Used for manual work start entries in daily summary.
 */
export const WORK_START_ID = 'WORK_START';

/**
 * Special task ID for work end marker sessions.
 * These sessions have t: 0 and s: timestamp indicating when work ended.
 * Used for manual work end entries in daily summary.
 */
export const WORK_END_ID = 'WORK_END';
