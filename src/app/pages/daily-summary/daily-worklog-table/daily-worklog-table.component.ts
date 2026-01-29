import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Task, TaskCopy } from '../../../features/tasks/task.model';
import { TaskService } from '../../../features/tasks/task.service';
import { ProjectService } from '../../../features/project/project.service';
import { T } from '../../../t.const';
import { DateService } from '../../../core/date/date.service';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { MatIcon } from '@angular/material/icon';
import { InlineInputComponent } from '../../../ui/inline-input/inline-input.component';
import { MatIconButton } from '@angular/material/button';
import { MsToClockStringPipe } from '../../../ui/duration/ms-to-clock-string.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { MomentFormatPipe } from '../../../ui/pipes/moment-format.pipe';
import { WorkContextService } from '../../../features/work-context/work-context.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { TimeSession } from '../../../features/time-tracking/time-tracking.model';
import { TimeSessionService } from '../../../features/time-tracking/time-session.service';
import { Store } from '@ngrx/store';

// data container for table entries
// can be a time session, work start/end, break, unaccounted time, summary
interface TableEntry {
  type: 'start' | 'end' | 'break' | 'task' | 'unaccounted' | 'summary';
  description: string;
  icon?: string | undefined;
  start: number | undefined;
  end: number | undefined;
  duration: number | undefined;
  task: TaskCopy | undefined;
  session: TimeSession | undefined;
}

@Component({
  selector: 'daily-worklog-table',
  templateUrl: './daily-worklog-table.component.html',
  styleUrls: ['./daily-worklog-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatIcon,
    InlineInputComponent,
    MatIconButton,
    MatHeaderRow,
    MatRow,
    MsToClockStringPipe,
    MomentFormatPipe,
    TranslatePipe,
    MatHeaderCellDef,
    MatCellDef,
    MatHeaderRowDef,
    MatRowDef,
  ],
})
export class DailyWorklogTableComponent {
  private _taskService = inject(TaskService);
  private _projectService = inject(ProjectService);
  private _dateService = inject(DateService);
  readonly _sessionService = inject(TimeSessionService);
  readonly _workContextService = inject(WorkContextService);
  private readonly _store$ = inject(Store);

  readonly flatTasks = input<Task[]>([]);
  readonly day = input<string>(this._dateService.todayStr());
  readonly updated = output<void>();

  T: typeof T = T;

  // table entries derived from work context (start, end, breaks, unaccounted)
  readonly tableEntries = computed(() => {
    const ret: TableEntry[] = [];

    ret.push({
      type: 'start',
      description: 'Work Start',
      icon: 'login',
      start: this.workStart(),
      end: undefined,
      duration: undefined,
      task: undefined,
      session: undefined,
    });

    for (const session of this._sessionService.todaySessions()) {
      if (session.tid) {
        const task = this.flatTasks()?.find((t) => t.id === session.tid);
        if (task) {
          ret.push({
            type: 'task',
            description: task.title,
            start: session.s,
            end: session.s ? session.s + session.t : undefined,
            duration: session.t,
            task: task,
            session: session,
          });
        }
      }
    }

    // add a break (mock start, duration from break duration)
    ret.splice(1, 0, {
      type: 'break',
      description: 'Break',
      icon: 'coffee',
      // eslint-disable-next-line no-mixed-operators
      start: (this.workStart() || 0) + 3.5 * 60 * 60 * 1000,
      // eslint-disable-next-line no-mixed-operators
      end: (this.workStart() || 0) + 3.5 * 60 * 60 * 1000 + (this.breakTime() || 0),
      duration: this.breakTime(),
      task: undefined,
      session: undefined,
    });

    // unaccounted time
    ret.push({
      type: 'unaccounted',
      description: 'Time not Spent on Tasks or Breaks',
      start: undefined,
      end: undefined,
      duration: (this.workEnd() || 0) - (this.workStart() || 0) - (this.workTime() || 0),
      task: undefined,
      session: undefined,
    });

    ret.push({
      type: 'end',
      description: 'Work End',
      icon: 'logout',
      start: undefined,
      end: this.workEnd(),
      duration: (this.workEnd() || 0) - (this.workStart() || 0),
      task: undefined,
      session: undefined,
    });

    return ret;
  });

  dayStr: string = this._dateService.todayStr();

  workStart = toSignal(this._workContextService.getWorkStart$(this.dayStr));
  workEnd = toSignal(this._workContextService.getWorkEnd$(this.dayStr));
  breakTime = toSignal(this._workContextService.getBreakTime$(this.dayStr));
  workTime = toSignal(
    this._workContextService.getTimeWorkedForDayTodaysTasks$(this.dayStr),
  );

  onStartChanged(entry: TableEntry, ev: string): void {
    const newStartTime = new Date(`${this.dayStr} ${ev}`).getTime();

    if (newStartTime && !isNaN(newStartTime)) {
      if (entry.session) {
        this._store$.dispatch({
          type: '[TimeTracking] Update Time Session',
          sessionId: entry.session.id,
          updates: {
            s: newStartTime,
          },
        });
      } else if (entry.type === 'start') {
        this._workContextService.updateWorkStartForActiveContext(
          this.dayStr,
          newStartTime,
        );
      }
    }
  }

  onEndChanged(entry: TableEntry, ev: string): void {
    const newEndTime = new Date(`${this.dayStr} ${ev}`).getTime();
    if (newEndTime && !isNaN(newEndTime)) {
      if (entry.session) {
        let newDuration = entry.session.t;
        let newStartTime = entry.session.s;

        // if start is set, calculate new duration
        if (entry.session.s && newEndTime > entry.session.s) {
          newDuration = newEndTime - entry.session.s;
        }
        // if start is empty but duration is available, calculate start time
        else if (entry.session.t && !entry.session.s) {
          newStartTime = newEndTime - entry.session.t;
        }
        // else do nothing
        else {
          return;
        }

        this._store$.dispatch({
          type: '[TimeTracking] Update Time Session',
          sessionId: entry.session.id,
          updates: {
            s: newStartTime,
            t: newDuration,
          },
        });
      } else if (entry.type === 'end') {
        this._workContextService.updateWorkEndForActiveContext(this.dayStr, newEndTime);
      }
    }
  }

  onDurationChanged(entry: TableEntry, ev: number): void {
    const newDurationMs = ev;

    if (newDurationMs && !isNaN(newDurationMs)) {
      if (entry.session) {
        this._store$.dispatch({
          type: '[TimeTracking] Update Time Session',
          sessionId: entry.session.id,
          updates: {
            t: newDurationMs,
          },
        });
      } else if (entry.type === 'end') {
        const newEndTime = (this.workStart() || 0) + newDurationMs;
        this._workContextService.updateWorkEndForActiveContext(this.dayStr, newEndTime);
      }
    }
  }
}
