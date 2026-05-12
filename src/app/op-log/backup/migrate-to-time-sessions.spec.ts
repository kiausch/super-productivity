/* eslint-disable @typescript-eslint/naming-convention */
import {
  migrateToTimeSessions,
  needsTimeSessionMigration,
} from './migrate-to-time-sessions';
import {
  BREAK_TASK_ID,
  WORK_END_ID,
  WORK_START_ID,
} from '../../features/time-session/time-session.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (
  id: string,
  timeSpentOnDay: Record<string, number>,
): Record<string, any> => ({
  id,
  title: `Task ${id}`,
  timeSpent: Object.values(timeSpentOnDay).reduce((a, b) => a + b, 0),
  timeSpentOnDay,
});

const makeTaskState = (tasks: Record<string, any>[]): Record<string, any> => ({
  ids: tasks.map((t) => t.id),
  entities: Object.fromEntries(tasks.map((t) => [t.id, t])),
});

const makeTimeTracking = (
  projectData: Record<string, Record<string, { s?: number; e?: number; bt?: number }>>,
): Record<string, any> => ({
  project: projectData,
  tag: {},
});

// ---------------------------------------------------------------------------
// needsTimeSessionMigration
// ---------------------------------------------------------------------------

describe('needsTimeSessionMigration', () => {
  it('returns true when timeSession key is absent', () => {
    expect(needsTimeSessionMigration({})).toBe(true);
    expect(needsTimeSessionMigration({ task: {}, timeTracking: {} })).toBe(true);
  });

  it('returns true when timeSession is null', () => {
    expect(needsTimeSessionMigration({ timeSession: null })).toBe(true);
  });

  it('returns false when timeSession key is present (even empty)', () => {
    expect(needsTimeSessionMigration({ timeSession: { sessions: [] } })).toBe(false);
  });

  it('returns false when timeSession has sessions', () => {
    expect(
      needsTimeSessionMigration({
        timeSession: { sessions: [{ id: '1', tid: 'task1', d: '2024-01-01', t: 1000 }] },
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// migrateToTimeSessions — basic shape
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — output shape', () => {
  it('adds a timeSession key with a sessions array', () => {
    const result = migrateToTimeSessions({});
    expect(result.timeSession).toBeDefined();
    expect(Array.isArray(result.timeSession.sessions)).toBe(true);
  });

  it('preserves all other keys', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({}),
      someOtherKey: 'preserved',
    };
    const result = migrateToTimeSessions(input);
    expect(result.someOtherKey).toBe('preserved');
    expect(result.task).toBe(input.task);
  });
});

// ---------------------------------------------------------------------------
// Task sessions
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — task sessions', () => {
  it('creates one session per (task, date) for tasks with timeSpentOnDay', () => {
    const input = {
      task: makeTaskState([
        makeTask('t1', { '2024-01-15': 3600000, '2024-01-16': 1800000 }),
      ]),
      timeTracking: makeTimeTracking({}),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const taskSessions = sessions.filter((s: any) => s.tid === 't1');
    expect(taskSessions).toHaveSize(2);
    expect(taskSessions.find((s: any) => s.d === '2024-01-15')?.t).toBe(3600000);
    expect(taskSessions.find((s: any) => s.d === '2024-01-16')?.t).toBe(1800000);
  });

  it('omits sessions for zero-duration days', () => {
    const input = {
      task: makeTaskState([makeTask('t1', { '2024-01-15': 0, '2024-01-16': 1800000 })]),
      timeTracking: makeTimeTracking({}),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const taskSessions = sessions.filter((s: any) => s.tid === 't1');
    expect(taskSessions).toHaveSize(1);
    expect(taskSessions[0].d).toBe('2024-01-16');
  });

  it('task sessions have no start timestamp (duration-only)', () => {
    const input = {
      task: makeTaskState([makeTask('t1', { '2024-01-15': 3600000 })]),
      timeTracking: makeTimeTracking({}),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const session = sessions.find((s: any) => s.tid === 't1');
    expect(session?.s).toBeUndefined();
  });

  it('each session has a unique string id', () => {
    const input = {
      task: makeTaskState([
        makeTask('t1', { '2024-01-15': 3600000 }),
        makeTask('t2', { '2024-01-15': 1800000 }),
      ]),
      timeTracking: makeTimeTracking({}),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const ids = sessions.map((s: any) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(sessions.length);
  });

  it('handles missing task.entities gracefully', () => {
    const result = migrateToTimeSessions({ task: null });
    expect(result.timeSession.sessions).toHaveSize(0);
  });

  it('handles task with no timeSpentOnDay', () => {
    const input = {
      task: { ids: ['t1'], entities: { t1: { id: 't1', title: 'T' } } },
    };
    expect(() => migrateToTimeSessions(input)).not.toThrow();
    expect(migrateToTimeSessions(input).timeSession.sessions).toHaveSize(0);
  });
});

// ---------------------------------------------------------------------------
// Work markers from timeTracking
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — work markers', () => {
  it('creates WORK_START session from timeTracking.project[id][date].s', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({
        'proj-1': { '2024-01-15': { s: 1705305600000 } },
      }),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const startSessions = sessions.filter((s: any) => s.tid === WORK_START_ID);
    expect(startSessions).toHaveSize(1);
    expect(startSessions[0].d).toBe('2024-01-15');
    expect(startSessions[0].s).toBe(1705305600000);
    expect(startSessions[0].t).toBe(0);
  });

  it('creates WORK_END session from timeTracking.project[id][date].e', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({
        'proj-1': { '2024-01-15': { e: 1705320000000 } },
      }),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const endSessions = sessions.filter((s: any) => s.tid === WORK_END_ID);
    expect(endSessions).toHaveSize(1);
    expect(endSessions[0].s).toBe(1705320000000);
  });

  it('creates BREAK session from timeTracking.project[id][date].bt', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({
        'proj-1': { '2024-01-15': { bt: 1800000 } },
      }),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const breakSessions = sessions.filter((s: any) => s.tid === BREAK_TASK_ID);
    expect(breakSessions).toHaveSize(1);
    expect(breakSessions[0].t).toBe(1800000);
    expect(breakSessions[0].s).toBeUndefined();
  });

  it('does not create BREAK session when bt is 0', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({ 'proj-1': { '2024-01-15': { bt: 0 } } }),
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === BREAK_TASK_ID)).toHaveSize(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-context deduplication
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — multi-context deduplication', () => {
  it('takes the minimum work start across multiple contexts for the same date', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: {
        project: {
          'proj-1': { '2024-01-15': { s: 1705310000000 } },
          'proj-2': { '2024-01-15': { s: 1705305600000 } }, // earlier
        },
        tag: {},
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const starts = sessions.filter((s: any) => s.tid === WORK_START_ID);
    expect(starts).toHaveSize(1);
    expect(starts[0].s).toBe(1705305600000);
  });

  it('takes the maximum work end across multiple contexts for the same date', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: {
        project: {
          'proj-1': { '2024-01-15': { e: 1705320000000 } },
          'proj-2': { '2024-01-15': { e: 1705325600000 } }, // later
        },
        tag: {},
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const ends = sessions.filter((s: any) => s.tid === WORK_END_ID);
    expect(ends).toHaveSize(1);
    expect(ends[0].s).toBe(1705325600000);
  });

  it('takes the maximum break time across multiple contexts for the same date', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: {
        project: {
          'proj-1': { '2024-01-15': { bt: 900000 } },
          'proj-2': { '2024-01-15': { bt: 1800000 } }, // larger
        },
        tag: {},
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const breaks = sessions.filter((s: any) => s.tid === BREAK_TASK_ID);
    expect(breaks).toHaveSize(1);
    expect(breaks[0].t).toBe(1800000);
  });

  it('produces one work-marker session per date, not per context', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: {
        project: {
          'proj-1': {
            '2024-01-15': { s: 1705305600000, e: 1705320000000 },
            '2024-01-16': { s: 1705392000000, e: 1705406400000 },
          },
          'proj-2': {
            '2024-01-15': { s: 1705305600000, e: 1705320000000 },
          },
        },
        tag: {},
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === WORK_START_ID)).toHaveSize(2);
    expect(sessions.filter((s: any) => s.tid === WORK_END_ID)).toHaveSize(2);
  });
});

