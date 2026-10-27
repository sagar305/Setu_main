"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { respond, type AgentReply } from "@/lib/pos/assistant/agent";
import { executeAction } from "@/lib/pos/assistant/executor";
import { usePos } from "@/lib/pos/store";
import type { Order } from "@/lib/pos/types";
import type { NavigateFn } from "./nav";
import { ReceiptModal } from "./ReceiptModal";

type ProposalState = "pending" | "running" | "done" | "dismissed";

type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "assistant"; reply: AgentReply; proposalState?: ProposalState };

type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;

/**
 * The POS assistant: a chat panel that answers questions about the POS and
 * the shop's own data, and carries out changes once the user confirms them.
 * Everything runs in this browser — see lib/pos/assistant/agent.ts.
 */
export function AssistantPanel({ onNavigate }: { onNavigate: NavigateFn }) {
  const pos = usePos();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = (message: NewMessage) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...message, id } as Message]);
    return id;
  };

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    push({ from: "user", text: trimmed });
    const reply = respond(trimmed, pos);
    push({ from: "assistant", reply, proposalState: reply.proposal ? "pending" : undefined });
    if (reply.navigate) onNavigate(reply.navigate.screen, reply.navigate.query);
    setInput("");
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
      push({ from: "assistant", reply: result.reply });
      if (result.order) setReceipt(result.order);
    } catch (error) {
      setProposalState(message.id, "pending");
      push({
        from: "assistant",
        reply: { text: error instanceof Error ? error.message : "That didn't work. Nothing was changed." },
      });
    }
  };

  const dismiss = (id: number) => {
    setProposalState(id, "dismissed");
    push({ from: "assistant", reply: { text: "Okay, nothing changed." } });
  };

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
  }, [messages, open]);

  // Seed the conversation with a greeting the first time it opens.
  useEffect(() => {
    if (open && messages.length === 0) push({ from: "assistant", reply: respond("hi", pos) });
  }, [open]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(input);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.from === "assistant")?.id;

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
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="POS assistant"
          className="fixed inset-x-0 bottom-0 z-[65] flex h-[80vh] flex-col overflow-hidden rounded-t-3xl border border-muted-line/30 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:rounded-3xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-muted-line/20 bg-cream-paper px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">POS assistant</h3>
                <p className="text-xs text-muted">Runs on this device · works offline</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the assistant"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white hover:text-indigo"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((message) =>
              message.from === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo px-3.5 py-2 text-sm text-white">
                    {message.text}
                  </p>
                </div>
              ) : (
                <AssistantBubble
                  key={message.id}
                  message={message}
                  showSuggestions={message.id === lastAssistantId}
                  onSuggestion={ask}
                  onLink={(screen, query) => onNavigate(screen, query)}
                  onConfirm={() => void confirm(message)}
                  onDismiss={() => dismiss(message.id)}
                />
              )
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-muted-line/20 px-3 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask, or say “sell 2 Maggi by UPI”"
              aria-label="Message the assistant"
              enterKeyHint="send"
              className="w-full rounded-full border border-muted-line/40 bg-cream-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:border-indigo focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo text-white transition hover:bg-ink disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}

      <ReceiptModal order={receipt} open={receipt !== null} onClose={() => setReceipt(null)} title="Sale complete" />
    </>
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
