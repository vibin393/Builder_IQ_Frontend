"use client";

import { useState } from "react";

import { Donut, LineChart, Meter, SERIES } from "@/components/charts";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  Tabs,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { NpsBand, Survey, SurveyStatus } from "@/types/api";

const DEPTS = ["sales", "construction", "quality", "warranty", "communication", "value"] as const;

function bandTone(b: NpsBand | null) {
  return b === "promoter" ? "ok" : b === "detractor" ? "danger" : "neutral";
}
function statusTone(s: SurveyStatus) {
  return s === "responded" ? "ok" : s === "declined" ? "danger" : s === "expired" ? "neutral" : "warn";
}
function Stars({ n }: { n: number | null }) {
  if (n == null) return <span style={{ color: "var(--fg-subtle)" }}>—</span>;
  return (
    <span title={`${n} of 5 stars`} style={{ color: "var(--warn)", letterSpacing: "1px" }}>
      {"★".repeat(n)}
      <span style={{ color: "var(--border)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

type TabName = "All surveys" | "Detractors";

export default function SurveysPage() {
  const summary = useAsync(() => api.surveySummary(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const users = useAsync(() => api.listUsers().then((p) => p.items), []);

  const [tab, setTab] = useState<TabName>("All surveys");
  const [filters, setFilters] = useState<{ stage?: string; status?: string; band?: string }>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [responding, setResponding] = useState<Survey | null>(null);
  const [followingUp, setFollowingUp] = useState<Survey | null>(null);

  const listParams = tab === "Detractors" ? { needs_follow_up: true } : filters;
  const surveys = useAsync(
    () => api.listSurveys(listParams),
    [tab, filters.stage, filters.status, filters.band],
  );

  const job = byId(jobs.data);
  const s = summary.data;

  function reloadAll() {
    surveys.reload();
    summary.reload();
  }
  function setFilter(k: keyof typeof filters, v: string) {
    setFilters((f) => ({ ...f, [k]: v || undefined }));
  }

  return (
    <>
      <PageHeader
        title="Homeowner surveys"
        subtitle="Satisfaction at each lifecycle stage. NPS and the star rating are the headline; detractors are the work list."
        action={
          <button className="btn btn-primary" onClick={() => setSendOpen(true)}>
            Send a survey
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Net Promoter Score"
          value={s?.nps ?? "—"}
          tone={s?.nps == null ? "default" : s.nps >= 50 ? "ok" : s.nps >= 0 ? "warn" : "danger"}
          hint={`${s?.responses ?? 0} responses`}
        />
        <StatTile
          label="Star rating (HBF)"
          value={<Stars n={s?.star_rating ?? null} />}
          hint={s?.pct_recommend != null ? `${s.pct_recommend}% would recommend` : "no responses"}
        />
        <StatTile
          label="Response rate"
          value={s ? `${Math.round(s.response_rate * 100)}%` : "—"}
          hint={s ? `${s.responses}/${s.sent} answered` : undefined}
        />
        <StatTile
          label="Detractors to chase"
          value={s?.detractors_open ?? "—"}
          tone={s?.detractors_open ? "danger" : "ok"}
          hint="Open follow-ups"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Promoters" value={s?.promoters ?? 0} tone="ok" />
        <StatTile label="Passives" value={s?.passives ?? 0} />
        <StatTile label="Detractors" value={s?.detractors ?? 0} tone={s?.detractors ? "danger" : "ok"} />
        <StatTile
          label="Pending"
          value={s?.pending ?? 0}
          tone={s?.overdue ? "warn" : "default"}
          hint={s?.overdue ? `${s.overdue} overdue` : "awaiting response"}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="NPS trend">
          {s && s.trend.length > 0 ? (
            <LineChart
              points={s.trend.map((t) => ({ label: t.label.slice(5), value: t.nps ?? 0 }))}
              suffix=""
            />
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
              Not enough responses to plot a trend.
            </p>
          )}
        </Card>

        <Card title="Promoter mix">
          {s && s.responses > 0 ? (
            <Donut
              centerValue={String(s.nps ?? 0)}
              centerLabel="NPS"
              slices={[
                { label: "Promoters", value: s.promoters, color: SERIES.three },
                { label: "Passives", value: s.passives, color: SERIES.one },
                { label: "Detractors", value: s.detractors, color: SERIES.two },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
              No responses yet.
            </p>
          )}
        </Card>

        <Card title="Average rating by department">
          {s && s.responses > 0 ? (
            <div className="space-y-3">
              {DEPTS.map((k) => (
                <Meter
                  key={k}
                  label={titleCase(k)}
                  value={s.ratings[k] ?? 0}
                  total={5}
                  format={(v) => (v ? `${v.toFixed(1)} / 5` : "no data")}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
              No ratings yet.
            </p>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <Card title="NPS by lifecycle stage" padded={false}>
          <DataTable
            columns={[
              { key: "stage", label: "Stage" },
              { key: "sent", label: "Sent", align: "right" },
              { key: "resp", label: "Responses", align: "right" },
              { key: "nps", label: "NPS", align: "right" },
            ]}
            empty="No surveys yet."
          >
            {(s?.by_stage ?? []).map((b) => (
              <tr key={b.stage}>
                <td className="font-medium">{titleCase(b.stage)}</td>
                <td className="num">{b.sent}</td>
                <td className="num">{b.responses}</td>
                <td className="num">
                  {b.nps == null ? (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  ) : (
                    <Badge tone={b.nps >= 50 ? "ok" : b.nps >= 0 ? "warn" : "danger"}>{b.nps}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Tabs
        tabs={["All surveys", "Detractors"] as const}
        active={tab}
        onChange={setTab}
        counts={{ Detractors: s?.detractors_open }}
      />

      <Card title={tab} padded={false}>
        {tab === "All surveys" && (
          <div className="flex flex-wrap gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <select className="input max-w-[10rem]" value={filters.stage ?? ""} onChange={(e) => setFilter("stage", e.target.value)}>
              <option value="">All stages</option>
              {["contract", "pre_closing", "thirty_day", "eleven_month", "warranty"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <select className="input max-w-[9rem]" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">All statuses</option>
              {["pending", "responded", "declined", "expired"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <select className="input max-w-[9rem]" value={filters.band ?? ""} onChange={(e) => setFilter("band", e.target.value)}>
              <option value="">All bands</option>
              {["promoter", "passive", "detractor"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
          </div>
        )}

        {surveys.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "job", label: "Home" },
              { key: "stage", label: "Stage" },
              { key: "status", label: "Status" },
              { key: "sent", label: "Sent" },
              { key: "score", label: "Recommend", align: "right" },
              { key: "band", label: "Band" },
              { key: "act", label: "", align: "right" },
            ]}
            empty={tab === "Detractors" ? "No detractors need a follow-up. " : "No surveys match these filters."}
          >
            {(surveys.data ?? []).map((sv) => (
              <tr key={sv.id}>
                <td className="font-medium">{job.get(sv.job_id)?.job_number ?? "—"}</td>
                <td><Badge tone="neutral">{titleCase(sv.stage)}</Badge></td>
                <td>
                  <Badge tone={statusTone(sv.status)}>{titleCase(sv.status)}</Badge>
                  {sv.is_overdue && <span className="ml-1"><Badge tone="danger">Overdue</Badge></span>}
                  {sv.reminder_count > 0 && (
                    <span className="ml-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {sv.reminder_count}× reminded
                    </span>
                  )}
                </td>
                <td className="text-sm">{day(sv.sent_date)}</td>
                <td className="num">{sv.would_recommend ?? "—"}</td>
                <td>{sv.nps_band && <Badge tone={bandTone(sv.nps_band)}>{titleCase(sv.nps_band)}</Badge>}</td>
                <td className="num">
                  <div className="flex justify-end gap-1.5">
                    {sv.status === "pending" && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => setResponding(sv)}>
                          Response
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => api.remindSurvey(sv.id).then(reloadAll)}>
                          Remind
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => api.declineSurvey(sv.id).then(reloadAll)}>
                          Decline
                        </button>
                      </>
                    )}
                    {sv.needs_follow_up && (
                      <button className="btn btn-primary btn-sm" onClick={() => setFollowingUp(sv)}>
                        Follow up
                      </button>
                    )}
                    {sv.follow_up_done && (
                      <Badge tone="ok">Followed up</Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <SendSurvey
        open={sendOpen}
        jobs={jobs.data ?? []}
        onClose={() => setSendOpen(false)}
        onDone={() => {
          setSendOpen(false);
          reloadAll();
        }}
      />
      <EnterResponse
        survey={responding}
        onClose={() => setResponding(null)}
        onDone={() => {
          setResponding(null);
          reloadAll();
        }}
      />
      <FollowUp
        survey={followingUp}
        users={users.data ?? []}
        onClose={() => setFollowingUp(null)}
        onDone={() => {
          setFollowingUp(null);
          reloadAll();
        }}
      />
    </>
  );
}

function SendSurvey({
  open,
  jobs,
  onClose,
  onDone,
}: {
  open: boolean;
  jobs: { id: string; job_number: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [stage, setStage] = useState("thirty_day");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.sendSurvey({ job_id: jobId, stage });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the survey");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Send a survey" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Home">
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
            <option value="">Select…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.job_number}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="contract">At contract</option>
            <option value="pre_closing">Pre-closing</option>
            <option value="thirty_day">30 days after closing</option>
            <option value="eleven_month">11 months</option>
            <option value="warranty">After a warranty claim</option>
          </select>
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnterResponse({
  survey,
  onClose,
  onDone,
}: {
  survey: Survey | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    would_recommend: "8",
    overall_satisfaction: "4",
    rating_sales: "4",
    rating_construction: "4",
    rating_quality: "4",
    rating_warranty: "4",
    rating_communication: "4",
    rating_value: "4",
    comments: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    setBusy(true);
    setError(null);
    try {
      await api.respondToSurvey(survey.id, {
        would_recommend: Number(form.would_recommend),
        overall_satisfaction: Number(form.overall_satisfaction),
        rating_sales: Number(form.rating_sales),
        rating_construction: Number(form.rating_construction),
        rating_quality: Number(form.rating_quality),
        rating_warranty: Number(form.rating_warranty),
        rating_communication: Number(form.rating_communication),
        rating_value: Number(form.rating_value),
        comments: form.comments || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(survey)} title="Survey response" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Would recommend (0–10)" hint="9–10 promoter, 7–8 passive, 0–6 detractor.">
            <input type="number" min={0} max={10} className="input" value={form.would_recommend} onChange={set("would_recommend")} required />
          </Field>
          <Field label="Overall satisfaction (1–5)">
            <select className="input" value={form.overall_satisfaction} onChange={set("overall_satisfaction")}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DEPTS.map((k) => (
            <Field key={k} label={titleCase(k)}>
              <select className="input" value={form[`rating_${k}` as keyof typeof form]} onChange={set(`rating_${k}` as keyof typeof form)}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          ))}
        </div>
        <Field label="Comments">
          <textarea className="input" rows={2} value={form.comments} onChange={set("comments")} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FollowUp({
  survey,
  users,
  onClose,
  onDone,
}: {
  survey: Survey | null;
  users: { id: string; full_name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [done, setDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    setBusy(true);
    setError(null);
    try {
      await api.followUpSurvey(survey.id, {
        follow_up_notes: notes || undefined,
        follow_up_done: done,
        follow_up_owner_id: owner || undefined,
      });
      setNotes("");
      setOwner("");
      setDone(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(survey)} title="Detractor follow-up" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {survey?.comments && (
          <p className="rounded-md p-3 text-sm" style={{ background: "var(--danger-soft)", color: "var(--fg-muted)" }}>
            “{survey.comments}”
          </p>
        )}
        <Field label="What was done">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called the homeowner, booked a visit…" />
        </Field>
        <Field label="Owner">
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
          Mark the follow-up as done
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
