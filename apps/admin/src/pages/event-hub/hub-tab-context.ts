import type { EventRecord } from '../../resources/events/event-labels';

export interface HubTabContext {
  event: EventRecord;
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onChanged: () => Promise<unknown>;
}
