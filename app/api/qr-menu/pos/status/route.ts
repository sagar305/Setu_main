import { forwardToQrMenu } from "@/lib/qrMenuPosServer";

// Free Dine checking a premium QR Menu sync key before it saves it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardToQrMenu(request, "/pos/status", "GET");
}
