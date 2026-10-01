import { useState, type FormEvent } from "react";
import { processTransaction, ApiError } from "../services/api";
import RequestPath, { type Outcome } from "./RequestPath";
import { PageHeader, Field, inputCls, readOnlyCls, primaryBtn } from "./ui";

// The backend only accepts a single demo merchant id (ALLOWED_MERCHANT_ID,
// default "demo-merchant") and requires an order_id on every transaction.
const DEMO_MERCHANT_ID = "demo-merchant";

export default function TransactionForm({ onRequireSignIn }: { onRequireSignIn: () => void }) {
  const [card, setCard] = useState("4111 1111 1111 1111");
  const [amount, setAmount] = useState("100.00");
  const [formError, setFormError] = useState("");
  const [inFlight, setInFlight] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight) return;

    const digits = card.replace(/\D/g, "");
    const parsedAmount = parseFloat(amount);
    if (digits.length < 13) return setFormError("Enter a card number with 13–16 digits.");
    if (isNaN(parsedAmount) || parsedAmount <= 0) return setFormError("Amount must be a number greater than 0.");

    setFormError("");
    setOutcome(null);
    setInFlight(true);
    const t0 = performance.now();
    const elapsed = () => Math.round(performance.now() - t0);

    try {
      const res = await processTransaction({
        card_number: digits,
        amount: parsedAmount,
        merchant_id: DEMO_MERCHANT_ID,
        order_id: crypto.randomUUID(),
      });
      const d = res.data;
      setOutcome({
        kind: res.success ? "approved" : "declined",
        ms: elapsed(),
        responseCode: d.responseCode ?? d.iso8583_message?.responseCode ?? (res.success ? "00" : "05"),
        stan: d.iso8583_message?.systemTraceNumber ?? "—",
        pan: d.card_number,
        orderId: d.order_id ?? "—",
      });
    } catch (err) {
      const ms = elapsed();
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) setOutcome({ kind: "unauthorized", ms, status: err.status });
        else if (err.status === 429) setOutcome({ kind: "throttled", ms, status: err.status });
        else if (err.status === 0) setOutcome({ kind: "network", ms, message: err.message });
        else setOutcome({ kind: "error", ms, status: err.status, message: err.message, traceId: err.traceId });
      } else {
        setOutcome({ kind: "network", ms, message: "Unexpected error. See the browser console." });
        console.error(err);
      }
    } finally {
      setInFlight(false);
    }
  };

  return (
    <>
      <PageHeader route="POST /api/transactions" title="Single transaction">
        Send a mock card payment and see which layers of the AWS stack it passes through, from the WAF at the edge
        to the database write.
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px] rounded-[10px] border border-line bg-panel p-[22px]">
          <Field label="Card number">
            <input
              className={`${inputCls} tracking-[0.04em]`}
              placeholder="4111 1111 1111 1111"
              inputMode="numeric"
              value={card}
              maxLength={19}
              onChange={(e) =>
                setCard(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim())
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Amount (USD)">
              <input
                className={inputCls}
                placeholder="100.00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </Field>
            <Field label="Merchant">
              <input className={readOnlyCls} readOnly value={DEMO_MERCHANT_ID} />
            </Field>
          </div>
          {formError && <span className="text-[13px] text-bad">{formError}</span>}
          <button type="submit" disabled={inFlight} className={primaryBtn}>
            {inFlight ? "Processing…" : "Send transaction"}
          </button>
          <span className="text-[12.5px] leading-normal text-dim">
            The full card number is never stored. It is masked in the Lambda before any database write or log line.
          </span>
        </form>

        <RequestPath inFlight={inFlight} outcome={outcome} onSignIn={onRequireSignIn} />
      </div>
    </>
  );
}
