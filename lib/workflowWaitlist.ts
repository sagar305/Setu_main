// Setu Workflow's waiting list: the confirmation email a firm gets after
// joining it on /products/workflow, and the free tools it points them to
// in the meantime.

const SITE_URL = "https://setutechnology.com";
const BRAND_INDIGO = "#26306B";

/** The free financial tools offered while a firm waits. */
export const WAITLIST_TOOLS = [
  {
    name: "Trial Balance Analyser",
    path: "/products/tb-analyzer",
    text: "Import up to three periods of a client's trial balance and get statements, ratios, variances and a review pack.",
  },
  {
    name: "Bank Statement Analyzer",
    path: "/products/bank-statement-analyzer",
    text: "Import a client's bank statement, classify every transaction and reconcile it against the ledger.",
  },
] as const;

/** A sane email address: something@something.tld, no spaces, at most 254 characters. */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export const WAITLIST_SUBJECT = "You're on the Setu Workflow waiting list";

export function waitlistEmailText(): string {
  return [
    "Thanks for joining the Setu Workflow waiting list.",
    "",
    "We'll let you know as soon as Setu Workflow opens for your firm.",
    "",
    "Until then, you can explore our free financial tools — no login, and your files never leave your browser:",
    "",
    ...WAITLIST_TOOLS.flatMap((tool) => [`${tool.name}: ${SITE_URL}${tool.path}`, tool.text, ""]),
    "— Team Setu Technology",
  ].join("\n");
}

export function waitlistEmailHtml(): string {
  const tools = WAITLIST_TOOLS.map(
    (tool) => `
          <tr>
            <td style="padding:0 0 12px;">
              <a href="${SITE_URL}${tool.path}" style="display:block;border:1px solid #e6e3dc;border-radius:12px;padding:16px;text-decoration:none;">
                <span style="display:block;font-size:15px;font-weight:600;color:${BRAND_INDIGO};">${tool.name} &rarr;</span>
                <span style="display:block;margin-top:4px;font-size:13px;line-height:1.6;color:#555;">${tool.text}</span>
              </a>
            </td>
          </tr>`,
  ).join("");
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5F0;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e3dc;">
      <div style="background:${BRAND_INDIGO};padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Setu Workflow</h1>
      </div>
      <div style="padding:32px 28px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Thanks for joining the waiting list</h2>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">
          You're on the list. We'll let you know as soon as Setu Workflow opens for your firm.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1a1a1a;">
          Until then, explore our free financial tools — no login, and your files never leave your browser:
        </p>
        <table style="width:100%;border-collapse:collapse;">${tools}
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#777;">— Team Setu Technology</p>
      </div>
    </div>
  </div>`;
}
