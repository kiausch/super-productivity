/* eslint-disable @typescript-eslint/naming-convention */
import { createActionGroup, props } from '@ngrx/store';
import { TimeSession } from '../time-session.model';

export const TimeSessionActions = createActionGroup({
  source: 'TimeSession',
  events: {
    'Add time session': props<{
      timeSession: TimeSession;
    }>(),
    'Update Time Session': props<{
      sessionId: string;
      updates: Partial<TimeSession>;
    }>(),
    'Delete Time Session': props<{
      sessionId: string;
    }>(),
  },
});
