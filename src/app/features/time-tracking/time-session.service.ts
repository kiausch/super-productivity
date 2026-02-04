import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAllSessions, selectTodaySessions } from './store/time-session.selectors';
import { TimeSession } from './time-tracking.model';

@Injectable({
  providedIn: 'root',
})
export class TimeSessionService {
  private _store = inject(Store);

  allSessions = this._store.selectSignal(selectAllSessions);
  todaySessions = this._store.selectSignal(selectTodaySessions);

  update(session: TimeSession, changes: Partial<TimeSession>): void {
    this._store.dispatch({
      type: '[TimeTracking] Update Time Session',
      sessionId: session.id,
      updates: changes,
    });
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
    this._store.dispatch({
      type: '[TimeTracking] Add time session',
      timeSession: newSession,
    });
  }
}
