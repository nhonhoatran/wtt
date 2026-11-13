import { bracketSize, splitEvenly } from './bracket-size.js';
import { MIN_GROUP_SIZE } from './group-allocation.js';
import { DrawParamsError } from './types.js';

export interface DrawPreviewParams {
  kind: 'MAIN' | 'QUALIFYING' | 'GROUP';
  /** Confirmed entries going into this draw. */
  entryCount: number;
  /** MAIN: explicit seed count; otherwise round(seedRatio x size). */
  seedCount?: number;
  /** AppSetting draw.defaultSeedPercent / 100. */
  seedRatio?: number;
  /** MAIN: slots reserved for qualifiers. QUALIFYING: number of sections. */
  qualifierCount?: number;
  /** GROUP: explicit group count, else derived from groupSize. */
  groupCount?: number;
  /** GROUP: AppSetting draw.defaultGroupSize. */
  groupSize?: number;
  /** GROUP: 1 or 2. */
  advancePerGroup?: number;
}

export interface DrawPreview {
  /** MAIN: bracket size; GROUP: size of the knockout that follows; QUALIFYING: null (see sectionSizes). */
  size: number | null;
  byeCount: number;
  seedCount: number;
  qualifierSlots: number;
  groupCount: number;
  /** QUALIFYING: bracket size of each section. */
  sectionSizes: number[];
}

const EMPTY: DrawPreview = { size: null, byeCount: 0, seedCount: 0, qualifierSlots: 0, groupCount: 0, sectionSizes: [] };

export function previewDraw(params: DrawPreviewParams): DrawPreview {
  const { kind, entryCount } = params;
  if (!Number.isInteger(entryCount) || entryCount < 0) throw new DrawParamsError('INVALID_PARAMS', `Invalid entry count: ${entryCount}`);

  if (kind === 'MAIN') {
    const qualifierSlots = params.qualifierCount ?? 0;
    const size = bracketSize(entryCount + qualifierSlots);
    const wanted = params.seedCount ?? Math.round((params.seedRatio ?? 0) * size);
    const seedCount = Math.max(0, Math.min(wanted, Math.max(1, size / 2), entryCount));
    return { ...EMPTY, size, byeCount: size - entryCount - qualifierSlots, seedCount, qualifierSlots };
  }

  if (kind === 'QUALIFYING') {
    const sections = params.qualifierCount ?? 0;
    if (sections < 1) throw new DrawParamsError('INVALID_PARAMS', 'Qualifying needs at least one section');
    const sectionSizes = splitEvenly(entryCount, sections).map(bracketSize);
    const byeCount = sectionSizes.reduce((sum, size) => sum + size, 0) - entryCount;
    return { ...EMPTY, byeCount, seedCount: Math.min(sections, entryCount), qualifierSlots: sections, sectionSizes };
  }

  const advance = params.advancePerGroup ?? 2;
  if (advance !== 1 && advance !== 2) throw new DrawParamsError('INVALID_PARAMS', `advancePerGroup must be 1 or 2, got ${advance}`);
  const groupCount = params.groupCount ?? Math.ceil(entryCount / Math.max(MIN_GROUP_SIZE, params.groupSize ?? MIN_GROUP_SIZE));
  if (groupCount < 1) throw new DrawParamsError('INVALID_PARAMS', 'Group count must be at least 1');
  if (Math.floor(entryCount / groupCount) < MIN_GROUP_SIZE) {
    throw new DrawParamsError('NOT_ENOUGH_ENTRIES', `${entryCount} entries make groups smaller than ${MIN_GROUP_SIZE}`);
  }
  const qualifiers = groupCount * advance;
  const size = bracketSize(qualifiers);
  return { ...EMPTY, size, byeCount: size - qualifiers, seedCount: groupCount, groupCount };
}
