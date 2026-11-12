import { z } from 'zod';

/** One request runs in a single transaction; 50 rows keeps it short and the modal list usable. */
export const MAX_BULK_ITEMS = 50;
const MAX_NAME = 200;
/** Sanity bound against typos (an extra zero), not a business rule. */
const MAX_ENTRIES = 10_000;

const SUB_EVENT_FORMATS = ['KNOCKOUT', 'GROUP_KNOCKOUT'] as const;

const uuid = (message: string) => z.string().uuid(message);
const optionalName = z
  .string()
  .trim()
  .max(MAX_NAME, `Tối đa ${MAX_NAME} ký tự`)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const format = z.enum(SUB_EVENT_FORMATS, { message: 'Chọn thể thức thi đấu' });
const maxEntries = z.number().int('Phải là số nguyên').min(1, 'Tối thiểu 1').max(MAX_ENTRIES).nullable();

const formatDefaults = {
  matchFormatId: uuid('Thể thức trận không hợp lệ').nullable().optional(),
  groupScoringRuleId: uuid('Luật tính điểm bảng không hợp lệ').nullable().optional(),
  hasQualifying: z.boolean().optional(),
  maxEntries: maxEntries.optional(),
};

export const createSubEventBody = z.object({
  disciplineId: uuid('Chọn nội dung thi đấu'),
  categoryId: uuid('Hạng mục không hợp lệ').nullable().optional(),
  name: optionalName,
  nameEn: optionalName,
  format,
  ...formatDefaults,
  order: z.number().int().min(0).optional(),
});
export type CreateSubEventBody = z.infer<typeof createSubEventBody>;

export const updateSubEventBody = z
  .object({ name: optionalName, nameEn: optionalName, format, ...formatDefaults, order: z.number().int().min(0) })
  .partial();
export type UpdateSubEventBody = z.infer<typeof updateSubEventBody>;

export const bulkSubEventsBody = z.object({
  items: z
    .array(
      z.object({
        disciplineId: uuid('Chọn nội dung thi đấu'),
        categoryId: uuid('Hạng mục không hợp lệ').nullable().optional(),
      }),
    )
    .min(1, 'Chọn ít nhất một nội dung')
    .max(MAX_BULK_ITEMS, `Tối đa ${MAX_BULK_ITEMS} nội dung mỗi lần`),
  defaults: z.object({ format, ...formatDefaults }),
});
export type BulkSubEventsBody = z.infer<typeof bulkSubEventsBody>;
