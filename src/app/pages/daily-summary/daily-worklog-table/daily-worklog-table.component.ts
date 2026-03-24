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
import { TimeSession } from '../../../features/time-session/time-session.model';
import { TimeSessionService } from '../../../features/time-session/time-session.service';
import {
  BREAK_TASK_ID,
  WORK_START_ID,
  WORK_END_ID,
} from '../../../features/time-session/time-session.model';
import { MatDialog } from '@angular/material/dialog';
import { DialogAddTaskComponent } from './dialog-add-task.component';

// data container for table entries
// can be a time session, work start/end, break, unaccounted time
interface TableEntry {
  type: 'start' | 'end' | 'break' | 'task' | 'unaccounted';
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
  private _dateService = inject(DateService);
  readonly _timeSessionService = inject(TimeSessionService);
  readonly _workContextService = inject(WorkContextService);
  private readonly _matDialog = inject(MatDialog);

  readonly flatTasks = input<Task[]>([]);
  readonly day = input<string>(this._dateService.todayStr());
  readonly updated = output<void>();

  T: typeof T = T;

  // table entries derived from work context (start, end, breaks, unaccounted)
  readonly tableEntries = computed(() => {
    const entries: TableEntry[] = [];

    for (const session of this._timeSessionService.todaySessions()) {
      if (session.tid) {
        // Skip special work hour marker sessions - they're displayed separately
        if (session.tid === WORK_START_ID || session.tid === WORK_END_ID) {
          continue;
        }

        const task = this.flatTasks()?.find((t) => t.id === session.tid);
        if (task) {
          entries.push({
            type: 'task',
            description: task.title,
            start: session.s,
            end: session.s ? session.s + session.t : undefined,
            duration: session.t,
            task: task,
            session: session,
          });
        } else if (session.tid === BREAK_TASK_ID) {
          entries.push({
            type: 'break',
            description: 'Break',
            icon: 'coffee',
            start: session.s,
            end: session.s ? session.s + session.t : undefined,
            duration: session.t,
            task: undefined,
            session: session,
          });
        }
      }
    }

    entries.sort((a, b) => {
      // if entries have no start time, put them at the end, preserving order
      // otherwise sort by start time
      if (a.start === undefined && b.start === undefined) {
        return 0;
      } else if (a.start === undefined) {
        return 1;
      } else if (b.start === undefined) {
        return -1;
      }
      return a.start - b.start;
    });

    // add work start, unaccounted time and work end entries
    entries.unshift({
      type: 'start',
      description: 'Work Start',
      icon: 'login',
      start: this.workStart(),
      end: undefined,
      duration: undefined,
      task: undefined,
      session: undefined,
    });

    if (this.unaccountedTime() > 0) {
      entries.push({
        type: 'unaccounted',
        description: 'Time not Spent on Tasks or Breaks',
        start: undefined,
        end: undefined,
        duration: this.unaccountedTime(),
        task: undefined,
        session: undefined,
      });
    }

    entries.push({
      type: 'end',
      description: 'Work End',
      icon: 'logout',
      start: undefined,
      end: this.workEnd(),
      duration: this.workTime(),
      task: undefined,
      session: undefined,
    });

    return entries;
  });

  dayStr: string = this._dateService.todayStr();

  workStart = this._timeSessionService.getWorkStart(this.dayStr);
  workEnd = this._timeSessionService.getWorkEnd(this.dayStr);
  workTime = computed(() => {
    return (this.workEnd() || 0) - (this.workStart() || 0);
  });
  breakTime = computed(() => {
    const sessions = this._timeSessionService.todaySessions();
    return sessions
      .filter((session) => session.tid === BREAK_TASK_ID)
      .reduce((acc, session) => acc + session.t, 0);
  });
  taskTime = computed(() => {
    const sessions = this._timeSessionService.todaySessions();
    return sessions
      .filter((session) => session.tid && session.tid !== BREAK_TASK_ID)
      .reduce((acc, session) => acc + session.t, 0);
  });
  unaccountedTime = computed(() => {
    return this.workTime() - this.taskTime() - this.breakTime();
  });
  workStartIsManual = this._timeSessionService.isManualWorkStart(this.dayStr);
  workEndIsManual = this._timeSessionService.isManualWorkEnd(this.dayStr);

  onStartChanged(entry: TableEntry, ev: string): void {
    if (ev === '') {
      // if input is cleared, delete start time
      if (entry.session) {
        this._timeSessionService.update(entry.session, {
          s: undefined,
        });
      }
    } else {
      const newStartTime = new Date(`${this.dayStr} ${ev}`).getTime();
      if (newStartTime && !isNaN(newStartTime)) {
        if (entry.session) {
          this._timeSessionService.update(entry.session, {
            s: newStartTime,
          });
        } else if (entry.type === 'start') {
          this._timeSessionService.setWorkStart(this.dayStr, newStartTime);
        }
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

        this._timeSessionService.update(entry.session, {
          s: newStartTime,
          t: newDuration,
        });
      } else if (entry.type === 'end') {
        this._timeSessionService.setWorkEnd(this.dayStr, newEndTime);
      }
    }
  }

  onDurationChanged(entry: TableEntry, ev: number): void {
    const newDurationMs = ev;

    if (newDurationMs && !isNaN(newDurationMs)) {
      if (entry.session) {
        this._timeSessionService.update(entry.session, {
          t: newDurationMs,
        });
      } else if (entry.type === 'end') {
        const newEndTime = (this.workStart() || 0) + newDurationMs;
        this._timeSessionService.setWorkEnd(this.dayStr, newEndTime);
      }
    }
  }

  addBreak(): void {
    // todo: useful default time, default to 15min for now
    this._timeSessionService.addBreakSession(15 * 60 * 1000, this.dayStr, undefined);
  }

  addTask(): void {
    this._matDialog
      .open(DialogAddTaskComponent)
      .afterClosed()
      .subscribe((taskOrTitle) => {
        if (taskOrTitle) {
          if (typeof taskOrTitle === 'string') {
            // User is creating a new task with title from input
            const taskId = this._taskService.add(taskOrTitle);
            this._taskService.getByIdOnce$(taskId).subscribe((createdTask: Task) => {
              this._addTaskSession(createdTask, this.unaccountedTime());
            });
          } else {
            // User selected an existing task
            this._addTaskSession(taskOrTitle, this.unaccountedTime());
          }
        }
      });
  }

  private _addTaskSession(task: Task, duration: number): void {
    if (duration > 0) {
      this._timeSessionService.addSession(task.id, this.dayStr, duration);
    }
  }

  toggleTaskDone(task: Task): void {
    this._taskService.updateEverywhere(task.id, {
      isDone: !task.isDone,
    });
  }

  deleteEntry(entry: TableEntry): void {
    if (entry.session) {
      this._timeSessionService.deleteSession(entry.session.id);
    }
  }

  setAutoStartTime(): void {
    this._timeSessionService.setAutoWorkStart(this.dayStr);
  }

  setAutoEndTime(): void {
    this._timeSessionService.setAutoWorkEnd(this.dayStr);
  }
}
