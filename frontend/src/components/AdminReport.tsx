import { useCallback, useEffect, useMemo, useState } from "react";
import { getTransactions, type TxRecord } from "../services/api";
import { PageHeader, Panel } from "./ui";

type Filter = "all" | "approved" | "declined";

const fmtUSD = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const txTime = (tx: TxRecord) => new Date(tx.created_at ?? tx.timestamp ?? 0).getTime();

interface Props {
  isLoggedIn: boolean;
  onRequireSignIn: () => void;
}

export default function AdminReport({ isLoggedIn, onRequireSignIn }: Props) {
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTxs(await getTransactions(50));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  const report = useMemo(() => {
    const approved = txs.filter((t) => t.status === "APPROVED").length;
    const declined = txs.filter((t) => t.status === "DECLINED").length;
    const volume = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      ok: 0,
      fail: 0,
      label: new Date(now - (11 - i) * 3600e3).getHours().toString().padStart(2, "0") + "h",
    }));
    txs.forEach((t) => {
      const h = 11 - Math.floor((now - txTime(t)) / 3600e3);
      if (h < 0 || h > 11) return;
      if (t.status === "APPROVED") buckets[h].ok++;
      else buckets[h].fail++;
    });
    const max = Math.max(1, ...buckets.map((b) => b.ok + b.fail));
    return { approved, declined, volume, buckets, max };
  }, [txs]);

  const header = (
    <PageHeader route="GET /api/transactions" title="Admin dashboard">
      Totals and recent activity from the transactions table. Card numbers appear only in masked form.
    </PageHeader>
  );

  if (!isLoggedIn) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-line px-6 py-12 text-center">
          <span className="font-mono text-xs text-bad">401 · Unauthorized</span>
          <span className="text-[17px] font-semibold">This route is protected by the Lambda authorizer</span>
          <span className="max-w-md text-sm leading-normal text-muted">
            Sign in to get a JWT. API Gateway checks it before the request reaches the API.
          </span>
          <button
            onClick={onRequireSignIn}
            className="mt-1.5 rounded-md bg-ok px-[18px] py-2.5 text-sm font-semibold text-bg hover:bg-ok-hover"
          >
            Sign in
          </button>
        </div>
      </>
    );
  }

  const rate = txs.length ? (report.approved / txs.length) * 100 : 0;
  const stats = [
    { label: "Transactions", value: txs.length.toLocaleString(), sub: "latest records", tone: "text-fg" },
    { label: "Total volume", value: fmtUSD(report.volume), sub: "USD, simulated", tone: "text-fg" },
    { label: "Approval rate", value: `${rate.toFixed(1)}%`, sub: `${report.approved} approved`, tone: "text-ok" },
    { label: "Declined", value: String(report.declined), sub: "response code 05", tone: "text-bad" },
  ];

  const rows = txs
    .filter((t) => filter === "all" || (filter === "approved" ? t.status === "APPROVED" : t.status !== "APPROVED"))
    .slice(0, 10);

  return (
    <>
      {header}

      {error && (
        <div className="rounded-lg border border-bad/40 bg-rail px-4 py-3 text-sm text-bad">{error}</div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-[10px] border border-line bg-panel px-[18px] py-4">
            <span className="text-[12.5px] text-muted">{s.label}</span>
            <span className={`font-mono text-[26px] font-medium tracking-tight ${s.tone}`}>
              {loading && !txs.length ? "…" : s.value}
            </span>
            <span className="text-xs text-dim">{s.sub}</span>
          </div>
        ))}
      </div>

      <Panel
        title="Volume, last 12 hours"
        right={
          <div className="flex gap-3.5 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ok" />Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-bad" />Declined</span>
          </div>
        }
      >
        <div className="flex flex-col gap-2 px-5 py-[18px]">
          <div className="grid h-[150px] grid-cols-12 items-end gap-2 border-b border-line">
            {report.buckets.map((b) => (
              <div key={b.label} className="flex h-full flex-col justify-end gap-0.5">
                <div className="rounded-t-sm bg-bad" style={{ height: `${(b.fail / report.max) * 100}%` }} />
                <div className="rounded-sm bg-ok" style={{ height: `${(b.ok / report.max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2">
            {report.buckets.map((b) => (
              <span key={b.label} className="text-center font-mono text-[10.5px] text-dim">{b.label}</span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title="Recent activity"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-fg disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            <div className="flex gap-0.5 rounded-[7px] border border-line bg-bg p-[3px]">
              {(["all", "approved", "declined"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-[5px] px-3 py-1 text-[12.5px] capitalize ${
                    filter === f ? "bg-active text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[110px_minmax(170px,1.4fr)_110px_minmax(120px,1fr)_100px] gap-3 border-b border-line2 px-5 py-2.5 text-[11px] uppercase tracking-[0.06em] text-dim">
              <span>Time</span>
              <span>Card (masked)</span>
              <span className="text-right">Amount</span>
              <span>Merchant</span>
              <span>Status</span>
            </div>
            {rows.length === 0 && (
              <div className="px-5 py-6 text-sm text-dim">{loading ? "Loading…" : "No transactions yet."}</div>
            )}
            {rows.map((t, i) => {
              const ok = t.status === "APPROVED";
              return (
                <div
                  key={t.id ?? i}
                  className="grid grid-cols-[110px_minmax(170px,1.4fr)_110px_minmax(120px,1fr)_100px] items-center gap-3 border-b border-line2 px-5 py-[11px] font-mono text-[12.5px] last:border-b-0 hover:bg-hover"
                >
                  <span className="text-muted">{new Date(txTime(t)).toLocaleTimeString("en-GB")}</span>
                  <span>{t.card_number}</span>
                  <span className="text-right">{fmtUSD(Number(t.amount) || 0)}</span>
                  <span className="truncate text-muted">{t.merchant_id}</span>
                  <span className={`flex items-center gap-1.5 ${ok ? "text-ok" : "text-bad"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ok" : "bg-bad"}`} />
                    {ok ? "Approved" : "Declined"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </>
  );
}
