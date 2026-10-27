"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Globe,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { respond, type AgentReply } from "@/lib/pos/assistant/agent";
import { aiSupported, assistantAi, type AiState } from "@/lib/pos/assistant/ai/client";
import { AI_MODELS } from "@/lib/pos/assistant/ai/models";
import type { VoiceLanguage } from "@/lib/pos/assistant/ai/protocol";
import { executeAction } from "@/lib/pos/assistant/executor";
import { flatExamples, smartRespond, type AssistantPack } from "@/lib/pos/assistant/pack";
import {
  DEFAULT_PREFS,
  downloadPack,
  loadPrefs,
  loadSavedPack,
  removePack,
  savePrefs,
  type AssistantPrefs,
} from "@/lib/pos/assistant/prefs";
import {
  browserSpeechSupported,
  listenWithBrowser,
  microphoneSupported,
  speak,
  speechOutputSupported,
  startRecording,
  stopSpeaking,
  type Recording,
} from "@/lib/pos/assistant/voice";
import { usePos } from "@/lib/pos/store";
import type { Order } from "@/lib/pos/types";
import { AssistantPackView } from "./AssistantPackView";
import type { NavigateFn } from "./nav";
import { ReceiptModal } from "./ReceiptModal";

type ProposalState = "pending" | "running" | "done" | "dismissed";

type Message =
  | { id: number; from: "user"; text: string; spoken?: boolean }
  | { id: number; from: "assistant"; reply: AgentReply; proposalState?: ProposalState }
  /** Asks how the mic should listen, the first time it is pressed. */
  | { id: number; from: "voice-setup" };

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;

type MicPhase = "idle" | "preparing" | "recording" | "listening" | "transcribing";

const IDLE_AI: AiState = {
  meaning: { phase: "idle", percent: null },
  voice: { phase: "idle", percent: null },
  indexed: false,
};

/** Delete a model's cached files, so "Remove" really frees the space. */
async function forgetModelFiles(repo: string) {
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    await Promise.all(keys.filter((request) => request.url.includes(repo)).map((request) => cache.delete(request)));
  } catch {
    // Cache Storage unavailable: nothing was cached there either.
  }
}

/** Text worth saying out loud: the answer, and the first few points of it. */
function spokenText(reply: AgentReply): string {
  const parts = [reply.text, ...(reply.bullets?.slice(0, 3) ?? [])];
  if (reply.proposal) parts.push(`${reply.proposal.title}. Press ${reply.proposal.confirmLabel} to confirm.`);
  return parts.join(". ").replace(/\.\./g, ".");
}

/**
 * The POS assistant: a chat panel that answers questions about the POS and
 * the shop's own data, and carries out changes once the user confirms them.
 * Everything runs in this browser — see lib/pos/assistant/agent.ts — and the
 * optional downloads (lib/pos/assistant/pack.ts, ai/) teach it more phrasings
 * and let it listen.
 */
