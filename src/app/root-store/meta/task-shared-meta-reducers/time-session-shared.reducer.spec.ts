import { timeSessionSharedMetaReducer } from './time-session-shared.reducer';
import { TaskSharedActions } from '../task-shared.actions';
import { RootState } from '../../root-state';
import { TIME_SESSION_FEATURE_KEY } from '../../../features/time-session/store/time-session.reducer';
import {
  TimeSession,
  TimeSessionState,
} from '../../../features/time-session/time-session.model';
import { TaskWithSubTasks } from '../../../features/tasks/task.model';
import { Action, ActionReducer } from '@ngrx/store';
import { createBaseState, createMockTask } from './test-utils';
import { nanoid } from 'nanoid';

const createMockTimeSession = (overrides: Partial<TimeSession> = {}): TimeSession => ({
  id: nanoid(),
  tid: 'task1',
  d: '2026-02-24',
  t: 3600000, // 1 hour
  ...overrides,
});

describe('timeSessionSharedMetaReducer', () => {
  let mockReducer: jasmine.Spy;
  let metaReducer: ActionReducer<any, Action>;
  let baseState: RootState;

  beforeEach(() => {
    mockReducer = jasmine.createSpy('reducer').and.callFake((state, action) => state);
    metaReducer = timeSessionSharedMetaReducer(mockReducer);
    baseState = createBaseState();
  });

  describe('deleteTask action', () => {
    it('should remove time sessions for deleted task', () => {
      const session1 = createMockTimeSession({ id: 's1', tid: 'task1' });
      const session2 = createMockTimeSession({ id: 's2', tid: 'task2' });
      const session3 = createMockTimeSession({ id: 's3', tid: 'task1' });

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions: [session1, session2, session3],
        } as TimeSessionState,
      };

      const task: TaskWithSubTasks = {
        ...createMockTask({ id: 'task1' }),
        subTasks: [],
        subTaskIds: [],
      };

      const action = TaskSharedActions.deleteTask({ task });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY].sessions).toEqual([session2]);
      expect(mockReducer).toHaveBeenCalled();
    });

    it('should remove time sessions for deleted task and its subtasks', () => {
      const session1 = createMockTimeSession({ id: 's1', tid: 'task1' });
      const session2 = createMockTimeSession({ id: 's2', tid: 'subtask1' });
      const session3 = createMockTimeSession({ id: 's3', tid: 'task2' });

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions: [session1, session2, session3],
        } as TimeSessionState,
      };

      const task: TaskWithSubTasks = {
        ...createMockTask({ id: 'task1' }),
        subTasks: [],
        subTaskIds: ['subtask1'],
      };

      const action = TaskSharedActions.deleteTask({ task });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY].sessions).toEqual([session3]);
      expect(mockReducer).toHaveBeenCalled();
    });

    it('should not modify state when no sessions match deleted task', () => {
      const session1 = createMockTimeSession({ id: 's1', tid: 'task2' });
      const session2 = createMockTimeSession({ id: 's2', tid: 'task3' });

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions: [session1, session2],
        } as TimeSessionState,
      };

      const task: TaskWithSubTasks = {
        ...createMockTask({ id: 'task1' }),
        subTasks: [],
        subTaskIds: [],
      };

      const action = TaskSharedActions.deleteTask({ task });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY]).toBe(testState[TIME_SESSION_FEATURE_KEY]);
      expect(mockReducer).toHaveBeenCalled();
    });

    it('should handle missing time session state gracefully', () => {
      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: undefined as any,
      };

      const task: TaskWithSubTasks = {
        ...createMockTask({ id: 'task1' }),
        subTasks: [],
        subTaskIds: [],
      };

      const action = TaskSharedActions.deleteTask({ task });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY]).toBeUndefined();
      expect(mockReducer).toHaveBeenCalled();
    });
  });

  describe('deleteTasks action', () => {
    it('should remove time sessions for all deleted tasks', () => {
      const session1 = createMockTimeSession({ id: 's1', tid: 'task1' });
      const session2 = createMockTimeSession({ id: 's2', tid: 'task2' });
      const session3 = createMockTimeSession({ id: 's3', tid: 'task3' });
      const session4 = createMockTimeSession({ id: 's4', tid: 'task4' });

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions: [session1, session2, session3, session4],
        } as TimeSessionState,
      };

      const action = TaskSharedActions.deleteTasks({ taskIds: ['task1', 'task3'] });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY].sessions).toEqual([session2, session4]);
      expect(mockReducer).toHaveBeenCalled();
    });

    it('should handle empty taskIds array', () => {
      const session1 = createMockTimeSession({ id: 's1', tid: 'task1' });

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions: [session1],
        } as TimeSessionState,
      };

      const action = TaskSharedActions.deleteTasks({ taskIds: [] });
      const result = metaReducer(testState, action);

      expect(result[TIME_SESSION_FEATURE_KEY]).toBe(testState[TIME_SESSION_FEATURE_KEY]);
      expect(mockReducer).toHaveBeenCalled();
    });

    it('should handle large number of task deletions efficiently', () => {
      // Create 100 tasks and 100 sessions
      const sessions: TimeSession[] = [];
      const taskIdsToDelete: string[] = [];

      for (let i = 0; i < 100; i++) {
        sessions.push(createMockTimeSession({ id: `s${i}`, tid: `task${i}` }));
        if (i % 2 === 0) {
          // Delete even-numbered tasks
          taskIdsToDelete.push(`task${i}`);
        }
      }

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions,
        } as TimeSessionState,
      };

      const action = TaskSharedActions.deleteTasks({ taskIds: taskIdsToDelete });
      const result = metaReducer(testState, action);

      // Should have 50 sessions remaining (odd-numbered tasks)
      expect(result[TIME_SESSION_FEATURE_KEY].sessions.length).toBe(50);
      expect(
        result[TIME_SESSION_FEATURE_KEY].sessions.every(
          (s) => parseInt(s.tid.replace('task', ''), 10) % 2 === 1,
        ),
      ).toBe(true);
      expect(mockReducer).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should use Set for O(1) lookups with many tasks', () => {
      const sessions: TimeSession[] = [];
      const taskIdsToDelete: string[] = [];

      // Create 1000 tasks and 1000 sessions
      for (let i = 0; i < 1000; i++) {
        sessions.push(createMockTimeSession({ id: `s${i}`, tid: `task${i}` }));
        if (i < 500) {
          taskIdsToDelete.push(`task${i}`);
        }
      }

      const testState: RootState = {
        ...baseState,
        [TIME_SESSION_FEATURE_KEY]: {
          sessions,
        } as TimeSessionState,
      };

      const action = TaskSharedActions.deleteTasks({ taskIds: taskIdsToDelete });

      const startTime = performance.now();
      const result = metaReducer(testState, action);
      const endTime = performance.now();

      expect(result[TIME_SESSION_FEATURE_KEY].sessions.length).toBe(500);
      // Should complete in under 50ms on a typical machine
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
