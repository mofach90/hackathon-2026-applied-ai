import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentResponse, ReasoningStep } from "@/agent/types/response";

interface ReasoningChainProps {
  response: AgentResponse;
}

export function ReasoningChain({ response }: ReasoningChainProps) {
  return (
    <div data-testid="reasoning-chain" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reasoning Chain</CardTitle>
          {response.reasoning_summary && (
            <p className="text-sm text-slate-600">{response.reasoning_summary}</p>
          )}
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {response.reasoning_chain.map((step: ReasoningStep) => (
              <li key={step.step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {step.step}
                </span>
                <div className="space-y-1">
                  <p className="text-sm">{step.thought}</p>
                  {step.evidence && step.evidence.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-slate-500">
                      {step.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="border-slate-900 bg-slate-50">
        <CardHeader>
          <CardTitle>Chosen Action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              {response.action.kind.replace(/_/g, " ")}
            </p>
            <pre className="overflow-x-auto rounded-md bg-white p-3 text-xs text-slate-800 shadow-inner">
              {JSON.stringify(response.action, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Confidence: {Math.round(response.confidence * 100)}% &middot; Model: {response.audit.model}{" "}
        &middot; Policy: {response.audit.policy_version}
      </p>
    </div>
  );
}
