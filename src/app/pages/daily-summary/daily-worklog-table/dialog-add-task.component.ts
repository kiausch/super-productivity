import { Component, HostListener, inject, signal } from '@angular/core';
import {
  MatDialogRef,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { SelectTaskComponent } from '../../../features/tasks/select-task/select-task.component';
import { Task } from '../../../features/tasks/task.model';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'dialog-add-task',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    SelectTaskComponent,
    MatButton,
    TranslatePipe,
  ],
  template: `
    <mat-dialog-content>
      <select-task
        [isIncludeDoneTasks]="true"
        [isShowSuggestionsWithoutSearch]="true"
        (taskChange)="onSelectTask($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        mat-stroked-button
        (click)="cancel()"
      >
        {{ 'G.CANCEL' | translate }}
      </button>
      <button
        mat-stroked-button
        color="primary"
        [disabled]="!selectedTask()"
        (click)="ok()"
      >
        {{ 'G.OK' | translate }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DialogAddTaskComponent {
  private _matDialogRef = inject<MatDialogRef<DialogAddTaskComponent>>(MatDialogRef);

  readonly selectedTask = signal<Task | string | null>(null);

  onSelectTask(taskOrTitle: Task | string): void {
    this.selectedTask.set(taskOrTitle);
  }

  ok(): void {
    if (this.selectedTask()) {
      this._matDialogRef.close(this.selectedTask());
    }
  }

  cancel(): void {
    this._matDialogRef.close(undefined);
  }

  @HostListener('keydown.enter')
  onEnter(): void {
    this.ok();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.cancel();
  }
}
