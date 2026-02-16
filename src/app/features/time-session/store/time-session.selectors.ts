import { createSelector, MemoizedSelector } from '@ngrx/store';
import { timeSessionFeature } from './time-session.reducer';
import { TimeSession } from '../time-session.model';
import { selectTodayStr } from '../../../root-store/app-state/app-state.selectors';

/**
 * Select all work sessions
 */
export const selectAllSessions = createSelector(
  timeSessionFeature.selectSessions,
  (sessions) => sessions,
);

export const selectTodaySessions = createSelector(
  selectAllSessions,
  selectTodayStr,
  (sessions: TimeSession[], today: string) => {
    return sessions.filter((session) => session.d === today);
  },
);

/**
 * Select sessions filtered by date
 * Usage: store.select(selectSessionsByDate('YYYY-MM-DD'))
 * TODO: untested
 */
export const selectSessionsByDate = (
  date: string,
): MemoizedSelector<any, TimeSession[]> =>
  createSelector(selectAllSessions, (sessions: TimeSession[]) =>
    sessions.filter((session) => session.d === date),
  );

/**
 * Select sessions filtered by task ID
 * Usage: store.select(selectSessionsByTask('task-id'))
 * TODO: untested
 */
export const selectSessionsByTask = (
  taskId: string,
): MemoizedSelector<any, TimeSession[]> =>
  createSelector(selectAllSessions, (sessions: TimeSession[]) =>
    sessions.filter((session) => session.tid === taskId),
  );

/**
 * Select sessions filtered by project ID via task lookup
 * Requires tasks state to determine which tasks belong to a project
 * Usage: store.select(selectSessionsByProject('proj-id', tasksByProjectId))
 * TODO: untested
 */
export const selectSessionsByProject = (
  projectId: string,
  tasksByProjectId: Record<string, string[]>,
): MemoizedSelector<any, TimeSession[]> =>
  createSelector(selectAllSessions, (sessions: TimeSession[]) => {
    const taskIds = tasksByProjectId?.[projectId] || [];
    return sessions.filter((session) => taskIds.includes(session.tid));
  });

/**
 * Select sessions filtered by tag ID via task lookup
 * Requires tasks state to determine which tasks have a tag
 * Usage: store.select(selectSessionsByTag('tag-id', tasksByTagId))
 * TODO: untested
 */
export const selectSessionsByTag = (
  tagId: string,
  tasksByTagId: Record<string, string[]>,
): MemoizedSelector<any, TimeSession[]> =>
  createSelector(selectAllSessions, (sessions: TimeSession[]) => {
    const taskIds = tasksByTagId?.[tagId] || [];
    return sessions.filter((session) => taskIds.includes(session.tid));
  });
