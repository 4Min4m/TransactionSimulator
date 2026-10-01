import { NavLink } from "react-router-dom";
import { getTokenExpiry } from "../services/auth";

interface SidebarProps {
  isLoggedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const links = [
  { to: "/", label: "Transaction", route: "/tx", end: true },
  { to: "/batch", label: "Batch jobs", route: "/batch", end: false },
  { to: "/admin", label: "Admin", route: "/admin", end: false },
];

export default function Sidebar({ isLoggedIn, onSignIn, onSignOut }: SidebarProps) {
  const exp = getTokenExpiry();
  const expLabel = exp
    ? new Date(exp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <aside className="flex flex-col gap-6 border-b border-line bg-rail px-3.5 py-5 md:sticky md:top-0 md:h-screen md:gap-7 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-2">
        <div className="grid h-[26px] w-[26px] place-items-center rounded-md bg-ok">
          <div className="h-2 w-3 rounded-[2px] border-2 border-bg" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight">PaySim</span>
          <span className="font-mono text-[10.5px] text-muted">ISO 8583 simulator</span>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto md:flex-col">
        <span className="hidden px-2.5 pb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-dim md:block">
          Workspace
        </span>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center justify-between gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm !no-underline transition-colors ${
                isActive ? "bg-active !text-fg" : "!text-muted hover:bg-hover hover:!text-fg"
              }`
            }
          >
            <span>{l.label}</span>
            <span className="hidden font-mono text-[10.5px] text-dim md:inline">{l.route}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-3 md:mt-auto">
        <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center gap-2">
            <span className={`h-[7px] w-[7px] rounded-full ${isLoggedIn ? "bg-ok" : "bg-dim"}`} />
            <span className="text-[13px] font-medium">{isLoggedIn ? "Signed in" : "Not signed in"}</span>
          </div>
          <span className="font-mono text-[11px] leading-normal text-muted">
            {isLoggedIn
              ? `JWT · HS256${expLabel ? ` · expires ${expLabel}` : ""}`
              : "Protected routes will return 401"}
          </span>
          {isLoggedIn ? (
            <button
              onClick={onSignOut}
              className="rounded-md border border-line py-2 text-[13px] text-fg transition-colors hover:border-bad hover:text-bad"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="rounded-md bg-ok py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-ok-hover"
            >
              Sign in
            </button>
          )}
        </div>
        <span className="hidden px-1 font-mono text-[10.5px] leading-relaxed text-dim md:block">
          CloudFront · API Gateway · Lambda · SQS · Supabase
        </span>
      </div>
    </aside>
  );
}
