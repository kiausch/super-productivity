import { Action, ActionReducer, MetaReducer } from '@ngrx/store';
import { RootState } from '../../root-state';
import {
  addTimeSession,
  deleteTimeSession,
  updateTimeSession,
} from '../../../features/time-session/store/time-session.actions';
import {
  BREAK_TASK_ID,
  WORK_END_ID,
  WORK_START_ID,
} from '../../../features/time-session/time-session.model';
import { TIME_SESSION_FEATURE_KEY } from '../../../features/time-session/store/time-session.reducer';
import { TASK_FEATURE_NAME } from '../../../features/tasks/store/task.reducer';
import { updateTimeSpentForTask } from '../../../features/tasks/store/task.reducer.util';

const SPECIAL_TASK_IDS = new Set([BREAK_TASK_ID, WORK_START_ID, WORK_END_ID]);

/**
 * Re-computes task.timeSpentOnDay and task.timeSpent from the session store
 * whenever a session is added, updated, or deleted.
 *
 * This is the single source of truth for task time data: sessions own the
 * canonical state and task fields are derived values computed here.
 *
 * Uses post-reducer pattern: calls inner reducer first (so session state is
 * already updated), then materialises the affected task's time fields.
 */
const materialise = (state: RootState, taskId: string): RootState => {
  if (SPECIAL_TASK_IDS.has(taskId)) {
    return state;
  }

  const taskState = state[TASK_FEATURE_NAME];
  if (!taskState?.entities[taskId]) {
    // Task might be in archive or already deleted — nothing to update
    return state;
  }

  const sessions = state[TIME_SESSION_FEATURE_KEY]?.sessions ?? [];
  const timeSpentOnDay: Record<string, number> = {};
  for (const session of sessions) {
    if (session.tid === taskId && session.t > 0) {
      timeSpentOnDay[session.d] = (timeSpentOnDay[session.d] ?? 0) + session.t;
    }
  }

  const newTaskState = updateTimeSpentForTask(taskId, timeSpentOnDay, taskState);
  if (newTaskState === taskState) {
    return state;
  }
  return { ...state, [TASK_FEATURE_NAME]: newTaskState };
};

/**
 * Meta-reducer that materialises session changes onto task entities.
 *
 * Handles addTimeSession, updateTimeSession, deleteTimeSession.
 *
 * For deleteTimeSession the session tid is captured BEFORE the inner reducer
 * removes it from state, since it would no longer be findable afterwards.
 */
export const sessionToTaskTimeMetaReducer: MetaReducer = (
  reducer: ActionReducer<any, Action>,
) => {
  return (state: unknown, action: Action) => {
    if (!state) return reducer(state, action);

    const rootState = state as RootState;

    // For delete we need to capture the tid before the session is removed
    let preDeleteTid: string | null = null;
    if (action.type === deleteTimeSession.type) {
      const { sessionId } = action as ReturnType<typeof deleteTimeSession>;
      const session = rootState[TIME_SESSION_FEATURE_KEY]?.sessions.find(
        (s) => s.id === sessionId,
      );
      preDeleteTid = session?.tid ?? null;
    }

    // Run all inner reducers first (session state is updated by base timeSessionReducer)
    const nextState = reducer(state, action) as RootState;

    if (action.type === addTimeSession.type) {
      const { timeSession } = action as ReturnType<typeof addTimeSession>;
      return materialise(nextState, timeSession.tid);
    }

    if (action.type === updateTimeSession.type) {
      const { sessionId } = action as ReturnType<typeof updateTimeSession>;
      const session = nextState[TIME_SESSION_FEATURE_KEY]?.sessions.find(
        (s) => s.id === sessionId,
      );
      return session ? materialise(nextState, session.tid) : nextState;
    }

    if (action.type === deleteTimeSession.type && preDeleteTid) {
      return materialise(nextState, preDeleteTid);
    }

    return nextState;
  };
};
