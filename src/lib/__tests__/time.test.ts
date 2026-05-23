import { describe, it, expect } from "vitest";
import { isContactHours, daysBetween } from "../time";

describe("isContactHours", () => {
  it("returns false at 19:00 UTC (21:00 Berlin CEST)", () => {
    expect(isContactHours(new Date("2026-06-06T19:00:00Z"))).toBe(false);
  });
  it("returns true at 08:00 UTC (10:00 Berlin CEST)", () => {
    expect(isContactHours(new Date("2026-06-06T08:00:00Z"))).toBe(true);
  });
  it("returns false before 08:00 Berlin", () => {
    // 05:00 UTC = 07:00 Berlin CEST
    expect(isContactHours(new Date("2026-06-06T05:00:00Z"))).toBe(false);
  });
  it("returns true at exactly 08:00 Berlin", () => {
    // 06:00 UTC = 08:00 Berlin CEST
    expect(isContactHours(new Date("2026-06-06T06:00:00Z"))).toBe(true);
  });
});

describe("daysBetween", () => {
  it("counts calendar days, not 24h windows", () => {
    const a = new Date("2026-06-06T23:00:00Z");
    const b = new Date("2026-06-07T01:00:00Z");
    expect(daysBetween(a, b)).toBe(1);
  });
  it("returns 0 for same day", () => {
    const a = new Date("2026-06-06T00:00:00Z");
    const b = new Date("2026-06-06T23:59:00Z");
    expect(daysBetween(a, b)).toBe(0);
  });
  it("is symmetric", () => {
    const a = new Date("2026-06-01");
    const b = new Date("2026-06-10");
    expect(daysBetween(a, b)).toBe(daysBetween(b, a));
  });
});
