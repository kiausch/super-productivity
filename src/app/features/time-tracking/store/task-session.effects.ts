import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap } from 'rxjs/operators';
import { setCurrentTask, unsetCurrentTask } from '../../tasks/store/task.actions';
import { TimeTrackingActions } from './time-tracking.actions';
import { DateService } from '../../../core/date/date.service';
import { nanoid } from 'nanoid';
import { formatDateYYYYMMDD } from '../../../util/format-date-yyyy-mm-dd';

/**
 * Tracks in-memory task start timestamps when a task is started and
 * emits a TimeTracking 'Add task session' action when tracking is stopped.
 */
@Injectable()
export class TaskSessionEffects {
  private _actions$ = inject(Actions);
  private _dateService = inject(DateService);

  // map of taskId -> startTs
  private _startMap = new Map<string, number>();
  private _lastStartedTaskId: string | null = null;

  // record start time when a task is set as current
  recordStart$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(setCurrentTask),
        tap(({ id }) => {
          if (!id) {
            return;
          }
          this._startMap.set(id, Date.now());
          this._lastStartedTaskId = id;
        }),
      ),
    { dispatch: false },
  );

  // on unset, close last started task and emit addTimeSession
  closeSession$ = createEffect(() =>
    this._actions$.pipe(
      ofType(unsetCurrentTask),
      map(() => {
        const taskId = this._lastStartedTaskId;
        if (!taskId) {
          return { type: '[TimeTracking] Noop' } as any;
        }
        const start = this._startMap.get(taskId);
        if (!start) {
          // nothing recorded
          this._lastStartedTaskId = null;
          return { type: '[TimeTracking] Noop' } as any;
        }
        const end = Date.now();
        const duration = Math.max(0, end - start);
        // cleanup
        this._startMap.delete(taskId);
        this._lastStartedTaskId = null;

        // Create TimeSession entry
        const timeSession = {
          id: nanoid(),
          tid: taskId,
          d: formatDateYYYYMMDD(start),
          s: start,
          t: duration,
        };

        return TimeTrackingActions.addTimeSession({
          timeSession,
        });
      }),
    ),
  );
}

export const effects = [TaskSessionEffects];
