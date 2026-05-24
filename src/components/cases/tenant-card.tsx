import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, Globe, Calendar, Home } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { tenant, property } from "@/db/schema";

type Tenant = InferSelectModel<typeof tenant> & {
  property: InferSelectModel<typeof property> | null;
};

interface TenantCardProps {
  tenant: Tenant;
}

export function TenantCard({ tenant: t }: TenantCardProps) {
  return (
    <Card className="overflow-hidden border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900 backdrop-blur-md shadow-md shadow-slate-100/50 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <CardHeader className="border-b border-slate-50 bg-slate-50/40 dark:bg-slate-800/40 px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/50">
            <User className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t.name}
            </CardTitle>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Active Tenant
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 grid gap-6 sm:grid-cols-2">
        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Contact Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <Mail className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="font-mono text-xs">{t.email}</span>
            </div>
            {t.phone && (
              <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                <Phone className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{t.phone}</span>
              </div>
            )}
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <Globe className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {t.language}
              </span>
            </div>
          </div>
        </div>

        {/* Tenancy & Location */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Lease & Property
          </h3>
          <div className="space-y-3">
            {t.property && (
              <div className="flex items-start text-sm text-slate-600 dark:text-slate-400">
                <Home className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{t.property.address}</p>
                  {t.property.unit && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unit {t.property.unit}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <div>
                <span className="text-xs text-slate-400 dark:text-slate-500 block font-medium uppercase tracking-wide">
                  Started
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t.tenancy_started.toLocaleDateString("de-DE")}
                </span>
              </div>
            </div>
            {t.lease_end && (
              <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                <Calendar className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block font-medium uppercase tracking-wide">
                    Lease End
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t.lease_end.toLocaleDateString("de-DE")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
