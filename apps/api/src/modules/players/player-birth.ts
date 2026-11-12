import { fieldError } from '../../common/validation/parse-body.js';
import { parseDateOnly } from '../events/date-only.js';

interface BirthInput {
  birthDate?: string | null;
  birthYear?: number | null;
}

interface BirthCurrent {
  birthDate: Date | null;
}

const MISMATCH = 'Năm sinh không khớp với ngày sinh';

/** birthDate wins: when it is set, birthYear is its year and a conflicting birthYear is refused. */
export function resolveBirth(current: BirthCurrent | null, input: BirthInput): { birthDate?: Date | null; birthYear?: number | null } {
  if (typeof input.birthDate === 'string') {
    const year = Number(input.birthDate.slice(0, 4));
    if (input.birthYear != null && input.birthYear !== year) throw fieldError('birthYear', MISMATCH);
    return { birthDate: parseDateOnly(input.birthDate), birthYear: year };
  }
  if (input.birthDate === null) {
    return { birthDate: null, ...(input.birthYear !== undefined && { birthYear: input.birthYear }) };
  }
  if (input.birthYear === undefined) return {};
  const keptYear = current?.birthDate?.getUTCFullYear();
  if (keptYear === undefined) return { birthYear: input.birthYear };
  if (input.birthYear !== null && input.birthYear !== keptYear) throw fieldError('birthYear', MISMATCH);
  return {};
}
