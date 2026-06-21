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

  const { name, email, date, time, details, product } = body as Record<string, string>;

  if (!name || !email || !date || !time) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const productName = product || "Setu";

  const { error } = await resend.emails.send({
    from: "Setu Technology <noreply@setutechnology.com>",
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `Demo request: ${productName}`,
    text: [
      `Product: ${productName}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Preferred date: ${date}`,
      `Preferred time: ${time}`,
      details ? `Details: ${details}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    console.error("Resend error (book-demo):", error);
    return NextResponse.json({ error: "Failed to send request" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
