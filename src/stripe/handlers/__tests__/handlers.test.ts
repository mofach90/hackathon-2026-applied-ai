import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUpdate,
  mockInsert,
  mockSelect,
  mockTenantFindFirst,
  mockPaymentPlanFindFirst,
  mockRentObligationFindFirst,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockTenantFindFirst: vi.fn(),
  mockPaymentPlanFindFirst: vi.fn(),
  mockRentObligationFindFirst: vi.fn(),
}));

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

vi.mock("@/db/client", () => ({
  db: {
    query: {
      tenant: { findFirst: mockTenantFindFirst },
      paymentPlan: { findFirst: mockPaymentPlanFindFirst },
      rentObligation: { findFirst: mockRentObligationFindFirst },
    },
    update: mockUpdate,
    insert: mockInsert,
    select: mockSelect,
  },
}));

vi.mock("@/stripe/client", () => ({ stripe: {} }));

import { handleCheckoutCompleted } from "../checkout-completed";
import { handleInvoicePaid } from "../invoice-paid";
import { handleInvoicePaymentFailed } from "../invoice-payment-failed";
import { handleTransferCreated } from "../transfer-created";
import { handleAccountUpdated } from "../account-updated";

function makeUpdateChain() {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
  return chain;
}
function makeInsertChain() {
  return { values: vi.fn().mockReturnThis(), onConflictDoNothing: vi.fn().mockResolvedValue([]) };
}
function makeSelectChain(rows: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(rows) };
}
function makeEvent(type: string, obj: Record<string, unknown>) {
  return { type, id: "evt_test", data: { object: obj } } as never;
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// checkout-completed
// ---------------------------------------------------------------------------
describe("handleCheckoutCompleted", () => {
  it("marks rent obligation paid when invoice found and not yet paid", async () => {
    mockTenantFindFirst.mockResolvedValue({ id: "t-1", stripe_customer_id: "cus_1" });
    mockRentObligationFindFirst.mockResolvedValue({
      id: "ro-1",
      status: "pending",
      stripe_invoice_id: "inv_1",
    });
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleCheckoutCompleted(
      makeEvent("checkout.session.completed", { customer: "cus_1", invoice: "inv_1" }),
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }));
  });

  it("is idempotent: skips update if obligation already paid", async () => {
    mockTenantFindFirst.mockResolvedValue({ id: "t-1", stripe_customer_id: "cus_1" });
    mockRentObligationFindFirst.mockResolvedValue({
      id: "ro-1",
      status: "paid",
      stripe_invoice_id: "inv_1",
    });

    await handleCheckoutCompleted(
      makeEvent("checkout.session.completed", { customer: "cus_1", invoice: "inv_1" }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when no customer id", async () => {
    await handleCheckoutCompleted(makeEvent("checkout.session.completed", { customer: null }));
    expect(mockTenantFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// invoice-paid
// ---------------------------------------------------------------------------
describe("handleInvoicePaid", () => {
  it("marks installment paid and completes plan when all installments done", async () => {
    mockPaymentPlanFindFirst.mockResolvedValue({
      id: "plan-1",
      status: "active",
      installments: [
        { index: 0, stripe_invoice_id: "inv_0", amount_cents: 500, paid_at: "2026-01-01" },
        { index: 1, stripe_invoice_id: "inv_1", amount_cents: 500 },
      ],
    });
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleInvoicePaid(
      makeEvent("invoice.paid", {
        id: "inv_1",
        metadata: { rentpilot_plan_id: "plan-1", rentpilot_installment_index: "1" },
      }),
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  it("keeps plan active when not all installments paid", async () => {
    mockPaymentPlanFindFirst.mockResolvedValue({
      id: "plan-1",
      status: "active",
      installments: [
        { index: 0, stripe_invoice_id: "inv_0", amount_cents: 500 },
        { index: 1, stripe_invoice_id: "inv_1", amount_cents: 500 },
      ],
    });
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleInvoicePaid(
      makeEvent("invoice.paid", {
        id: "inv_0",
        metadata: { rentpilot_plan_id: "plan-1", rentpilot_installment_index: "0" },
      }),
    );

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("is idempotent: skips when plan already completed", async () => {
    mockPaymentPlanFindFirst.mockResolvedValue({
      id: "plan-1",
      status: "completed",
      installments: [],
    });

    await handleInvoicePaid(
      makeEvent("invoice.paid", {
        id: "inv_0",
        metadata: { rentpilot_plan_id: "plan-1", rentpilot_installment_index: "0" },
      }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when metadata missing", async () => {
    await handleInvoicePaid(makeEvent("invoice.paid", { id: "inv_x", metadata: {} }));
    expect(mockPaymentPlanFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// invoice-payment-failed
// ---------------------------------------------------------------------------
describe("handleInvoicePaymentFailed", () => {
  it("creates agent_case for failed payment", async () => {
    mockTenantFindFirst.mockResolvedValue({ id: "t-1", stripe_customer_id: "cus_1" });
    mockSelect.mockReturnValue(makeSelectChain([]));
    const chain = makeInsertChain();
    mockInsert.mockReturnValue(chain);

    await handleInvoicePaymentFailed(
      makeEvent("invoice.payment_failed", {
        id: "inv_fail",
        customer: "cus_1",
        amount_due: 80000,
      }),
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_type: "rent_failed_charge" }),
    );
  });

  it("is idempotent: skips insert if case already exists", async () => {
    mockTenantFindFirst.mockResolvedValue({ id: "t-1", stripe_customer_id: "cus_1" });
    mockSelect.mockReturnValue(
      makeSelectChain([
        {
          id: "case-1",
          trigger_type: "rent_failed_charge",
          trigger_payload: { stripe_invoice_id: "inv_fail" },
        },
      ]),
    );

    await handleInvoicePaymentFailed(
      makeEvent("invoice.payment_failed", {
        id: "inv_fail",
        customer: "cus_1",
        amount_due: 80000,
      }),
    );

    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// transfer-created
// ---------------------------------------------------------------------------
describe("handleTransferCreated", () => {
  it("marks vendor invoice paid when transfer_id matches", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeSelectChain([{ id: "vi-1", status: "verified", stripe_transfer_id: "tr_1" }]),
      );
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleTransferCreated(makeEvent("transfer.created", { id: "tr_1", metadata: {} }));

    expect(mockUpdate).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }));
  });

  it("is idempotent: skips if vendor invoice already paid", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeSelectChain([{ id: "vi-1", status: "paid", stripe_transfer_id: "tr_1" }]),
      );

    await handleTransferCreated(makeEvent("transfer.created", { id: "tr_1", metadata: {} }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marks vendor invoice paid via metadata when not found by transfer_id", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ id: "vi-2", status: "verified" }]));
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleTransferCreated(
      makeEvent("transfer.created", {
        id: "tr_2",
        metadata: { rentpilot_vendor_invoice_id: "vi-2" },
      }),
    );

    expect(mockUpdate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// account-updated
// ---------------------------------------------------------------------------
describe("handleAccountUpdated", () => {
  it("updates vendor kyc_verified=true when account is verified", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeSelectChain([{ id: "v-1", stripe_account_id: "acct_1", kyc_verified: false }]),
      );
    const chain = makeUpdateChain();
    mockUpdate.mockReturnValue(chain);

    await handleAccountUpdated(
      makeEvent("account.updated", {
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith({ kyc_verified: true });
  });

  it("is idempotent: skips update if kyc_verified already matches", async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(
        makeSelectChain([{ id: "v-1", stripe_account_id: "acct_1", kyc_verified: true }]),
      );

    await handleAccountUpdated(
      makeEvent("account.updated", {
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("logs and no-ops for landlord account", async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "l-1", stripe_account_id: "acct_2" }]));

    await handleAccountUpdated(
      makeEvent("account.updated", {
        id: "acct_2",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
