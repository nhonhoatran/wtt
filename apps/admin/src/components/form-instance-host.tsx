import { Form, type FormInstance } from 'antd';

/**
 * Attaches a form instance that has no visible <Form> right now, so antd does not warn that it is unconnected.
 * Refine's useTable creates a search form our filter bars do not use, and Refine's useForm resets its form on
 * mount while an edit page still shows its loading skeleton. Renders no DOM.
 */
export function FormInstanceHost({ form }: { form?: FormInstance }) {
  return form ? <Form form={form} component={false} /> : null;
}
