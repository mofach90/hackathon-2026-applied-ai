import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_WEBHOOK_SECRET: "whsec_mock",
    STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS: 800,
    ANTHROPIC_API_KEY: "sk-ant-mock",
    RESEND_API_KEY: "re_mock",
    CRON_SECRET: "cron_mock",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

const {
  mockTransferCreate,
  mockDbSelect,
  mockDbInsert,
  mockWhere,
  mockInnerJoin,
  mockFrom,
  mockInsertValues,
} = vi.hoisted(() => {
  const mockTransferCreate = vi.fn();
  const mockDbSelect = vi.fn();
  const mockDbInsert = vi.fn();
  const mockWhere = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockFrom = vi.fn();
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);

  mockWhere.mockResolvedValue([]);
  mockInnerJoin.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
  mockFrom.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
  mockDbSelect.mockReturnValue({ from: mockFrom });
  mockDbInsert.mockReturnValue({ values: mockInsertValues });

  return {
    mockTransferCreate,
    mockDbSelect,
    mockDbInsert,
    mockWhere,
    mockInnerJoin,
    mockFrom,
    mockInsertValues,
  };
});

vi.mock("@/stripe/client", () => ({
  stripe: {
    transfers: {
      create: mockTransferCreate,
    },
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

import { disburseLandlord } from "../landlord-disburse";

const period = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-01-08T00:00:00Z"),
};

describe("disburseLandlord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransferCreate.mockResolvedValue({ id: "tr_mock" });
    mockWhere.mockResolvedValue([]);
    mockInnerJoin.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhere });
    mockDbSelect.mockReturnValue({ from: mockFrom });
    mockDbInsert.mockReturnValue({ values: mockInsertValues });
  });

  it("does nothing when there are no obligations", async () => {
    mockWhere.mockResolvedValue([]);
    await disburseLandlord(period);
    expect(mockTransferCreate).not.toHaveBeenCalled();
  });

  it("deducts platform fee (8%) before transfer", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "ro_1",
        amount_eur_cents: 10000,
        landlord_id: "ll_1",
        stripe_account_id: "acct_ll1",
      },
    ]);

    await disburseLandlord(period);

    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9200, currency: "eur", destination: "acct_ll1" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("ll_1") }),
    );
  });

  it("groups multiple obligations by landlord and sums them", async () => {
    mockWhere.mockResolvedValue([
      { id: "ro_1", amount_eur_cents: 5000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
      { id: "ro_2", amount_eur_cents: 3000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
    ]);

    await disburseLandlord(period);

    expect(mockTransferCreate).toHaveBeenCalledTimes(1);
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7360 }),
      expect.any(Object),
    );
  });

  it("creates one transfer per landlord", async () => {
    mockWhere.mockResolvedValue([
      { id: "ro_1", amount_eur_cents: 5000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
      { id: "ro_2", amount_eur_cents: 3000, landlord_id: "ll_2", stripe_account_id: "acct_ll2" },
    ]);

    await disburseLandlord(period);

    expect(mockTransferCreate).toHaveBeenCalledTimes(2);
  });
});
