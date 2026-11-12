import { App, Button, Flex, Form, theme } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { EventFormSections } from '../../resources/events/event-form-sections';
import { toEventFormValues, toEventPayload, type EventFormValues } from '../../resources/events/event-form-values';
import { EVENT_FORM_MAX_WIDTH } from '../../resources/events/event-labels';
import { EventIntroSection } from '../../resources/events/event-intro-section';
import type { HubTabContext } from './hub-tab-context';

export function EventInfoTab({ event, canUpdate, onChanged }: HubTabContext) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm<EventFormValues>();
  const [saving, setSaving] = useState(false);

  const save = async (values: EventFormValues) => {
    setSaving(true);
    try {
      await apiFetch(`/admin/events/${event.id}`, { method: 'PATCH', body: toEventPayload(values) });
      await onChanged();
      message.success('Đã lưu thông tin giải');
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        form.setFields(Object.entries(error.errors).map(([name, text]) => ({ name: name as keyof EventFormValues, errors: [text] })));
      } else {
        message.error(error instanceof Error ? error.message : 'Không lưu được');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      key={event.updatedAt}
      form={form}
      layout="vertical"
      disabled={!canUpdate}
      initialValues={toEventFormValues(event)}
      onFinish={save}
      style={{ maxWidth: EVENT_FORM_MAX_WIDTH }}
    >
      <Flex vertical gap={token.margin}>
        <EventFormSections form={form} event={event} />
        <EventIntroSection />
        {canUpdate && (
          <div>
            <Button type="primary" htmlType="submit" loading={saving}>
              Lưu thay đổi
            </Button>
          </div>
        )}
      </Flex>
    </Form>
  );
}
