"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Monitor,
  Plus,
  RotateCcw,
  Sheet,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useQueue } from "@/lib/queue/store";
import { generateSalt, hashPin, isValidPinFormat } from "@/lib/pos/pin";
import { suggestedServiceMinutes } from "@/lib/queue/calc";
import {
  chimeSupported,
  chooseVoice,
  describeVoiceChoice,
  loadVoices,
  playChime,
  speakAnnouncement,
  speechSupported,
} from "@/lib/queue/voice";
import { createBackup, downloadBackupFile, parseBackupFile } from "@/lib/queue/backup";
import { APPS_SCRIPT_TEMPLATE, isValidSyncUrl, testSheetConnection } from "@/lib/queue/sheetSync";
import { MESSAGE_PLACEHOLDERS } from "@/lib/queue/types";
import {
  DEFAULT_VOICE_TEMPLATE,
  HINDI_VOICE_TEMPLATE,
  SERVICE_COLOURS,
  VOICE_LANGUAGES,
  type Counter,
  type QueueTheme,
  type Service,
} from "@/lib/queue/types";
import {
  ConfirmDialog,
  Field,
  SectionCard,
  ServiceDot,
  chipBtnClass,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function SettingsScreen() {
  return (
    <div className="grid gap-4">
      <BusinessSection />
      <ServicesSection />
      <CountersSection />
      <DisplaySection />
      <AnnouncementSection />
      <DaySection />
      <MessagesSection />
      <SheetSection />
      <BackupSection />
      <LockSection />
      <DangerSection />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BusinessSection() {
  const { business, updateBusiness } = useQueue();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(business?.name ?? "");
    setPhone(business?.phone ?? "");
  }, [business]);

  return (
    <SectionCard title="Business">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" hint="Shown on the display and on every token slip.">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="button"
        className={`${secondaryBtnClass} mt-3`}
        onClick={async () => {
          await updateBusiness({ name: name.trim(), phone: phone.trim() });
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1500);
        }}
      >
        {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
        {saved ? "Saved" : "Save business details"}
      </button>
      <p className="mt-2 text-xs text-muted">
        These are shared with your other Setu tools on this device.
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

type ServiceDraft = {
  name: string;
  prefix: string;
  avgServiceMinutes: number;
  colour: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY_SERVICE: ServiceDraft = {
  name: "",
  prefix: "",
  avgServiceMinutes: 5,
  colour: SERVICE_COLOURS[0],
  active: true,
  sortOrder: 0,
};

function ServicesSection() {
  const { services, tokens, today, saveService, deleteService } = useQueue();
  const [editing, setEditing] = useState<Service | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>({ ...EMPTY_SERVICE });
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const open = (service: Service | null) => {
    setEditing(service);
    setAdding(service === null);
    setDraft(
      service
        ? {
            name: service.name,
            prefix: service.prefix,
            avgServiceMinutes: service.avgServiceMinutes,
            colour: service.colour,
            active: service.active,
            sortOrder: service.sortOrder,
          }
        : { ...EMPTY_SERVICE, sortOrder: services.length, colour: SERVICE_COLOURS[services.length % SERVICE_COLOURS.length] }
    );
  };

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    await saveService({ ...draft, name: draft.name.trim(), prefix: draft.prefix.trim().slice(0, 2) }, editing?.id);
    close();
  };

  return (
    <SectionCard
      title="Services"
      action={
        <button type="button" className={secondaryBtnClass} onClick={() => open(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add service
        </button>
      }
    >
      <ul className="grid gap-2">
        {services.map((service) => (
          <li
            key={service.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted-line/30 px-3 py-2.5"
          >
            <span className="flex items-center gap-2">
              <ServiceDot colour={service.colour} />
              <span className="font-semibold text-ink">{service.name}</span>
              {service.prefix && (
                <span className="rounded bg-cream px-1.5 text-xs font-bold text-muted">
                  {service.prefix}-42
                </span>
              )}
              {!service.active && <span className="text-xs text-muted">(off)</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted">{service.avgServiceMinutes} min each</span>
              <button type="button" className={`${chipBtnClass} min-h-0 px-2 py-1`} onClick={() => open(service)}>
                Edit
              </button>
              <button
                type="button"
                className={`${chipBtnClass} min-h-0 px-2 py-1`}
                onClick={() => setDeleteTarget(service)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Remove {service.name}</span>
              </button>
            </span>
          </li>
        ))}
        {services.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">No services yet.</li>
        )}
      </ul>

      {(editing || adding) && (
        <div className="mt-4 grid gap-3 rounded-xl border-2 border-indigo/30 bg-indigo/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="New registration"
                autoFocus
              />
            </Field>
            <Field label="Token prefix" hint='One letter, e.g. "A" gives A-42. Leave empty for plain numbers.'>
              <input
                className={inputClass}
                value={draft.prefix}
                maxLength={2}
                onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>

          <ServiceMinutesField
            service={editing}
            value={draft.avgServiceMinutes}
            onChange={(value) => setDraft({ ...draft, avgServiceMinutes: value })}
            tokens={tokens}
            today={today}
          />

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Chip colour
            </span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  aria-label={`Use colour ${colour}`}
                  aria-pressed={draft.colour === colour}
                  onClick={() => setDraft({ ...draft, colour })}
                  className={`h-9 w-9 rounded-full border-2 ${
                    draft.colour === colour ? "border-ink" : "border-transparent"
                  }`}
                  style={{ backgroundColor: colour }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Accepting new tokens
          </label>

          <div className="flex gap-2">
            <button type="button" className={primaryBtnClass} onClick={() => void save()}>
              Save service
            </button>
            <button type="button" className={secondaryBtnClass} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this service?"
        message={
          deleteTarget && tokens.some((t) => t.serviceId === deleteTarget.id)
            ? "Tokens have been issued for it, so it is switched off rather than deleted — otherwise today's history and your reports would stop making sense."
            : "It has never issued a token, so it will be removed completely."
        }
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void deleteService(target.id);
        }}
      />
    </SectionCard>
  );
}

/**
 * The estimate that drives every wait shown to a customer, with what the last
 * week actually measured offered beside it.
 *
 * Offered, not applied. An owner who finds this number moving on its own stops
 * trusting the whole display.
 */
function ServiceMinutesField({
  service,
  value,
  onChange,
  tokens,
  today,
}: {
  service: Service | null;
  value: number;
  onChange: (value: number) => void;
  tokens: ReturnType<typeof useQueue>["tokens"];
  today: string;
}) {
  const suggestion = useMemo(
    () => (service ? suggestedServiceMinutes(tokens, service.id, today) : null),
    [service, tokens, today]
  );

  return (
    <Field label="Minutes per person" hint="Drives the wait estimate on slips and the display.">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-[8rem]`}
          type="number"
          min={1}
          max={240}
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        />
        {suggestion !== null && suggestion !== value && (
          <button
            type="button"
            className={`${chipBtnClass} min-h-0 px-2 py-1`}
            onClick={() => onChange(suggestion)}
          >
            Last 7 days say {suggestion} min — use it
          </button>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */

function CountersSection() {
  const { counters, services, saveCounter, deleteCounter } = useQueue();
  const [editing, setEditing] = useState<Counter | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    staffName: "",
    serviceIds: [] as string[],
    active: true,
  });
  const [deleteTarget, setDeleteTarget] = useState<Counter | null>(null);

  const open = (counter: Counter | null) => {
    setEditing(counter);
    setAdding(counter === null);
    setDraft(
      counter
        ? {
            name: counter.name,
            staffName: counter.staffName,
            serviceIds: counter.serviceIds,
            active: counter.active,
          }
        : { name: `Counter ${counters.length + 1}`, staffName: "", serviceIds: [], active: true }
    );
  };

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  return (
    <SectionCard
      title="Counters"
      action={
        <button type="button" className={secondaryBtnClass} onClick={() => open(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add counter
        </button>
      }
    >
      <ul className="grid gap-2">
        {counters.map((counter) => (
          <li
            key={counter.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted-line/30 px-3 py-2.5"
          >
            <span>
              <span className="font-semibold text-ink">{counter.name}</span>
              {counter.staffName && (
                <span className="ml-2 text-xs text-muted">{counter.staffName}</span>
              )}
              {!counter.active && <span className="ml-2 text-xs text-muted">(off)</span>}
              <div className="text-xs text-muted">
                {counter.serviceIds.length === 0
                  ? "Serves everything"
                  : counter.serviceIds
                      .map((id) => services.find((s) => s.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
              </div>
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                className={`${chipBtnClass} min-h-0 px-2 py-1`}
                onClick={() => open(counter)}
              >
                Edit
              </button>
              <button
                type="button"
                className={`${chipBtnClass} min-h-0 px-2 py-1`}
                onClick={() => setDeleteTarget(counter)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Remove {counter.name}</span>
              </button>
            </span>
          </li>
        ))}
        {counters.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">No counters yet.</li>
        )}
      </ul>

      {(editing || adding) && (
        <div className="mt-4 grid gap-3 rounded-xl border-2 border-indigo/30 bg-indigo/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Counter 1"
                autoFocus
              />
            </Field>
            <Field label="Staff name" hint="Optional. Appears in the reports.">
              <input
                className={inputClass}
                value={draft.staffName}
                onChange={(e) => setDraft({ ...draft, staffName: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Serves
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${chipBtnClass} ${draft.serviceIds.length === 0 ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => setDraft({ ...draft, serviceIds: [] })}
              >
                Everything
              </button>
              {services.map((service) => {
                const on = draft.serviceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`${chipBtnClass} ${on ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        serviceIds: on
                          ? draft.serviceIds.filter((id) => id !== service.id)
                          : [...draft.serviceIds, service.id],
                      })
                    }
                  >
                    <ServiceDot colour={service.colour} />
                    {service.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Open — counts towards the wait estimate
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              className={primaryBtnClass}
              onClick={async () => {
                if (!draft.name.trim()) return;
                await saveCounter({ ...draft, name: draft.name.trim() }, editing?.id);
                close();
              }}
            >
              Save counter
            </button>
            <button type="button" className={secondaryBtnClass} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this counter?"
        message="Tokens it has already served keep their record in the reports."
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void deleteCounter(target.id);
        }}
      />
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

const THEMES: { id: QueueTheme; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Matches the rest of Setu" },
  { id: "dark", label: "Dark", hint: "Easier on a screen left on all day" },
  { id: "high-contrast", label: "High contrast", hint: "For a TV seen from far away" },
];

function DisplaySection() {
  const { settings, updateSettings } = useQueue();
  return (
    <SectionCard
      title="Waiting-room display"
      action={
        <a
          href="/products/free-queue-system/display"
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtnClass}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
          Open display
        </a>
      }
    >
      <div className="grid gap-3">
        <Field label="Title" hint="The line across the top of the screen.">
          <input
            className={inputClass}
            value={settings.displayTitle}
            onChange={(e) => void updateSettings({ displayTitle: e.target.value })}
            placeholder="Welcome to Sharma Diagnostics"
          />
        </Field>
        <Field label="Notice ticker" hint="Scrolls along the bottom. Leave empty to hide it.">
          <input
            className={inputClass}
            value={settings.tickerText}
            onChange={(e) => void updateSettings({ tickerText: e.target.value })}
            placeholder="Reports ready in 30 minutes · Please keep your token safe"
          />
        </Field>
        <Field label="How many upcoming tokens to list">
          <input
            className={`${inputClass} max-w-[8rem]`}
            type="number"
            min={0}
            max={10}
            value={settings.showNextCount}
            onChange={(e) =>
              void updateSettings({
                showNextCount: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </Field>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Theme
          </span>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                title={theme.hint}
                className={`${chipBtnClass} ${settings.theme === theme.id ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => void updateSettings({ theme: theme.id })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Open the display on the TV or second monitor once and leave it. It follows this counter
        without anyone touching it.
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The announcement settings, with a Test button that is not optional.
 *
 * Which voices a device has varies wildly, and the owner has to hear the thing
 * work on their own screen before they will trust a waiting room to it. So the
 * voice that will actually be used is named in words, and there is a button
 * that makes noise right now.
 */
function AnnouncementSection() {
  const { settings, updateSettings } = useQueue();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [tested, setTested] = useState<string>("");

  useEffect(() => {
    void loadVoices().then(setVoices);
  }, []);

  const choice = useMemo(() => chooseVoice(voices, settings.voiceLang), [voices, settings.voiceLang]);
  const supported = speechSupported();

  const deviceLanguages = useMemo(() => {
    const known = new Set(VOICE_LANGUAGES.map((row) => row.code.toLowerCase()));
    const extras = new Map<string, string>();
    for (const voice of voices) {
      const code = voice.lang;
      if (!known.has(code.toLowerCase())) extras.set(code, code);
    }
    return Array.from(extras.keys()).sort();
  }, [voices]);

  const test = () => {
    const spoke = speakAnnouncement(
      {
        template: settings.voiceTemplate,
        token: "A 42",
        counter: "Counter 3",
        lang: settings.voiceLang,
        rate: settings.voiceRate,
        repeat: 1,
      },
      choice.voice
    );
    if (settings.chimeEnabled) playChime(settings.chimeSound);
    setTested(
      spoke
        ? "Playing now. If you heard nothing, check the screen's volume."
        : "This browser could not speak. The chime will be used instead."
    );
    window.setTimeout(() => setTested(""), 6000);
  };

  return (
    <SectionCard title="Announcements">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={settings.voiceEnabled}
          onChange={(e) => void updateSettings({ voiceEnabled: e.target.checked })}
        />
        Call the number out loud
      </label>

      {!supported && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This browser has no speech engine, so nothing will be spoken here. The chime and the
          flashing card still work. Chrome, Edge and Safari on a laptop all speak.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Language">
          <select
            className={inputClass}
            value={settings.voiceLang}
            onChange={(e) => {
              const lang = e.target.value;
              void updateSettings({
                voiceLang: lang,
                voiceTemplate:
                  settings.voiceTemplate === DEFAULT_VOICE_TEMPLATE && lang.startsWith("hi")
                    ? HINDI_VOICE_TEMPLATE
                    : settings.voiceTemplate,
              });
            }}
          >
            {VOICE_LANGUAGES.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label}
              </option>
            ))}
            {deviceLanguages.length > 0 && (
              <optgroup label="Also on this device">
                {deviceLanguages.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        <Field label={`Speaking speed — ${settings.voiceRate.toFixed(1)}×`}>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            className="w-full"
            value={settings.voiceRate}
            onChange={(e) => void updateSettings({ voiceRate: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field
          label="What it says"
          hint="{token} and {counter} are filled in. A-42 is read as “A forty-two”."
        >
          <input
            className={inputClass}
            value={settings.voiceTemplate}
            onChange={(e) => void updateSettings({ voiceTemplate: e.target.value })}
          />
        </Field>
      </div>

      <p className="mt-3 rounded-lg bg-cream-paper px-3 py-2 text-sm text-muted">
        {describeVoiceChoice(choice, settings.voiceLang)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={settings.chimeEnabled}
              onChange={(e) => void updateSettings({ chimeEnabled: e.target.checked })}
            />
            Play a chime first
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["bell", "ding", "chime"] as const).map((sound) => (
              <button
                key={sound}
                type="button"
                className={`${chipBtnClass} ${settings.chimeSound === sound ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => {
                  void updateSettings({ chimeSound: sound });
                  playChime(sound);
                }}
              >
                {sound}
              </button>
            ))}
          </div>
          {!chimeSupported() && (
            <p className="mt-2 text-xs text-amber-700">
              This browser cannot play the chime either — the card will flash instead.
            </p>
          )}
        </div>

        <Field label="Repeat each announcement">
          <div className="flex gap-2">
            {([1, 2] as const).map((count) => (
              <button
                key={count}
                type="button"
                className={`${chipBtnClass} ${settings.announceRepeat === count ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => void updateSettings({ announceRepeat: count })}
              >
                {count}×
              </button>
            ))}
          </div>
        </Field>
      </div>

      <button type="button" className={`${primaryBtnClass} mt-4`} onClick={test}>
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        Test the announcement
      </button>
      {tested && <p className="mt-2 text-sm text-muted">{tested}</p>}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function DaySection() {
  const { settings, updateSettings, resetDayNow, today } = useQueue();
  const [confirming, setConfirming] = useState(false);

  return (
    <SectionCard title="The day">
      <Field
        label="Numbering restarts at"
        hint="Pick an hour before you open. Work done after midnight but before this hour still counts as the previous day."
      >
        <select
          className={`${inputClass} max-w-[10rem]`}
          value={settings.dailyResetHour}
          onChange={(e) => void updateSettings({ dailyResetHour: Number(e.target.value) })}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {hour === 0 ? "Midnight" : `${String(hour).padStart(2, "0")}:00`}
            </option>
          ))}
        </select>
      </Field>

      <p className="mt-3 text-sm text-muted">
        Today is <strong className="text-ink">{today}</strong>.
      </p>

      <button
        type="button"
        className={`${secondaryBtnClass} mt-3`}
        onClick={() => setConfirming(true)}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset the queue now
      </button>
      <p className="mt-2 text-xs text-muted">
        For the day that does not end when the clock says it does — a night shift, a wedding-season
        Sunday. Numbering starts again at 1 and today&apos;s history is kept.
      </p>

      <ConfirmDialog
        open={confirming}
        title="Reset the queue now?"
        message="Everyone still waiting or called is cancelled, and the next token issued will be number 1. Today's history stays in Reports."
        confirmLabel="Reset the queue"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void resetDayNow();
        }}
      />
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function MessagesSection() {
  const { settings, updateSettings } = useQueue();
  return (
    <SectionCard title="WhatsApp messages">
      <div className="grid gap-3">
        <Field label="When a token is issued">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={settings.messageTemplates.tokenIssued}
            onChange={(e) =>
              void updateSettings({
                messageTemplates: { ...settings.messageTemplates, tokenIssued: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Almost your turn">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={settings.messageTemplates.almostYourTurn}
            onChange={(e) =>
              void updateSettings({
                messageTemplates: {
                  ...settings.messageTemplates,
                  almostYourTurn: e.target.value,
                },
              })
            }
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {MESSAGE_PLACEHOLDERS.map((row) => (
          <span key={row.token}>
            <code className="font-semibold text-ink">{row.token}</code> {row.meaning}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Nothing is sent automatically. The app opens WhatsApp with the message ready and you tap
        send — an app with no server cannot do more than that, and pretending otherwise would be
        worse.
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function SheetSection() {
  const { settings, updateSettings, syncToSheet } = useQueue();
  const [url, setUrl] = useState(settings.sheetUrl ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => setUrl(settings.sheetUrl ?? ""), [settings.sheetUrl]);

  return (
    <SectionCard title="Google Sheet backup">
      <Field label="Apps Script URL" hint="Leave empty to keep everything on this device.">
        <input
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/…/exec"
        />
      </Field>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          disabled={busy || !url.trim()}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              if (!isValidSyncUrl(url)) {
                setStatus("That does not look like an Apps Script URL.");
                return;
              }
              const result = await testSheetConnection(url.trim());
              setStatus(result.ok ? "Connected." : result.error ?? "Could not connect.");
              if (result.ok) await updateSettings({ sheetUrl: url.trim() });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sheet className="h-4 w-4" aria-hidden="true" />
          Test and save
        </button>

        <button
          type="button"
          className={secondaryBtnClass}
          disabled={busy || !settings.sheetUrl}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              await syncToSheet();
              setStatus("Pushed to your sheet.");
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Could not push to the sheet.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Push now
        </button>

        <button
          type="button"
          className={chipBtnClass}
          onClick={() => setShowScript((value) => !value)}
        >
          {showScript ? "Hide" : "Show"} the script to paste
        </button>
      </div>

      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      {settings.lastSyncAt && (
        <p className="mt-1 text-xs text-muted">
          Last pushed {new Date(settings.lastSyncAt).toLocaleString("en-IN")}.
        </p>
      )}

      {showScript && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">
            In your Google Sheet: Extensions → Apps Script, paste this, then Deploy → New
            deployment → Web app, with access set to &ldquo;Anyone&rdquo;.
          </p>
          <pre className="max-h-64 overflow-auto rounded-lg bg-ink p-3 text-xs text-cream">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        One way only. The sheet is a copy for the owner, never a source the queue reads back —
        a stale spreadsheet overwriting a live queue would lose somebody standing in the room.
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function BackupSection() {
  const { settings, updateSettings, applyRestoredBackup } = useQueue();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  return (
    <SectionCard title="Backup">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={async () => {
            downloadBackupFile(await createBackup());
            await updateSettings({ lastBackupAt: new Date().toISOString() });
            setStatus("Backup downloaded.");
          }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download a backup
        </button>
        <button type="button" className={secondaryBtnClass} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Restore a backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const result = parseBackupFile(await file.text());
            if (!result.ok) {
              setStatus(result.error);
              return;
            }
            await applyRestoredBackup(result.backup);
            setStatus("Restored.");
          }}
        />
      </div>
      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      <p className="mt-2 text-xs text-muted">
        {settings.lastBackupAt
          ? `Last backup ${new Date(settings.lastBackupAt).toLocaleString("en-IN")}.`
          : "You have not taken a backup yet. This browser is the only copy."}
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function LockSection() {
  const { settings, updateSettings } = useQueue();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const hasPin = Boolean(settings.pinHash);

  return (
    <SectionCard title="Screen lock">
      {hasPin ? (
        <>
          <p className="text-sm text-muted">A PIN is set on this device.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Lock after (minutes idle)" hint="0 never locks on its own.">
              <input
                className={`${inputClass} max-w-[8rem]`}
                type="number"
                min={0}
                max={120}
                value={settings.autoLockMinutes ?? 0}
                onChange={(e) =>
                  void updateSettings({ autoLockMinutes: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </Field>
            <button
              type="button"
              className={dangerBtnClass}
              onClick={async () => {
                await updateSettings({ pinHash: "", pinSalt: "" });
                setStatus("PIN removed.");
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove the PIN
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Set a PIN" hint="4 to 8 digits.">
            <input
              className={`${inputClass} max-w-[10rem]`}
              value={pin}
              inputMode="numeric"
              maxLength={8}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={async () => {
              if (!isValidPinFormat(pin)) {
                setStatus("A PIN is 4 to 8 digits.");
                return;
              }
              const salt = generateSalt();
              await updateSettings({ pinHash: await hashPin(pin, salt), pinSalt: salt });
              setPin("");
              setStatus("PIN set.");
            }}
          >
            Set PIN
          </button>
        </div>
      )}
      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      <p className="mt-2 text-xs text-muted">
        A deterrent against a customer poking at an unattended counter, not a defence against
        someone with the device and developer tools. The queue lives in this browser.
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function DangerSection() {
  const { clearAllData } = useQueue();
  const [confirming, setConfirming] = useState(false);

  return (
    <SectionCard title="Start over">
      <button type="button" className={dangerBtnClass} onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete everything in the queue
      </button>
      <p className="mt-2 text-xs text-muted">
        Services, counters, tokens and these settings. Your business profile and your other Setu
        tools are untouched. Take a backup first — this cannot be undone.
      </p>

      <ConfirmDialog
        open={confirming}
        title="Delete the whole queue?"
        message="Every service, counter and token on this device is removed. Your other Setu tools keep their data."
        confirmLabel="Delete everything"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void clearAllData();
        }}
      />
    </SectionCard>
  );
}
