import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  BellRing,
  Bitcoin,
  CandlestickChart,
  Gem,
  Layers,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { AssetClass, WatchlistItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate, formatMoney } from "@/lib/format";

const ASSET_ICONS: Record<AssetClass, LucideIcon> = {
  Equity: CandlestickChart,
  Options: Layers,
  Futures: TrendingUp,
  Forex: Banknote,
  Crypto: Bitcoin,
  Commodity: Gem,
};

interface WatchItemCardProps {
  item: WatchlistItem;
  onPlanTrade: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** One watchlist symbol: identity, planned setup, alert level, note, actions. */
export function WatchItemCard({ item, onPlanTrade, onEdit, onRemove }: WatchItemCardProps) {
  const Icon = ASSET_ICONS[item.assetClass];
  const note = item.note.trim();

  return (
    <Card className="flex h-full flex-col transition-transform duration-150 hover:-translate-y-0.5" bodyClassName="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-raised">
            <Icon size={16} className="text-muted" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[15px] font-semibold tracking-tight text-ink" title={item.symbol}>
              {item.symbol}
            </p>
            <div className="mt-1">
              <Badge tone="neutral">{item.assetClass}</Badge>
            </div>
          </div>
        </div>
        <Badge tone="accent" className="shrink-0">
          {item.plannedSetup}
        </Badge>
      </div>

      {item.alertPrice !== undefined && (
        <div className="mt-3">
          <Badge tone="info">
            <BellRing size={11} aria-hidden />
            Alert @ {formatMoney(item.alertPrice, { decimals: !Number.isInteger(item.alertPrice) })}
          </Badge>
        </div>
      )}

      {note ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{note}</p>
      ) : (
        <p className="mt-3 text-[12.5px] italic text-faint">No note yet — add levels or a catalyst.</p>
      )}

      <footer className="-mx-5 -mb-5 mt-auto flex items-center justify-between gap-2 border-t border-edge-soft px-5 py-2.5 pt-3">
        <span className="text-[11px] text-faint">Added {formatDate(item.addedAt)}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={ArrowUpRight} onClick={onPlanTrade}>
            Plan trade
          </Button>
          <IconAction label={`Edit ${item.symbol}`} icon={Pencil} onClick={onEdit} />
          <IconAction label={`Remove ${item.symbol} from watchlist`} icon={Trash2} onClick={onRemove} danger />
        </div>
      </footer>
    </Card>
  );
}

interface IconActionProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

function IconAction({ label, icon: Icon, onClick, danger = false }: IconActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        danger ? "hover:text-loss" : "hover:text-ink"
      }`}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
