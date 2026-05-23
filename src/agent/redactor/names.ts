/**
 * Seed list of names the regex redactor matches whole-word, case-insensitive.
 *
 * Sources:
 * - Demo personas from `docs/project.md` (Amina Benali, Mike Schmidt, Sara Petrović)
 * - Counterfactual swap names from `docs/adr/0005-bias-defense-layers.md`
 *   (Anna Bauer, Mehmet, Sarah)
 *
 * Production would replace this with a per-tenant lookup driven by the DB.
 * For the hackathon demo, hard-coding the personas is sufficient.
 */
export const TENANT_NAMES: readonly string[] = [
  "Amina",
  "Benali",
  "Mike",
  "Schmidt",
  "Sara",
  "Petrović",
  "Petrovic",
  "Anna",
  "Bauer",
  "Mehmet",
  "Sarah",
];
