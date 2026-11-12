import { describe, expect, it } from 'vitest';
import { checkEntryEligibility, type EligibilityPlayer, type EligibilitySubEvent } from './entry-eligibility.js';

const male = (id: string, extra: Partial<EligibilityPlayer> = {}): EligibilityPlayer => ({ id, fullName: `Nam ${id}`, gender: 'MALE', birthYear: 2000, ...extra });
const female = (id: string, extra: Partial<EligibilityPlayer> = {}): EligibilityPlayer => ({ id, fullName: `Nữ ${id}`, gender: 'FEMALE', birthYear: 2000, ...extra });

const singles = (genderRule: EligibilitySubEvent['genderRule'], category: EligibilitySubEvent['category'] = null): EligibilitySubEvent => ({
  competitorKind: 'SINGLES',
  genderRule,
  category,
  eventStartDate: '2026-06-15',
});
const doubles = (genderRule: EligibilitySubEvent['genderRule']): EligibilitySubEvent => ({ ...singles(genderRule), competitorKind: 'DOUBLES' });
const u15 = { name: 'U15', minAge: null, maxAge: 15 };

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

describe('checkEntryEligibility gender', () => {
  it('accepts matching gender and OPEN', () => {
    expect(checkEntryEligibility([male('a')], singles('MEN'), 'BIRTH_YEAR')).toEqual([]);
    expect(checkEntryEligibility([female('a')], singles('WOMEN'), 'BIRTH_YEAR')).toEqual([]);
    expect(checkEntryEligibility([female('a')], singles('OPEN'), 'BIRTH_YEAR')).toEqual([]);
  });

  it('flags the wrong gender as overridable', () => {
    const issues = checkEntryEligibility([female('a')], singles('MEN'), 'BIRTH_YEAR');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'GENDER', playerId: 'a', overridable: true });
  });

  it('flags each wrong-gender player of a same-gender pair', () => {
    expect(codes(checkEntryEligibility([male('a'), female('b')], doubles('MEN'), 'BIRTH_YEAR'))).toEqual(['GENDER']);
    expect(codes(checkEntryEligibility([male('a'), male('b')], doubles('WOMEN'), 'BIRTH_YEAR'))).toEqual(['GENDER', 'GENDER']);
  });

  it('MIXED needs one man and one woman', () => {
    expect(checkEntryEligibility([male('a'), female('b')], doubles('MIXED'), 'BIRTH_YEAR')).toEqual([]);
    expect(codes(checkEntryEligibility([male('a'), male('b')], doubles('MIXED'), 'BIRTH_YEAR'))).toEqual(['MIXED_PAIR']);
    expect(codes(checkEntryEligibility([female('a'), female('b')], doubles('MIXED'), 'BIRTH_YEAR'))).toEqual(['MIXED_PAIR']);
  });
});

describe('checkEntryEligibility structure', () => {
  it('requires the right number of players, not overridable', () => {
    const tooMany = checkEntryEligibility([male('a'), male('b')], singles('OPEN'), 'BIRTH_YEAR');
    const tooFew = checkEntryEligibility([male('a')], doubles('OPEN'), 'BIRTH_YEAR');
    expect(tooMany).toEqual([expect.objectContaining({ code: 'PLAYER_COUNT', overridable: false })]);
    expect(tooFew).toEqual([expect.objectContaining({ code: 'PLAYER_COUNT', overridable: false })]);
  });

  it('refuses the same player twice in a pair', () => {
    const issues = checkEntryEligibility([male('a'), male('a')], doubles('OPEN'), 'BIRTH_YEAR');
    expect(issues).toEqual([expect.objectContaining({ code: 'SAME_PLAYER', overridable: false })]);
  });
});

describe('checkEntryEligibility age', () => {
  it('BIRTH_YEAR: event year minus birth year', () => {
    expect(checkEntryEligibility([male('a', { birthYear: 2011 })], singles('MEN', u15), 'BIRTH_YEAR')).toEqual([]);
    const over = checkEntryEligibility([male('a', { birthYear: 2010 })], singles('MEN', u15), 'BIRTH_YEAR');
    expect(over).toEqual([expect.objectContaining({ code: 'AGE_ABOVE', playerId: 'a', overridable: true })]);
    expect(over[0]!.message).toContain('2010');
    expect(over[0]!.message).toContain('U15');
  });

  it('EVENT_START_DATE: a birthday not yet reached keeps the player eligible', () => {
    const player = male('a', { birthDate: '2010-12-01', birthYear: 2010 });
    expect(checkEntryEligibility([player], singles('MEN', u15), 'EVENT_START_DATE')).toEqual([]);
    expect(codes(checkEntryEligibility([player], singles('MEN', u15), 'BIRTH_YEAR'))).toEqual(['AGE_ABOVE']);
  });

  it('EVENT_START_DATE: birthday passed makes the player too old', () => {
    const player = male('a', { birthDate: '2010-01-01' });
    expect(codes(checkEntryEligibility([player], singles('MEN', u15), 'EVENT_START_DATE'))).toEqual(['AGE_ABOVE']);
  });

  it('works with only a birth year under EVENT_START_DATE', () => {
    const issues = checkEntryEligibility([male('a', { birthYear: 2009 })], singles('MEN', u15), 'EVENT_START_DATE');
    expect(codes(issues)).toEqual(['AGE_ABOVE']);
    expect(issues[0]!.message).toContain('tính theo năm sinh vì chưa có ngày sinh');
    expect(issues[0]!.message).not.toContain('ngày khai mạc');
  });

  it('names the opening date when the exact birth date is known', () => {
    const issues = checkEntryEligibility([male('a', { birthDate: '2010-01-01' })], singles('MEN', u15), 'EVENT_START_DATE');
    expect(issues[0]!.message).toContain('tính theo ngày khai mạc');
  });

  it('flags a player below the minimum age', () => {
    const over40 = { name: 'O40', minAge: 40, maxAge: null };
    expect(codes(checkEntryEligibility([male('a', { birthYear: 2000 })], singles('OPEN', over40), 'BIRTH_YEAR'))).toEqual(['AGE_BELOW']);
    expect(checkEntryEligibility([male('a', { birthYear: 1980 })], singles('OPEN', over40), 'BIRTH_YEAR')).toEqual([]);
  });

  it('unknown age against a limited category is an overridable issue', () => {
    const issues = checkEntryEligibility([male('a', { birthYear: null })], singles('MEN', u15), 'BIRTH_YEAR');
    expect(issues).toEqual([expect.objectContaining({ code: 'AGE_UNKNOWN', overridable: true })]);
  });

  it('skips the age check when the category has no limits or is absent', () => {
    const unlimited = { name: 'Open', minAge: null, maxAge: null };
    expect(checkEntryEligibility([male('a', { birthYear: null })], singles('MEN', unlimited), 'BIRTH_YEAR')).toEqual([]);
    expect(checkEntryEligibility([male('a', { birthYear: null })], singles('MEN'), 'BIRTH_YEAR')).toEqual([]);
  });

  it('checks both members of a pair', () => {
    const issues = checkEntryEligibility([male('a', { birthYear: 2010 }), male('b', { birthYear: 2011 })], { ...doubles('MEN'), category: u15 }, 'BIRTH_YEAR');
    expect(issues.map((issue) => issue.playerId)).toEqual(['a']);
  });
});
