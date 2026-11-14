import { redirectToFirstSubEvent } from '../../../../../lib/event-page';

export default async function EventTabIndex({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  return redirectToFirstSubEvent(params, 'groups');
}
