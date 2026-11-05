"use client";

/**
 * The unified directory.
 *
 * BuilderIQ already held every contact — internal users, subcontractors,
 * customers and realtors — but on four separate screens, so finding a person
 * meant first knowing which kind they were. This is the one place to search all
 * of them at once. It is read-only: each kind is still edited on its own screen.
 */

import { useMemo, useState } from "react";

import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Loading,
  PageHeader,
  StatTile,
  Tabs,
  Tone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { DirectoryContact, DirectoryContactType } from "@/types/api";

type Filter = "all" | DirectoryContactType;

const FILTERS: readonly Filter[] = ["all", "customer", "trade", "team", "realtor"] as const;

const LABELS: Record<Filter, string> = {
  all: "All contacts",
  customer: "Customers",
  trade: "Trades & vendors",
  team: "Internal users",
  realtor: "Realtors",
};

const TYPE_LABEL: Record<DirectoryContactType, string> = {
  customer: "Customer",
  trade: "Trade",
  team: "Team",
  realtor: "Realtor",
};

function typeTone(t: DirectoryContactType): Tone {
  switch (t) {
    case "customer":
      return "brand";
    case "trade":
      return "warn";
    case "team":
      return "ok";
    case "realtor":
      return "neutral";
  }
}

export default function DirectoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const summary = useAsync(() => api.directorySummary(), []);
  const rows = useAsync(
    () =>
      api.listDirectory({
        type: filter === "all" ? undefined : filter,
        search: search.trim() || undefined,
      }),
    [filter, search],
  );

  const counts = useMemo(() => {
    const s = summary.data;
    if (!s) return undefined;
    return {
      customer: s.customers,
      trade: s.trades,
      team: s.team,
      realtor: s.realtors,
    } as Partial<Record<Filter, number>>;
  }, [summary.data]);

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Directory"
        subtitle="Every contact the business holds — customers, trades, internal users and realtors — in one searchable place."
        action={
          <input
            className="input w-auto max-w-[18rem]"
            placeholder="Search name, company or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search contacts"
          />
        }
      />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="All contacts" value={s.total} />
          <StatTile label="Customers" value={s.customers} />
          <StatTile label="Trades & vendors" value={s.trades} />
          <StatTile label="Internal users" value={s.team} />
          <StatTile label="Realtors" value={s.realtors} />
        </div>
      )}

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} counts={counts} />

      <Card padded={false}>
        {rows.loading ? (
          <Loading />
        ) : rows.error ? (
          <div className="p-5">
            <ErrorNote message={rows.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Name" },
              { key: "type", label: "Type" },
              { key: "status", label: "Status" },
              { key: "company", label: "Company / trade" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "detail", label: "Detail" },
            ]}
            empty={search ? `No contacts match “${search}”.` : "No contacts yet."}
          >
            {(rows.data ?? []).map((c: DirectoryContact) => (
              <tr key={`${c.type}-${c.id}`}>
                <td>
                  <div className="font-medium">{c.name}</div>
                  {c.code && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {c.code}
                    </div>
                  )}
                </td>
                <td>
                  <Badge tone={typeTone(c.type)}>{TYPE_LABEL[c.type]}</Badge>
                </td>
                <td>
                  {c.status ? (
                    <Badge tone={c.status === "active" ? "ok" : c.status === "inactive" ? "neutral" : "warn"}>{c.status}</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-sm">{c.company ?? "—"}</td>
                <td className="text-sm">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} style={{ color: "var(--brand)" }}>
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-sm">
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} style={{ color: "var(--fg)" }}>
                      {c.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {c.detail ?? "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
