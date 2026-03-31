import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, EMPTY, from, Observable } from 'rxjs';
import { SimpleMetrics } from './metric.model';
import { delay, map, switchMap, take } from 'rxjs/operators';
import { WorkContextType } from '../work-context/work-context.model';
import { mapSimpleMetrics } from './metric.util';
import { TaskService } from '../tasks/task.service';
import { WorklogService } from '../worklog/worklog.service';
import { WorkContextService } from '../work-context/work-context.service';
import { Store } from '@ngrx/store';
import { selectAllSessions } from '../time-session/store/time-session.selectors';
import { BREAK_TASK_ID, TimeSession } from '../time-session/time-session.model';
import { breakSessionsToBreakMaps } from './break-session.util';

@Injectable({
  providedIn: 'root',
})
export class ProjectMetricsService {
  private _taskService = inject(TaskService);
  private _worklogService = inject(WorklogService);
  private _workContextService = inject(WorkContextService);
  private _store = inject(Store);

  private _breakSessions$: Observable<TimeSession[]> = this._store
    .select(selectAllSessions)
    .pipe(map((sessions) => sessions.filter((s) => s.tid === BREAK_TASK_ID)));

  private _simpleMetricsObs$: Observable<SimpleMetrics> =
    this._workContextService.activeWorkContextTypeAndId$.pipe(
      // wait for current projectId to settle in :(
      delay(100),
      switchMap(({ activeType, activeId }) => {
        return activeType === WorkContextType.PROJECT
          ? combineLatest([
              this._breakSessions$.pipe(map((s) => breakSessionsToBreakMaps(s).breakNr)),
              this._breakSessions$.pipe(
                map((s) => breakSessionsToBreakMaps(s).breakTime),
              ),
              this._worklogService.worklog$,
              this._worklogService.totalTimeSpent$,
              from(this._taskService.getAllTasksForProject(activeId)),
            ]).pipe(
              map(mapSimpleMetrics),
              // because otherwise the page is always redrawn if a task is active
              take(1),
            )
          : EMPTY;
      }),
    );

  simpleMetrics = toSignal(this._simpleMetricsObs$);
}
