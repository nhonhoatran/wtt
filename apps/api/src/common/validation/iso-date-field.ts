import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date "YYYY-MM-DD" that round-trips through Date (rejects 2026-02-31). */
export const isoDateField = z
  .string()
  .regex(ISO_DATE, 'Ngày dạng YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Ngày không hợp lệ');

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const todayIso = (now: Date = new Date()): string => toIsoDate(now);

/** @db.Date columns are read and written as UTC midnight. */
export const dateFromIso = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
