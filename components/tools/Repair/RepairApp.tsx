"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  Lock,
  PackageX,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { RepairProvider, useRepair } from "@/lib/repair/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import { primaryBtnClass } from "@/components/tools/FreePos/ui";
import { agingLevel, isUncollected } from "@/lib/repair/calc";
import { outboundFor } from "@/lib/repair/messages";
import { printJobSlip } from "@/lib/repair/print";
import type { ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { JobsScreen } from "./JobsScreen";
import { IntakeWizard } from "./IntakeWizard";
import { JobDetail } from "./JobDetail";
import { CustomersScreen } from "./CustomersScreen";
import { PartsScreen } from "./PartsScreen";
import { BillingScreen } from "./BillingScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { WarrantyLookup } from "./WarrantyLookup";
import { SendQueue } from "./SendQueue";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof ClipboardList }[] = [
  { id: "jobs", label: "Jobs", icon: ClipboardList },
  { id: "customers", label: "Customers", icon: Users },
  { id: "parts", label: "Parts", icon: Boxes },
  { id: "billing", label: "Billing", icon: FileText },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function RepairShell() {
  const {
    business,
    jobs,
    settings,
    technicians,
    today,
    markNotified,
    customerById,
  } = useRepair();

  const [screen, setScreen] = useState<ScreenId>("jobs");
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [lookingUpWarranty, setLookingUpWarranty] = useState(false);
  const [offline, setOffline] = useState(false);

  // The "device received" message, offered once, straight after intake.
  const [intakeSent, setIntakeSent] = useState<{
    jobId: string;
    changeId: string | null;
    name: string;
  } | null>(null);
  const [intakeMessages, setIntakeMessages] = useState<
    ReturnType<typeof outboundFor>[] | null
  >(null);

  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const unlockedOnceRef = useRef(false);

  // Lock as soon as we learn a PIN exists — settings arrive asynchronously, so
  // the first render always has none.
  useEffect(() => {
    if (hasPin && !unlockedOnceRef.current) setLocked(true);
    if (!hasPin) setLocked(false);
  }, [hasPin]);

  const autoLockMinutes = settings.autoLockMinutes ?? 0;
  useEffect(() => {
    if (!hasPin || locked || autoLockMinutes <= 0) return;
    let timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((event) => document.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => document.removeEventListener(event, reset));
    };
  }, [hasPin, locked, autoLockMinutes]);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (locked) {
    return (
      <LockScreen
        businessName={business?.name ?? "Job card"}
        pinHash={settings.pinHash ?? ""}
        pinSalt={settings.pinSalt ?? ""}
        onUnlock={() => {
          unlockedOnceRef.current = true;
          setLocked(false);
        }}
      />
    );
  }

  const red = jobs.filter((job) => agingLevel(job, settings, today) === "red").length;
  const uncollected = jobs.filter((job) => isUncollected(job, settings, today)).length;

  const openJob = (id: string) => {
    setOpenJobId(id);
    setScreen("jobs");
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name || "Job card"}</h2>
          {red > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpenJobId(null);
                setScreen("jobs");
              }}
              className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700"
            >
              {red} sitting too long
            </button>
          )}
          {uncollected > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpenJobId(null);
                setScreen("reports");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800"
            >
              <PackageX className="h-3.5 w-3.5" aria-hidden="true" />
              {uncollected} uncollected
            </button>
          )}
          {offline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline — the job card still works
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLookingUpWarranty(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo/40"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Warranty
          </button>
          {hasPin && (
            <button
              type="button"
              onClick={() => setLocked(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo/40"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Lock
            </button>
          )}
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Job card sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setScreen(item.id);
              setOpenJobId(null);
            }}
            aria-current={screen === item.id ? "page" : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              screen === item.id ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      {screen === "jobs" &&
        (openJobId ? (
          <JobDetail jobId={openJobId} onBack={() => setOpenJobId(null)} />
        ) : (
          <JobsScreen onOpenJob={openJob} onNewJob={() => setScreen("intake")} />
        ))}

      {screen === "intake" && (
        <IntakeWizard
          onCancel={() => setScreen("jobs")}
          onDone={(job) => {
            const customer = customerById(job.customerId) ?? null;
            const technician =
              technicians.find((tech) => tech.id === job.technicianId) ?? null;

            // §3.2: print the slip and offer the "received" message.
            printJobSlip({ business, job, customer, technician, settings });
            if (customer) {
              setIntakeMessages([
                outboundFor("received", job, customer, business, settings),
              ]);
              setIntakeSent({
                jobId: job.id,
                changeId: job.statusHistory[job.statusHistory.length - 1]?.id ?? null,
                name: customer.name,
              });
            }
            setScreen("jobs");
            setOpenJobId(job.id);
          }}
        />
      )}

      {screen === "customers" && <CustomersScreen onOpenJob={openJob} />}
      {screen === "parts" && <PartsScreen />}
      {screen === "billing" && <BillingScreen onOpenJob={openJob} />}
      {screen === "reports" && <ReportsScreen onOpenJob={openJob} />}
      {screen === "settings" && <SettingsScreen />}

      <WarrantyLookup
        open={lookingUpWarranty}
        onClose={() => setLookingUpWarranty(false)}
        onOpenJob={openJob}
      />

      <SendQueue
        open={intakeMessages !== null}
        title={intakeSent ? `Tell ${intakeSent.name}` : "Tell the customer"}
        intro="The job slip is printing. This is the “we have your device” message — send it now or skip it."
        messages={intakeMessages ?? []}
        onClose={() => {
          setIntakeMessages(null);
          setIntakeSent(null);
        }}
        onSent={(ids) => {
          if (ids.length > 0 && intakeSent?.changeId) {
            void markNotified(intakeSent.jobId, intakeSent.changeId);
          }
        }}
      />
    </div>
  );
}

function RepairBody() {
  const { status, errorMessage } = useRepair();

  return (
    <div className="rounded-3xl border border-muted-line/30 bg-cream-paper p-4 sm:p-6">
      {status === "loading" && (
        <p className="py-16 text-center text-sm text-muted">Opening your job card…</p>
      )}

      {status === "error" && (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-red-600">{errorMessage}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            The job card needs IndexedDB. Private browsing on some phones blocks it — try a normal
            window.
          </p>
          <button
            type="button"
            className={`${primaryBtnClass} mt-4`}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}

      {status === "welcome" && <WelcomeScreen />}
      {status === "setup" && <SetupScreen />}
      {status === "ready" && <RepairShell />}
    </div>
  );
}

export function RepairApp() {
  return (
    <RepairProvider>
      <RepairBody />
    </RepairProvider>
  );
}
