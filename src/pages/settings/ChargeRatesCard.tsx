/** Settings → Charge rates: the rate card behind the live trade calculator and imports. */

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { ChargeRates } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { DEFAULT_CHARGE_RATES } from "@/lib/tradeMath";
import { CardFooter, RateInput, draftDirty, numsToStrings, parseNums } from "@/pages/settings/shared";

type ChargeKey = keyof ChargeRates;

interface RateField {
  key: ChargeKey;
  label: string;
  suffix: string;
  hint: string;
}

const GROUPS: { heading: string; fields: RateField[] }[] = [
  {
    heading: "Brokerage",
    fields: [
      {
        key: "brokerageFlatPerOrder",
        label: "Flat brokerage",
        suffix: "₹/order",
        hint: "Cap for delivery/intraday (₹20 or 0.1% lower); flat fee for F&O",
      },
      {
        key: "brokeragePctPerOrder",
        label: "Brokerage percentage",
        suffix: "%",
        hint: "% of order value per leg (Groww 0.1% equity; flat 0.1% for MTF, no cap)",
      },
      {
        key: "minBrokeragePerOrder",
        label: "Minimum brokerage",
        suffix: "₹/order",
        hint: "Floor per executed leg (Groww ₹5); 0 to disable",
      },
      {
        key: "mtfInterestAnnualPct",
        label: "MTF interest",
        suffix: "%/yr",
        hint: "Reference rate on the funded amount — interest is entered per trade",
      },
    ],
  },
  {
    heading: "STT / CTT",
    fields: [
      { key: "sttIntradayPct", label: "Equity intraday", suffix: "%", hint: "On the sell side" },
      { key: "sttDeliveryPct", label: "Equity delivery", suffix: "%", hint: "On both sides of the trade" },
      { key: "sttEtfDeliveryPct", label: "Equity ETF (delivery)", suffix: "%", hint: "Sell side only — nil on buy (₹1/lakh)" },
      { key: "sttOptionsPct", label: "Options", suffix: "%", hint: "On sell-side premium" },
      { key: "sttFuturesPct", label: "Futures", suffix: "%", hint: "On the sell side" },
    ],
  },
  {
    heading: "Exchange transaction",
    fields: [
      { key: "exchangeEquityPct", label: "Equity (NSE)", suffix: "%", hint: "% of turnover — ₹2.97/lakh" },
      { key: "exchangeEquityBsePct", label: "Equity (BSE)", suffix: "%", hint: "% of turnover — ₹3.75/lakh (Group A/B)" },
      { key: "exchangeOptionsPct", label: "Options", suffix: "%", hint: "% of premium turnover" },
      { key: "exchangeFuturesPct", label: "Futures", suffix: "%", hint: "% of turnover" },
      { key: "exchangeCommodityPct", label: "Commodity", suffix: "%", hint: "% of turnover (MCX)" },
      { key: "exchangeForexPct", label: "Forex", suffix: "%", hint: "% of turnover" },
      {
        key: "cryptoFeePct",
        label: "Crypto exchange fee",
        suffix: "%",
        hint: "Per leg — crypto trades carry no brokerage",
      },
    ],
  },
  {
    heading: "Stamp duty",
    fields: [
      { key: "stampDeliveryPct", label: "Equity delivery", suffix: "%", hint: "On the buy side" },
      { key: "stampIntradayPct", label: "Equity intraday", suffix: "%", hint: "On the buy side" },
      { key: "stampOptionsPct", label: "Options", suffix: "%", hint: "On the buy side" },
      { key: "stampFuturesPct", label: "Futures", suffix: "%", hint: "On the buy side" },
    ],
  },
  {
    heading: "Statutory & other",
    fields: [
      { key: "sebiPct", label: "SEBI charges", suffix: "%", hint: "% of total turnover" },
      { key: "gstPct", label: "GST", suffix: "%", hint: "On brokerage + exchange txn + SEBI + DP + pledge" },
      { key: "dpChargePerSell", label: "DP charge", suffix: "₹/sell", hint: "Per delivery/MTF equity sell" },
      { key: "pledgeChargePerRequest", label: "MTF pledge/unpledge", suffix: "₹/leg", hint: "₹20 + GST per ISIN per request (MTF buy & sell)" },
    ],
  },
];

const CHARGE_KEYS: readonly ChargeKey[] = GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export function ChargeRatesCard() {
  const rates = useStore((s) => s.settings.chargeRates);
  const updateSettings = useStore((s) => s.updateSettings);

  const [draft, setDraft] = useState<Record<ChargeKey, string>>(() => numsToStrings<ChargeKey>(rates));

  const dirty = draftDirty(draft, rates, CHARGE_KEYS);
  const atDefaults = !draftDirty(draft, DEFAULT_CHARGE_RATES, CHARGE_KEYS);

  const setField = (key: ChargeKey, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const resetToDefaults = () => {
    setDraft(numsToStrings<ChargeKey>(DEFAULT_CHARGE_RATES));
    toast("Charge rates reset to defaults — hit Save to apply", "info");
  };

  const save = () => {
    const parsed = parseNums<ChargeKey>(draft, CHARGE_KEYS);
    if (!parsed) {
      toast("Every rate must be a non-negative number", "error");
      return;
    }
    updateSettings({ chargeRates: parsed });
    setDraft(numsToStrings<ChargeKey>(parsed));
    toast("Charge rates saved");
  };

  return (
    <Card
      title="Charge rates"
      subtitle="The rate card behind the live trade-cost calculator and imports — modelled on Indian discount-broker schedules."
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {GROUPS.map((group, gi) => (
          <div key={group.heading} className="contents">
            <h4 className={`label-caps sm:col-span-2 ${gi > 0 ? "mt-2" : ""}`}>{group.heading}</h4>
            {group.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {(id) => (
                  <RateInput id={id} value={draft[f.key]} suffix={f.suffix} onChange={(v) => setField(f.key, v)} />
                )}
              </Field>
            ))}
          </div>
        ))}
      </div>

      <CardFooter
        dirty={dirty}
        note="Existing trades keep the charges recorded when they were entered — only new and edited trades use these rates."
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
