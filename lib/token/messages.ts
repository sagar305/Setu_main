// WhatsApp and SMS text for the queue.
//
// Nothing here sends anything. There is no server and no login, so the app can
// only prepare the words and hand them to WhatsApp — the receptionist taps
// send. That is the honest limit of an offline app, and it is why the
// "almost your turn" nudge is a button somebody presses rather than something
// that happens on its own.
//
// The placeholder syntax is the site's single-brace {token}, shared with the
// Tuition Class Manager, not the {{token}} the spec was drafted with: one
// syntax across every template screen on the site is worth more than matching
// a draft, and an owner editing two apps should not have to remember which is
// which.

import { fillTemplate, smsLink, whatsAppLink } from "@/lib/tuition/messages";
import {
  formatWait,
  estimateWaitMinutes,
  waitingAhead,
  activeCountersForService,
} from "./calc";
import {
  tokenLabel,
  type Counter,
  type TokenSettings,
  type MessageTemplateKey,
  type Service,
  type Token,
} from "./types";

export { fillTemplate, smsLink, whatsAppLink };

export type MessageContext = {
  token: Token;
  service: Service | undefined;
  counter?: Counter | null;
  businessName: string;
  tokens: Token[];
  counters: Counter[];
};

/** The values every queue template can use. */
export function messageVars(context: MessageContext): Record<string, string> {
  const { token, service, counter, businessName, tokens, counters } = context;
  const ahead = service ? waitingAhead(tokens, service.id) : 0;
  const minutes = service
    ? estimateWaitMinutes(
        ahead,
        service.avgServiceMinutes,
        activeCountersForService(counters, service.id)
      )
    : 0;

  return {
    name: token.customerName.trim() || "Sir/Ma'am",
    token: tokenLabel(token, service),
    service: service?.name ?? "",
    business: businessName || "our counter",
    wait: formatWait(minutes),
    ahead: String(ahead),
    counter: counter?.name ?? "",
  };
}

export function buildMessage(
  key: MessageTemplateKey,
  settings: TokenSettings,
  context: MessageContext
): string {
  return fillTemplate(settings.messageTemplates[key], messageVars(context));
}

/** A wa.me link for one token's message, or the chooser when we have no number. */
export function whatsAppLinkFor(
  key: MessageTemplateKey,
  settings: TokenSettings,
  context: MessageContext
): string {
  return whatsAppLink(context.token.phone, buildMessage(key, settings, context));
}
