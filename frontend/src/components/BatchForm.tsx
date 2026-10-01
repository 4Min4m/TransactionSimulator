import { useEffect, useRef, useState, type FormEvent } from "react";
import { startBatch, getBatchStatus, ApiError, type BatchStatus } from "../services/api";
import { PageHeader, Panel, Field, inputCls, primaryBtn } from "./ui";

// POST /api/process-batch enqueues the job on SQS and returns a batch_id (202).
// A worker Lambda processes it; this view polls GET /api/batches/{id}.
const DEMO_MERCHANT_ID = "demo-merchant";
const POLL_MS = 1000;

interface LogLine {
  t: string;
  src: "POST" | "GET" | "client";
  msg: string;
}

type JobState = "idle" | "queued" | "processing" | "completed" | "failed";

const srcCls: Record<LogLine["src"], string> = { POST: "text-ok", GET: "text-warn", client: "text-muted" };

interface Props {
  isLoggedIn: boolean;
  onRequireSignIn: (notice?: string) => void;
}

export default function BatchForm({ isLoggedIn, onRequireSignIn }: Props) {
  const [total, setTotal] = useState(200);
  const [amount, setAmount] = useState(5000);
  const [duration, setDuration] = useState(30);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [job, setJob] = useState<JobState>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef(0);
  const lastState = useRef<string>("");
  const lastDecile = useRef(0);

  useEffect(() => () => stopPolling(), []);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const push = (src: LogLine["src"], msg: string) => {
    const t = `+${((performance.now() - t0.current) / 1000).toFixed(1)}s`;
    setLog((l) => [...l, { t, src, msg }].slice(-8));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onRequireSignIn("POST /api/process-batch requires a JWT. Sign in first.");
      return;
    }
    stopPolling();
    setError(null);
    setStatus(null);
    setLog([]);
    setBatchId(null);
    setJob("queued");
    t0.current = performance.now();
    lastState.current = "";
    lastDecile.current = 0;

    try {
      const res = await startBatch({
        total_transactions: total,
        total_amount: amount,
        duration_seconds: duration,
        merchant_id: DEMO_MERCHANT_ID,
      });
      setBatchId(res.batch_id);
      push("POST", `/api/process-batch → 202 · batch_id=${res.batch_id}`);

      pollRef.current = setInterval(async () => {
        try {
          const s = await getBatchStatus(res.batch_id);
          setStatus(s);
          setJob(s.status);
          const done = s.success_count + s.failure_count;
          if (s.status !== lastState.current) {
            lastState.current = s.status;
            push("GET", `status → ${s.status}`);
          }
          const dec = s.total_transactions ? Math.floor((done / s.total_transactions) * 10) : 0;
          if (s.status === "processing" && dec > lastDecile.current) {
            lastDecile.current = dec;
            push("GET", `progress ${dec * 10}% (${done}/${s.total_transactions})`);
          }
          if (s.status === "completed") {
            stopPolling();
            push("client", `done · ${s.success_count} approved / ${s.failure_count} declined`);
          }
        } catch (err) {
          stopPolling();
          setJob("failed");
          setError(err instanceof Error ? err.message : "Failed to fetch batch status");
        }
      }, POLL_MS);
    } catch (err) {
      setJob("failed");
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onRequireSignIn(msg);
    }
  };

  const running = job === "queued" || job === "processing";
  const done = status ? status.success_count + status.failure_count : 0;
  const pct = status?.total_transactions ? Math.round((done / status.total_transactions) * 100) : 0;

  const badge: Record<JobState, string> = {
    idle: "text-muted bg-line2",
    queued: "text-warn bg-warn/15",
    processing: "text-warn bg-warn/15",
    completed: "text-ok bg-ok/15",
    failed: "text-bad bg-bad/15",
  };

  const pipe = ["API Lambda", "SQS queue", "Worker Lambda", "Supabase"];
  const pipeOn = (i: number) =>
    job === "completed" || (job === "queued" && i <= 1) || (job === "processing" && i >= 2);

  return (
    <>
      <PageHeader route="POST /api/process-batch → 202" title="Batch load test">
        The API queues the job on SQS and returns right away. A separate worker Lambda processes it in the
        background, and this page polls for progress.
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px] rounded-[10px] border border-line bg-panel p-[22px]">
          <Field label="Total transactions">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={total}
              onChange={(e) => setTotal(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Total amount (USD)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Duration (s, max 300)">
              <input
                type="number"
                min={0}
                max={300}
                className={inputCls}
                value={duration}
                onChange={(e) => setDuration(Math.min(300, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </Field>
          </div>
          {error && <span className="text-[13px] text-bad">{error}</span>}
          <button type="submit" disabled={running} className={primaryBtn}>
            {running ? "Batch running…" : "Start batch"}
          </button>
        </form>

        <Panel
          title="Job monitor"
          right={
            <span className={`rounded px-2 py-0.5 font-mono text-[11.5px] font-semibold uppercase ${badge[job]}`}>
              {job}
            </span>
          }
        >
          <div className="flex flex-col gap-5 px-5 py-[18px]">
            <div className="flex flex-wrap items-center gap-1.5">
              {pipe.map((p, i) => (
                <div key={p} className="flex items-center gap-1.5">
                  <span
                    className={`rounded-[5px] border px-2.5 py-1.5 font-mono text-xs transition-colors ${
                      pipeOn(i)
                        ? `bg-hover text-fg ${job === "completed" ? "border-ok/50" : "border-warn/50"}`
                        : "border-line text-muted"
                    }`}
                  >
                    {p}
                  </span>
                  {i < pipe.length - 1 && <span className="text-xs text-faint">→</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3 font-mono text-xs text-muted">
                <span className="truncate">batch_id {batchId ?? "—"}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded border border-line2 bg-bg">
                <div className="h-full bg-ok transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Processed" value={status ? `${done}/${status.total_transactions}` : "0"} />
              <Stat label="Approved" value={status?.success_count ?? 0} tone="text-ok" />
              <Stat label="Declined" value={status?.failure_count ?? 0} tone="text-bad" />
            </div>

            <div className="flex min-h-[150px] flex-col gap-1 rounded-lg border border-line2 bg-bg px-3.5 py-3">
              {log.length === 0 ? (
                <span className="font-mono text-[11.5px] text-dim">No job running. Start a batch to see events.</span>
              ) : (
                log.map((l, i) => (
                  <div key={i} className="grid grid-cols-[56px_52px_minmax(0,1fr)] gap-2.5 font-mono text-[11.5px] leading-normal">
                    <span className="text-dim">{l.t}</span>
                    <span className={srcCls[l.src]}>{l.src}</span>
                    <span className="break-all text-[#b7c3bc]">{l.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Stat({ label, value, tone = "text-fg" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line2 p-3">
      <span className="text-[11.5px] text-dim">{label}</span>
      <span className={`font-mono text-xl font-medium ${tone}`}>{value}</span>
    </div>
  );
}
