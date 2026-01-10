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
import { ProjectService } from 'src/app/features/project/project.service';
import { T } from '../../../t.const';
import { DateService } from 'src/app/core/date/date.service';
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
import { WorkContextService } from 'src/app/features/work-context/work-context.service';
import { toSignal } from '@angular/core/rxjs-interop';

interface WorkEntry {
  type: 'start' | 'end' | 'break' | 'task' | 'unaccounted' | 'summary';
  description: string;
  icon?: string | undefined;
  start: number | undefined;
  end: number | undefined;
  duration: number | undefined;
  task: TaskCopy | undefined;
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
  readonly workContextService = inject(WorkContextService);

  readonly flatTasks = input<Task[]>([]);
  readonly day = input<string>(this._dateService.todayStr());
  readonly updated = output<void>();

  T: typeof T = T;

  readonly logEntries = computed(() => {
    const ret: WorkEntry[] = [];

    ret.push({
      type: 'start',
      description: 'Work Start',
      icon: 'login',
      start: this.workStart(),
      end: undefined,
      duration: undefined,
      task: undefined,
    });

    let breakIndex = 1;
    const tasks = this.flatTasks();
    if (tasks) {
      for (const task of tasks) {
        ret.push({
          type: 'task',
          description: `${
            this.allProjects().find((project) => {
              return project.id === task.projectId;
            })?.title
          } > ${task.title}`,
          start: undefined,
          end: undefined,
          duration: task.timeSpentOnDay[this.day()],
          task: task,
        });
      }
      breakIndex = 1 + Math.round(0.5 * tasks.length);
    }

    // add mock start & end time to first two tasks
    if (ret.length > 1) {
      ret[1].start = this.workStart();
      ret[1].end = (ret[1].start || 0) + (ret[1].duration || 0);
    }
    if (ret.length > 2) {
      ret[2].start = ret[1].end;
      ret[2].end = (ret[2].start || 0) + (ret[2].duration || 0);
    }

    // add a break (mock start, duration from break duration)
    ret.splice(breakIndex, 0, {
      type: 'break',
      description: 'Break',
      icon: 'coffee',
      // eslint-disable-next-line no-mixed-operators
      start: (this.workStart() || 0) + 3.5 * 60 * 60 * 1000,
      // eslint-disable-next-line no-mixed-operators
      end: (this.workStart() || 0) + 3.5 * 60 * 60 * 1000 + (this.breakTime() || 0),
      duration: this.breakTime(),
      task: undefined,
    });

    // unaccounted time
    ret.push({
      type: 'unaccounted',
      description: 'Time not Spent on Tasks or Breaks',
      start: undefined,
      end: undefined,
      duration: (this.workEnd() || 0) - (this.workStart() || 0) - (this.workTime() || 0),
      task: undefined,
    });

    ret.push({
      type: 'end',
      description: 'Work End',
      icon: 'logout',
      start: undefined,
      end: this.workEnd(),
      duration: (this.workEnd() || 0) - (this.workStart() || 0),
      task: undefined,
    });

    return ret;
  });

  dayStr: string = this._dateService.todayStr();

  workStart = toSignal(this.workContextService.getWorkStart$(this.dayStr));
  workEnd = toSignal(this.workContextService.getWorkEnd$(this.dayStr));
  breakTime = toSignal(this.workContextService.getBreakTime$(this.dayStr));
  workTime = toSignal(
    this.workContextService.getTimeWorkedForDayTodaysTasks$(this.dayStr),
  );

  private readonly allProjects = toSignal(this._projectService.list$, {
    initialValue: [],
  });

  updateTimeSpentTodayForTask(task: Task, newVal: number | string): void {
    this._taskService.updateEverywhere(task.id, {
      timeSpentOnDay: {
        ...task.timeSpentOnDay,
        [this.day()]: +newVal,
      },
    });
    this.updated.emit();
  }

  updateTaskTitle(task: Task, newVal: string): void {
    this._taskService.updateEverywhere(task.id, {
      title: newVal,
    });
    this.updated.emit();
  }

  toggleTaskDone(task: Task): void {
    this._taskService.updateEverywhere(task.id, {
      isDone: !task.isDone,
    });
    // task.isDone
    //   ? this._taskService.setUnDone(task.id)
    //   : this._taskService.setDone(task.id);
    this.updated.emit();
  }
}
