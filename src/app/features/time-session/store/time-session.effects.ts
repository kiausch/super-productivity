import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { createEffect, ofType } from '@ngrx/effects';
import { filter, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { merge } from 'rxjs';
import { setCurrentTask, unsetCurrentTask } from '../../tasks/store/task.actions';
import { addTimeSession, tickUpdateTaskTime } from './time-session.actions';
import { nanoid } from 'nanoid';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';

const MIN_SESSION_DURATION_MS = 10_000;

/**
 * Manages live time-tracking sessions.
 *
 * Per-tick behaviour (non-persistent):
 *   Dispatches `tickUpdateTaskTime` on every interval tick so the UI shows
 *   live progress without writing to the op-log.
 *
 * Session commit (persistent, once per tracking period):
 *   When tracking stops or the active task switches, `finalize()` runs and
 *   dispatches a single `addTimeSession` (op-log write) if the session lasted
 *   at least MIN_SESSION_DURATION_MS.  This mirrors the old `addTimeSpent`
 *   approach where only a periodic flush was ever written to persistent storage.
 */
@Injectable()
export class TimeSessionEffects {
  private _actions$ = inject(LOCAL_ACTIONS);
  private _trackingService = inject(GlobalTrackingIntervalService);
  private _store = inject(Store);

  liveSession$ = createEffect(() =>
    this._actions$.pipe(
      ofType(setCurrentTask),
      filter(({ id }) => !!id),
      switchMap(({ id }) => {
        const startTime = Date.now();

        return this._trackingService.tick$.pipe(
          map((tick) =>
            tickUpdateTaskTime({ taskId: id!, date: tick.date, duration: tick.duration }),
          ),
          // unsetCurrentTask completes the inner observable;
          // a new setCurrentTask is handled by switchMap (also triggers finalize)
          takeUntil(
            merge(
              this._actions$.pipe(ofType(unsetCurrentTask)),
              this._actions$.pipe(ofType(setCurrentTask)),
            ),
          ),
          finalize(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= MIN_SESSION_DURATION_MS) {
              this._store.dispatch(
                addTimeSession({
                  timeSession: {
                    id: nanoid(),
                    tid: id!,
                    d: getDbDateStr(startTime),
                    s: startTime,
                    t: elapsed,
                  },
                }),
              );
            }
          }),
        );
      }),
    ),
  );
}

export const effects = [TimeSessionEffects];
