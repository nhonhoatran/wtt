import { Create, useForm } from '@refinedev/antd';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Form, Result, Skeleton } from 'antd';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { toEventPayload, type EventFormValues } from './event-form-values';
import { EventFormSections } from './event-form-sections';
import { EVENT_FORM_MAX_WIDTH, type EventRecord } from './event-labels';

interface EventDefaults {
  timezone: string;
  defaultDurationDays: number;
  lastEventTypeId: string | null;
}

export function EventCreate() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const defaults = useQuery({
    queryKey: ['event-defaults'],
    queryFn: async () => (await apiFetch<{ data: EventDefaults }>('/admin/events/defaults')).data,
    gcTime: 0,
  });
  const { formProps, form, saveButtonProps } = useForm<EventRecord, never, EventFormValues>({
    resource: 'events',
    action: 'create',
    redirect: false,
    onMutationSuccess: (result) => {
      showWarnings(message, warningsOf(result));
      navigate(`/events/${result.data.id}/sub-events`);
    },
  });

  if (defaults.isLoading) return <Skeleton active />;
  if (defaults.isError || !defaults.data) {
    return <Result status="error" title="Không tải được dữ liệu mặc định" extra={<Button onClick={() => defaults.refetch()}>Thử lại</Button>} />;
  }

  return (
    <Create title="Tạo giải" saveButtonProps={{ ...saveButtonProps, children: 'Lưu nháp' }}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{
          timezone: defaults.data.timezone,
          eventTypeId: defaults.data.lastEventTypeId ?? undefined,
          isFeatured: false,
          showTicket: false,
        }}
        onFinish={(values) => formProps.onFinish?.(toEventPayload(values) as unknown as EventFormValues)}
        style={{ maxWidth: EVENT_FORM_MAX_WIDTH }}
      >
        <EventFormSections form={form} defaultDurationDays={defaults.data.defaultDurationDays} />
      </Form>
    </Create>
  );
}
