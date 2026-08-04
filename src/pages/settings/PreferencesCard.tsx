/** Settings → Preferences: base currency, timezone, starting capital. */

import { useState } from "react";
import { Save } from "lucide-react";
import type { AppSettings } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { formatMoney } from "@/lib/format";
import { CardFooter } from "@/pages/settings/shared";

const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata — IST (UTC+05:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai — GST (UTC+04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore — SGT (UTC+08:00)" },
  { value: "Europe/London", label: "Europe/London — GMT / BST" },
  { value: "America/New_York", label: "America/New_York — ET" },
];

type Currency = AppSettings["baseCurrency"];

export function PreferencesCard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [capital, setCapital] = useState(String(settings.startingCapital));

  const dirty =
    currency !== settings.baseCurrency ||
    timezone !== settings.timezone ||
    capital.trim() !== String(settings.startingCapital);

  const parsedCapital = Number(capital.trim());
  const capitalValid = capital.trim() !== "" && Number.isFinite(parsedCapital) && parsedCapital > 0;

  const capitalHint = capitalValid
    ? `≈ ${formatMoney(parsedCapital, { currency })} — drives the equity curve and ROI math.`
    : "Enter a positive amount — this seeds the equity curve and ROI math.";

  const timezoneKnown = TIMEZONES.some((t) => t.value === timezone);

  const save = () => {
    if (!capitalValid) {
      toast("Starting capital must be a positive number", "error");
      return;
    }
    updateSettings({ baseCurrency: currency, timezone, startingCapital: parsedCapital });
    setCapital(String(parsedCapital));
    toast("Preferences saved");
  };

  return (
    <Card title="Preferences" subtitle="Currency, timezone and the capital your performance is measured against.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Base currency" hint="Display currency across dashboards and reports.">
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="INR">INR — Indian Rupee (₹)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </Select>
          )}
        </Field>
        <Field label="Timezone" hint="Used when reading trade timestamps.">
          {(id) => (
            <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {!timezoneKnown && <option value={timezone}>{timezone}</option>}
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Starting capital" hint={capitalHint} className="sm:col-span-2">
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="pr-12"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-faint"
              >
                {currency === "INR" ? "₹" : "$"}
              </span>
            </div>
          )}
        </Field>
      </div>

      <CardFooter dirty={dirty}>
        <Button variant="primary" icon={Save} size="sm" onClick={save} disabled={!dirty}>
          Save preferences
        </Button>
      </CardFooter>
    </Card>
  );
}
