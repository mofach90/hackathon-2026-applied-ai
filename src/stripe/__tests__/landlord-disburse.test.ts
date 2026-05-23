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

const mocks = vi.hoisted(() => ({
  transferCreate: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
}));

vi.mock("@/stripe/client", () => ({
  stripe: {
    transfers: { create: mocks.transferCreate },
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
  },
}));

import { disburseLandlord } from "../landlord-disburse";

const period = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-01-08T00:00:00Z"),
};

function setupSelectChain(rows: unknown[]) {
  const mockWhere = vi.fn().mockResolvedValue(rows);
  const chain = { innerJoin: vi.fn(), where: mockWhere };
  chain.innerJoin.mockReturnValue(chain);
  const mockFrom = vi.fn().mockReturnValue(chain);
  mocks.dbSelect.mockReturnValue({ from: mockFrom });
}

describe("disburseLandlord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transferCreate.mockResolvedValue({ id: "tr_mock" });
    mocks.dbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    setupSelectChain([]);
  });

  it("does nothing when there are no obligations", async () => {
    setupSelectChain([]);
    await disburseLandlord(period);
    expect(mocks.transferCreate).not.toHaveBeenCalled();
  });

  it("deducts platform fee (8%) before transfer", async () => {
    setupSelectChain([
      { id: "ro_1", amount_eur_cents: 10000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
    ]);

    await disburseLandlord(period);

    expect(mocks.transferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9200, currency: "eur", destination: "acct_ll1" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining("ll_1") }),
    );
  });

  it("groups multiple obligations by landlord and sums them", async () => {
    setupSelectChain([
      { id: "ro_1", amount_eur_cents: 5000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
      { id: "ro_2", amount_eur_cents: 3000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
    ]);

    await disburseLandlord(period);

    expect(mocks.transferCreate).toHaveBeenCalledTimes(1);
    expect(mocks.transferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7360 }),
      expect.any(Object),
    );
  });

  it("creates one transfer per landlord", async () => {
    setupSelectChain([
      { id: "ro_1", amount_eur_cents: 5000, landlord_id: "ll_1", stripe_account_id: "acct_ll1" },
      { id: "ro_2", amount_eur_cents: 3000, landlord_id: "ll_2", stripe_account_id: "acct_ll2" },
    ]);

    await disburseLandlord(period);

    expect(mocks.transferCreate).toHaveBeenCalledTimes(2);
  });
});
