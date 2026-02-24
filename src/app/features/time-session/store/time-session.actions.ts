import { createAction } from '@ngrx/store';
import { TimeSession } from '../time-session.model';
import { PersistentActionMeta } from '../../../op-log/core/persistent-action.interface';
import { OpType } from '../../../op-log/core/operation.types';

/**
 * Persistent action for adding a new time session.
 * Syncs the session to other devices.
 */
export const addTimeSession = createAction(
  '[TimeSession] Add time session',
  (actionProps: { timeSession: TimeSession }) => ({
    ...actionProps,
    meta: {
      isPersistent: true,
      entityType: 'TIME_SESSION',
      entityId: '*', // singleton entity
      opType: OpType.Create,
    } satisfies PersistentActionMeta,
  }),
);

/**
 * Persistent action for updating an existing time session.
 * Syncs the updates to other devices.
 */
export const updateTimeSession = createAction(
  '[TimeSession] Update Time Session',
  (actionProps: { sessionId: string; updates: Partial<TimeSession> }) => ({
    ...actionProps,
    meta: {
      isPersistent: true,
      entityType: 'TIME_SESSION',
      entityId: '*', // singleton entity
      opType: OpType.Update,
    } satisfies PersistentActionMeta,
  }),
);

/**
 * Persistent action for deleting a time session.
 * Syncs the deletion to other devices.
 */
export const deleteTimeSession = createAction(
  '[TimeSession] Delete Time Session',
  (actionProps: { sessionId: string }) => ({
    ...actionProps,
    meta: {
      isPersistent: true,
      entityType: 'TIME_SESSION',
      entityId: '*', // singleton entity
      opType: OpType.Delete,
    } satisfies PersistentActionMeta,
  }),
);
