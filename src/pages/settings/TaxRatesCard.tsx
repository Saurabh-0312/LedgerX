/** Settings → Tax rates: special-rate percentages + new-regime FY thresholds
 *  that drive the financial-year tax estimate on the Tax Report page. */

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { TaxRates } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { DEFAULT_TAX_RATES } from "@/lib/tradeMath";
import { CardFooter, RateInput, draftDirty, numsToStrings, parseNums } from "@/pages/settings/shared";

type TaxKey = keyof TaxRates;

const PCT_FIELDS: { key: TaxKey; label: string; hint: string }[] = [
  { key: "intradayPct", label: "Intraday / F&O", hint: "Business income · per-trade estimate (FY total uses slabs)" },
  { key: "stcgPct", label: "STCG · §111A", hint: "Equity held under 12 months · flat" },
  { key: "ltcgPct", label: "LTCG · §112A", hint: "Equity held 12 months or more · over the annual exemption" },
  { key: "cryptoPct", label: "Crypto / VDA · §115BBH", hint: "Flat rate, no loss set-off" },
  { key: "cessPct", label: "Health & education cess", hint: "Applied on tax + surcharge" },
];

const AMT_FIELDS: { key: TaxKey; label: string; hint: string }[] = [
  { key: "basicExemption", label: "Basic exemption", hint: "New-regime nil slab · unused amount offsets gains" },
  { key: "ltcgExemption", label: "LTCG annual exemption", hint: "Tax-free LTCG per financial year (§112A)" },
  { key: "rebate87ALimit", label: "§87A rebate income limit", hint: "Total income up to which the rebate applies" },
  { key: "rebate87AMax", label: "§87A maximum rebate", hint: "Cap on the rebate against business-income tax" },
];

const PCT_KEYS = PCT_FIELDS.map((f) => f.key);
const AMT_KEYS = AMT_FIELDS.map((f) => f.key);
const ALL_KEYS: readonly TaxKey[] = [...PCT_KEYS, ...AMT_KEYS];
const AMT_MAX = 100_000_000;

export function TaxRatesCard() {
  const rates = useStore((s) => s.settings.taxRates);
  const updateSettings = useStore((s) => s.updateSettings);

  const [draft, setDraft] = useState<Record<TaxKey, string>>(() => numsToStrings<TaxKey>(rates));

  const dirty = draftDirty(draft, rates, ALL_KEYS);
  const atDefaults = !draftDirty(draft, DEFAULT_TAX_RATES, ALL_KEYS);

  const resetToDefaults = () => {
    setDraft(numsToStrings<TaxKey>(DEFAULT_TAX_RATES));
    toast("Tax rates reset to defaults — hit Save to apply", "info");
  };

  const save = () => {
    const pct = parseNums<TaxKey>(draft, PCT_KEYS, 100);
    const amt = parseNums<TaxKey>(draft, AMT_KEYS, AMT_MAX);
    if (!pct || !amt) {
      toast("Percentages must be 0–100 and thresholds valid rupee amounts", "error");
      return;
    }
    const parsed = { ...pct, ...amt } as TaxRates;
    updateSettings({ taxRates: parsed });
    setDraft(numsToStrings<TaxKey>(parsed));
    toast("Tax rates saved");
  };

  return (
    <Card
      title="Tax rates"
      subtitle="Rates and thresholds for the financial-year tax estimate — new regime, FY 2025-26."
    >
      <div>
        <p className="label-caps mb-2">Special rates & cess</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PCT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {(id) => (
                <RateInput
                  id={id}
                  value={draft[f.key]}
                  suffix="%"
                  max={100}
                  onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                />
              )}
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-edge-soft pt-4">
        <p className="label-caps mb-2">New-regime thresholds (₹)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {AMT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {(id) => (
                <RateInput
                  id={id}
                  value={draft[f.key]}
                  suffix="₹"
                  max={AMT_MAX}
                  onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                />
              )}
            </Field>
          ))}
        </div>
      </div>

      <CardFooter
        dirty={dirty}
        note="Estimates only — the Tax Report applies the new-regime slabs, §87A rebate and basic-exemption set-off on your aggregate yearly income."
      >
        <Button variant="outline" icon={RotateCcw} size="sm" onClick={resetToDefaults} disabled={atDefaults}>
          Reset to defaults
        </Button>
        <Button variant="primary" icon={Save} size="sm" onClick={save} disabled={!dirty}>
          Save rates
        </Button>
      </CardFooter>
    </Card>
  );
}
