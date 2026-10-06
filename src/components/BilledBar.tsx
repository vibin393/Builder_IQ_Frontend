import { money } from "@/components/ui";
import type { PurchaseOrder } from "@/types/api";

/** A thin bar: how much of a PO's commitment has become approved actual cost. */
export function BilledBar({ po, wide = false }: { po: PurchaseOrder; wide?: boolean }) {
  const pct = Math.min(100, po.percent_billed);
  return (
    <div className={wide ? "w-full" : "min-w-[7rem]"}>
      <div
        className={`${wide ? "h-2.5" : "h-1.5"} w-full overflow-hidden rounded-full`}
        style={{ background: "var(--neutral-soft)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--brand)" }}
        />
      </div>
      <div className="mt-1 text-xs tnum" style={{ color: "var(--fg-subtle)" }}>
        {money(po.billed_to_date)} billed · {po.percent_billed}%
      </div>
    </div>
  );
}
