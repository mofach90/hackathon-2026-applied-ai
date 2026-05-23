import { describe, it, expect } from "vitest";
import { eurToCents, centsToEur, formatEur, applyFeePct } from "../money";

describe("eurToCents", () => {
  it("converts euros to cents with rounding", () => {
    expect(eurToCents(1199.995)).toBe(120000);
  });
  it("handles whole numbers", () => {
    expect(eurToCents(1200)).toBe(120000);
  });
  it("handles sub-euro amounts", () => {
    expect(eurToCents(0.99)).toBe(99);
  });
  it("throws on negative input", () => {
    expect(() => eurToCents(-1)).toThrow();
  });
  it("allows zero", () => {
    expect(eurToCents(0)).toBe(0);
  });
});

describe("centsToEur", () => {
  it("converts cents to euros", () => {
    expect(centsToEur(120000)).toBe(1200);
  });
});

describe("formatEur", () => {
  it("formats cents as EUR string", () => {
    expect(formatEur(120000)).toContain("1.200");
  });
});

describe("applyFeePct", () => {
  it("applies 800 bps (8%) correctly", () => {
    expect(applyFeePct(120000, 800)).toEqual({ fee: 9600, net: 110400 });
  });
  it("applies 0 bps correctly", () => {
    expect(applyFeePct(100, 0)).toEqual({ fee: 0, net: 100 });
  });
  it("applies 10000 bps (100%) correctly", () => {
    expect(applyFeePct(100, 10000)).toEqual({ fee: 100, net: 0 });
  });
});
