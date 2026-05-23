// Demo unstructured inputs keyed by tenant_id (from seed IDs)
export const UNSTRUCTURED_FIXTURES: Record<string, { source: string; content: string }[]> = {
  // Amina Benali
  "c1000000-0000-0000-0000-000000000001": [
    {
      source: "support_chat",
      content:
        "Hi, I wanted to reach out because I've been struggling financially. I recently changed jobs and there was a gap in my salary payments. I know I'm late on rent and I'm really sorry. I'm expecting my first full paycheck next Friday and I can pay the full amount then.",
    },
    {
      source: "landlord_note",
      content:
        "Amina has always been a reliable tenant for the past 2 years. This is the first time she's been late. She mentioned a job change last month.",
    },
  ],
  // Mike Schmidt
  "c1000000-0000-0000-0000-000000000002": [
    {
      source: "support_chat",
      content:
        "Why are you charging me a late fee?! I sent the payment! Your system is broken. If you send me another notice I'll call my lawyer.",
    },
    {
      source: "landlord_note",
      content:
        "Mike has been late 3 times this year. Previous payment plans were not honored.",
    },
  ],
  // Sara Petrović
  "c1000000-0000-0000-0000-000000000003": [
    {
      source: "support_chat",
      content:
        "Hello, I got your notice. I have the money but my online banking is not working. Can I pay in cash or via bank transfer? I will do it today or tomorrow.",
    },
    {
      source: "landlord_note",
      content:
        "Sara is cooperative. Works as a freelancer, income sometimes irregular but she always pays eventually.",
    },
  ],
};

export function getUnstructuredFixtures(
  tenantId: string,
): { source: string; content: string }[] {
  return UNSTRUCTURED_FIXTURES[tenantId] ?? [];
}
