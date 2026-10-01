import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-md border border-line bg-bg px-3 py-2.5 font-mono text-[14.5px] text-fg outline-none transition-colors placeholder:text-dim focus:border-ok";

export const readOnlyCls =
  "w-full rounded-md border border-dashed border-line bg-rail px-3 py-2.5 font-mono text-[14.5px] text-muted outline-none";

export const primaryBtn =
  "rounded-md bg-ok px-4 py-3 text-[14.5px] font-semibold text-bg transition-colors hover:bg-ok-hover disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({ route, title, children }: { route: string; title: string; children: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <span className="font-mono text-xs text-ok">{route}</span>
      <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
      <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted [text-wrap:pretty]">{children}</p>
    </header>
  );
}

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <span className="text-[14.5px] font-semibold">{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      {children}
    </label>
  );
}
