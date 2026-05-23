import Stripe from "stripe";
import { handleCheckoutCompleted } from "@/stripe/handlers/checkout-completed";
import { handleInvoicePaid } from "@/stripe/handlers/invoice-paid";
import { handleInvoicePaymentFailed } from "@/stripe/handlers/invoice-payment-failed";
import { handleTransferCreated } from "@/stripe/handlers/transfer-created";
import { handleAccountUpdated } from "@/stripe/handlers/account-updated";

export async function dispatchWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event);
      break;
    case "transfer.created":
      await handleTransferCreated(event);
      break;
    case "account.updated":
      await handleAccountUpdated(event);
      break;
    default:
      console.log(`[webhook] unhandled event type: ${event.type}`);
      break;
  }
}
