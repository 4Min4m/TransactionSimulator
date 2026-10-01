import { Panel } from "./ui";

export type Outcome =
  | { kind: "approved" | "declined"; ms: number; responseCode: string; stan: string; pan: string; orderId: string }
  | { kind: "unauthorized"; ms: number; status: number }
  | { kind: "throttled"; ms: number; status: number }
  | { kind: "error"; ms: number; status: number; message: string; traceId?: string }
  | { kind: "network"; ms: number; message: string };

type StepState = "idle" | "run" | "ok" | "deny" | "skip";

const STEPS = [
  { name: "AWS WAFv2", detail: "managed rules · per-IP rate limit", ok: "PASS" },
  { name: "API Gateway", detail: "POST /api/transactions · stage prod", ok: "ROUTED" },
  { name: "Lambda authorizer", detail: "verify Bearer JWT (HS256)", ok: "ALLOW" },
  { name: "API Lambda", detail: "validate · build ISO 8583 · mask PAN", ok: "MTI 0110" },
  { name: "Supabase Postgres", detail: "INSERT transactions · RLS enforced", ok: "WRITTEN" },
];

// Where the request stopped is inferred from the HTTP status the browser saw.
function stepFor(i: number, inFlight: boolean, o: Outcome | null): [StepState, string] {
  if (inFlight) return ["run", "in flight"];
  if (!o) return ["idle", "—"];
  switch (o.kind) {
    case "approved":
    case "declined":
      return ["ok", STEPS[i].ok];
    case "unauthorized":
      if (i < 2) return ["ok", STEPS[i].ok];
      return i === 2 ? ["deny", `DENY ${o.status}`] : ["skip", "not reached"];
    case "throttled":
      if (i < 1) return ["ok", STEPS[i].ok];
      return i === 1 ? ["deny", `THROTTLED ${o.status}`] : ["skip", "not reached"];
    case "error":
      if (i < 3) return ["ok", STEPS[i].ok];
      return i === 3 ? ["deny", `${o.status >= 500 ? "ERROR" : "REJECTED"} ${o.status}`] : ["skip", "not reached"];
    case "network":
      return ["skip", "not reached"];
  }
}

const dotCls: Record<StepState, string> = {
  idle: "bg-faint",
  run: "bg-warn ring-4 ring-warn/20 animate-pulse",
  ok: "bg-ok ring-4 ring-ok/15",
  deny: "bg-bad ring-4 ring-bad/20",
  skip: "bg-line",
};
const labelCls: Record<StepState, string> = {
  idle: "text-dim",
  run: "text-warn",
  ok: "text-ok",
  deny: "text-bad",
  skip: "text-dim",
};

interface Props {
  inFlight: boolean;
  outcome: Outcome | null;
  onSignIn: () => void;
}

export default function RequestPath({ inFlight, outcome, onSignIn }: Props) {
  const header = inFlight ? "awaiting response" : outcome ? `${outcome.ms} ms round trip` : "waiting for request";

  return (
    <Panel title="Request path" right={<span className="font-mono text-[11.5px] text-muted">{header}</span>}>
      <div className="flex flex-col px-5 py-2">
        {STEPS.map((s, i) => {
          const [state, label] = stepFor(i, inFlight, outcome);
          const dim = state === "idle" || state === "skip";
          return (
            <div key={s.name} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line2 py-3 last:border-b-0">
              <span className={`h-2.5 w-2.5 justify-self-center rounded-full ${dotCls[state]}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={`text-sm font-medium ${dim ? "text-muted" : "text-fg"}`}>{s.name}</span>
                <span className="font-mono text-[11.5px] text-dim">{s.detail}</span>
              </div>
              <span className={`font-mono text-[11.5px] font-semibold ${labelCls[state]}`}>{label}</span>
            </div>
          );
        })}
      </div>

      {outcome && <ResultCard outcome={outcome} onSignIn={onSignIn} />}

      <p className="px-5 pb-4 text-xs leading-relaxed text-dim">
        Stage results are inferred from the HTTP status. The round trip is timed in the browser; per-hop latency is
        in AWS X-Ray.
      </p>
    </Panel>
  );
}

function ResultCard({ outcome: o, onSignIn }: { outcome: Outcome; onSignIn: () => void }) {
  let title = "";
  let tone: "ok" | "bad" = "bad";
  let message = "";
  let fields: { k: string; v: string }[] = [];

  switch (o.kind) {
    case "approved":
    case "declined":
      tone = o.kind === "approved" ? "ok" : "bad";
      title = o.kind === "approved" ? "Approved" : "Declined";
      message =
        o.kind === "approved"
          ? "Response code 00. Stored with the card number masked."
          : "Response code 05 (do not honor). Stored with the card number masked.";
      fields = [
        { k: "Response code", v: o.responseCode },
        { k: "STAN", v: o.stan },
        { k: "Stored PAN", v: o.pan },
        { k: "Order ID", v: o.orderId.slice(0, 13) + "…" },
      ];
      break;
    case "unauthorized":
      title = `${o.status} ${o.status === 401 ? "Unauthorized" : "Forbidden"}`;
      message =
        "The request was stopped at the API Gateway edge. It never reached the Lambda or the database.";
      break;
    case "throttled":
      title = "429 Too Many Requests";
      message = "API Gateway throttling rejected the request before it reached the Lambda.";
      break;
    case "error":
      title = o.status >= 500 ? `${o.status} Server error` : `${o.status} Rejected`;
      message = o.message;
      if (o.traceId) fields = [{ k: "traceId (CloudWatch)", v: o.traceId }];
      break;
    case "network":
      title = "Network error";
      message = o.message;
      break;
  }

  return (
    <div
      className={`mx-5 mb-4 mt-1 flex flex-col gap-3.5 rounded-lg border bg-rail p-4 ${
        tone === "ok" ? "border-ok/35" : "border-bad/40"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className={`text-lg font-semibold ${tone === "ok" ? "text-ok" : "text-bad"}`}>{title}</span>
        <span className="font-mono text-xs text-muted">{o.ms} ms total</span>
      </div>
      <span className="text-[13.5px] leading-normal text-muted">{message}</span>
      {fields.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          {fields.map((f) => (
            <div key={f.k} className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.06em] text-dim">{f.k}</span>
              <span className="break-all font-mono text-[13px]">{f.v}</span>
            </div>
          ))}
        </div>
      )}
      {o.kind === "unauthorized" && (
        <button
          onClick={onSignIn}
          className="self-start rounded-md bg-ok px-3.5 py-2 text-[13px] font-semibold text-bg hover:bg-ok-hover"
        >
          Sign in and retry
        </button>
      )}
    </div>
  );
}
