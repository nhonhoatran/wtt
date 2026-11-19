import { serializeStructuredData } from '../../lib/structured-data';

export function StructuredData({ value }: { value: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(value) }} />;
}
