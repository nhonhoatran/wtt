import { describe, expect, it } from 'vitest';
import { serializeStructuredData } from '../../src/lib/structured-data';

describe('serializeStructuredData', () => {
  it('escapes script delimiters and Unicode line separators while preserving valid JSON', () => {
    const value = { headline: '</script><script>alert(1)</script>', separator: '\u2028' };
    const serialized = serializeStructuredData(value);

    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
