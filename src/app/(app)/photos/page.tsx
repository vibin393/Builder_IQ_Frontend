"use client";

import { Card, EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function PhotosPage() {
  const docs = useAsync(() => api.listDocuments({}), []);
  const photos = (docs.data ?? []).filter((d) => (d.content_type || "").startsWith("image/"));

  return (
    <>
      <PageHeader title="Photos" subtitle="Site and progress photography across every home, pulled from the document register." />
      {docs.error && <ErrorNote message={docs.error} />}
      {docs.loading ? (
        <Loading label="Loading photos" />
      ) : photos.length === 0 ? (
        <EmptyState title="No photos yet" hint="Image files attached to a home or lead appear here as a gallery." />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {photos.map((p) => (
            <Card key={p.id}>
              <div
                style={{ aspectRatio: "4/3", background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
              >
                {/^https?:\/\//.test(p.storage_key) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.storage_key} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 28 }}>🖼️</span>
                )}
              </div>
              <div className="mt-2 truncate text-sm font-medium">{p.name}</div>
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{p.content_type}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
