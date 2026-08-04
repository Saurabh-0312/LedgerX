/** CSV → Trade[] parser for the Trades page "Import CSV" action.
 *  Accepts a simple header row (symbol, assetClass, direction, quantity,
 *  entryPrice, exitPrice, openedAt, closedAt, strategy, riskAmount …) and
 *  rebuilds full Trade objects with the house charge/tax/R math. */

import type {
  Account,
  AppSettings,
  AssetClass,
  Direction,
  Trade,
} from "@/types";
import {
  computeCharges,
  computeGrossPnl,
  computeRMultiple,
  computeTax,
  computeTaxablePnl,
  defaultSegmentFor,
  holdingMinutesBetween,
  isIntraday,
  manualChargesBreakdown,
  taxCategoryFor,
} from "@/lib/tradeMath";
import { nextTradeId } from "@/store/useStore";

export interface ImportContext {
  /** full trade list (unfiltered) — used to continue the T-xxxx id sequence */
  existing: Trade[];
  accounts: Account[];
  /** global account filter — "all" falls back to the first account */
  accountId: string;
  settings: AppSettings;
}

/* ── low-level CSV row parser (handles quoted fields, "" escapes, CRLF) ── */

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* ── header + value normalisation ──────────────────────────────────────── */

type FieldKey =
  | "symbol"
  | "assetClass"
  | "direction"
  | "quantity"
  | "entryPrice"
  | "exitPrice"
  | "openedAt"
  | "closedAt"
  | "strategy"
  | "riskAmount"
  | "stopLoss"
  | "target"
  | "totalCharges"
  | "mtfInterest"
  | "exchange"
  | "tags"
  | "notes";

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  symbol: ["symbol", "ticker", "instrument", "scrip"],
  assetClass: ["assetclass", "asset", "segment", "class"],
  direction: ["direction", "side"],
  quantity: ["quantity", "qty", "size"],
  entryPrice: ["entryprice", "entry", "buyprice", "avgentry"],
  exitPrice: ["exitprice", "exit", "sellprice", "avgexit"],
  openedAt: ["openedat", "opened", "opendate", "entrydate", "entrytime", "date"],
  closedAt: ["closedat", "closed", "closedate", "exitdate", "exittime"],
  strategy: ["strategy", "setup", "playbook"],
  riskAmount: ["riskamount", "risk"],
  stopLoss: ["stoploss", "stop", "sl"],
  target: ["target", "tgt", "tp"],
  totalCharges: ["totalcharges", "charges", "chargestotal", "totalcharge", "fees", "totalfees", "cost"],
  mtfInterest: ["mtfinterest", "mtf", "margininterest", "interest", "mtfint"],
  exchange: ["exchange", "exch", "venue"],
  tags: ["tags", "labels"],
  notes: ["notes", "note", "comment", "comments"],
};

const REQUIRED: FieldKey[] = ["symbol", "direction", "quantity", "entryPrice", "openedAt"];

