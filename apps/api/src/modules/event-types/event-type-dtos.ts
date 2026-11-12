import { z } from 'zod';
import { codeField, mediaIdField, nameField, optionalColorHexField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

export const createEventTypeBody = z.object({
  tierId: z.string().uuid('Chọn cấp giải'),
  code: codeField,
  name: nameField,
  nameEn: optionalText(120),
  colorHex: optionalColorHexField,
  logoMediaId: mediaIdField,
  backgroundMediaId: mediaIdField,
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateEventTypeBody = createEventTypeBody.partial();
