"use client";

import { Card, ErrorNote, Loading, PageHeader, day } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function MyUpdatesPage() {
  const updates = useAsync(() => api.homeownerUpdates(), []);

  if (updates.loading) return <Loading label="Loading updates" />;
  if (updates.error) return <ErrorNote message={updates.error} />;

  const rows = updates.data ?? [];

  return (
    <>
      <PageHeader title="Updates" subtitle="News and progress your builder has posted about your home." />

      {rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            No updates have been posted yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((u) => (
            <Card key={u.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold">{u.title}</h3>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--fg-subtle)" }}>
                  {day(u.posted_on)}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--fg-muted)" }}>
                {u.body}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
