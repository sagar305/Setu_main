"use client";

// The send queue — how every "notify the parents" action in this app works.
//
// With no server there is nothing that can send a message on the teacher's
// behalf, so the app prepares each message and hands it to WhatsApp one parent
// at a time. Tapping a row opens WhatsApp with the text already typed; coming
// back marks that parent done. "Copy all" is the escape hatch for teachers who
// use a bulk sender.

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Phone } from "lucide-react";
import { Modal, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { smsLink, whatsAppLink, type OutboundMessage } from "@/lib/tuition/messages";

export function SendQueue({
  open,
  title,
  messages,
  onClose,
  onSent,
}: {
  open: boolean;
  title: string;
  messages: OutboundMessage[];
  onClose: () => void;
  /** Called with the ids of every recipient the teacher actually opened. */
  onSent: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const [sent, setSent] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (open) {
      setSent([]);
      setCopiedId("");
      setCopiedAll(false);
    }
  }, [open, messages]);

  const markSent = (id: string) => {
    setSent((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const openWhatsApp = (message: OutboundMessage) => {
    window.open(whatsAppLink(message.phone, message.message), "_blank", "noopener");
    markSent(message.id);
  };

  const copyOne = async (message: OutboundMessage) => {
    try {
      await navigator.clipboard.writeText(message.message);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(""), 1500);
    } catch {
      // Clipboard blocked — the text is on screen to copy by hand.
    }
  };

  const copyAll = async () => {
    const block = messages
      .map((m) => `${m.name} (${m.phone || t("sqNoNumber")})\n${m.message}`)
      .join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(block);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // Clipboard blocked.
    }
  };

  const finish = () => {
    onSent(sent);
    onClose();
  };

  return (
    <Modal open={open} onClose={finish} title={title} wide>
      <p className="text-sm text-muted">{t("sqBlurb")}</p>

      {messages.length === 0 ? (
        <p className="mt-6 rounded-xl bg-cream-paper p-4 text-center text-sm text-muted">
          {t("sqNobody")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((message) => {
            const done = sent.includes(message.id);
            return (
              <li
                key={message.id}
                className={`rounded-xl border p-3 transition ${
                  done ? "border-emerald-200 bg-emerald-50/60" : "border-muted-line/30 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{message.name}</p>
                    <p className="text-xs text-muted">
                      {message.phone || t("sqNoPhone")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyOne(message)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
                      aria-label={fill(t("sqCopyFor"), { name: message.name })}
                      title={t("sqCopyThis")}
                    >
                      {copiedId === message.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {message.phone ? (
                      <a
                        href={smsLink(message.phone, message.message)}
                        onClick={() => markSent(message.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
                        aria-label={fill(t("sqSmsTo"), { name: message.name })}
                        title={t("sqSmsInstead")}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openWhatsApp(message)}
                      className={`${done ? secondaryBtnClass : primaryBtnClass} px-3 py-2`}
                    >
                      {done ? (
                        <>
                          <Check className="h-4 w-4" /> {t("sqSent")}
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4" /> {t("sdWhatsApp")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-cream-paper p-2 text-xs text-muted">
                  {message.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => void copyAll()} className={secondaryBtnClass}>
          {copiedAll ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {t("sqCopyAll")}
        </button>
        <button type="button" onClick={finish} className={primaryBtnClass}>
          {sent.length > 0 ? fill(t("sqDoneN"), { count: sent.length }) : t("appDone")}
        </button>
      </div>
    </Modal>
  );
}
