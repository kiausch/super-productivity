/* eslint-disable @typescript-eslint/naming-convention */
import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { AllTasksMetricsService } from './all-tasks-metrics.service';
import { TaskService } from '../tasks/task.service';
import { WorklogService } from '../worklog/worklog.service';
import { WorkContextService } from '../work-context/work-context.service';
import { BehaviorSubject } from 'rxjs';
import { createTask } from '../tasks/task.test-helper';
import { Worklog } from '../worklog/worklog.model';
import { WorkContext, WorkContextType } from '../work-context/work-context.model';
import { TODAY_TAG } from '../tag/tag.const';
import { selectAllSessions } from '../time-session/store/time-session.selectors';
import { BREAK_TASK_ID, TimeSession } from '../time-session/time-session.model';

describe('AllTasksMetricsService', () => {
  let service: AllTasksMetricsService;
  let taskService: jasmine.SpyObj<TaskService>;
  let activeWorkContext$: BehaviorSubject<WorkContext | null>;
  let worklog$: BehaviorSubject<Worklog>;
  let totalTimeSpent$: BehaviorSubject<number>;
  let store: MockStore;

  const createMockWorkContext = (
    id: string,
    type: WorkContextType,
    title: string = 'Test Context',
  ): WorkContext => ({
    id,
    type,
    title,
    icon: null,
    theme: {} as any,
    advancedCfg: { worklogExportSettings: {} as any },
    routerLink: `/${type.toLowerCase()}/${id}`,
    isEnableBacklog: false,
    taskIds: [],
    backlogTaskIds: [],
    noteIds: [],
  });

  const createWorklog = (timeSpent: number): Worklog => {
    return {
      2025: {
        timeSpent,
        daysWorked: 1,
        monthWorked: 1,
        ent: {
          1: {
            timeSpent,
            daysWorked: 1,
            weeks: [],
            ent: {
              15: {
                timeSpent,
                logEntries: [],
                dateStr: '2025-01-15',
                dayStr: '2025-01-15',
                workStart: Date.now(),
                workEnd: Date.now(),
              },
            },
          },
        },
      },
    };
  };

  const createBreakSession = (
    date: string,
    duration: number,
    id: string = 'break-' + Math.random(),
  ): TimeSession => ({
    id,
    tid: BREAK_TASK_ID,
    d: date,
    t: duration,
  });

  beforeEach(() => {
    activeWorkContext$ = new BehaviorSubject<WorkContext | null>(null);
    worklog$ = new BehaviorSubject<Worklog>(createWorklog(10000));
    totalTimeSpent$ = new BehaviorSubject<number>(10000);

    const taskServiceSpy = jasmine.createSpyObj('TaskService', ['getAllTasksEverywhere']);
    const worklogServiceSpy = jasmine.createSpyObj('WorklogService', [], {
      worklog$: worklog$.asObservable(),
      totalTimeSpent$: totalTimeSpent$.asObservable(),
    });
    const workContextServiceSpy = jasmine.createSpyObj('WorkContextService', [], {
      activeWorkContext$: activeWorkContext$.asObservable(),
    });

    // Default return values
    taskServiceSpy.getAllTasksEverywhere.and.returnValue(
      Promise.resolve([createTask({ id: '1' })]),
    );

    TestBed.configureTestingModule({
      providers: [
        AllTasksMetricsService,
        provideMockStore({
          selectors: [{ selector: selectAllSessions, value: [] }],
        }),
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: WorklogService, useValue: worklogServiceSpy },
        { provide: WorkContextService, useValue: workContextServiceSpy },
      ],
    });

    service = TestBed.inject(AllTasksMetricsService);
    taskService = TestBed.inject(TaskService) as jasmine.SpyObj<TaskService>;
    store = TestBed.inject(MockStore);
  });

  describe('Signal creation', () => {
    it('should create simpleMetrics signal', () => {
      expect(service.simpleMetrics).toBeDefined();
    });

    it('should return undefined initially (before context is TODAY_TAG)', () => {
      expect(service.simpleMetrics()).toBeUndefined();
    });

    it('should compute metrics when context switches to TODAY_TAG', fakeAsync(() => {
      // Set context to TODAY_TAG
      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics).toBeDefined();
    }));

    it('should not compute metrics for regular project context', fakeAsync(() => {
      // Set context to regular project
      activeWorkContext$.next(
        createMockWorkContext('project-1', WorkContextType.PROJECT, 'Project 1'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics).toBeUndefined();
    }));

    it('should not compute metrics for regular tag context', fakeAsync(() => {
      // Set context to regular tag
      activeWorkContext$.next(
        createMockWorkContext('tag-1', WorkContextType.TAG, 'Tag 1'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics).toBeUndefined();
    }));
  });

  describe('Break aggregation from sessions', () => {
    it('should aggregate break counts from sessions', fakeAsync(() => {
      store.overrideSelector(selectAllSessions, [
        createBreakSession('2025-01-15', 300000, 'b1'),
        createBreakSession('2025-01-15', 300000, 'b2'),
        createBreakSession('2025-01-16', 600000, 'b3'),
      ]);
      store.refreshState();

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics).toBeDefined();
      // 2025-01-15: 2 breaks, 2025-01-16: 1 break => total 3
      expect(metrics?.breakNr).toBe(3);
    }));

    it('should aggregate break times from sessions', fakeAsync(() => {
      store.overrideSelector(selectAllSessions, [
        createBreakSession('2025-01-15', 600000, 'b1'),
        createBreakSession('2025-01-15', 300000, 'b2'),
      ]);
      store.refreshState();

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.breakTime).toBe(900000); // 600000 + 300000
    }));

    it('should ignore non-break sessions', fakeAsync(() => {
      store.overrideSelector(selectAllSessions, [
        createBreakSession('2025-01-15', 600000, 'b1'),
        { id: 'task-session', tid: 'task-1', d: '2025-01-15', t: 1200000 },
      ]);
      store.refreshState();

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.breakNr).toBe(1);
      expect(metrics?.breakTime).toBe(600000);
    }));

    it('should handle empty sessions', fakeAsync(() => {
      store.overrideSelector(selectAllSessions, []);
      store.refreshState();

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.breakNr).toBe(0);
      expect(metrics?.breakTime).toBe(0);
    }));

    it('should aggregate breaks across multiple dates', fakeAsync(() => {
      store.overrideSelector(selectAllSessions, [
        createBreakSession('2025-01-15', 300000, 'b1'),
        createBreakSession('2025-01-15', 300000, 'b2'),
        createBreakSession('2025-01-16', 600000, 'b3'),
        createBreakSession('2025-01-17', 150000, 'b4'),
      ]);
      store.refreshState();

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.breakNr).toBe(4);
      expect(metrics?.breakTime).toBe(1350000); // 300000+300000+600000+150000
    }));
  });

  describe('Task aggregation', () => {
    it('should use getAllTasksEverywhere for task data', fakeAsync(() => {
      const allTasks = [
        createTask({ id: '1', projectId: 'project-1' }),
        createTask({ id: '2', projectId: 'project-2' }),
        createTask({ id: '3', tagIds: ['tag-1'] }),
      ];

      taskService.getAllTasksEverywhere.and.returnValue(Promise.resolve(allTasks));
      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      expect(taskService.getAllTasksEverywhere).toHaveBeenCalled();
      const metrics = service.simpleMetrics();
      expect(metrics?.nrOfAllTasks).toBe(3);
    }));

    it('should handle empty task list', fakeAsync(() => {
      taskService.getAllTasksEverywhere.and.returnValue(Promise.resolve([]));
      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.nrOfAllTasks).toBe(0);
      expect(metrics?.nrOfCompletedTasks).toBe(0);
    }));
  });

  describe('Worklog integration', () => {
    it('should use worklog data from WorklogService', fakeAsync(() => {
      const testWorklog = createWorklog(50000);
      worklog$.next(testWorklog);
      totalTimeSpent$.next(50000);

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.timeSpent).toBe(50000);
    }));

    it('should handle zero time spent', fakeAsync(() => {
      const testWorklog = createWorklog(0);
      worklog$.next(testWorklog);
      totalTimeSpent$.next(0);

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      const metrics = service.simpleMetrics();
      expect(metrics?.timeSpent).toBe(0);
    }));
  });

  describe('Context switching behavior', () => {
    it('should recompute metrics when switching back to TODAY_TAG', fakeAsync(() => {
      // Start with TODAY_TAG
      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      let metrics = service.simpleMetrics();
      expect(metrics).toBeDefined();
      const initialTimeSpent = metrics?.timeSpent;

      // Switch to a project (signal retains last value, doesn't become undefined)
      activeWorkContext$.next(
        createMockWorkContext('project-1', WorkContextType.PROJECT, 'Project 1'),
      );

      tick(200);
      flush();

      metrics = service.simpleMetrics();
      // Signal retains last emitted value when observable stops emitting
      expect(metrics?.timeSpent).toBe(initialTimeSpent);

      // Switch back to TODAY_TAG with updated worklog (metrics should recompute)
      const updatedWorklog = createWorklog(99999);
      worklog$.next(updatedWorklog);
      totalTimeSpent$.next(99999);

      activeWorkContext$.next(
        createMockWorkContext(TODAY_TAG.id, WorkContextType.TAG, 'Today'),
      );

      tick(200);
      flush();

      metrics = service.simpleMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.timeSpent).toBe(99999);
    }));
  });
});
