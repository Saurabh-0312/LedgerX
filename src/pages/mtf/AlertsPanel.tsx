/** Intelligent warning cards (spec §11) — derived per open position via
 *  computeAlerts, grouped by severity (loss first) with count chips.
 *  Renders null when nothing needs attention. */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ComputedPosition, MtfAlertSeverity } from "@/lib/mtf/types";
import { computeAlerts } from "@/lib/mtf/calc";
import { ALERT_META } from "@/lib/mtf/palette";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const SEVERITY_ORDER: MtfAlertSeverity[] = ["loss", "warning", "info"];

const SEVERITY_ICON: Record<MtfAlertSeverity, LucideIcon> = {
  loss: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const SEVERITY_LABEL: Record<MtfAlertSeverity, string> = {
  loss: "critical",
  warning: "warning",
  info: "info",
};

export function AlertsPanel({ computed }: { computed: ComputedPosition[] }) {
  const navigate = useNavigate();

  /** All triggered alerts, grouped by severity — loss first. */
  const alerts = useMemo(() => {
    const all = computed.flatMap((cp) => computeAlerts(cp));
    return SEVERITY_ORDER.flatMap((sev) => all.filter((a) => a.severity === sev));
  }, [computed]);

  if (alerts.length === 0) return null;

  const counts = SEVERITY_ORDER.map((sev) => ({
    sev,
    count: alerts.filter((a) => a.severity === sev).length,
  })).filter((c) => c.count > 0);

  return (
    <Card
      title="Alerts"
      subtitle="What needs your attention"
      action={
        <>
          {counts.map(({ sev, count }) => (
            <Badge key={sev} tone={sev}>
              {count} {SEVERITY_LABEL[sev]}
            </Badge>
          ))}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {alerts.map((a, i) => {
          const Icon = SEVERITY_ICON[a.severity];
          const meta = ALERT_META[a.severity];
          return (
            <button
              key={`${a.positionId}-${a.title}-${i}`}
              type="button"
              onClick={() => navigate(`/mtf/${a.positionId}`)}
              className={`flex items-start gap-3 rounded-[10px] p-3 text-left transition-opacity hover:opacity-85 ${meta.className}`}
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${meta.iconClass}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug">{a.title}</p>
                  <Badge tone={a.severity}>{a.symbol}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{a.detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
