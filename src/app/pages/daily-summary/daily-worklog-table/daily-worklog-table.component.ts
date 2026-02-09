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

// todo: move to const file, maybe make it a const task, so that we can use accumulation functions on it
const breakTaskId = 'BREAK';

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
  private readonly _matDialog = inject(MatDialog);

  readonly flatTasks = input<Task[]>([]);
  readonly day = input<string>(this._dateService.todayStr());
  readonly updated = output<void>();

  T: typeof T = T;

  // table entries derived from work context (start, end, breaks, unaccounted)
  readonly tableEntries = computed(() => {
    const entries: TableEntry[] = [];

    for (const session of this._sessionService.todaySessions()) {
      if (session.tid) {
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
        } else if (session.tid === breakTaskId) {
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

    entries.push({
      type: 'unaccounted',
      description: 'Time not Spent on Tasks or Breaks',
      start: undefined,
      end: undefined,
      duration: this.unaccountedTime(),
      task: undefined,
      session: undefined,
    });

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

  workStart = toSignal(this._workContextService.getWorkStart$(this.dayStr));
  workEnd = toSignal(this._workContextService.getWorkEnd$(this.dayStr));
  workTime = computed(() => {
    return (this.workEnd() || 0) - (this.workStart() || 0);
  });
  breakTime = computed(() => {
    const sessions = this._sessionService.todaySessions();
    return sessions
      .filter((session) => session.tid === breakTaskId)
      .reduce((acc, session) => acc + session.t, 0);
  });
  taskTime = computed(() => {
    const sessions = this._sessionService.todaySessions();
    return sessions
      .filter((session) => session.tid !== breakTaskId)
      .reduce((acc, session) => acc + session.t, 0);
  });
  unaccountedTime = computed(() => {
    return (this.workTime() || 0) - (this.taskTime() || 0) - (this.breakTime() || 0);
  });

  onStartChanged(entry: TableEntry, ev: string): void {
    const newStartTime = new Date(`${this.dayStr} ${ev}`).getTime();

    if (newStartTime && !isNaN(newStartTime)) {
      if (entry.session) {
        this._sessionService.update(entry.session, {
          s: newStartTime,
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

        this._sessionService.update(entry.session, {
          s: newStartTime,
          t: newDuration,
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
        this._sessionService.update(entry.session, {
          t: newDurationMs,
        });
      } else if (entry.type === 'end') {
        const newEndTime = (this.workStart() || 0) + newDurationMs;
        this._workContextService.updateWorkEndForActiveContext(this.dayStr, newEndTime);
      }
    }
  }

  addBreak(): void {
    // todo: useful default time, default to 15min for now
    this._sessionService.addSession(breakTaskId, this.dayStr, undefined, 15 * 60 * 1000);
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
      this._sessionService.addSession(task.id, this.dayStr, undefined, duration);
    }
  }

  toggleTaskDone(task: Task): void {
    this._taskService.updateEverywhere(task.id, {
      isDone: !task.isDone,
    });
  }

  deleteEntry(entry: TableEntry): void {
    if (entry.session) {
      this._sessionService.deleteSession(entry.session.id);
    }
  }
}
