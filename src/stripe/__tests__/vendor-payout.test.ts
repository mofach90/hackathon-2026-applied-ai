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
  dbQueryVendorInvoiceFindFirst: vi.fn(),
  dbQueryVendorFindFirst: vi.fn(),
  dbUpdate: vi.fn(),
}));

vi.mock("@/stripe/client", () => ({
  stripe: {
    transfers: { create: mocks.transferCreate },
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      vendorInvoice: { findFirst: mocks.dbQueryVendorInvoiceFindFirst },
      vendor: { findFirst: mocks.dbQueryVendorFindFirst },
    },
    update: mocks.dbUpdate,
  },
}));

import { payVendorInvoice } from "../vendor-payout";

describe("payVendorInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transferCreate.mockResolvedValue({ id: "tr_mock" });
    mocks.dbQueryVendorInvoiceFindFirst.mockResolvedValue({
      id: "vi_1", amount_eur_cents: 50000, status: "verified", vendor_id: "vendor_1",
    });
    mocks.dbQueryVendorFindFirst.mockResolvedValue({
      id: "vendor_1", stripe_account_id: "acct_vendor1",
    });
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mocks.dbUpdate.mockReturnValue({ set: mockSet });
  });

  it("creates a Stripe transfer with correct shape", async () => {
    await payVendorInvoice("vi_1");
    expect(mocks.transferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, currency: "eur", destination: "acct_vendor1" }),
      expect.objectContaining({ idempotencyKey: "vendor_payout_vi_1" }),
    );
  });

  it("updates invoice status after transfer", async () => {
    await payVendorInvoice("vi_1");
    expect(mocks.dbUpdate).toHaveBeenCalled();
  });

  it("throws if invoice is already paid", async () => {
    mocks.dbQueryVendorInvoiceFindFirst.mockResolvedValue({
      id: "vi_1", amount_eur_cents: 50000, status: "paid", vendor_id: "vendor_1",
    });
    await expect(payVendorInvoice("vi_1")).rejects.toThrow();
  });

  it("throws if invoice not found", async () => {
    mocks.dbQueryVendorInvoiceFindFirst.mockResolvedValue(undefined);
    await expect(payVendorInvoice("vi_1")).rejects.toThrow("not found");
  });
});
