"use client";

/**
 * Time clock & employee locator.
 *
 * Two layers the old labour screen could not show. "On the clock" is presence —
 * who is clocked in right now, and where they were when they clocked in. The map
 * plots those locations. Shifts are the history, each with a running or closed
 * duration, approvable the same way a timecard is. Hours still flow to job cost
 * through timecards; this is attendance, not payroll.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  Tabs,
  Tone,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { CostCode, Job, Shift, ShiftMapPoint } from "@/types/api";

type Tab = "shifts" | "on_the_clock" | "map";
const TABS: readonly Tab[] = ["on_the_clock", "shifts", "map"] as const;
const TAB_LABEL: Record<Tab, string> = {
  on_the_clock: "On the clock",
  shifts: "Shifts",
  map: "Map",
};

function statusToneFor(s: Shift["status"]): Tone {
  return s === "active" ? "brand" : s === "completed" ? "ok" : "danger";
}
function oobTone(s: string): Tone {
  return s === "out_of_bounds" ? "danger" : s === "in_bounds" ? "ok" : "neutral";
}
function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function mins(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* ---- the locator map (Leaflet from CDN, with a pin-list fallback) ---- */
function LocatorMap({ points }: { points: ShiftMapPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Load Leaflet once from CDN.
  useEffect(() => {
    let cancelled = false;
    const L = (window as unknown as { L?: unknown }).L;
    if (L) {
      setReady(true);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";
    css.crossOrigin = "anonymous";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.integrity = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";
    script.crossOrigin = "anonymous";
    script.onload = () => !cancelled && setReady(true);
    script.onerror = () => !cancelled && setFailed(true);
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, []);

  // Render / update markers.
  useEffect(() => {
    if (!ready || !ref.current) return;
    const L = (window as unknown as { L?: any }).L;
    if (!L) return;
    const pts = points.filter((p) => p.lat && p.lng);
    if (!mapRef.current) {
      const center = pts.length ? [Number(pts[0].lat), Number(pts[0].lng)] : [39.5, -98.35];
      mapRef.current = L.map(ref.current).setView(center, pts.length ? 12 : 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapRef.current);
    }
    const map = mapRef.current as any;
    map._iqMarkers?.forEach((m: any) => map.removeLayer(m));
    map._iqMarkers = [];
    const latlngs: [number, number][] = [];
    pts.forEach((p) => {
      const ll: [number, number] = [Number(p.lat), Number(p.lng)];
      latlngs.push(ll);
      const marker = L.marker(ll).addTo(map);
      marker.bindPopup(
        `<strong>${p.worker_name}</strong><br>Clocked in ${fmtTime(p.clock_in_at)}` +
          (p.out_of_bounds === "out_of_bounds" ? "<br>⚠ Out of bounds" : ""),
      );
      map._iqMarkers.push(marker);
    });
    if (latlngs.length) map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 15 });
    setTimeout(() => map.invalidateSize(), 50);
  }, [ready, points]);

  if (failed) {
    return (
      <div className="p-5">
        <ErrorNote message="Map tiles could not be loaded. Locations are listed below instead." />
        <PinList points={points} />
      </div>
    );
  }

  return (
    <div>
      <div
        ref={ref}
        style={{ height: 420, width: "100%", borderRadius: 12, overflow: "hidden", background: "var(--neutral-soft)" }}
      />
      {!ready && (
        <p className="p-3 text-sm" style={{ color: "var(--fg-subtle)" }}>
          Loading map…
        </p>
      )}
      <PinList points={points} />
    </div>
  );
}

function PinList({ points }: { points: ShiftMapPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {points.map((p) => (
        <div key={p.id} className="card p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{p.worker_name}</span>
            {p.out_of_bounds !== "unknown" && (
              <Badge tone={oobTone(p.out_of_bounds)}>{p.out_of_bounds.replaceAll("_", " ")}</Badge>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
            Clocked in {fmtTime(p.clock_in_at)}
          </p>
          <a
            href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs"
            style={{ color: "var(--brand)" }}
          >
            {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)} ↗
          </a>
        </div>
      ))}
    </div>
  );
}

export default function TimeClockPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const jobs = useAsync(() => api.jobOptions(), []);
  const costCodes = useAsync(() => api.listCostCodes(), []);
  const [jobId, setJobId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("on_the_clock");

  useEffect(() => {
    if (!jobId && jobs.data?.length) setJobId(jobs.data[0].id);
  }, [jobs.data, jobId]);

  const jobParam = jobId || undefined;
  const summary = useAsync(() => api.timeClockSummary(jobParam), [jobId]);
  const active = useAsync(() => api.onTheClock(jobParam), [jobId]);
  const shifts = useAsync(() => api.listShifts({ job_id: jobParam, size: 100 }), [jobId]);
  const mapPts = useAsync(
    () => (tab === "map" ? api.shiftMap(jobParam) : Promise.resolve([] as ShiftMapPoint[])),
    [jobId, tab],
  );

  const reloadAll = useCallback(() => {
    summary.reload();
    active.reload();
    shifts.reload();
    mapPts.reload();
  }, [summary, active, shifts, mapPts]);

  const ccById = byId(costCodes.data);

  // ---- clock-in modal ----
  const [clockOpen, setClockOpen] = useState(false);
  const [worker, setWorker] = useState("");
  const [shiftType, setShiftType] = useState("regular");
  const [costCodeId, setCostCodeId] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("Location unavailable", "This device has no geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location captured");
      },
      () => toast.error("Location denied", "Permission was not granted."),
    );
  }

  async function doClockIn() {
    if (!jobId) return;
    if (!worker.trim()) {
      toast.error("A worker name is required.");
      return;
    }
    setBusy(true);
    try {
      await api.clockIn({
        job_id: jobId,
        worker_name: worker.trim(),
        shift_type: shiftType,
        cost_code_id: costCodeId || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        out_of_bounds: coords ? "in_bounds" : "unknown",
      });
      toast.success("Clocked in", `${worker.trim()} is now on the clock.`);
      setClockOpen(false);
      setWorker("");
      setCostCodeId("");
      setCoords(null);
      reloadAll();
    } catch (err) {
      toast.error("Could not clock in", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function clockOut(s: Shift) {
    try {
      await api.clockOut(s.id);
      toast.success("Clocked out", `${s.worker_name} — ${mins(s.duration_minutes)}.`);
      reloadAll();
    } catch (err) {
      toast.error("Could not clock out", err instanceof Error ? err.message : undefined);
    }
  }

  async function approve(s: Shift) {
    try {
      await api.approveShift(s.id);
      toast.success("Shift approved");
      reloadAll();
    } catch (err) {
      toast.error("Could not approve", err instanceof Error ? err.message : undefined);
    }
  }

  function removeShift(s: Shift) {
    confirm({
      title: "Delete shift?",
      body: `${s.worker_name}'s shift will be permanently removed.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.deleteShift(s.id);
          toast.success("Shift deleted");
          reloadAll();
        } catch (err) {
          toast.error("Could not delete", err instanceof Error ? err.message : undefined);
        }
      },
    });
  }

  const s = summary.data;
  const counts = s ? ({ on_the_clock: s.on_the_clock } as Partial<Record<Tab, number>>) : undefined;

  return (
    <div>
      <PageHeader
        title="Time clock"
        subtitle="Clock employees in and out, see who is on site right now, and locate them on the map. Hours still flow to job cost through timecards."
        action={
          <div className="flex items-center gap-2">
            <select
              className="input w-auto max-w-[16rem]"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              aria-label="Home"
            >
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {jobLabel(j)}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!jobId} onClick={() => setClockOpen(true)}>
              Clock in
            </button>
          </div>
        }
      />

      {jobs.error && <ErrorNote message={jobs.error} />}

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="On the clock" value={s.on_the_clock} tone={s.on_the_clock ? "ok" : "default"} />
          <StatTile label="Workers today" value={s.workers_today} />
          <StatTile label="Hours today" value={Number(s.hours_today).toFixed(1)} />
          <StatTile label="Pending approval" value={s.pending_approval} tone={s.pending_approval ? "warn" : "default"} />
          <StatTile label="Out of bounds" value={s.out_of_bounds} tone={s.out_of_bounds ? "danger" : "default"} />
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} counts={counts} />

      {/* ON THE CLOCK */}
      {tab === "on_the_clock" && (
        <Card padded={false}>
          {active.loading ? (
            <Loading />
          ) : active.error ? (
            <div className="p-5"><ErrorNote message={active.error} /></div>
          ) : (active.data ?? []).length === 0 ? (
            <EmptyState title="Nobody is on the clock" hint="Clock a worker in to start tracking a shift." />
          ) : (
            <DataTable
              columns={[
                { key: "w", label: "Worker" },
                { key: "since", label: "Since" },
                { key: "dur", label: "Duration" },
                { key: "loc", label: "Location" },
                { key: "cc", label: "Cost code" },
                { key: "act", label: "" },
              ]}
            >
              {(active.data ?? []).map((sh) => (
                <tr key={sh.id}>
                  <td className="font-medium">{sh.worker_name}</td>
                  <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{fmtTime(sh.clock_in_at)}</td>
                  <td className="tnum">{mins(sh.duration_minutes)}</td>
                  <td>
                    {sh.clock_in_lat ? (
                      <Badge tone={oobTone(sh.out_of_bounds)}>
                        {sh.out_of_bounds === "unknown" ? "located" : sh.out_of_bounds.replaceAll("_", " ")}
                      </Badge>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>no location</span>
                    )}
                  </td>
                  <td className="text-sm">{sh.cost_code_id ? ccById.get(sh.cost_code_id)?.code ?? "—" : "—"}</td>
                  <td className="num">
                    <button className="btn btn-sm btn-primary" onClick={() => clockOut(sh)}>
                      Clock out
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {/* SHIFTS */}
      {tab === "shifts" && (
        <Card padded={false}>
          {shifts.loading ? (
            <Loading />
          ) : shifts.error ? (
            <div className="p-5"><ErrorNote message={shifts.error} /></div>
          ) : (
            <DataTable
              columns={[
                { key: "w", label: "Worker" },
                { key: "st", label: "Status" },
                { key: "in", label: "Clock in" },
                { key: "out", label: "Clock out" },
                { key: "hrs", label: "Hours", align: "right" },
                { key: "type", label: "Type" },
                { key: "appr", label: "Approval" },
                { key: "act", label: "" },
              ]}
              empty="No shifts for this home yet."
            >
              {(shifts.data?.items ?? []).map((sh) => (
                <tr key={sh.id}>
                  <td className="font-medium">{sh.worker_name}</td>
                  <td><Badge tone={statusToneFor(sh.status)}>{sh.status}</Badge></td>
                  <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{fmtTime(sh.clock_in_at)}</td>
                  <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{fmtTime(sh.clock_out_at)}</td>
                  <td className="num tnum">{Number(sh.total_hours).toFixed(2)}</td>
                  <td className="text-sm">{sh.shift_type}</td>
                  <td>
                    {sh.is_approved ? (
                      <Badge tone="ok">approved</Badge>
                    ) : sh.status === "completed" ? (
                      <Badge tone="warn">pending</Badge>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>—</span>
                    )}
                  </td>
                  <td className="num">
                    <div className="flex justify-end gap-1.5">
                      {sh.status === "active" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => clockOut(sh)}>Clock out</button>
                      )}
                      {sh.status === "completed" && !sh.is_approved && (
                        <button className="btn btn-sm btn-primary" onClick={() => approve(sh)}>Approve</button>
                      )}
                      {!sh.is_approved && (
                        <button className="btn btn-sm btn-ghost" onClick={() => removeShift(sh)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {/* MAP */}
      {tab === "map" && (
        <Card padded={false}>
          {mapPts.loading ? (
            <Loading variant="text" label="Loading locations" />
          ) : mapPts.error ? (
            <div className="p-5"><ErrorNote message={mapPts.error} /></div>
          ) : (mapPts.data ?? []).length === 0 ? (
            <EmptyState
              title="No located workers"
              hint="Workers appear here once they clock in with location sharing on."
            />
          ) : (
            <div className="p-4">
              <LocatorMap points={mapPts.data ?? []} />
            </div>
          )}
        </Card>
      )}

      {/* Clock-in modal */}
      <Modal open={clockOpen} title="Clock in" onClose={() => setClockOpen(false)}>
        <div className="space-y-3">
          <Field label="Worker">
            <input className="input" value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Shift type">
            <select className="input" value={shiftType} onChange={(e) => setShiftType(e.target.value)}>
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="break">Break</option>
              <option value="pto">PTO</option>
            </select>
          </Field>
          <Field label="Cost code" hint="Optional.">
            <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)}>
              <option value="">—</option>
              {(costCodes.data ?? []).map((c: CostCode) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between rounded-lg p-3" style={{ background: "var(--neutral-soft)" }}>
            <span className="text-sm">
              {coords ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "No location captured"}
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={captureLocation}>
              Use my location
            </button>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setClockOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={doClockIn}>
            {busy ? "Clocking in…" : "Clock in"}
          </button>
        </div>
      </Modal>

      {dialog}
    </div>
  );
}
