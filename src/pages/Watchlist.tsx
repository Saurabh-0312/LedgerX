import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Eye, Plus } from "lucide-react";
import type { WatchlistItem } from "@/types";
import { useStore } from "@/store/useStore";
import { datasetToday } from "@/store/useFilteredTrades";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { WatchItemCard } from "@/pages/watchlist/WatchItemCard";
import { WatchItemModal, type WatchFormValues } from "@/pages/watchlist/WatchItemModal";

/** Generic setups offered alongside the strategy names found in the trade log. */
const GENERIC_SETUPS = [
  "Breakout",
  "Momentum",
  "Mean Reversion",
  "Trend Pullback",
  "Range Fade",
  "Reversal",
  "Earnings Play",
] as const;

/** Next sequential watchlist id, matching the dataset's "W-01" style. */
function nextWatchId(watchlist: WatchlistItem[]): string {
  const max = watchlist.reduce((m, w) => {
    const n = Number(w.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `W-${String(max + 1).padStart(2, "0")}`;
}

export default function Watchlist() {
  const watchlist = useStore((s) => s.watchlist);
  const trades = useStore((s) => s.trades);
  const addWatchItem = useStore((s) => s.addWatchItem);
  const updateWatchItem = useStore((s) => s.updateWatchItem);
  const removeWatchItem = useStore((s) => s.removeWatchItem);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WatchlistItem | null>(null);

  /** Setup choices: strategies actually traded + generic plays + any legacy watchlist values. */
  const setupOptions = useMemo(() => {
    const set = new Set<string>(GENERIC_SETUPS);
    for (const t of trades) if (t.strategy) set.add(t.strategy);
    for (const w of watchlist) if (w.plannedSetup) set.add(w.plannedSetup);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [trades, watchlist]);

  /** Newest additions first. */
  const items = useMemo(
    () =>
      [...watchlist].sort(
        (a, b) => b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id),
      ),
    [watchlist],
  );

  const alertCount = useMemo(
    () => watchlist.filter((w) => w.alertPrice !== undefined).length,
    [watchlist],
  );

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: WatchlistItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = (values: WatchFormValues) => {
    if (editing) {
      updateWatchItem(editing.id, {
        symbol: values.symbol,
        assetClass: values.assetClass,
        plannedSetup: values.plannedSetup,
        alertPrice: values.alertPrice,
        note: values.note,
      });
      toast(`${values.symbol} updated`);
    } else {
      addWatchItem({
        id: nextWatchId(watchlist),
        symbol: values.symbol,
        assetClass: values.assetClass,
        plannedSetup: values.plannedSetup,
        alertPrice: values.alertPrice,
        note: values.note,
        addedAt: format(datasetToday(trades), "yyyy-MM-dd"),
      });
      toast(`${values.symbol} added to watchlist`);
    }
    closeModal();
  };

  const handleRemove = (item: WatchlistItem) => {
    removeWatchItem(item.id);
    toast(`${item.symbol} removed from watchlist`, "info");
  };

  return (
    <>
      <PageHeader
        title="Watchlist"
        description={
          watchlist.length > 0
            ? `${watchlist.length} symbol${watchlist.length === 1 ? "" : "s"} under observation · ${alertCount} with price alerts`
            : "Track setups before you commit capital."
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={openAdd}>
            Add symbol
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card className="animate-in">
          <EmptyState
            icon={Eye}
            title="Nothing on the radar"
            hint="Add a symbol you're stalking — note the setup, the level, and wait for it to come to you."
            action={
              <Button variant="primary" icon={Plus} onClick={openAdd}>
                Add symbol
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="animate-in grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <WatchItemCard
              key={item.id}
              item={item}
              onPlanTrade={() => navigate("/trades/new")}
              onEdit={() => openEdit(item)}
              onRemove={() => handleRemove(item)}
            />
          ))}
        </div>
      )}

      <WatchItemModal
        open={modalOpen}
        initial={editing}
        setupOptions={setupOptions}
        onClose={closeModal}
        onSave={handleSave}
      />
    </>
  );
}