const ASSET_ALIASES: Record<string, AssetClass> = {
  equity: "Equity",
  equities: "Equity",
  stock: "Equity",
  stocks: "Equity",
  eq: "Equity",
  cash: "Equity",
  options: "Options",
  option: "Options",
  opt: "Options",
  futures: "Futures",
  future: "Futures",
  fut: "Futures",
  forex: "Forex",
  fx: "Forex",
  currency: "Forex",
  crypto: "Crypto",
  cryptocurrency: "Crypto",
  vda: "Crypto",
  commodity: "Commodity",
  commodities: "Commodity",
  mcx: "Commodity",
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ── main entry ─────────────────────────────────────────────────────────── */

export function parseTradesCsv(text: string, ctx: ImportContext): Trade[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("CSV needs a header row plus at least one trade row.");
  }

  // map field keys → column index via the header row
  const header = rows[0].map(normalizeHeader);
  const col: Partial<Record<FieldKey, number>> = {};
  (Object.keys(HEADER_ALIASES) as FieldKey[]).forEach((key) => {
    const i = header.findIndex((h) => HEADER_ALIASES[key].includes(h));
    if (i !== -1) col[key] = i;
  });

  const missing = REQUIRED.filter((key) => col[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`CSV is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  const account =
    (ctx.accountId !== "all" ? ctx.accounts.find((a) => a.id === ctx.accountId) : undefined) ??
    ctx.accounts[0];
  if (!account) throw new Error("Add an account before importing trades.");
  const capital = account.startingCapital > 0 ? account.startingCapital : ctx.settings.startingCapital;

  // continue the sequential id counter locally across imported rows
  let seq = Number(nextTradeId(ctx.existing).replace(/\D/g, ""));

  const trades: Trade[] = [];

  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    const rowNo = r + 1; // 1-based, counting the header

    const cell = (key: FieldKey): string => {
      const i = col[key];
      return i === undefined || i >= raw.length ? "" : raw[i].trim();
    };
    const numCell = (key: FieldKey): number | undefined => {
      const s = cell(key).replace(/[₹$,\s]/g, "");
      if (s === "") return undefined;
      const n = Number(s);
      if (!Number.isFinite(n)) throw new Error(`Row ${rowNo}: "${cell(key)}" is not a valid number for ${key}.`);
      return n;
    };
    const dateCell = (key: FieldKey): string | undefined => {
      const s = cell(key);
      if (s === "") return undefined;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) throw new Error(`Row ${rowNo}: "${s}" is not a valid date for ${key}.`);
      return d.toISOString();
    };

    const symbol = cell("symbol").toUpperCase();
    if (!symbol) throw new Error(`Row ${rowNo}: symbol is empty.`);

    const assetClass: AssetClass = ASSET_ALIASES[cell("assetClass").toLowerCase()] ?? "Equity";
    const direction: Direction = /^(short|sell|s)$/i.test(cell("direction")) ? "Short" : "Long";

    const quantity = numCell("quantity");
    if (quantity === undefined || quantity <= 0) throw new Error(`Row ${rowNo}: quantity must be a positive number.`);
    const entryPrice = numCell("entryPrice");
    if (entryPrice === undefined || entryPrice <= 0) throw new Error(`Row ${rowNo}: entryPrice must be a positive number.`);

    const openedAt = dateCell("openedAt");
    if (!openedAt) throw new Error(`Row ${rowNo}: openedAt is required.`);
    const exitPrice = numCell("exitPrice");
    // tolerate a filled exit with a blank close time → same-day close
    const closedAt = exitPrice !== undefined ? (dateCell("closedAt") ?? openedAt) : dateCell("closedAt");
    if (closedAt && new Date(closedAt).getTime() < new Date(openedAt).getTime()) {
      throw new Error(`Row ${rowNo}: closedAt is before openedAt.`);
    }

    const closed = exitPrice !== undefined && closedAt !== undefined;
    const intraday = isIntraday(openedAt, closed ? closedAt : undefined);
    // MTF interest column implies an MTF equity trade; otherwise infer from asset/intraday
    const manualMtf = numCell("mtfInterest");
    const segment =
      assetClass === "Equity" && manualMtf !== undefined && manualMtf > 0
        ? "MTF"
        : defaultSegmentFor(assetClass, intraday);
    const exchange = /^bse$/i.test(cell("exchange")) ? "BSE" : "NSE";

    let holdingMinutes: number | undefined;
    let grossPnl = 0;
    if (exitPrice !== undefined && closedAt !== undefined) {
      holdingMinutes = holdingMinutesBetween(openedAt, closedAt);
      grossPnl = computeGrossPnl(direction, entryPrice, exitPrice, quantity);
    }

    // a `charges`/`totalCharges` (and/or `mtfInterest`) column switches this row
    // to manual charge entry, split into charges + MTF interest
    const manualCharge = numCell("totalCharges");
    const isManual = manualCharge !== undefined || manualMtf !== undefined;
    const charges = isManual
      ? manualChargesBreakdown(manualCharge ?? 0, manualMtf ?? 0)
      : computeCharges({
          assetClass,
          segment,
          exchange,
          quantity,
          entryPrice,
          exitPrice: closed ? exitPrice : undefined,
          direction,
          rates: ctx.settings.chargeRates,
          mtfInterest: manualMtf ?? 0,
        });
    const netPnl = closed ? r2(grossPnl - charges.total) : 0;
    const category = taxCategoryFor(assetClass, holdingMinutes, intraday);
    const taxablePnl = closed ? computeTaxablePnl(grossPnl, charges, category) : 0;
    const tax = computeTax(taxablePnl, category, ctx.settings.taxRates);

    const positionValue = r2(entryPrice * quantity);
    const riskRaw = numCell("riskAmount");
    const riskAmount = riskRaw !== undefined && riskRaw > 0 ? r2(riskRaw) : Math.max(1, Math.round(positionValue * 0.01));

    const tagsCell = cell("tags");
    const tags = tagsCell
      ? tagsCell.split(/[;|,]/).map((t) => t.trim()).filter(Boolean)
      : [];

    const id = `T-${String(seq++).padStart(4, "0")}`;

    trades.push({
      id,
      accountId: account.id,
      symbol,
      assetClass,
      segment,
      exchange,
      direction,
      status: closed ? "Closed" : "Open",
      quantity,
      entryPrice,
      exitPrice: closed ? exitPrice : undefined,
      stopLoss: numCell("stopLoss"),
      target: numCell("target"),
      openedAt,
      closedAt: closed ? closedAt : undefined,
      holdingMinutes,
      grossPnl,
      charges,
      manualCharges: isManual,
      netPnl,
      taxablePnl,
      tax,
      riskAmount,
      rMultiple: closed ? computeRMultiple(netPnl, riskAmount) : undefined,
      positionValue,
      pctOfCapital: capital > 0 ? r2((positionValue / capital) * 100) : 0,
      strategy: cell("strategy") || "Imported",
      marketCondition: "Trending",
      timeframe: "15m",
      tags,
      emotionRating: 3,
      confidenceRating: 3,
      notes: cell("notes") || "Imported via CSV",
    });
  }

  if (trades.length === 0) throw new Error("No trade rows found in that file.");
  return trades;
}
