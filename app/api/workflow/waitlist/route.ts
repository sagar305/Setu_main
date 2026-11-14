import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isValidEmail, waitlistEmailHtml, waitlistEmailText, WAITLIST_SUBJECT } from "@/lib/workflowWaitlist";

const NOTIFY_EMAIL = "sagarbansal305@gmail.com";

// Best effort, per server instance: this route emails whatever address is typed
// in, so one visitor can't use it to send more than a few in a row.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function tooMany(ip: string, now: number): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

/**
 * Joins the Setu Workflow waiting list: emails the visitor a confirmation with
 * links to the free TB Analyser and Bank Statement Analyzer, and tells us who
 * joined. Our inbox is the list.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Hidden field a person never sees. Bots that fill it get a quiet "ok".
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip, Date.now())) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "Setu Technology <noreply@setutechnology.com>",
    to: email,
    replyTo: NOTIFY_EMAIL,
    subject: WAITLIST_SUBJECT,
    html: waitlistEmailHtml(),
    text: waitlistEmailText(),
  });
  if (error) {
    console.error("Resend error (workflow waitlist, confirmation):", error);
    return NextResponse.json({ error: "We couldn't send the email. Please try again." }, { status: 502 });
  }

  // The visitor is already confirmed; a failure here only costs us the note.
  const { error: notifyError } = await resend.emails.send({
    from: "Setu Technology <noreply@setutechnology.com>",
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `Setu Workflow waiting list: ${email}`,
    text: [`Email: ${email}`, "Source: Setu Workflow page — Join waiting list"].join("\n"),
  });
  if (notifyError) console.error("Resend error (workflow waitlist, notify):", notifyError);

  return NextResponse.json({ ok: true });
}
