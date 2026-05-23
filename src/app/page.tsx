import { getCurrentManager } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  const manager = getCurrentManager();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome, {manager.name}</p>
      </div>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            RentPilot AI — autonomous payment operations for property management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
