import { computed, inject, Injectable, Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAllSessions, selectTodaySessions } from './store/time-session.selectors';
import {
  addTimeSession,
  updateTimeSession,
  deleteTimeSession,
} from './store/time-session.actions';
import {
  TimeSession,
  WORK_START_ID,
  WORK_END_ID,
  BREAK_TASK_ID,
} from './time-session.model';
import { DateService } from '../../core/date/date.service';

@Injectable({
  providedIn: 'root',
})
export class TimeSessionService {
  private _store = inject(Store);
  private _dateService = inject(DateService);

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

  /**
   * Convenience method to add a break session.
   *
   * @param duration Duration of the break in milliseconds
   * @param date Date string in 'YYYY-MM-DD' format (defaults to today)
   * @param start Start timestamp in ms (defaults to current time, can be undefined)
   */
  addBreakSession(
    duration: number,
    date: string = this._dateService.todayStr(),
    start: number | undefined = undefined,
  ): void {
    this.addSession(BREAK_TASK_ID, date, start, duration);
  }

  /**
   * Sets work start time for a date.
   * Updates existing WORK_START_ID session if found, otherwise creates new one.
   *
   * @param date Date string in 'YYYY-MM-DD' format
   * @param timestamp Work start timestamp in ms
   */
  setWorkStart(date: string, timestamp: number): void {
    const existingSession = this.allSessions().find(
      (s) => s.d === date && s.tid === WORK_START_ID,
    );

    if (existingSession) {
      this._store.dispatch(
        updateTimeSession({
          sessionId: existingSession.id,
          updates: { s: timestamp },
        }),
      );
    } else {
      const newSession: TimeSession = {
        id: crypto.randomUUID(),
        tid: WORK_START_ID,
        d: date,
        s: timestamp,
        t: 0,
      };
      this._store.dispatch(
        addTimeSession({
          timeSession: newSession,
        }),
      );
    }
  }

  /**
   * Sets work end time for a date.
   * Updates existing WORK_END_ID session if found, otherwise creates new one.
   *
   * @param date Date string in 'YYYY-MM-DD' format
   * @param timestamp Work end timestamp in ms
   */
  setWorkEnd(date: string, timestamp: number): void {
    const existingSession = this.allSessions().find(
      (s) => s.d === date && s.tid === WORK_END_ID,
    );

    if (existingSession) {
      this._store.dispatch(
        updateTimeSession({
          sessionId: existingSession.id,
          updates: { s: timestamp },
        }),
      );
    } else {
      const newSession: TimeSession = {
        id: crypto.randomUUID(),
        tid: WORK_END_ID,
        d: date,
        s: timestamp,
        t: 0,
      };
      this._store.dispatch(
        addTimeSession({
          timeSession: newSession,
        }),
      );
    }
  }

  /**
   * Gets work start time for a date.
   * Calculates the minimum start time from all sessions (including manual WORK_START_ID markers).
   *
   * @param date Date string in 'YYYY-MM-DD' format
   * @returns Signal of work start timestamp, or undefined if no sessions exist
   */
  getWorkStart(date: string): Signal<number | undefined> {
    return computed(() => {
      const sessionsForDate = this.allSessions().filter(
        (s) => s.d === date && s.s !== undefined,
      );

      if (sessionsForDate.length === 0) {
        return undefined;
      }

      return Math.min(...sessionsForDate.map((s) => s.s as number));
    });
  }

  /**
   * Gets work end time for a date.
   * Calculates the maximum end time (start + duration) from all sessions (including manual WORK_END_ID markers).
   *
   * @param date Date string in 'YYYY-MM-DD' format
   * @returns Signal of work end timestamp, or undefined if no sessions exist
   */
  getWorkEnd(date: string): Signal<number | undefined> {
    return computed(() => {
      const sessionsForDate = this.allSessions().filter(
        (s) => s.d === date && s.s !== undefined,
      );

      if (sessionsForDate.length === 0) {
        return undefined;
      }

      return Math.max(...sessionsForDate.map((s) => (s.s as number) + s.t));
    });
  }

  /**
   * Sets work start time for a date to be automatically determined by sessions.
   * Deletes the WORK_START_ID session if it exists. After deletion, work start time will be calculated from the earliest session start time.
   *
   * @param date Date string in 'YYYY-MM-DD' format
   */
  setAutoWorkStart(date: string): void {
    const existingSession = this.allSessions().find(
      (s) => s.d === date && s.tid === WORK_START_ID,
    );
    if (existingSession) {
      this._store.dispatch(
        deleteTimeSession({
          sessionId: existingSession.id,
        }),
      );
    }
  }

  /**
   * Sets work end time for a date to be automatically determined by sessions.
   * Deletes the WORK_END_ID session if it exists. After deletion, work end time will be calculated from the latest session end time.
   *
   * @param date Date string in 'YYYY-MM-DD' format
   */
  setAutoWorkEnd(date: string): void {
    const existingSession = this.allSessions().find(
      (s) => s.d === date && s.tid === WORK_END_ID,
    );
    if (existingSession) {
      this._store.dispatch(
        deleteTimeSession({
          sessionId: existingSession.id,
        }),
      );
    }
  }
}
