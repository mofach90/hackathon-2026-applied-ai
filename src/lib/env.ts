// server-only: never import this module in client components
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // basis points integer, e.g. 800 = 8%
  STRIPE_CONNECT_LANDLORD_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000),
  GEMINI_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function parseEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `[env] Missing or invalid environment variables: ${missing}. ` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }
  return Object.freeze(result.data);
}

export const env = parseEnv();

export type Env = z.infer<typeof schema>;
