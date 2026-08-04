/** MTF sample seed — realistic Groww positions with REAL relative dates
 *  (spec §2.7: this module uses real `new Date()`, not the journal's
 *  synthetic datasetToday). Seeded once, then persisted. */

import { format, subDays } from "date-fns";
import type { MtfBroker, MtfPosition } from "./types";
import { buildCloseSnapshot } from "./calc";

export const SAMPLE_BROKERS: MtfBroker[] = [
  { id: "broker-groww", name: "Groww", dailyRatePct: 0.041 },
];

const day = (daysAgo: number) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd");

const base = {
  brokerId: "broker-groww",
  dailyRatePct: 0.041,
  interestBasis: "total" as const,
  fundedPercent: 100,
  status: "Open" as const,
};

export function generateSampleMtf(): MtfPosition[] {
  const positions: MtfPosition[] = [
    {
      ...base,
      id: "MTF-0001",
      stockName: "Reliance Industries",
      symbol: "RELIANCE",
      purchaseDate: day(12),
      quantity: 15,
      avgBuyPrice: 2905,
      totalInvestment: 15 * 2905,
      currentPrice: 2968,
      charges: { brokerage: 87.15, stt: 43.6, exchangeTxn: 15.1, gst: 18.4, sebi: 0.9, stampDuty: 6.5, dp: 15.93 },
      notes: "Post-results momentum; plan to exit near 3,050.",
    },
    {
      ...base,
      id: "MTF-0002",
      stockName: "Tata Motors",
      symbol: "TATAMOTORS",
      purchaseDate: day(38),
      quantity: 120,
      avgBuyPrice: 995,
      totalInvestment: 120 * 995,
      currentPrice: 1024,
      interestBasis: "funded",
      fundedPercent: 75, // broker funds 75% — interest on the borrowed leg only
      charges: { manualTotal: 186.45 },
      notes: "Funded 75% — demo of interest on the borrowed amount.",
    },
    {
      ...base,
      id: "MTF-0003",
      stockName: "HDFC Bank",
      symbol: "HDFCBANK",
      purchaseDate: day(6),
      quantity: 40,
      avgBuyPrice: 1652,
      totalInvestment: 40 * 1652,
      currentPrice: 1671,
      charges: { manualTotal: 142.3 },
    },
    {
      ...base,
      id: "MTF-0004",
      stockName: "Infosys",
      symbol: "INFY",
      purchaseDate: day(65),
      quantity: 55,
      avgBuyPrice: 1848,
      totalInvestment: 55 * 1848,
      currentPrice: 1856, // tiny gross gain — interest has eaten it (alert demo)
      charges: { manualTotal: 210.6 },
      notes: "Held too long — financing cost overtook the move.",
    },
    {
      ...base,
      id: "MTF-0005",
      stockName: "ITC",
      symbol: "ITC",
      // bought in TWO tranches — each lot accrues interest from its own date
      lots: [
        { id: "L1", date: day(25), quantity: 120, price: 435 },
        { id: "L2", date: day(11), quantity: 80, price: 442.5 },
      ],
      purchaseDate: day(25), // derived: earliest lot
      quantity: 200, // derived: Σ lot qty
      avgBuyPrice: 438, // derived: 87,600 / 200
      totalInvestment: 87600, // derived: 120×435 + 80×442.5
      currentPrice: 452,
      charges: { manualTotal: 128.75 },
      notes: "Added a second tranche on the dip — per-lot interest demo.",
    },
    {
      ...base,
      id: "MTF-0006",
      stockName: "Adani Enterprises",
      symbol: "ADANIENT",
      purchaseDate: day(92),
      quantity: 10,
      avgBuyPrice: 3210,
      totalInvestment: 10 * 3210,
      currentPrice: 3105, // gross loss + >90d hold — red health, stacked alerts
      charges: { manualTotal: 96.4 },
      notes: "Thesis broken — decide exit this week.",
    },
  ];

  // two closed positions with frozen snapshots (history / closed table demo)
  const sbin: MtfPosition = {
    ...base,
    id: "MTF-0007",
    stockName: "State Bank of India",
    symbol: "SBIN",
    purchaseDate: day(75),
    quantity: 100,
    avgBuyPrice: 812,
    totalInvestment: 100 * 812,
    charges: { manualTotal: 168.2 },
  };
  const wipro: MtfPosition = {
    ...base,
    id: "MTF-0008",
    stockName: "Wipro",
    symbol: "WIPRO",
    purchaseDate: day(50),
    quantity: 150,
    avgBuyPrice: 292,
    totalInvestment: 150 * 292,
    charges: { manualTotal: 94.6 },
  };
  positions.push(
    { ...sbin, ...buildCloseSnapshot(sbin, 847, day(30)) },
    { ...wipro, ...buildCloseSnapshot(wipro, 288, day(10)) },
  );

  return positions;
}
