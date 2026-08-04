/** MTF Interest Tracker — overview dashboard (route /mtf, spec §7.1).
 *  Standard page pattern: store positions/brokers + useAsOfToday + memoized
 *  computePortfolio. All math comes from @/lib/mtf/calc — never re-derived. */

import { useMemo, useState } from "react";
import { Download, Percent, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { computePortfolio } from "@/lib/mtf/calc";
import { downloadMtfCsv, printMtfReport } from "@/lib/mtf/exportMtf";
import type { MtfPosition } from "@/lib/mtf/types";
import { toast } from "@/store/toast";
import { useAsOfToday, useMtfStore } from "@/store/useMtfStore";
import { AlertsPanel } from "./mtf/AlertsPanel";
import { ClosePositionModal } from "./mtf/ClosePositionModal";
import { DEFAULT_MTF_FILTERS, FilterSortBar, applyFilterSort } from "./mtf/FilterSortBar";
import type { MtfFilterState } from "./mtf/FilterSortBar";
import { LiveInterestMeter } from "./mtf/LiveInterestMeter";
import { PortfolioAnalytics } from "./mtf/PortfolioAnalytics";
import { PositionFormModal } from "./mtf/PositionFormModal";
import { PositionsTable } from "./mtf/PositionsTable";
import { StatGrid } from "./mtf/StatGrid";
import { CapitalAllocationChart } from "./mtf/charts/CapitalAllocationChart";
import { HoldingDurationChart } from "./mtf/charts/HoldingDurationChart";
import { InterestDistributionChart } from "./mtf/charts/InterestDistributionChart";
import { LiveOpenInterestChart } from "./mtf/charts/LiveOpenInterestChart";
import { NetProfitTrendChart } from "./mtf/charts/NetProfitTrendChart";
import { PortfolioInterestTrendChart } from "./mtf/charts/PortfolioInterestTrendChart";
import { ProfitVsInterestChart } from "./mtf/charts/ProfitVsInterestChart";
import { TopInterestStocksChart } from "./mtf/charts/TopInterestStocksChart";

export default function Mtf() {
  const positions = useMtfStore((s) => s.positions);
  const brokers = useMtfStore((s) => s.brokers);
  const duplicatePosition = useMtfStore((s) => s.duplicatePosition);
  const deletePosition = useMtfStore((s) => s.deletePosition);
  const accountValue = useMtfStore((s) => s.accountValue);
  const setAccountValue = useMtfStore((s) => s.setAccountValue);
  const asOf = useAsOfToday();

  const stats = useMemo(() => computePortfolio(positions, brokers, asOf), [positions, brokers, asOf]);
  const allComputed = useMemo(() => [...stats.open, ...stats.closed], [stats]);

  const [filters, setFilters] = useState<MtfFilterState>(DEFAULT_MTF_FILTERS);
  const filtered = useMemo(() => applyFilterSort(allComputed, filters), [allComputed, filters]);
  const openRows = useMemo(() => filtered.filter((c) => !c.isClosed), [filtered]);
  const closedRows = useMemo(() => filtered.filter((c) => c.isClosed), [filtered]);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<MtfPosition | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<MtfPosition | null>(null);

  const openAdd = () => {
    setFormInitial(null);
    setFormOpen(true);
  };
  const handleEdit = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    setFormInitial(pos);
    setFormOpen(true);
  };
  const handleClosePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    setCloseTarget(pos);
    setCloseOpen(true);
  };
  const handleDuplicate = (id: string) => {
    duplicatePosition(id);
    toast("Position duplicated");
  };
  const handleDelete = (id: string) => {
    deletePosition(id);
    toast("Position deleted");
  };
  const handleExport = () => {
    if (filtered.length === 0) {
      toast("Nothing to export", "info");
      return;
    }
    downloadMtfCsv(filtered);
    toast("CSV exported");
  };
  const handlePrint = () => {
    if (printMtfReport(stats)) toast("Print report opened");
    else toast("Popup blocked — allow popups to print the report", "error");
  };

  return (
    <>
      <PageHeader
        title="MTF Interest Tracker"
        description="Real profitability of your margin positions after daily interest, charges & break-even."
        actions={
          <>
            <Button icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
            <Button icon={Printer} onClick={handlePrint}>
              Print / PDF
            </Button>
            <Button variant="primary" icon={Plus} onClick={openAdd}>
              Add Position
            </Button>
          </>
        }
      />

      {positions.length === 0 ? (
        <Card className="animate-in">
          <EmptyState
            icon={Percent}
            title="No MTF positions yet"
            hint="Add your first margin position to start tracking daily interest and break-even."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add Position
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="animate-in space-y-4">
          <LiveInterestMeter stats={stats} />

          <StatGrid stats={stats} />

          <AlertsPanel computed={stats.open} />

          <FilterSortBar value={filters} onChange={setFilters} brokers={brokers} />

          <PositionsTable
            rows={openRows}
            variant="open"
            onEdit={handleEdit}
            onClosePosition={handleClosePosition}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />

          <PortfolioAnalytics stats={stats} />

          <div className="grid gap-4 md:grid-cols-2">
            <PortfolioInterestTrendChart computed={allComputed} />
            <LiveOpenInterestChart
              computed={allComputed}
              accountValue={accountValue}
              onAccountValueChange={setAccountValue}
            />
            <TopInterestStocksChart computed={stats.open} />
            <InterestDistributionChart computed={stats.open} />
            <CapitalAllocationChart computed={stats.open} />
            <ProfitVsInterestChart computed={stats.open} />
            <NetProfitTrendChart computed={allComputed} />
            <HoldingDurationChart computed={stats.open} />
          </div>

          {closedRows.length > 0 && (
            <Card
              title="Closed positions"
              subtitle={`${closedRows.length} position${closedRows.length === 1 ? "" : "s"} · frozen final snapshots`}
            >
              <PositionsTable
                rows={closedRows}
                variant="closed"
                onEdit={handleEdit}
                onClosePosition={handleClosePosition}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </Card>
          )}
        </div>
      )}

      <PositionFormModal open={formOpen} initial={formInitial} onClose={() => setFormOpen(false)} />
      <ClosePositionModal open={closeOpen} position={closeTarget} onClose={() => setCloseOpen(false)} />
    </>
  );
}
