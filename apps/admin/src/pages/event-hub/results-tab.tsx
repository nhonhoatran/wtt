import { ResultsWorkspace } from '../results/results-workspace';
import type { HubTabContext } from './hub-tab-context';

/** The results list with the event fixed by the hub, so there is no event picker. */
export function ResultsTab({ event }: HubTabContext) {
  return <ResultsWorkspace event={event} />;
}
