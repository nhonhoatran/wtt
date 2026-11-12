import { z } from 'zod';
import { codeField, colorHexField, mediaIdField, nameField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

export const createTierBody = z.object({
  code: codeField,
  name: nameField,
  nameEn: optionalText(120),
  colorHex: colorHexField,
  logoMediaId: mediaIdField,
  backgroundMediaId: mediaIdField,
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateTierBody = createTierBody.partial();