// ---------------------------------------------------------------------------
// Archive timeTracking migration
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — archive timeTracking', () => {
  it('merges work markers from archiveYoung.timeTracking', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({}),
      archiveYoung: {
        task: { ids: [], entities: {} },
        timeTracking: makeTimeTracking({
          'proj-1': { '2023-06-01': { s: 1685574000000, e: 1685592000000 } },
        }),
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === WORK_START_ID)).toHaveSize(1);
    expect(sessions.filter((s: any) => s.tid === WORK_END_ID)).toHaveSize(1);
  });

  it('merges work markers from archiveOld.timeTracking', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({}),
      archiveOld: {
        task: { ids: [], entities: {} },
        timeTracking: makeTimeTracking({
          'proj-1': { '2022-01-10': { s: 1641812400000 } },
        }),
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === WORK_START_ID)).toHaveSize(1);
    expect(sessions[0].d).toBe('2022-01-10');
  });

  it('merges work markers across all three sources, same date', () => {
    // current: s=10, archiveYoung: s=5 (earlier, should win), archiveOld: e=20
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({ 'proj-1': { '2024-01-15': { s: 10 } } }),
      archiveYoung: {
        task: { ids: [], entities: {} },
        timeTracking: makeTimeTracking({ 'proj-1': { '2024-01-15': { s: 5 } } }),
      },
      archiveOld: {
        task: { ids: [], entities: {} },
        timeTracking: makeTimeTracking({ 'proj-1': { '2024-01-15': { e: 20 } } }),
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    const start = sessions.find((s: any) => s.tid === WORK_START_ID);
    const end = sessions.find((s: any) => s.tid === WORK_END_ID);
    expect(start?.s).toBe(5);
    expect(end?.s).toBe(20);
  });

  it('does NOT create task sessions for archived tasks', () => {
    const input = {
      task: makeTaskState([]),
      timeTracking: makeTimeTracking({}),
      archiveYoung: {
        task: makeTaskState([makeTask('archived-1', { '2024-01-10': 3600000 })]),
        timeTracking: makeTimeTracking({}),
      },
    };
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === 'archived-1')).toHaveSize(0);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — idempotency', () => {
  it('needsTimeSessionMigration returns false after migration', () => {
    const migrated = migrateToTimeSessions({ task: makeTaskState([]) });
    expect(needsTimeSessionMigration(migrated)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Empty / edge cases
// ---------------------------------------------------------------------------

describe('migrateToTimeSessions — edge cases', () => {
  it('handles completely empty input gracefully', () => {
    const result = migrateToTimeSessions({});
    expect(result.timeSession.sessions).toHaveSize(0);
  });

  it('handles missing timeTracking gracefully', () => {
    const input = { task: makeTaskState([makeTask('t1', { '2024-01-01': 1000 })]) };
    expect(() => migrateToTimeSessions(input)).not.toThrow();
    const { sessions } = migrateToTimeSessions(input).timeSession;
    expect(sessions.filter((s: any) => s.tid === 't1')).toHaveSize(1);
  });
});
