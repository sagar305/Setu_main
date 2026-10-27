"use client";

import { BookOpen, Brain, Check, Download, Loader2, Mic, Trash2, WifiOff } from "lucide-react";
import type { AiState, TaskState } from "@/lib/pos/assistant/ai/client";
import { AI_MODELS } from "@/lib/pos/assistant/ai/models";
import type { VoiceLanguage } from "@/lib/pos/assistant/ai/protocol";
import type { AssistantPack } from "@/lib/pos/assistant/pack";
import type { AssistantPrefs } from "@/lib/pos/assistant/prefs";

/**
 * The assistant's "Offline AI" page: what can be downloaded, what it adds,
 * how big it is, and the promise that comes with it.
 */
export function AssistantPackView({
  pack,
  packBusy,
  packError,
  ai,
  prefs,
  supported,
  onDownloadPack,
  onRemovePack,
  onInstall,
  onRemoveModel,
  onDownloadAll,
  onLanguage,
}: {
  pack: AssistantPack | null;
  packBusy: boolean;
  packError: string;
  ai: AiState;
  prefs: AssistantPrefs;
  supported: boolean;
  onDownloadPack: () => void;
  onRemovePack: () => void;
  onInstall: (task: "meaning" | "voice") => void;
  onRemoveModel: (task: "meaning" | "voice") => void;
  onDownloadAll: () => void;
  onLanguage: (language: VoiceLanguage) => void;
}) {
  const everything = Boolean(pack) && prefs.meaningInstalled && prefs.voiceInstalled;
  const busy = packBusy || ai.meaning.phase === "loading" || ai.voice.phase === "loading";
  const exampleCount = pack?.intents.reduce((sum, intent) => sum + intent.examples.length, 0) ?? 0;

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      <p className="text-sm text-ink">
        Download these once and the assistant understands far more ways of asking — in English, Hinglish and Hindi — and
        can listen to your voice. Everything then runs on this device, with or without internet.
      </p>

      {!everything && (
        <button
          type="button"
          onClick={onDownloadAll}
          disabled={busy || !supported}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download everything (about {AI_MODELS.meaning.approximateMb + AI_MODELS.voice.approximateMb} MB, once)
        </button>
      )}

      <PackRow
        icon={BookOpen}
        title="Keyword pack"
        description={
          pack
            ? `${Object.keys(pack.synonyms).length} Hinglish & Hindi words, ${exampleCount} example phrasings.`
            : "Hinglish & Hindi words and hundreds of example phrasings. Under 40 KB."
        }
        installed={Boolean(pack)}
        state={packBusy ? { phase: "loading", percent: null } : packError ? { phase: "error", percent: null, error: packError } : null}
        onInstall={onDownloadPack}
        onRemove={onRemovePack}
      />

      <PackRow
        icon={Brain}
        title={AI_MODELS.meaning.label}
        description={`Matches what you mean, not just the words. About ${AI_MODELS.meaning.approximateMb} MB.`}
        installed={prefs.meaningInstalled && ai.meaning.phase !== "error"}
        state={ai.meaning}
        disabled={!supported}
        onInstall={() => onInstall("meaning")}
        onRemove={() => onRemoveModel("meaning")}
      />

      <PackRow
        icon={Mic}
        title={AI_MODELS.voice.label}
        description={`Speak instead of typing — recognised on this device. About ${AI_MODELS.voice.approximateMb} MB.`}
        installed={prefs.voiceInstalled && ai.voice.phase !== "error"}
        state={ai.voice}
        disabled={!supported}
        onInstall={() => onInstall("voice")}
        onRemove={() => onRemoveModel("voice")}
      >
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>I'll speak in</span>
          {(["english", "hindi"] as const).map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => onLanguage(language)}
              aria-pressed={prefs.language === language}
              className={`rounded-full px-2.5 py-1 font-semibold transition ${
                prefs.language === language ? "bg-indigo text-white" : "bg-cream-paper text-ink hover:text-indigo"
              }`}
            >
              {language === "english" ? "English / Hinglish" : "हिंदी"}
            </button>
          ))}
        </div>
      </PackRow>

      {!supported && (
        <p className="rounded-xl bg-saffron/10 p-3 text-xs text-ink">
          This browser can't run on-device AI models. The keyword pack still works.
        </p>
      )}

      <div className="flex gap-2.5 rounded-xl bg-cream-paper p-3 text-xs leading-relaxed text-muted">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-indigo" />
        <p>
          The download fetches only the pack and the models themselves — it sends nothing about your shop, your sales or
          what you say. Once it finishes, turn your internet off and try it: the assistant keeps working.
        </p>
      </div>
    </div>
  );
}

function PackRow({
  icon: Icon,
  title,
  description,
  installed,
  state,
  disabled,
  onInstall,
  onRemove,
  children,
}: {
  icon: typeof Brain;
  title: string;
  description: string;
  installed: boolean;
  state: TaskState | null;
  disabled?: boolean;
  onInstall: () => void;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  const loading = state?.phase === "loading";
  return (
    <div className="rounded-xl border border-muted-line/30 bg-white p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        {installed && !loading ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3 w-3" />
              {state?.phase === "ready" || !state ? "Ready" : "Saved"}
            </span>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${title}`}
              title="Remove from this device"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onInstall}
            disabled={loading || disabled}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo/30 px-2.5 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/5 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {loading ? (state?.percent != null ? `${state.percent}%` : "Starting…") : "Download"}
          </button>
        )}
      </div>
      {loading && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-paper" role="progressbar" aria-valuenow={state?.percent ?? undefined} aria-label={`${title} download`}>
          <div className="h-full bg-indigo transition-all" style={{ width: `${state?.percent ?? 5}%` }} />
        </div>
      )}
      {state?.phase === "error" && (
        <p className="mt-2 text-xs text-red-600">
          Couldn't get it: {state.error}. Check your internet and try again.
        </p>
      )}
      {children}
    </div>
  );
}
