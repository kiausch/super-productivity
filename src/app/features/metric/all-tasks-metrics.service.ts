import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, from, Observable } from 'rxjs';
import { SimpleMetrics } from './metric.model';
import { filter, map, switchMap, take, withLatestFrom } from 'rxjs/operators';
import { mapSimpleMetrics } from './metric.util';
import { TaskService } from '../tasks/task.service';
import { WorklogService } from '../worklog/worklog.service';
import { WorkContextType } from '../work-context/work-context.model';
import { WorkContextService } from '../work-context/work-context.service';
import { TODAY_TAG } from '../tag/tag.const';
import { Store } from '@ngrx/store';
import { selectAllSessions } from '../time-session/store/time-session.selectors';
import { BREAK_TASK_ID, TimeSession } from '../time-session/time-session.model';
import { breakSessionsToBreakMaps } from './break-session.util';

@Injectable({
  providedIn: 'root',
})
export class AllTasksMetricsService {
  private _taskService = inject(TaskService);
  private _worklogService = inject(WorklogService);
  private _workContextService = inject(WorkContextService);
  private _store = inject(Store);

  private _breakSessions$: Observable<TimeSession[]> = this._store
    .select(selectAllSessions)
    .pipe(map((sessions) => sessions.filter((s) => s.tid === BREAK_TASK_ID)));

  /**
   * Reactive metrics that recompute when context switches to TODAY_TAG.
   * WorklogService automatically returns ALL tasks when context is TODAY_TAG
   * via getCompleteStateForWorkContext utility.
   */
  private _simpleMetricsObs$: Observable<SimpleMetrics | undefined> =
    this._workContextService.activeWorkContext$.pipe(
      filter((ctx) => ctx?.type === WorkContextType.TAG && ctx.id === TODAY_TAG.id),
      // Ensure worklog is loaded before computing metrics
      withLatestFrom(this._worklogService.worklog$),
      filter(([, worklog]) => !!worklog),
      switchMap(() =>
        combineLatest([
          this._breakSessions$.pipe(map((s) => breakSessionsToBreakMaps(s).breakNr)),
          this._breakSessions$.pipe(map((s) => breakSessionsToBreakMaps(s).breakTime)),
          this._worklogService.worklog$,
          this._worklogService.totalTimeSpent$,
          from(this._taskService.getAllTasksEverywhere()),
        ]).pipe(
          map(mapSimpleMetrics),
          // prevent constant redraws - take 1 per context switch
          take(1),
        ),
      ),
    );

  simpleMetrics = toSignal(this._simpleMetricsObs$);
}
