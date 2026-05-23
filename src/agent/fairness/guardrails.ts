import { FORBIDDEN_KEYWORDS } from "./keywords";

export interface OutputGuardrailCheck {
  forbidden_keywords_present: boolean;
  hits: string[];
}

function normalizeCorpus(reasoningSummary: string): string {
  return reasoningSummary
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function checkOutputGuardrails(reasoningSummary: string): OutputGuardrailCheck {
  const corpus = normalizeCorpus(reasoningSummary);
  const hits = FORBIDDEN_KEYWORDS.filter((keyword) => corpus.includes(keyword));

  return {
    forbidden_keywords_present: hits.length > 0,
    hits,
  };
}
