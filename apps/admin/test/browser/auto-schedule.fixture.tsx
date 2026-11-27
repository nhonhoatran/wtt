import '@ant-design/v5-patch-for-react-19';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { createRoot } from 'react-dom/client';
import { AutoScheduleButton } from '../../src/pages/event-hub/auto-schedule-button';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App><AutoScheduleButton eventId="fixture-event" sessionId="session-am" /></App>
  </QueryClientProvider>,
);
