"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  CheckSquare,
  Clock,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Send,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// The five roles a firm starts with in Setu Workflow, played as a walkthrough:
// each role gets its own sidebar (only the menus that role really has) and a
// three-beat scene of a typical moment in its day. The words come from
// content/en/workflow.json (roles); the scenes mirror the app's real screens
// and default role permissions (Setu-workflow/src/lib/permissions.ts).
// ---------------------------------------------------------------------------

export type RoleId = "admin" | "partner" | "manager" | "reviewer" | "preparer";
export type RoleContent = { id: string; name: string; who: string; sees: string[]; can: string[] };

const ROLE_MS = 8400;
const BEATS = 3;

type NavItem = { label: string; icon: typeof LayoutDashboard };
const NAV: Record<string, NavItem> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  myday: { label: "My Day", icon: LayoutDashboard },
  mywork: { label: "My Work", icon: CheckSquare },
  mytime: { label: "My Time", icon: Clock },
  engagements: { label: "Engagements", icon: Briefcase },
  clients: { label: "Clients", icon: Building2 },
  team: { label: "Team Capacity", icon: Users },
  templates: { label: "Templates", icon: Layers },
  reports: { label: "Reports", icon: BarChart3 },
  admin: { label: "Admin", icon: Settings2 },
};

/** Which menus each default role sees, and which one the scene is on. */
const ROLE_NAV: Record<RoleId, { items: (keyof typeof NAV)[]; active: keyof typeof NAV }> = {
  admin: { items: ["dashboard", "mywork", "mytime", "engagements", "clients", "team", "templates", "reports", "admin"], active: "admin" },
  partner: { items: ["dashboard", "mywork", "mytime", "engagements", "clients", "team", "templates", "reports"], active: "dashboard" },
  manager: { items: ["dashboard", "mywork", "mytime", "engagements", "clients", "team", "templates", "reports"], active: "team" },
  reviewer: { items: ["myday", "mywork", "mytime", "engagements", "clients", "templates"], active: "engagements" },
  preparer: { items: ["myday", "mywork", "mytime", "engagements", "clients"], active: "myday" },
};

const PERSON: Record<RoleId, { name: string; initials: string }> = {
  admin: { name: "Anita Rao", initials: "AR" },
  partner: { name: "Rahul Mehta", initials: "RM" },
  manager: { name: "Daniel Brooks", initials: "DB" },
  reviewer: { name: "Maya Chen", initials: "MC" },
  preparer: { name: "James Wilson", initials: "JW" },
};

// ----- Scenes ---------------------------------------------------------------

const pop = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.35 },
};

