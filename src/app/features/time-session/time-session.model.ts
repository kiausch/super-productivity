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
