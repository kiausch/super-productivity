/**
 * One-time migration from the legacy TimeTrackingState format to TimeSessionState.
 *
 * The `feat/timesessions` rework stores all tracking data as a flat session array
 * (`timeSession.sessions`) instead of the old nested map
 * (`timeTracking.project/tag[contextId][date] = { s, e, b, bt }`).
 *
 * This migration runs once when the app first loads old data that has no
 * `timeSession` key.  It is pure (no side-effects) and idempotent.
 *
 * ## What is migrated
 * - `task.entities[id].timeSpentOnDay` → one duration-only TimeSession per (task, date)
 * - `timeTracking` + `archiveYoung.timeTracking` + `archiveOld.timeTracking`
 *   → WORK_START / WORK_END / BREAK sessions (merged across all contexts & archive tiers)
 *
 * ## What is NOT migrated
 * - `archiveYoung.task` / `archiveOld.task` — archived tasks keep their `timeSpentOnDay`;
 *   the worklog reads task totals from those directly, so no sessions are needed.
 * - `task.timeSpentOnDay` is NOT cleared; the meta-reducer will overwrite it on the
 *   first live session action.
 */

import {
  BREAK_TASK_ID,
  TimeSession,
  WORK_END_ID,
  WORK_START_ID,
} from '../../features/time-session/time-session.model';
import { TTWorkContextSessionMap } from '../../features/time-tracking/time-tracking.model';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if `data` is missing the `timeSession` key, indicating that a
 * migration from the legacy format is needed.
 */
export const needsTimeSessionMigration = (data: Record<string, unknown>): boolean => {
  return !('timeSession' in data) || data['timeSession'] == null;
};

/**
 * Migrates legacy `AppDataComplete`-shaped data to include a populated
 * `timeSession` slice built from task and timeTracking data.
 *
 * @param data - Any AppDataComplete-compatible plain object (typed as `any`
 *   to avoid a hard dependency on the full AppDataComplete type here).
 * @returns New object with the same shape plus a populated `timeSession` field.
 */
export const migrateToTimeSessions = (data: Record<string, any>): Record<string, any> => {
  const sessions: TimeSession[] = [];

  // 1. Convert current (non-archived) task.timeSpentOnDay → duration-only sessions
  _collectTaskSessions(data.task, sessions);

  // 2. Collect work start / end / break from all three timeTracking sources and
  //    merge them into a single set of special sessions.
  const workStartByDate: Record<string, number> = {};
  const workEndByDate: Record<string, number> = {};
  const breakByDate: Record<string, number> = {};

  _collectWorkMarkers(data.timeTracking, workStartByDate, workEndByDate, breakByDate);
  _collectWorkMarkers(
    data.archiveYoung?.timeTracking,
    workStartByDate,
    workEndByDate,
    breakByDate,
  );
  _collectWorkMarkers(
    data.archiveOld?.timeTracking,
    workStartByDate,
    workEndByDate,
    breakByDate,
  );

  // 3. Emit the merged work-marker sessions
  for (const [date, start] of Object.entries(workStartByDate)) {
    sessions.push({ id: _uuid(), tid: WORK_START_ID, d: date, s: start, t: 0 });
  }
  for (const [date, end] of Object.entries(workEndByDate)) {
    sessions.push({ id: _uuid(), tid: WORK_END_ID, d: date, s: end, t: 0 });
  }
  for (const [date, breakTime] of Object.entries(breakByDate)) {
    sessions.push({ id: _uuid(), tid: BREAK_TASK_ID, d: date, t: breakTime });
  }

  return { ...data, timeSession: { sessions } };
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Iterates over a TaskState-like object and pushes one duration-only
 * TimeSession per (taskId, date) pair into `out`.
 */
const _collectTaskSessions = (
  taskState: Record<string, any> | undefined | null,
  out: TimeSession[],
): void => {
  if (!taskState?.entities) return;

  for (const taskId of taskState.ids as string[]) {
    const task = taskState.entities[taskId];
    if (!task?.timeSpentOnDay) continue;

    for (const [date, durationRaw] of Object.entries(task.timeSpentOnDay)) {
      const duration = Number(durationRaw);
      if (duration > 0) {
        out.push({ id: _uuid(), tid: taskId, d: date, t: duration });
      }
    }
  }
};

/**
 * Scans a TimeTrackingState-like object (with `project` and `tag` maps) and
 * accumulates the earliest work start, latest work end, and maximum break time
 * per date across all work contexts into the provided accumulator objects.
 *
 * Using min/max rather than a single context's value avoids double-counting
 * when the same break was recorded under multiple work contexts.
 */
const _collectWorkMarkers = (
  timeTracking: Record<string, any> | undefined | null,
  workStartByDate: Record<string, number>,
  workEndByDate: Record<string, number>,
  breakByDate: Record<string, number>,
): void => {
  if (!timeTracking) return;

  for (const contextType of ['project', 'tag'] as const) {
    const contextMap = (timeTracking[contextType] ?? {}) as TTWorkContextSessionMap;
    for (const dateMap of Object.values(contextMap)) {
      if (!dateMap) continue;
      for (const [date, ctx] of Object.entries(dateMap)) {
        if (ctx.s != null) {
          workStartByDate[date] =
            workStartByDate[date] == null
              ? ctx.s
              : Math.min(workStartByDate[date], ctx.s);
        }
        if (ctx.e != null) {
          workEndByDate[date] =
            workEndByDate[date] == null ? ctx.e : Math.max(workEndByDate[date], ctx.e);
        }
        if (ctx.bt != null && ctx.bt > 0) {
          breakByDate[date] =
            breakByDate[date] == null ? ctx.bt : Math.max(breakByDate[date], ctx.bt);
        }
      }
    }
  }
};

/** Minimal UUID v4 compatible with both browser and Node (for tests). */
const _uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};
