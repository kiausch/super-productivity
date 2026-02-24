import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAllSessions, selectTodaySessions } from './store/time-session.selectors';
import {
  addTimeSession,
  updateTimeSession,
  deleteTimeSession,
} from './store/time-session.actions';
import { TimeSession } from './time-session.model';

@Injectable({
  providedIn: 'root',
})
export class TimeSessionService {
  private _store = inject(Store);

  allSessions = this._store.selectSignal(selectAllSessions);
  todaySessions = this._store.selectSignal(selectTodaySessions);

  update(session: TimeSession, changes: Partial<TimeSession>): void {
    this._store.dispatch(
      updateTimeSession({
        sessionId: session.id,
        updates: changes,
      }),
    );
  }

  addSession(
    taskId: string,
    date: string,
    start: number | undefined,
    duration: number,
  ): void {
    const newSession: TimeSession = {
      id: crypto.randomUUID(),
      tid: taskId,
      d: date,
      s: start,
      t: duration,
    };
    this._store.dispatch(
      addTimeSession({
        timeSession: newSession,
      }),
    );
  }

  deleteSession(sessionId: string): void {
    this._store.dispatch(
      deleteTimeSession({
        sessionId,
      }),
    );
  }
}
