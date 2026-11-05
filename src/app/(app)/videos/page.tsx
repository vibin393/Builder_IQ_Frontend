"use client";

import { Card, EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function VideosPage() {
  const docs = useAsync(() => api.listDocuments({}), []);
  const videos = (docs.data ?? []).filter((d) => (d.content_type || "").startsWith("video/"));

  return (
    <>
      <PageHeader title="Videos" subtitle="Walkthroughs and site video attached to homes and leads, from the document register." />
      {docs.error && <ErrorNote message={docs.error} />}
      {docs.loading ? (
        <Loading label="Loading videos" />
      ) : videos.length === 0 ? (
        <EmptyState title="No videos yet" hint="Video files attached to a home or lead appear here." />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {videos.map((v) => (
            <Card key={v.id}>
              {/^https?:\/\//.test(v.storage_key) ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={v.storage_key} controls style={{ width: "100%", borderRadius: 8, background: "#000" }} />
              ) : (
                <div style={{ aspectRatio: "16/9", background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 28 }}>🎬</span>
                </div>
              )}
              <div className="mt-2 truncate text-sm font-medium">{v.name}</div>
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{v.content_type}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
