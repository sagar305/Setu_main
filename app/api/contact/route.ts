import { NextResponse } from "next/server";
import { Resend } from "resend";

const NOTIFY_EMAIL = "sagarbansal305@gmail.com";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, company, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Setu Technology Website <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `New contact form submission from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Business name: ${company}` : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
