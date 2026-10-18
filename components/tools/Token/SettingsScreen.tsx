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
import { useI18n } from "@/lib/i18n";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { fill, type TKey } from "@/lib/i18n/translate";
import { useToken } from "@/lib/token/store";
import { generateSalt, hashPin, isValidPinFormat } from "@/lib/pos/pin";
import { suggestedServiceMinutes } from "@/lib/token/calc";
import {
  chimeSupported,
  chooseVoice,
  describeVoiceChoice,
  loadVoices,
  playChime,
  speakAnnouncement,
  speechSupported,
} from "@/lib/token/voice";
import { createBackup, downloadBackupFile, parseBackupFile } from "@/lib/token/backup";
import { APPS_SCRIPT_TEMPLATE, isValidSyncUrl, testSheetConnection } from "@/lib/token/sheetSync";
import { messagePlaceholders } from "@/lib/token/types";
import {
  voiceTemplateFor,
  SERVICE_COLOURS,
  VOICE_LANGUAGES,
  type Counter,
  type DisplayTheme,
  type Service,
} from "@/lib/token/types";
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
  const { t } = useI18n();
  const { business, updateBusiness } = useToken();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(business?.name ?? "");
    setPhone(business?.phone ?? "");
  }, [business]);

  return (
    <SectionCard title={t("appBusiness")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("name")} hint={t("tkStNameHint")}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("phone")}>
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
        {saved ? t("saved") : t("appSaveBusinessDetails")}
      </button>
      <p className="mt-2 text-xs text-muted">
        {t("appBusinessSharedHint")}
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
  const { t } = useI18n();
  const { services, tokens, today, saveService, deleteService } = useToken();
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
      title={t("tkStServices")}
      action={
        <button type="button" className={secondaryBtnClass} onClick={() => open(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("tkStAddService")}
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
              {!service.active && <span className="text-xs text-muted">{t("tkStOff")}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {fill(t("tkStMinEach"), { n: service.avgServiceMinutes })}
              </span>
              <button type="button" className={`${chipBtnClass} min-h-0 px-2 py-1`} onClick={() => open(service)}>
                {t("edit")}
              </button>
              <button
                type="button"
                className={`${chipBtnClass} min-h-0 px-2 py-1`}
                onClick={() => setDeleteTarget(service)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">
                  {fill(t("appRemoveNamed"), { name: service.name })}
                </span>
              </button>
            </span>
          </li>
        ))}
        {services.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">{t("tkStNoServices")}</li>
        )}
      </ul>

      {(editing || adding) && (
        <div className="mt-4 grid gap-3 rounded-xl border-2 border-indigo/30 bg-indigo/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("name")} required>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("tkStServicePh")}
                autoFocus
              />
            </Field>
            <Field label={t("tkStTokenPrefix")} hint={t("tkStTokenPrefixHint")}>
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
              {t("tkStChipColour")}
            </span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  aria-label={fill(t("tkStUseColour"), { colour })}
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
            {t("tkStAcceptingNew")}
          </label>

          <div className="flex gap-2">
            <button type="button" className={primaryBtnClass} onClick={() => void save()}>
              {t("tkStSaveService")}
            </button>
            <button type="button" className={secondaryBtnClass} onClick={close}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("tkStRemoveServiceQ")}
        message={
          deleteTarget && tokens.some((row) => row.serviceId === deleteTarget.id)
            ? t("tkStRemoveServiceUsed")
            : t("tkStRemoveServiceUnused")
        }
        confirmLabel={t("remove")}
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
  tokens: ReturnType<typeof useToken>["tokens"];
  today: string;
}) {
  const { t } = useI18n();
  const suggestion = useMemo(
    () => (service ? suggestedServiceMinutes(tokens, service.id, today) : null),
    [service, tokens, today]
  );

  return (
    <Field label={t("tkStMinutesPerPerson")} hint={t("tkStMinutesPerPersonHint")}>
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
            {fill(t("tkStSuggestion"), { n: suggestion })}
          </button>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */

function CountersSection() {
  const { t } = useI18n();
  const { counters, services, saveCounter, deleteCounter } = useToken();
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
        : {
            name: fill(t("tkStCounterN"), { n: counters.length + 1 }),
            staffName: "",
            serviceIds: [],
            active: true,
          }
    );
  };

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  return (
    <SectionCard
      title={t("tkStCounters")}
      action={
        <button type="button" className={secondaryBtnClass} onClick={() => open(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("tkStAddCounter")}
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
              {!counter.active && (
                <span className="ml-2 text-xs text-muted">{t("tkStOff")}</span>
              )}
              <div className="text-xs text-muted">
                {counter.serviceIds.length === 0
                  ? t("tkStServesEverything")
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
                {t("edit")}
              </button>
              <button
                type="button"
                className={`${chipBtnClass} min-h-0 px-2 py-1`}
                onClick={() => setDeleteTarget(counter)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">
                  {fill(t("appRemoveNamed"), { name: counter.name })}
                </span>
              </button>
            </span>
          </li>
        ))}
        {counters.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">{t("tkStNoCounters")}</li>
        )}
      </ul>

      {(editing || adding) && (
        <div className="mt-4 grid gap-3 rounded-xl border-2 border-indigo/30 bg-indigo/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("name")} required>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={fill(t("tkStCounterN"), { n: 1 })}
                autoFocus
              />
            </Field>
            <Field label={t("appStaffName")} hint={t("tkStStaffNameHint")}>
              <input
                className={inputClass}
                value={draft.staffName}
                onChange={(e) => setDraft({ ...draft, staffName: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("tkStServes")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${chipBtnClass} ${draft.serviceIds.length === 0 ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => setDraft({ ...draft, serviceIds: [] })}
              >
                {t("appEverything")}
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
            {t("tkStCounterOpen")}
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
              {t("tkStSaveCounter")}
            </button>
            <button type="button" className={secondaryBtnClass} onClick={close}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("tkStRemoveCounterQ")}
        message={t("tkStRemoveCounterBody")}
        confirmLabel={t("remove")}
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

const THEMES: { id: DisplayTheme; label: TKey; hint: TKey }[] = [
  { id: "light", label: "appThemeLight", hint: "tkStThemeLightHint" },
  { id: "dark", label: "appThemeDark", hint: "tkStThemeDarkHint" },
  { id: "high-contrast", label: "appThemeHighContrast", hint: "tkStThemeContrastHint" },
];

/** The business day as a reader of `lang` would write it. */
function formatDay(dateKey: string, lang: LanguageCode): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString(intlLocaleFor(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const CHIME_KEYS: Record<"bell" | "ding" | "chime", TKey> = {
  bell: "tkStChimeBell",
  ding: "tkStChimeDing",
  chime: "tkStChimeChime",
};

/**
 * The spoken line when the announcement language changes.
 *
 * A template still equal to one of our shipped lines is ours, so it moves to
 * the newly chosen voice language. Anything the owner typed is left alone.
 */
function voiceLineFor(current: string, voiceLang: string, lang: LanguageCode): string {
  const site = LANGUAGES.find(({ code }) => voiceLang.toLowerCase().startsWith(code));
  const target = site ? site.code : lang;
  return voiceTemplateFor(current, target);
}

function DisplaySection() {
  const { t } = useI18n();
  const { settings, updateSettings } = useToken();
  return (
    <SectionCard
      title={t("tkStDisplaySection")}
      action={
        <a
          href="/products/free-token-system/display"
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtnClass}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
          {t("tkStOpenDisplay")}
        </a>
      }
    >
      <div className="grid gap-3">
        <Field label={t("tkStTitle")} hint={t("tkStTitleHint")}>
          <input
            className={inputClass}
            value={settings.displayTitle}
            onChange={(e) => void updateSettings({ displayTitle: e.target.value })}
            placeholder={t("tkStTitlePh")}
          />
        </Field>
        <Field label={t("tkStTicker")} hint={t("tkStTickerHint")}>
          <input
            className={inputClass}
            value={settings.tickerText}
            onChange={(e) => void updateSettings({ tickerText: e.target.value })}
            placeholder={t("tkStTickerPh")}
          />
        </Field>
        <Field label={t("tkStUpcomingCount")}>
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
            {t("appTheme")}
          </span>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                title={t(theme.hint)}
                className={`${chipBtnClass} ${settings.theme === theme.id ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
                onClick={() => void updateSettings({ theme: theme.id })}
              >
                {t(theme.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        {t("tkStDisplayFoot")}
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
  const { t, lang } = useI18n();
  const { settings, updateSettings } = useToken();
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
        counter: fill(t("tkStCounterN"), { n: 3 }),
        lang: settings.voiceLang,
        rate: settings.voiceRate,
        repeat: 1,
      },
      choice.voice
    );
    if (settings.chimeEnabled) playChime(settings.chimeSound);
    setTested(
      spoke ? t("tkStTestPlaying") : t("tkStTestNoSpeech")
    );
    window.setTimeout(() => setTested(""), 6000);
  };

  return (
    <SectionCard title={t("tkStAnnouncements")}>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={settings.voiceEnabled}
          onChange={(e) => void updateSettings({ voiceEnabled: e.target.checked })}
        />
        {t("tkStCallOutLoud")}
      </label>

      {!supported && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("tkStNoSpeechEngine")}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={t("language")}>
          <select
            className={inputClass}
            value={settings.voiceLang}
            onChange={(e) => {
              const code = e.target.value;
              void updateSettings({
                voiceLang: code,
                // A template the owner has not rewritten follows the voice
                // language, so picking Hindi gets the Hindi line rather than
                // an English sentence read with a Hindi voice.
                voiceTemplate: voiceLineFor(settings.voiceTemplate, code, lang),
              });
            }}
          >
            {VOICE_LANGUAGES.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label}
              </option>
            ))}
            {deviceLanguages.length > 0 && (
              <optgroup label={t("tkStAlsoOnDevice")}>
                {deviceLanguages.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        <Field label={fill(t("tkStSpeakingSpeed"), { rate: settings.voiceRate.toFixed(1) })}>
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
          label={t("tkStWhatItSays")}
          hint={t("tkStWhatItSaysHint")}
        >
          <input
            className={inputClass}
            value={settings.voiceTemplate}
            onChange={(e) => void updateSettings({ voiceTemplate: e.target.value })}
          />
        </Field>
      </div>

      <p className="mt-3 rounded-lg bg-cream-paper px-3 py-2 text-sm text-muted">
        {describeVoiceChoice(choice, settings.voiceLang, lang)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={settings.chimeEnabled}
              onChange={(e) => void updateSettings({ chimeEnabled: e.target.checked })}
            />
            {t("tkStPlayChimeFirst")}
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
                {t(CHIME_KEYS[sound])}
              </button>
            ))}
          </div>
          {!chimeSupported() && (
            <p className="mt-2 text-xs text-amber-700">
              {t("tkStNoChime")}
            </p>
          )}
        </div>

        <Field label={t("tkStRepeatAnnouncement")}>
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

      <div className="mt-5 rounded-xl border border-muted-line/30 bg-cream-paper p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={settings.autoSkipEnabled}
            onChange={(e) => void updateSettings({ autoSkipEnabled: e.target.checked })}
          />
          {t("tkStAutoSkip")}
        </label>
        {settings.autoSkipEnabled && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label={t("tkStMinutesToReach")}>
              <input
                className={`${inputClass} max-w-[7rem]`}
                type="number"
                min={1}
                max={60}
                value={settings.autoSkipMinutes}
                onChange={(e) =>
                  void updateSettings({
                    autoSkipMinutes: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </Field>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {t("tkStAutoSkipFoot")}
        </p>
      </div>

      <button type="button" className={`${primaryBtnClass} mt-4`} onClick={test}>
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        {t("tkStTestAnnouncement")}
      </button>
      {tested && <p className="mt-2 text-sm text-muted">{tested}</p>}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function DaySection() {
  const { t, lang } = useI18n();
  const { settings, updateSettings, resetDayNow, today } = useToken();
  const [confirming, setConfirming] = useState(false);

  return (
    <SectionCard title={t("tkStTheDay")}>
      <Field label={t("tkStNumberingRestarts")} hint={t("tkStNumberingHint")}>
        <select
          className={`${inputClass} max-w-[10rem]`}
          value={settings.dailyResetHour}
          onChange={(e) => void updateSettings({ dailyResetHour: Number(e.target.value) })}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {hour === 0 ? t("tkStMidnight") : `${String(hour).padStart(2, "0")}:00`}
            </option>
          ))}
        </select>
      </Field>

      <p className="mt-3 text-sm text-muted">
        {fill(t("tkStTodayIs"), { date: formatDay(today, lang) })}
      </p>

      <button
        type="button"
        className={`${secondaryBtnClass} mt-3`}
        onClick={() => setConfirming(true)}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t("tkStResetQueueNow")}
      </button>
      <p className="mt-2 text-xs text-muted">
        {t("tkStResetFoot")}
      </p>

      <ConfirmDialog
        open={confirming}
        title={t("tkStResetQueueQ")}
        message={t("tkStResetQueueBody")}
        confirmLabel={t("tkStResetQueueConfirm")}
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
  const { t, lang } = useI18n();
  const { settings, updateSettings } = useToken();
  return (
    <SectionCard title={t("tkStWhatsAppMessages")}>
      <div className="grid gap-3">
        <Field label={t("tkStTplIssuedLabel")}>
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
        <Field label={t("tkStTplAlmostLabel")}>
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
        <Field
          label={t("tkStTplWaitingLabel")}
          hint={t("tkStTplWaitingHint")}
        >
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={settings.messageTemplates.waitingForYou}
            onChange={(e) =>
              void updateSettings({
                messageTemplates: {
                  ...settings.messageTemplates,
                  waitingForYou: e.target.value,
                },
              })
            }
          />
        </Field>
        <Field label={t("tkStTplSkippedLabel")}>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={settings.messageTemplates.skipped}
            onChange={(e) =>
              void updateSettings({
                messageTemplates: { ...settings.messageTemplates, skipped: e.target.value },
              })
            }
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {messagePlaceholders(lang).map((row) => (
          <span key={row.token}>
            <code className="font-semibold text-ink">{row.token}</code> {row.meaning}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {t("tkStMessagesFoot")}
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function SheetSection() {
  const { t, lang } = useI18n();
  const { settings, updateSettings, syncToSheet } = useToken();
  const [url, setUrl] = useState(settings.sheetUrl ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => setUrl(settings.sheetUrl ?? ""), [settings.sheetUrl]);

  return (
    <SectionCard title={t("appSheetBackupTitle")}>
      <Field label={t("appAppsScriptUrl")} hint={t("appAppsScriptUrlHint")}>
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
                setStatus(t("appNotAppsScriptUrl"));
                return;
              }
              const result = await testSheetConnection(url.trim(), lang);
              setStatus(
                result.ok ? t("appSheetConnected") : result.error ?? t("appSheetCouldNotConnect")
              );
              if (result.ok) await updateSettings({ sheetUrl: url.trim() });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sheet className="h-4 w-4" aria-hidden="true" />
          {t("appTestAndSave")}
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
              setStatus(t("appPushedToSheet"));
            } catch (error) {
              setStatus(error instanceof Error ? error.message : t("appCouldNotPushToSheet"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {t("appPushNow")}
        </button>

        <button
          type="button"
          className={chipBtnClass}
          onClick={() => setShowScript((value) => !value)}
        >
          {showScript ? t("appHideScriptToPaste") : t("appShowScriptToPaste")}
        </button>
      </div>

      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      {settings.lastSyncAt && (
        <p className="mt-1 text-xs text-muted">
          {fill(t("appLastPushedAt"), {
            when: new Date(settings.lastSyncAt).toLocaleString(intlLocaleFor(lang)),
          })}
        </p>
      )}

      {showScript && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">
            {t("appScriptPasteSteps")}
          </p>
          <pre className="max-h-64 overflow-auto rounded-lg bg-ink p-3 text-xs text-cream">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        {t("tkStSheetFoot")}
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function BackupSection() {
  const { t, lang } = useI18n();
  const { settings, updateSettings, applyRestoredBackup } = useToken();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  return (
    <SectionCard title={t("appBackup")}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={async () => {
            downloadBackupFile(await createBackup());
            await updateSettings({ lastBackupAt: new Date().toISOString() });
            setStatus(t("appBackupDownloaded"));
          }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("appDownloadABackup")}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {t("appRestoreABackup")}
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
              setStatus(t(result.error));
              return;
            }
            await applyRestoredBackup(result.backup);
            setStatus(t("appRestored"));
          }}
        />
      </div>
      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      <p className="mt-2 text-xs text-muted">
        {settings.lastBackupAt
          ? fill(t("appLastBackupAt"), {
              when: new Date(settings.lastBackupAt).toLocaleString(intlLocaleFor(lang)),
            })
          : t("appNoBackupYet")}
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function LockSection() {
  const { t } = useI18n();
  const { settings, updateSettings } = useToken();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const hasPin = Boolean(settings.pinHash);

  return (
    <SectionCard title={t("appLockTitle")}>
      {hasPin ? (
        <>
          <p className="text-sm text-muted">{t("appPinSetOnDevice")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label={t("appLockAfterMinutesIdle")} hint={t("appNeverLocksHint")}>
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
                setStatus(t("appPinRemoved"));
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t("appRemoveThePin")}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("appSetAPin")} hint={t("appPinDigitsHint")}>
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
                setStatus(t("appPinFormatError"));
                return;
              }
              const salt = generateSalt();
              await updateSettings({ pinHash: await hashPin(pin, salt), pinSalt: salt });
              setPin("");
              setStatus(t("appPinSet"));
            }}
          >
            {t("appSetPin")}
          </button>
        </div>
      )}
      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}
      <p className="mt-2 text-xs text-muted">
        {t("tkStLockFoot")}
      </p>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function DangerSection() {
  const { t } = useI18n();
  const { clearAllData } = useToken();
  const [confirming, setConfirming] = useState(false);

  return (
    <SectionCard title={t("appStartOver")}>
      <button type="button" className={dangerBtnClass} onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("tkStDeleteQueueBtn")}
      </button>
      <p className="mt-2 text-xs text-muted">
        {t("tkStDangerFoot")}
      </p>

      <ConfirmDialog
        open={confirming}
        title={t("tkStDeleteQueueQ")}
        message={t("tkStDeleteQueueBody")}
        confirmLabel={t("appDeleteEverything")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void clearAllData();
        }}
      />
    </SectionCard>
  );
}
