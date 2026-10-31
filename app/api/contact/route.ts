import { NextResponse } from "next/server";
import { Resend } from "resend";

const NOTIFY_EMAIL = "sagarbansal305@gmail.com";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, phone, phoneCountry, company, message } = body as Record<string, string>;
  // The consultancy page's form adds these three, all optional. Anything that is
  // not a short string is dropped rather than echoed into the email.
  const optional = (key: string) => {
    const value = body[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : null;
  };
  const isConsultancy = optional("topic") === "consultancy";
  const businessType = optional("businessType");
  const frequency = optional("frequency");
  const software = optional("software");

  // Checked here as well as in the form: the browser's `required` only binds
  // the browser, and this endpoint is reachable without one.
  if (!name || !email || !phone || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Setu Technology <noreply@setutechnology.com>",
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: isConsultancy
      ? `New consultancy enquiry from ${name}`
      : `New contact form submission from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}${phoneCountry ? ` (${phoneCountry})` : ""}`,
      company ? `Business name: ${company}` : null,
      businessType ? `Business type: ${businessType}` : null,
      frequency ? `Preferred frequency: ${frequency}` : null,
      software ? `Accounting software: ${software}` : null,
      isConsultancy ? "Source: Consultancy page" : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    console.error("Resend error (contact):", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
