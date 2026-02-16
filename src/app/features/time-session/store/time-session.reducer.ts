import { TimeSessionActions } from './time-session.actions';
import { createFeature, createReducer, on } from '@ngrx/store';
import { TimeSessionState } from '../time-session.model';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { AppDataComplete } from '../../../op-log/model/model-config';

export const TIME_SESSION_FEATURE_KEY = 'timeSession' as const;

export const initialTimeSessionState: TimeSessionState = {
  sessions: [],
} as const;

export const timeSessionReducer = createReducer(
  initialTimeSessionState,

  on(loadAllData, (state, { appDataComplete }) => {
    const appData = appDataComplete as AppDataComplete;
    // Load timeSession state from appDataComplete
    if (appData.timeSession) {
      return appData.timeSession;
    }
    return state;
  }),

  on(TimeSessionActions.addTimeSession, (state, { timeSession }) => ({
    ...state,
    sessions: [...state.sessions, timeSession],
  })),

  on(TimeSessionActions.updateTimeSession, (state, { sessionId, updates }) => ({
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId ? { ...session, ...updates } : session,
    ),
  })),

  on(TimeSessionActions.deleteTimeSession, (state, { sessionId }) => ({
    ...state,
    sessions: state.sessions.filter((session) => session.id !== sessionId),
  })),
);

export const timeSessionFeature = createFeature({
  name: TIME_SESSION_FEATURE_KEY,
  reducer: timeSessionReducer,
});
