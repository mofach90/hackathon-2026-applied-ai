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
  mockInvoiceCreate,
  mockInvoiceItemCreate,
  mockInvoiceFinalize,
  mockInvoiceSend,
  mockDbInsert,
  mockDbQueryTenantFindFirst,
} = vi.hoisted(() => ({
  mockInvoiceCreate: vi.fn(),
  mockInvoiceItemCreate: vi.fn(),
  mockInvoiceFinalize: vi.fn(),
  mockInvoiceSend: vi.fn(),
  mockDbInsert: vi.fn().mockReturnValue({ values: vi.fn() }),
  mockDbQueryTenantFindFirst: vi.fn(),
}));

vi.mock("@/stripe/client", () => ({
  stripe: {
    invoices: {
      create: mockInvoiceCreate,
      finalizeInvoice: mockInvoiceFinalize,
      sendInvoice: mockInvoiceSend,
    },
    invoiceItems: {
      create: mockInvoiceItemCreate,
    },
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      tenant: {
        findFirst: mockDbQueryTenantFindFirst,
      },
    },
    insert: mockDbInsert,
  },
}));

import { createPaymentPlan } from "../plan";

describe("createPaymentPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQueryTenantFindFirst.mockResolvedValue({
      id: "tenant-1",
      stripe_customer_id: "cus_test123",
    });
    mockInvoiceCreate.mockResolvedValue({ id: "inv_mock" });
    mockInvoiceItemCreate.mockResolvedValue({});
    mockInvoiceFinalize.mockResolvedValue({});
    mockInvoiceSend.mockResolvedValue({});
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("creates 2 invoices for 2 installments with correct amounts", async () => {
    await createPaymentPlan("tenant-1", 101, 2);

    expect(mockInvoiceCreate).toHaveBeenCalledTimes(2);
    expect(mockInvoiceItemCreate).toHaveBeenCalledTimes(2);

    expect(mockInvoiceItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amount: 50, currency: "eur" }),
      expect.any(Object),
    );
    expect(mockInvoiceItemCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: 51, currency: "eur" }),
      expect.any(Object),
    );
  });

  it("sends only the first invoice immediately", async () => {
    await createPaymentPlan("tenant-1", 200, 2);

    expect(mockInvoiceSend).toHaveBeenCalledTimes(1);
    expect(mockInvoiceFinalize).toHaveBeenCalledTimes(2);
  });

  it("sets days_until_due as N*30 per installment", async () => {
    await createPaymentPlan("tenant-1", 300, 3);

    expect(mockInvoiceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ days_until_due: 30 }),
      expect.any(Object),
    );
    expect(mockInvoiceCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ days_until_due: 60 }),
      expect.any(Object),
    );
    expect(mockInvoiceCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ days_until_due: 90 }),
      expect.any(Object),
    );
  });

  it("throws if tenant not found", async () => {
    mockDbQueryTenantFindFirst.mockResolvedValue(undefined);
    await expect(createPaymentPlan("bad-id", 100, 2)).rejects.toThrow("not found");
  });
});