function Caption({ beat, lines }: { beat: number; lines: string[] }) {
  return (
    <div className="mt-auto pt-3">
      <AnimatePresence mode="wait">
        <motion.p
          key={beat}
          {...pop}
          className="inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-2.5 py-1 text-[11px] font-semibold text-ink"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
          {lines[beat]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Row({ children, highlight, className = "" }: { children: ReactNode; highlight?: boolean; className?: string }) {
  return (
    <motion.div
      layout
      animate={{ backgroundColor: highlight ? "rgba(242,160,61,0.16)" : "rgba(255,255,255,1)" }}
      transition={{ duration: 0.4 }}
      className={`flex items-center gap-2 rounded-lg border border-[#E4E1D8] px-2.5 py-2 text-[11px] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function AdminScene({ beat }: { beat: number }) {
  const users = [
    { n: "Anita Rao", r: "Firm Admin", s: "Active" },
    { n: "Rahul Mehta", r: "Partner", s: "Active" },
    { n: "Maya Chen", r: "Senior / Reviewer", s: "Active" },
  ];
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo/70">Admin · Users</p>
      <div className="mt-2 space-y-1.5">
        {users.map((u) => (
          <Row key={u.n}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E6E7EE] text-[8px] font-bold text-indigo">
              {u.n.split(" ").map((p) => p[0]).join("")}
            </span>
            <span className="flex-1 font-semibold text-ink">{u.n}</span>
            <span className="text-muted">{u.r}</span>
            <span className="rounded bg-green-50 px-1.5 text-[9px] text-green-700">{u.s}</span>
          </Row>
        ))}
        <AnimatePresence>
          {beat >= 1 && (
            <motion.div key="new" {...pop}>
              <Row highlight={beat === 1}>
                <UserPlus className="h-3.5 w-3.5 text-indigo" />
                <span className="flex-1 font-semibold text-ink">James Wilson</span>
                <span className="text-muted">Associate / Preparer</span>
                <span className="rounded bg-amber-50 px-1.5 text-[9px] text-amber-700">Invited</span>
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {beat === 2 && (
          <motion.div {...pop} className="mt-2 rounded-lg border border-indigo/20 bg-white p-2.5">
            <p className="text-[10px] font-semibold text-ink">Custom role · Article Assistant</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {["View engagements", "Log time", "Reply to points", "Complete checklist"].map((p, i) => (
                <motion.span
                  key={p}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 * i }}
                  className="flex items-center gap-1 text-[10px] text-ink/80"
                >
                  <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-indigo text-white">
                    <Check className="h-2 w-2" />
                  </span>
                  {p}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Caption beat={beat} lines={["Every user, role and office in one place", "Invite a colleague — they set their own password", "Create a custom role with exactly the right permissions"]} />
    </>
  );
}

function PartnerScene({ beat }: { beat: number }) {
  const rows = [
    { icon: AlertTriangle, t: "ABC Manufacturing · GST Q3", r: "Deadline passed 3 days ago", tone: "text-red-600" },
    { icon: MessageSquare, t: "Greenfield Medical · Audit FY26", r: "Blocking review point open", tone: "text-amber-600" },
    { icon: BarChart3, t: "Patel & Sons · Tax return", r: "112% of budgeted hours", tone: "text-red-600" },
  ];
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo/70">Dashboard · Needs attention</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          ["Active", "48"],
          ["Due this week", "9"],
          ["Overdue", beat >= 2 ? "3" : "4"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-[#E4E1D8] bg-white px-2 py-1.5">
            <p className="text-[9px] text-muted">{l}</p>
            <AnimatePresence mode="wait">
              <motion.p key={v} {...pop} className="text-sm font-bold text-ink">
                {v}
              </motion.p>
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <Row key={r.t} highlight={beat === 1 && i === 0}>
            <r.icon className={`h-3.5 w-3.5 ${r.tone}`} />
            <span className="flex-1">
              <span className="block font-semibold text-ink">{r.t}</span>
              <span className="text-muted">{r.r}</span>
            </span>
            {i === 0 && beat >= 1 && (
              <motion.span {...pop} className="rounded bg-indigo px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {beat === 1 ? "Reassign" : "→ Daniel B."}
              </motion.span>
            )}
          </Row>
        ))}
      </div>
      <Caption beat={beat} lines={["Every engagement in the firm, exceptions first", "Spot the overdue job and reassign it", "Done — without asking anyone for a status update"]} />
    </>
  );
}

function ManagerScene({ beat }: { beat: number }) {
  const people = [
    { n: "Maya Chen", base: 28, add: 0 },
    { n: "James Wilson", base: 22, add: beat >= 1 ? 12 : 0 },
    { n: "Priya Shah", base: 34, add: 0, leave: beat >= 2 },
  ];
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo/70">Team capacity · this week</p>
      <div className="mt-2 space-y-2">
        {people.map((p) => {
          const cap = p.leave ? 24 : 40;
          const load = p.base + p.add;
          const pct = Math.min(100, (load / cap) * 100);
          const over = load > cap;
          return (
            <div key={p.n} className="rounded-lg border border-[#E4E1D8] bg-white px-2.5 py-2">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-ink">{p.n}</span>
                <span className={over ? "font-semibold text-red-600" : "text-muted"}>
                  {load}h of {cap}h {p.leave ? "· 2 days leave" : ""}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ECEAE3]">
                <motion.div
                  className={`h-full rounded-full ${over ? "bg-red-500" : "bg-indigo"}`}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {beat >= 1 && (
          <motion.div {...pop} className="mt-2 flex items-center gap-2 rounded-lg border border-indigo/20 bg-white px-2.5 py-2 text-[11px]">
            <CalendarClock className="h-3.5 w-3.5 text-indigo" />
            <span className="flex-1 text-ink">Allocated 12h · Patel &amp; Sons tax return → James</span>
            {beat === 2 && <span className="text-[10px] font-semibold text-red-600">Priya over capacity</span>}
          </motion.div>
        )}
      </AnimatePresence>
      <Caption beat={beat} lines={["See who is free before assigning work", "Plan dated hours — the load updates as you go", "Leave and holidays adjust capacity automatically"]} />
    </>
  );
}

function ReviewerScene({ beat }: { beat: number }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo/70">Greenfield Medical · Audit FY26 · Points</p>
      <div className="mt-2 flex items-center gap-1 text-[9px]">
        {["Preparation", "Review", "Partner sign-off"].map((s, i) => {
          const current = beat === 2 ? 2 : 1;
          return (
            <span key={s} className="flex items-center gap-1">
              <motion.span
                animate={{
                  backgroundColor: i === current ? "#26306B" : i < current ? "#E8EAF4" : "#FFFFFF",
                  color: i === current ? "#FFFFFF" : "#26306B",
                }}
                className="rounded-full border border-indigo/20 px-2 py-0.5 font-semibold"
              >
                {s}
              </motion.span>
              {i < 2 && <span className="text-muted">→</span>}
            </span>
          );
        })}
      </div>
      <div className="mt-2 rounded-lg border border-[#E4E1D8] bg-white p-2.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-indigo">#4</span>
          <span className="flex-1 font-semibold text-ink">Fixed asset register doesn&rsquo;t tie to the TB</span>
          <motion.span
            animate={{ backgroundColor: beat === 2 ? "#E8F5EC" : "#FBE9E7", color: beat === 2 ? "#195D3A" : "#9A302A" }}
            className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
          >
            {beat === 2 ? "Resolved" : "Blocking"}
          </motion.span>
        </div>
        <p className="mt-1 text-muted">Review point · raised by Maya · 2 days old</p>
        <AnimatePresence>
          {beat >= 1 && (
            <motion.div {...pop} className="mt-2 rounded-md bg-[#F7F5F0] p-2">
              <p className="text-[10px] font-semibold text-ink">James Wilson replied</p>
              <p className="text-[10px] text-muted">Two disposals were missing — register updated, now ties to ₹48.2L.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Caption beat={beat} lines={["A blocking point holds the stage until it’s cleared", "The preparer answers in the same numbered thread", "Resolve it — the engagement moves to partner sign-off"]} />
    </>
  );
}

function PreparerScene({ beat }: { beat: number }) {
  const items = [
    { t: "Bank reconciliation — March", done: true },
    { t: "Fixed asset schedule", done: beat >= 1 },
    { t: "Draft financial statements", done: false },
  ];
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo/70">My Day · Thursday</p>
      <div className="mt-2 space-y-1.5">
        {items.map((it) => (
          <Row key={it.t} highlight={beat === 1 && it.t === "Fixed asset schedule"}>
            <motion.span
              animate={{ backgroundColor: it.done ? "#26306B" : "#FFFFFF" }}
              className="flex h-3.5 w-3.5 items-center justify-center rounded border border-indigo/40"
            >
              {it.done && <Check className="h-2.5 w-2.5 text-white" />}
            </motion.span>
            <span className={`flex-1 ${it.done ? "text-muted line-through" : "font-semibold text-ink"}`}>{it.t}</span>
            <span className="text-[9px] text-muted">Greenfield Medical</span>
          </Row>
        ))}
      </div>
      <AnimatePresence>
        {beat >= 2 && (
          <motion.div {...pop} className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E4E1D8] bg-white px-2.5 py-2">
              <Clock className="h-3.5 w-3.5 text-indigo" />
              <span className="text-ink">
                <b>2.5h</b> logged · Preparation
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-indigo px-2.5 py-2 text-white">
              <Send className="h-3.5 w-3.5" />
              Sent to review
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Caption beat={beat} lines={["Opens to exactly what’s assigned and due", "Ticks off checklist items as the work gets done", "Logs the hours and sends the stage to review"]} />
    </>
  );
}

const SCENES: Record<RoleId, (props: { beat: number }) => ReactNode> = {
  admin: AdminScene,
  partner: PartnerScene,
  manager: ManagerScene,
  reviewer: ReviewerScene,
  preparer: PreparerScene,
};

// ----- Showcase ---------------------------------------------------------------

export function WorkflowRolesShowcase({ roles }: { roles: RoleContent[] }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const autoplay = !reduceMotion && !paused && visible;

  // Only play while on screen, so the first role isn't half over by the time it's seen.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => {
      if (beat < BEATS - 1) setBeat(beat + 1);
      else {
        setBeat(0);
        setIndex((i) => (i + 1) % roles.length);
      }
    }, ROLE_MS / BEATS);
    return () => clearTimeout(timer);
  }, [autoplay, beat, index, roles.length]);

  const role = roles[index];
  const id = role.id as RoleId;
  const Scene = SCENES[id];
  const nav = ROLE_NAV[id];
  const person = PERSON[id];
  // With reduced motion there is no timeline: show each scene's last beat.
  const shownBeat = reduceMotion ? BEATS - 1 : beat;

  const select = (i: number) => {
    setIndex(i);
    setBeat(0);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div role="tablist" aria-label="Roles" className="flex gap-2 overflow-x-auto pb-1">
        {roles.map((r, i) => {
          const active = i === index;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="workflow-role-panel"
              onClick={() => select(i)}
              className={`relative min-w-[132px] flex-1 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                active ? "border-indigo bg-white text-indigo shadow-sm" : "border-muted-line/30 bg-white/50 text-muted hover:text-ink"
              }`}
            >
              {r.name}
              {active && !reduceMotion && (
                <motion.span
                  key={`${index}-${paused}`}
                  className="absolute bottom-0 left-0 h-[3px] bg-saffron"
                  initial={{ width: `${(beat / BEATS) * 100}%` }}
                  animate={{ width: autoplay ? "100%" : `${(beat / BEATS) * 100}%` }}
                  transition={{ duration: autoplay ? ((BEATS - beat) * ROLE_MS) / BEATS / 1000 : 0, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div id="workflow-role-panel" role="tabpanel" aria-live="polite" className="mt-5 grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Mock app window */}
        <div className="overflow-hidden rounded-2xl border border-indigo/15 bg-[#F7F5F0] shadow-lg" aria-hidden="true">
          <div className="flex items-center gap-1.5 border-b border-[#E4E1D8] bg-white px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
            <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
            <span className="h-2 w-2 rounded-full bg-[#E4E1D8]" />
            <span className="ml-3 text-[10px] text-muted">Setu Workflow · Mehta &amp; Associates</span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-ink">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E6E7EE] text-[8px] font-bold text-indigo">
                {person.initials}
              </span>
              <span className="hidden sm:inline">
                {person.name} · <span className="text-muted">{role.name}</span>
              </span>
            </span>
          </div>
          <div className="flex min-h-[330px]">
            <div className="hidden w-[132px] flex-shrink-0 bg-[#1C2452] px-2 py-3 sm:block">
              <p className="mb-2 px-1.5 text-[11px] font-bold text-[#F2EFE7]">
                Setu<span className="text-saffron">.</span>
              </p>
              <AnimatePresence initial={false}>
                {nav.items.map((key) => {
                  const item = NAV[key];
                  const active = key === nav.active;
                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.25 }}
                      className={`mb-0.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] ${
                        active ? "bg-[#2C335C] text-white shadow-[inset_2px_0_#F2A03D]" : "text-[#C8CAD9]"
                      }`}
                    >
                      <item.icon className={`h-3 w-3 ${active ? "text-saffron" : ""}`} />
                      {item.label}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-1 flex-col"
                >
                  <Scene beat={shownBeat} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* What this role sees and does */}
        <AnimatePresence mode="wait">
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-warm">
              <ShieldCheck className="h-4 w-4 text-indigo" />
              Role {index + 1} of {roles.length}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-ink">{role.name}</h3>
            <p className="mt-1 text-sm text-muted">{role.who}</p>
            <h4 className="mt-5 text-sm font-semibold text-ink">Sees</h4>
            <ul className="mt-2 space-y-1.5">
              {role.sees.map((s, i) => (
                <motion.li
                  key={s}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.1 }}
                  className="flex items-start gap-2 text-sm text-ink/80"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-saffron" />
                  {s}
                </motion.li>
              ))}
            </ul>
            <h4 className="mt-5 text-sm font-semibold text-ink">Can</h4>
            <ul className="mt-2 space-y-1.5">
              {role.can.map((c, i) => (
                <motion.li
                  key={c}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.35 }}
                  className="flex items-start gap-2 text-sm text-ink/80"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" />
                  {c}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
