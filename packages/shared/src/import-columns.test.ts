import { describe, expect, it } from 'vitest';
import { ENTRY_IMPORT_COLUMNS, QUOTA_EXPORT_LABELS, QUOTA_IMPORT_VALUES } from './import-columns.js';
import { normalizePersonName } from './normalize-person-name.js';

describe('quota labels', () => {
  const parseQuota = (text: string) => QUOTA_IMPORT_VALUES[normalizePersonName(text)];

  it('every exported label parses back to the same quota type', () => {
    for (const [quota, label] of Object.entries(QUOTA_EXPORT_LABELS)) {
      expect(parseQuota(label), label).toBe(quota);
    }
  });

  it('template quota header lists every exported label', () => {
    const header = ENTRY_IMPORT_COLUMNS.find((column) => column.key === 'quotaType')?.header ?? '';
    for (const label of Object.values(QUOTA_EXPORT_LABELS)) expect(header).toContain(label);
  });

  it('still accepts the legacy "Vòng loại" spelling for the qualifier quota', () => {
    expect(parseQuota('Vòng loại')).toBe('QUALIFIER');
  });
});