export function AssistantPanel({ onNavigate }: { onNavigate: NavigateFn }) {
  const pos = usePos();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "pack">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [prefs, setPrefsState] = useState<AssistantPrefs>(DEFAULT_PREFS);
  const [pack, setPack] = useState<AssistantPack | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const [packError, setPackError] = useState("");
  const [ai, setAi] = useState<AiState>(IDLE_AI);
  const [mic, setMic] = useState<MicPhase>("idle");
  const [micError, setMicError] = useState("");
  const recordingRef = useRef<Recording | null>(null);
  const browserListenRef = useRef<{ stop: () => void } | null>(null);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = aiSupported();

  const updatePrefs = useCallback((update: Partial<AssistantPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update };
      savePrefs(next);
      return next;
    });
  }, []);

  // What this browser already has: saved settings and the downloaded pack.
  useEffect(() => {
    setPrefsState(loadPrefs());
    setPack(loadSavedPack());
  }, []);

  useEffect(() => (supported ? assistantAi().subscribe(setAi) : undefined), [supported]);

  // Restart installed models from the browser's cache once the panel is used.
  useEffect(() => {
    if (!open || !supported) return;
    if (prefs.meaningInstalled && ai.meaning.phase === "idle") assistantAi().load("meaning").catch(() => {});
  }, [open, supported, prefs.meaningInstalled, ai.meaning.phase]);

  // Teach the meaning model the pack's phrasings once both are present.
  useEffect(() => {
    if (pack && ai.meaning.phase === "ready") assistantAi().index(flatExamples(pack).map((example) => example.shape));
  }, [pack, ai.meaning.phase]);

  const push = (message: NewMessage) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...message, id } as Message]);
    return id;
  };

  const say = (reply: AgentReply) => {
    push({ from: "assistant", reply, proposalState: reply.proposal ? "pending" : undefined });
    if (reply.navigate) onNavigate(reply.navigate.screen, reply.navigate.query);
    if (prefs.speakReplies) speak(spokenText(reply), prefs.language);
  };

  const ask = async (text: string, spoken = false) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    push({ from: "user", text: trimmed, spoken });
    setInput("");
    setThinking(true);
    try {
      const meaningReady = ai.meaning.phase === "ready" && ai.indexed;
      const reply = await smartRespond(trimmed, pos, {
        pack,
        meaning: meaningReady
          ? async (shape) => (await assistantAi().match(shape)) ?? null
          : null,
      });
      say(reply);
    } finally {
      setThinking(false);
    }
  };

  const setProposalState = (id: number, state: ProposalState) =>
    setMessages((prev) => prev.map((m) => (m.id === id && m.from === "assistant" ? { ...m, proposalState: state } : m)));

  const confirm = async (message: Extract<Message, { from: "assistant" }>) => {
    const proposal = message.reply.proposal;
    if (!proposal || message.proposalState !== "pending") return;
    setProposalState(message.id, "running");
    try {
      const result = await executeAction(proposal.action, {
        currency: pos.business?.currency || "INR",
        products: pos.products,
        orders: pos.orders,
        checkout: pos.checkout,
        adjustStock: pos.adjustStock,
        updateProduct: pos.updateProduct,
        createProduct: pos.createProduct,
        createCustomer: pos.createCustomer,
        cancelOrder: pos.cancelOrder,
        exportBackup: pos.exportBackup,
      });
      setProposalState(message.id, "done");
      say(result.reply);
      if (result.order) setReceipt(result.order);
    } catch (error) {
      setProposalState(message.id, "pending");
      say({ text: error instanceof Error ? error.message : "That didn't work. Nothing was changed." });
    }
  };

  const dismiss = (id: number) => {
    setProposalState(id, "dismissed");
    say({ text: "Okay, nothing changed." });
  };

  // --- downloads -------------------------------------------------------------

  const getPack = async (): Promise<AssistantPack | null> => {
    if (pack) return pack;
    setPackBusy(true);
    setPackError("");
    try {
      const downloaded = await downloadPack();
      setPack(downloaded);
      return downloaded;
    } catch (error) {
      setPackError(error instanceof Error ? error.message : "Download failed");
      return null;
    } finally {
      setPackBusy(false);
    }
  };

  const install = async (task: "meaning" | "voice") => {
    if (task === "meaning") await getPack();
    try {
      await assistantAi().load(task);
      updatePrefs(task === "meaning" ? { meaningInstalled: true } : { voiceInstalled: true, voiceMode: "offline" });
    } catch {
      // The row shows the error from the worker.
    }
  };

  const removeModel = (task: "meaning" | "voice") => {
    updatePrefs(task === "meaning" ? { meaningInstalled: false } : { voiceInstalled: false, voiceMode: prefs.voiceMode === "offline" ? null : prefs.voiceMode });
    void forgetModelFiles(AI_MODELS[task].repo);
  };

  const downloadAll = async () => {
    await getPack();
    await Promise.allSettled([install("meaning"), install("voice")]);
  };

  // --- voice -----------------------------------------------------------------

  const startOfflineVoice = async () => {
    setMicError("");
    setMic("preparing");
    try {
      if (ai.voice.phase !== "ready") await assistantAi().load("voice");
      if (!prefs.voiceInstalled) updatePrefs({ voiceInstalled: true, voiceMode: "offline" });
      stopSpeaking();
      recordingRef.current = await startRecording(() => void finishRecording());
      setMic("recording");
    } catch (error) {
      setMic("idle");
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setMicError(
        denied
          ? "Microphone permission was denied. Allow it in the browser's site settings."
          : assistantAi().getState().voice.phase === "error"
            ? `Couldn't download the voice model — it needs internet the first time.${browserSpeechSupported() ? " Tap the mic again to use browser voice instead." : ""}`
            : "Couldn't start the microphone."
      );
      // Offer the other way of listening on the next press.
      if (!denied && assistantAi().getState().voice.phase === "error") updatePrefs({ voiceMode: null, voiceInstalled: false });
    }
  };

  const finishRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setMic("transcribing");
    try {
      const audio = await recording.stop();
      if (audio.length < 16_000 * 0.3) throw new Error("That was too short — hold on a moment longer.");
      const text = await assistantAi().transcribe(audio, prefs.language);
      setMic("idle");
      if (text) await ask(text, true);
      else setMicError("I didn't hear anything. Try again a little closer.");
    } catch (error) {
      setMic("idle");
      setMicError(error instanceof Error ? error.message : "Couldn't understand the recording.");
    }
  };

  const startBrowserVoice = async () => {
    setMicError("");
    stopSpeaking();
    const session = listenWithBrowser(prefs.language);
    browserListenRef.current = session;
    setMic("listening");
    try {
      const text = await session.result;
      setMic("idle");
      if (text) await ask(text, true);
      else setMicError("I didn't hear anything. Try again.");
    } catch (error) {
      setMic("idle");
      setMicError(error instanceof Error ? error.message : "Didn't catch that.");
    } finally {
      browserListenRef.current = null;
    }
  };

  const onMic = () => {
    if (mic === "recording") return void finishRecording();
    if (mic === "listening") return browserListenRef.current?.stop();
    if (mic !== "idle") return;
    if (prefs.voiceMode === "offline" || prefs.voiceInstalled) return void startOfflineVoice();
    if (prefs.voiceMode === "browser" && browserSpeechSupported()) return void startBrowserVoice();
    if (!messages.some((m) => m.from === "voice-setup")) push({ from: "voice-setup" });
    else listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  };

  const chooseVoice = (mode: "offline" | "browser") => {
    setMessages((prev) => prev.filter((m) => m.from !== "voice-setup"));
    if (mode === "browser") {
      updatePrefs({ voiceMode: "browser" });
      void startBrowserVoice();
    } else {
      void startOfflineVoice();
    }
  };

  // Stop listening if the panel closes mid-recording.
  useEffect(() => {
    if (open) return;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    browserListenRef.current?.stop();
    stopSpeaking();
    setMic("idle");
  }, [open]);

  // --- layout effects --------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !receipt) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, receipt]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, thinking, view]);

  // Seed the conversation with a greeting the first time it opens.
  useEffect(() => {
    if (open && messages.length === 0) push({ from: "assistant", reply: respond("hi", pos) });
  }, [open]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.from === "assistant")?.id;
  const smartOn = Boolean(pack) || ai.meaning.phase === "ready";
  const canUseMic = microphoneSupported() || browserSpeechSupported();
  const micBusy = mic === "preparing" || mic === "transcribing";
  const micActive = mic === "recording" || mic === "listening";
  const micLabel =
    mic === "recording" || mic === "listening"
      ? "Stop and send"
      : mic === "transcribing"
        ? "Understanding what you said"
        : mic === "preparing"
          ? "Getting the microphone ready"
          : "Speak to the assistant";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[65] inline-flex items-center gap-2 rounded-full bg-indigo px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-ink sm:bottom-6 sm:right-6"
          aria-label="Open the POS assistant"
        >
          <Sparkles className="h-4 w-4" />
          Ask assistant
          {canUseMic && <Mic className="h-4 w-4 opacity-80" aria-hidden />}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="POS assistant"
          className="fixed inset-x-0 bottom-0 z-[65] flex h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-muted-line/30 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-muted-line/20 bg-cream-paper px-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {view === "pack" ? (
                <button
                  type="button"
                  onClick={() => setView("chat")}
                  aria-label="Back to chat"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-white hover:text-indigo"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink">{view === "pack" ? "Offline AI" : "POS assistant"}</h3>
                <p className="truncate text-xs text-muted">
                  {view === "pack" ? "Download once, works without internet" : smartOn ? "Smart mode · on this device" : "Runs on this device · works offline"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {view === "chat" && (
                <button
                  type="button"
                  onClick={() => setView("pack")}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo/25 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo transition hover:border-indigo"
                >
                  <Download className="h-3.5 w-3.5" />
                  {smartOn ? "AI" : "Get AI"}
                </button>
              )}
              {speechOutputSupported() && (
                <button
                  type="button"
                  onClick={() => {
                    if (prefs.speakReplies) stopSpeaking();
                    updatePrefs({ speakReplies: !prefs.speakReplies });
                  }}
                  aria-pressed={prefs.speakReplies}
                  aria-label={prefs.speakReplies ? "Stop reading replies aloud" : "Read replies aloud"}
                  title={prefs.speakReplies ? "Replies are read aloud" : "Read replies aloud"}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    prefs.speakReplies ? "bg-indigo text-white" : "text-muted hover:bg-white hover:text-indigo"
                  }`}
                >
                  {prefs.speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the assistant"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white hover:text-indigo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {view === "pack" ? (
            <AssistantPackView
              pack={pack}
              packBusy={packBusy}
              packError={packError}
              ai={ai}
              prefs={prefs}
              supported={supported}
              onDownloadPack={() => void getPack()}
              onRemovePack={() => {
                removePack();
                setPack(null);
              }}
              onInstall={(task) => void install(task)}
              onRemoveModel={removeModel}
              onDownloadAll={() => void downloadAll()}
              onLanguage={(language: VoiceLanguage) => updatePrefs({ language })}
            />
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                {messages.map((message) =>
                  message.from === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo px-3.5 py-2 text-sm text-white">
                        {message.spoken && <Mic className="mr-1.5 inline h-3.5 w-3.5 opacity-70" aria-label="Spoken" />}
                        {message.text}
                      </p>
                    </div>
                  ) : message.from === "voice-setup" ? (
                    <VoiceSetupCard
                      key={message.id}
                      offlineAvailable={supported && microphoneSupported()}
                      browserAvailable={browserSpeechSupported()}
                      voiceState={ai.voice}
                      onChoose={chooseVoice}
                    />
                  ) : (
                    <AssistantBubble
                      key={message.id}
                      message={message}
                      showSuggestions={message.id === lastAssistantId && !thinking}
                      onSuggestion={(text) => void ask(text)}
                      onLink={(screen, query) => onNavigate(screen, query)}
                      onConfirm={() => void confirm(message)}
                      onDismiss={() => dismiss(message.id)}
                    />
                  )
                )}
                {thinking && (
                  <div className="flex items-center gap-2 text-xs text-muted" role="status">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking…
                  </div>
                )}
              </div>

              {(micActive || micBusy || micError) && (
                <div
                  role="status"
                  className={`flex items-center gap-2 border-t border-muted-line/20 px-4 py-2 text-xs font-semibold ${
                    micError ? "text-red-600" : "text-indigo"
                  }`}
                >
                  {micActive && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />}
                  {micBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {micError ||
                    (mic === "recording"
                      ? "Listening… speak now, then tap the red button."
                      : mic === "listening"
                        ? "Listening with browser voice… tap to stop."
                        : mic === "transcribing"
                          ? "Understanding what you said…"
                          : ai.voice.phase === "loading"
                            ? `Getting voice ready${ai.voice.percent != null ? ` · ${ai.voice.percent}%` : "…"}`
                            : "Getting the microphone ready…")}
                </div>
              )}

              <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-muted-line/20 px-3 py-3">
                {canUseMic && (
                  <button
                    type="button"
                    onClick={onMic}
                    disabled={micBusy}
                    aria-label={micLabel}
                    title={micLabel}
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition disabled:opacity-60 ${
                      micActive ? "bg-red-500 text-white" : "bg-saffron text-ink hover:brightness-95"
                    }`}
                  >
                    {micActive && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" aria-hidden />}
                    {micBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : micActive ? (
                      <Square className="relative h-4 w-4 fill-current" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={canUseMic ? "Type or tap the mic" : "Ask, or say “sell 2 Maggi by UPI”"}
                  aria-label="Message the assistant"
                  enterKeyHint="send"
                  className="w-full min-w-0 rounded-full border border-muted-line/40 bg-cream-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-indigo focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo text-white transition hover:bg-ink disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <ReceiptModal order={receipt} open={receipt !== null} onClose={() => setReceipt(null)} title="Sale complete" />
    </>
  );
}

function VoiceSetupCard({
  offlineAvailable,
  browserAvailable,
  voiceState,
  onChoose,
}: {
  offlineAvailable: boolean;
  browserAvailable: boolean;
  voiceState: AiState["voice"];
  onChoose: (mode: "offline" | "browser") => void;
}) {
  return (
    <div className="w-full max-w-[90%] rounded-2xl border border-saffron/40 bg-white p-3 text-sm shadow-sm">
      <p className="font-bold text-ink">How should I listen?</p>
      <div className="mt-2 space-y-2">
        {offlineAvailable && (
          <button
            type="button"
            onClick={() => onChoose("offline")}
            disabled={voiceState.phase === "loading"}
            className="flex w-full items-start gap-2.5 rounded-xl bg-indigo px-3 py-2.5 text-left text-white transition hover:bg-ink disabled:opacity-70"
          >
            <Download className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-semibold">Private voice, works offline</span>
              <span className="block text-xs text-white/80">
                One-time download, about {AI_MODELS.voice.approximateMb} MB. Your voice never leaves this device.
              </span>
            </span>
          </button>
        )}
        {browserAvailable && (
          <button
            type="button"
            onClick={() => onChoose("browser")}
            className="flex w-full items-start gap-2.5 rounded-xl border border-muted-line/40 px-3 py-2.5 text-left transition hover:border-indigo/40"
          >
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-indigo" />
            <span>
              <span className="block font-semibold text-ink">Start right now with browser voice</span>
              <span className="block text-xs text-muted">
                No download, but needs internet — your browser sends the audio to its speech service.
              </span>
            </span>
          </button>
        )}
        {!offlineAvailable && !browserAvailable && (
          <p className="text-xs text-muted">This browser can't record audio. Try Chrome or Edge.</p>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  showSuggestions,
  onSuggestion,
  onLink,
  onConfirm,
  onDismiss,
}: {
  message: Extract<Message, { from: "assistant" }>;
  showSuggestions: boolean;
  onSuggestion: (text: string) => void;
  onLink: NavigateFn;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { reply, proposalState } = message;
  const suggestions = reply.suggestions;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-cream-paper px-3.5 py-2.5 text-sm text-ink">
        <p className={reply.bullets ? "font-semibold" : undefined}>{reply.text}</p>
        {reply.bullets && (
          <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-ink/85">
            {reply.bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {reply.understoodAs && (
          <p className="mt-1.5 text-[11px] text-muted">Understood as “{reply.understoodAs}”</p>
        )}
        {reply.link && (
          <button
            type="button"
            onClick={() => onLink(reply.link!.screen, reply.link!.query)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
          >
            {reply.link.label}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {reply.proposal && (
        <div className="w-full max-w-[90%] rounded-2xl border border-indigo/25 bg-white p-3 shadow-sm">
          <p className="text-sm font-bold text-ink">{reply.proposal.title}</p>
          <ul className="mt-1.5 space-y-0.5 text-[13px] text-muted">
            {reply.proposal.details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
          {proposalState === "pending" || proposalState === "running" ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={proposalState === "running"}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-60"
              >
                {proposalState === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {reply.proposal.confirmLabel}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                disabled={proposalState === "running"}
                className="rounded-lg border border-muted-line/40 px-3 py-2 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-muted">
              {proposalState === "done" ? "✓ Done" : "Cancelled"}
            </p>
          )}
        </div>
      )}

      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="rounded-full border border-indigo/25 bg-white px-3 py-1 text-xs font-semibold text-indigo transition hover:border-indigo hover:bg-indigo/5"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
