import { initialTimeSessionState, timeSessionReducer } from './time-session.reducer';
import { TimeSessionActions } from './time-session.actions';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { AppDataComplete } from '../../../op-log/model/model-config';

describe('TimeSession Reducer', () => {
  it('should return the previous state for an unknown action', () => {
    const action = {} as any;
    const result = timeSessionReducer(initialTimeSessionState, action);
    expect(result).toBe(initialTimeSessionState);
  });

  it('should load all data from timeSession state', () => {
    const appDataComplete: AppDataComplete = {
      timeSession: {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
          { id: '2', tid: 'task-2', d: '2023-01-02', t: 7200000 },
        ],
      },
      timeTracking: { project: {}, tag: {} },
    } as Partial<AppDataComplete> as AppDataComplete;
    const action = loadAllData({ appDataComplete });
    const result = timeSessionReducer(initialTimeSessionState, action);
    expect(result).toEqual(appDataComplete.timeSession);
    expect(result.sessions.length).toBe(2);
  });

  describe('addTimeSession', () => {
    it('should add a time session to the array', () => {
      const timeSession = {
        id: 'session-1',
        tid: 'task-1',
        d: '2023-01-01',
        s: 1000000000000,
        t: 3600000,
      };
      const action = TimeSessionActions.addTimeSession({ timeSession });
      const result = timeSessionReducer(initialTimeSessionState, action);
      expect(result.sessions.length).toBe(1);
      expect(result.sessions[0]).toEqual(timeSession);
    });

    it('should add multiple sessions preserving order', () => {
      let state = initialTimeSessionState;
      const sessions = [
        {
          id: 'session-1',
          tid: 'task-1',
          d: '2023-01-01',
          s: 1000000000000,
          t: 3600000,
        },
        {
          id: 'session-2',
          tid: 'task-2',
          d: '2023-01-02',
          s: 1000000001000,
          t: 7200000,
        },
      ];

      for (const session of sessions) {
        const action = TimeSessionActions.addTimeSession({ timeSession: session });
        state = timeSessionReducer(state, action);
      }

      expect(state.sessions.length).toBe(2);
      expect(state.sessions[0].id).toBe('session-1');
      expect(state.sessions[1].id).toBe('session-2');
    });

    it('should not cause mutations to the original state', () => {
      const originalState = {
        sessions: [{ id: '1', tid: 'task-1', d: '2023-01-01', t: 3600000 }],
      };
      const newSession = {
        id: '2',
        tid: 'task-2',
        d: '2023-01-02',
        s: 1000000000000,
        t: 7200000,
      };
      const action = TimeSessionActions.addTimeSession({ timeSession: newSession });
      const result = timeSessionReducer(originalState, action);

      // Original should be unchanged
      expect(originalState.sessions.length).toBe(1);
      // Result should have both
      expect(result.sessions.length).toBe(2);
    });
  });

  describe('updateTimeSession', () => {
    it('should update a time session by id', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
        ],
      };
      const action = TimeSessionActions.updateTimeSession({
        sessionId: '1',
        updates: { t: 7200000 },
      });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions[0].t).toBe(7200000);
      expect(result.sessions[0].id).toBe('1');
      expect(result.sessions[0].tid).toBe('task-1');
    });

    it('should merge updates with existing session data', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
        ],
      };
      const action = TimeSessionActions.updateTimeSession({
        sessionId: '1',
        updates: { tid: 'task-2' },
      });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions[0]).toEqual({
        id: '1',
        tid: 'task-2',
        d: '2023-01-01',
        s: 1000000000000,
        t: 3600000,
      });
    });

    it('should not affect other sessions in the array', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
          { id: '2', tid: 'task-2', d: '2023-01-02', s: 1000000001000, t: 7200000 },
        ],
      };
      const action = TimeSessionActions.updateTimeSession({
        sessionId: '1',
        updates: { t: 9999999 },
      });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions[0].t).toBe(9999999);
      expect(result.sessions[1].t).toBe(7200000);
    });

    it('should not mutate the original state', () => {
      const originalState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
        ],
      };
      const action = TimeSessionActions.updateTimeSession({
        sessionId: '1',
        updates: { t: 7200000 },
      });
      const result = timeSessionReducer(originalState, action);

      expect(originalState.sessions[0].t).toBe(3600000);
      expect(result.sessions[0].t).toBe(7200000);
    });
  });

  describe('deleteTimeSession', () => {
    it('should remove a time session by id', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
        ],
      };
      const action = TimeSessionActions.deleteTimeSession({ sessionId: '1' });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions.length).toBe(0);
    });

    it('should not affect other sessions in the array', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
          { id: '2', tid: 'task-2', d: '2023-01-02', s: 1000000001000, t: 7200000 },
        ],
      };
      const action = TimeSessionActions.deleteTimeSession({ sessionId: '2' });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions.length).toBe(1);
      expect(result.sessions[0].id).toBe('1');
    });

    it('should handle deleting non-existent session gracefully', () => {
      const initialState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
        ],
      };
      const action = TimeSessionActions.deleteTimeSession({ sessionId: 'non-existent' });
      const result = timeSessionReducer(initialState, action);

      expect(result.sessions.length).toBe(1);
      expect(result.sessions[0].id).toBe('1');
    });

    it('should not mutate the original state', () => {
      const originalState = {
        sessions: [
          { id: '1', tid: 'task-1', d: '2023-01-01', s: 1000000000000, t: 3600000 },
          { id: '2', tid: 'task-2', d: '2023-01-02', s: 1000000001000, t: 7200000 },
        ],
      };
      const action = TimeSessionActions.deleteTimeSession({ sessionId: '1' });
      const result = timeSessionReducer(originalState, action);

      expect(originalState.sessions.length).toBe(2);
      expect(result.sessions.length).toBe(1);
    });
  });
});
