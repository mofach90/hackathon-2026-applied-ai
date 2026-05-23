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

const mockTransferCreate = vi.fn();
const mockDbQueryVendorInvoiceFindFirst = vi.fn();
const mockDbQueryVendorFindFirst = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("@/stripe/client", () => ({
  stripe: {
    transfers: {
      create: mockTransferCreate,
    },
  },
}));

const mockSet = vi.fn();
const mockWhere = vi.fn().mockResolvedValue(undefined);
mockSet.mockReturnValue({ where: mockWhere });
mockDbUpdate.mockReturnValue({ set: mockSet });

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

const mockInvoice = {
  id: "vi_1",
  vendor_id: "vendor-1",
  amount_eur_cents: 5000,
  status: "verified" as const,
};

const mockVendor = {
  id: "vendor-1",
  stripe_account_id: "acct_vendortest",
};

describe("payVendorInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue(mockInvoice);
    mockDbQueryVendorFindFirst.mockResolvedValue(mockVendor);
    mockTransferCreate.mockResolvedValue({ id: "tr_mock" });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });
  });

  it("creates a Stripe transfer with correct shape", async () => {
    await payVendorInvoice("vi_1");

    expect(mockTransferCreate).toHaveBeenCalledWith(
      {
        amount: 5000,
        currency: "eur",
        destination: "acct_vendortest",
        description: expect.stringContaining("vi_1"),
      },
      { idempotencyKey: "vendor_payout_vi_1" },
    );
  });

  it("updates vendor_invoice status to paid after transfer", async () => {
    await payVendorInvoice("vi_1");

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "paid" });
  });

  it("throws if invoice is already paid", async () => {
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue({ ...mockInvoice, status: "paid" });
    await expect(payVendorInvoice("vi_1")).rejects.toThrow("paid");
  });

  it("throws if invoice not found", async () => {
    mockDbQueryVendorInvoiceFindFirst.mockResolvedValue(undefined);
    await expect(payVendorInvoice("vi_1")).rejects.toThrow("not found");
  });
});
