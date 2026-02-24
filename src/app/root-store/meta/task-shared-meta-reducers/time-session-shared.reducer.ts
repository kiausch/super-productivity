import { MetaReducer, Action, ActionReducer } from '@ngrx/store';
import { RootState } from '../../root-state';
import { TaskSharedActions } from '../task-shared.actions';
import { TIME_SESSION_FEATURE_KEY } from '../../../features/time-session/store/time-session.reducer';
import { TimeSessionState } from '../../../features/time-session/time-session.model';
import { ActionHandlerMap } from './task-shared-helpers';

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Removes time sessions for deleted tasks.
 * Cleans up both individual task deletions and batch deletions.
 *
 * @param timeSessionState - Current time session state
 * @param taskIds - Task IDs being deleted (may include subtasks)
 * @returns Updated time session state with sessions removed
 */
const cleanupTimeSessionsForTasks = (
  timeSessionState: TimeSessionState | undefined,
  taskIds: string[],
): TimeSessionState | undefined => {
  if (!timeSessionState || taskIds.length === 0) {
    return timeSessionState;
  }

  // PERF: Use Set for O(1) lookup instead of O(n) Array.includes()
  const taskIdsSet = new Set(taskIds);

  // Filter out sessions whose task ID is being deleted
  const filteredSessions = timeSessionState.sessions.filter(
    (session) => !taskIdsSet.has(session.tid),
  );

  // Only update if there are changes (avoid unnecessary state updates)
  if (filteredSessions.length === timeSessionState.sessions.length) {
    return timeSessionState;
  }

  return {
    ...timeSessionState,
    sessions: filteredSessions,
  };
};

/**
 * Handles deleteTask action - removes time sessions for the deleted task and its subtasks.
 */
const handleDeleteTask = (state: RootState, taskIds: string[]): RootState => {
  const updatedTimeSessionState = cleanupTimeSessionsForTasks(
    state[TIME_SESSION_FEATURE_KEY],
    taskIds,
  );

  // If state is unchanged or undefined, return original state
  if (
    !updatedTimeSessionState ||
    updatedTimeSessionState === state[TIME_SESSION_FEATURE_KEY]
  ) {
    return state;
  }

  return {
    ...state,
    [TIME_SESSION_FEATURE_KEY]: updatedTimeSessionState,
  };
};

/**
 * Handles deleteTasks action - removes time sessions for all deleted tasks.
 */
const handleDeleteTasks = (state: RootState, taskIds: string[]): RootState => {
  const updatedTimeSessionState = cleanupTimeSessionsForTasks(
    state[TIME_SESSION_FEATURE_KEY],
    taskIds,
  );

  // If state is unchanged or undefined, return original state
  if (
    !updatedTimeSessionState ||
    updatedTimeSessionState === state[TIME_SESSION_FEATURE_KEY]
  ) {
    return state;
  }

  return {
    ...state,
    [TIME_SESSION_FEATURE_KEY]: updatedTimeSessionState,
  };
};

// =============================================================================
// META-REDUCER
// =============================================================================

const createActionHandlers = (state: RootState, action: Action): ActionHandlerMap => ({
  [TaskSharedActions.deleteTask.type]: () => {
    const { task } = action as ReturnType<typeof TaskSharedActions.deleteTask>;
    // Collect all task IDs to clean up (parent + subtasks)
    const allTaskIds = [task.id, ...(task.subTaskIds || [])];
    return handleDeleteTask(state, allTaskIds);
  },

  [TaskSharedActions.deleteTasks.type]: () => {
    const { taskIds } = action as ReturnType<typeof TaskSharedActions.deleteTasks>;
    return handleDeleteTasks(state, taskIds);
  },
});

/**
 * Meta-reducer that cleans up time sessions when tasks are deleted.
 *
 * This ensures referential integrity - time sessions that reference deleted
 * tasks are removed to prevent orphaned data.
 *
 * Handles both single task deletion and batch task deletion.
 */
export const timeSessionSharedMetaReducer: MetaReducer = (
  reducer: ActionReducer<any, Action>,
) => {
  return (state: unknown, action: Action) => {
    if (!state) return reducer(state, action);

    const rootState = state as RootState;
    const actionHandlers = createActionHandlers(rootState, action);
    const handler = actionHandlers[action.type];
    const updatedState = handler ? handler(rootState) : rootState;

    return reducer(updatedState, action);
  };
};
