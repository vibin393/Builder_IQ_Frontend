"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorNote, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Job, Lead, Lot } from "@/types/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEAFLET_VERSION = "1.9.4";

// Free base layers (no API key). Terrain = OpenTopoMap, Satellite = Esri World Imagery.
const TILES: Record<string, { url: string; attr: string }> = {
  street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "&copy; OpenStreetMap contributors" },
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "&copy; OpenTopoMap (CC-BY-SA)" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "&copy; Esri" },
};

// Load Leaflet (CSS + JS) from the CDN once, resolving when window.L is ready.
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    // SRI hashes below pin Leaflet 1.9.4 (cdnjs minified build). If
    // LEAFLET_VERSION changes, regenerate both from the cdnjs SRI metadata.
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${LEAFLET_VERSION}/leaflet.min.css`;
    css.integrity = "sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==";
    css.crossOrigin = "anonymous";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${LEAFLET_VERSION}/leaflet.min.js`;
    js.async = true;
    js.integrity = "sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==";
    js.crossOrigin = "anonymous";
    js.onload = () => resolve((window as any).L);
    js.onerror = () => reject(new Error("Could not load the map library."));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

type Pin = {
  kind: "home" | "lead";
  id: string;
  lat: number;
  lng: number;
  title: string;
  sub: string;
  status: string;
  href: string;
};

function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export default function MapPage() {
  const [layer, setLayer] = useState<"all" | "home" | "lead">("all");
  const [base, setBase] = useState<"street" | "terrain" | "satellite">("street");
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const layerGroups = useRef<{ home: any; lead: any } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const communities = useAsync(() => api.listCommunities(), []);
  const jobs = useAsync(() => api.listJobs({ size: 200 } as any).then((p) => p.items), []);
  const leads = useAsync(() => api.listLeads({ size: 200 } as any).then((p) => p.items), []);

  // Plots across every development (each carries the geocoded position).
  const lots = useAsync(async () => {
    const comms = await api.listCommunities();
    const all = await Promise.all(comms.map((c) => api.listLots(c.id).catch(() => [] as Lot[])));
    return all.flat();
  }, []);

  const pins = useMemo<Pin[]>(() => {
    const out: Pin[] = [];
    const jobByLot = new Map<string, Job>();
    (jobs.data ?? []).forEach((j) => jobByLot.set(j.lot_id, j));
    (lots.data ?? []).forEach((lot) => {
      if (lot.latitude == null || lot.longitude == null) return;
      const j = jobByLot.get(lot.id);
      if (!j) return; // only plots that are live homes
      out.push({
        kind: "home",
        id: j.id,
        lat: Number(lot.latitude),
        lng: Number(lot.longitude),
        title: j.elevation || `Home ${j.job_number}`,
        sub: lot.address || "",
        status: j.status,
        href: `/jobs/${j.id}`,
      });
    });
    (leads.data ?? []).forEach((l: Lead) => {
      if (l.latitude == null || l.longitude == null) return;
      out.push({
        kind: "lead",
        id: l.id,
        lat: Number(l.latitude),
        lng: Number(l.longitude),
        title: l.full_name,
        sub: [l.city, l.project_type].filter(Boolean).join(" · "),
        status: l.status,
        href: `/leads/${l.id}`,
      });
    });
    return out;
  }, [jobs.data, lots.data, leads.data]);

  const loading = communities.loading || jobs.loading || leads.loading || lots.loading;
  const homeCount = pins.filter((p) => p.kind === "home").length;
  const leadCount = pins.filter((p) => p.kind === "lead").length;

  // Build the map once the data and the library are both ready.
  useEffect(() => {
    if (loading || !mapEl.current) return;
    let disposed = false;
    loadLeaflet()
      .then((L) => {
        if (disposed || !mapEl.current) return;
        if (!mapRef.current) {
          mapRef.current = L.map(mapEl.current, { scrollWheelZoom: true }).setView([32.9, -117.1], 9);
          tileRef.current = L.tileLayer(TILES[base].url, { maxZoom: 19, attribution: TILES[base].attr }).addTo(mapRef.current);
          layerGroups.current = { home: L.layerGroup().addTo(mapRef.current), lead: L.layerGroup().addTo(mapRef.current) };
        }
        const groups = layerGroups.current!;
        groups.home.clearLayers();
        groups.lead.clearLayers();
        const color = (k: string) => (k === "home" ? "#2563eb" : "#d97706");
        const bounds: [number, number][] = [];
        pins.forEach((p) => {
          const icon = L.divIcon({
            className: "",
            html: `<span style="display:block;width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color(p.kind)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 16],
          });
          const m = L.marker([p.lat, p.lng], { icon });
          m.bindPopup(
            `<div style="min-width:160px"><strong>${esc(p.title)}</strong><br>${esc(p.sub)}<br>` +
              `<span style="text-transform:capitalize;color:#666">${esc(p.status)}</span><br>` +
              `<a href="${p.href}" style="color:#2563eb;font-weight:600">Open ${p.kind === "home" ? "home" : "lead"} →</a></div>`,
          );
          groups[p.kind].addLayer(m);
          bounds.push([p.lat, p.lng]);
        });
        if (bounds.length) mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      })
      .catch((e) => setMapError(e instanceof Error ? e.message : "Map failed to load"));
    return () => {
      disposed = true;
    };
  }, [loading, pins]);

  // Toggle which marker groups are shown.
  useEffect(() => {
    const groups = layerGroups.current;
    const map = mapRef.current;
    if (!groups || !map) return;
    [["home", groups.home], ["lead", groups.lead]].forEach(([k, g]: any) => {
      const show = layer === "all" || layer === k;
      if (show && !map.hasLayer(g)) map.addLayer(g);
      if (!show && map.hasLayer(g)) map.removeLayer(g);
    });
  }, [layer]);

  // Swap the base map layer (street / terrain / satellite).
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[base].url, { maxZoom: 19, attribution: TILES[base].attr }).addTo(map);
    if (tileRef.current.bringToBack) tileRef.current.bringToBack();
  }, [base]);

  const err = communities.error || jobs.error || leads.error || lots.error || mapError;

  return (
    <>
      <PageHeader
        title="Map"
        subtitle="Every home and active lead across the region, plotted from its address."
      />
      {err && <ErrorNote message={err} />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          ["all", `All (${pins.length})`],
          ["home", `Homes (${homeCount})`],
          ["lead", `Leads (${leadCount})`],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setLayer(v)}
            className="btn btn-sm"
            style={
              layer === v
                ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 }
                : { background: "var(--surface-2)", color: "var(--fg-muted)" }
            }
          >
            {label}
          </button>
        ))}
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#2563eb", display: "inline-block" }} /> Homes{" "}
          <span style={{ width: 10, height: 10, borderRadius: 9999, background: "#d97706", display: "inline-block", marginLeft: 8 }} /> Leads
        </span>
        <span className="ml-auto inline-flex gap-1">
          {(["street", "terrain", "satellite"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBase(b)}
              className="btn btn-sm"
              style={
                base === b
                  ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600, textTransform: "capitalize" }
                  : { background: "var(--surface-2)", color: "var(--fg-muted)", textTransform: "capitalize" }
              }
            >
              {b}
            </button>
          ))}
        </span>
      </div>
      {loading ? (
        <Loading label="Loading map" />
      ) : (
        <div
          ref={mapEl}
          style={{ height: "70vh", width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", zIndex: 0 }}
        />
      )}
    </>
  );
}
