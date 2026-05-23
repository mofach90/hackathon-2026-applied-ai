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
  mockDbQueryVendorInvoiceFindFirst,
  mockDbQueryVendorFindFirst,
  mockDbUpdate,
  mockSet,
  mockWhere,
} = vi.hoisted(() => {
  const mockTransferCreate = vi.fn();
  const mockDbQueryVendorInvoiceFindFirst = vi.fn();
  const mockDbQueryVendorFindFirst = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn().mockResolvedValue(undefined);

  mockSet.mockReturnValue({ where: mockWhere });
  mockDbUpdate.mockReturnValue({ set: mockSet });

  return {
    mockTransferCreate,
    mockDbQueryVendorInvoiceFindFirst,
    mockDbQueryVendorFindFirst,
    mockDbUpdate,
    mockSet,
    mockWhere,
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
    query: {
      vendorInvoice: {
        findFirst: mockDbQueryVendorInvoiceFindFirst,
      },
      vendor: {
        findFirst: mockDbQueryVendorFindFirst,
      },
    },
    update: mockDbUpdate,
  },
}));

import { payVendorInvoice } from "../vendor-payout";

describe("payVendorInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue({
      id: "vi_1",
      amount_eur_cents: 50000,
      status: "verified",
      vendor_id: "vendor_1",
    });
    mockDbQueryVendorFindFirst.mockResolvedValue({
      id: "vendor_1",
      stripe_account_id: "acct_vendor1",
    });
    mockTransferCreate.mockResolvedValue({ id: "tr_mock" });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });
  });

  it("creates a Stripe transfer with correct shape", async () => {
    await payVendorInvoice("vi_1");
    expect(mockTransferCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, currency: "eur", destination: "acct_vendor1" }),
      expect.objectContaining({ idempotencyKey: "vendor_payout_vi_1" }),
    );
  });

  it("updates invoice status after transfer", async () => {
    await payVendorInvoice("vi_1");
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("throws if invoice is already paid", async () => {
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue({
      id: "vi_1",
      amount_eur_cents: 50000,
      status: "paid",
      vendor_id: "vendor_1",
    });
    await expect(payVendorInvoice("vi_1")).rejects.toThrow();
  });

  it("throws if invoice not found", async () => {
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue(undefined);
    await expect(payVendorInvoice("vi_1")).rejects.toThrow("not found");
  });
});
