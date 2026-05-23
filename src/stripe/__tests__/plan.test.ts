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
  invoiceCreate: vi.fn(),
  invoiceItemCreate: vi.fn(),
  invoiceFinalize: vi.fn(),
  invoiceSend: vi.fn(),
  dbInsert: vi.fn(),
  dbQueryTenantFindFirst: vi.fn(),
}));

vi.mock("@/stripe/client", () => ({
  stripe: {
    invoices: {
      create: mocks.invoiceCreate,
      finalizeInvoice: mocks.invoiceFinalize,
      sendInvoice: mocks.invoiceSend,
    },
    invoiceItems: {
      create: mocks.invoiceItemCreate,
    },
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      tenant: {
        findFirst: mocks.dbQueryTenantFindFirst,
      },
    },
    insert: mocks.dbInsert,
  },
}));

import { createPaymentPlan } from "../plan";

describe("createPaymentPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbQueryTenantFindFirst.mockResolvedValue({
      id: "tenant-1",
      stripe_customer_id: "cus_test123",
    });
    mocks.invoiceCreate.mockResolvedValue({ id: "inv_mock" });
    mocks.invoiceItemCreate.mockResolvedValue({});
    mocks.invoiceFinalize.mockResolvedValue({});
    mocks.invoiceSend.mockResolvedValue({});
    mocks.dbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("creates 2 invoices for 2 installments with correct amounts", async () => {
    await createPaymentPlan("tenant-1", 101, 2);

    expect(mocks.invoiceCreate).toHaveBeenCalledTimes(2);
    expect(mocks.invoiceItemCreate).toHaveBeenCalledTimes(2);

    expect(mocks.invoiceItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ amount: 50, currency: "eur" }),
      expect.any(Object),
    );
    expect(mocks.invoiceItemCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: 51, currency: "eur" }),
      expect.any(Object),
    );
  });

  it("sends only the first invoice immediately", async () => {
    await createPaymentPlan("tenant-1", 200, 2);

    expect(mocks.invoiceSend).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceFinalize).toHaveBeenCalledTimes(2);
  });

  it("sets days_until_due as N*30 per installment", async () => {
    await createPaymentPlan("tenant-1", 300, 3);

    expect(mocks.invoiceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ days_until_due: 30 }),
      expect.any(Object),
    );
    expect(mocks.invoiceCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ days_until_due: 60 }),
      expect.any(Object),
    );
    expect(mocks.invoiceCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ days_until_due: 90 }),
      expect.any(Object),
    );
  });

  it("throws if tenant not found", async () => {
    mocks.dbQueryTenantFindFirst.mockResolvedValue(undefined);
    await expect(createPaymentPlan("bad-id", 100, 2)).rejects.toThrow("not found");
  });
});
