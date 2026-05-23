import "server-only";
import { formatInTimeZone } from "date-fns-tz";
const BERLIN = "Europe/Berlin";
const CONTACT_START = 8;
const CONTACT_END = 20;

export function nowInBerlin(): Date {
  return new Date();
}

export function isContactHours(date: Date): boolean {
  const hour = parseInt(formatInTimeZone(date, BERLIN, "H"), 10);
  return hour >= CONTACT_START && hour < CONTACT_END;
}

export function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(Math.round((utcB - utcA) / 86_400_000));
}

export function formatBerlin(date: Date, fmt: string): string {
  return formatInTimeZone(date, BERLIN, fmt);
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
