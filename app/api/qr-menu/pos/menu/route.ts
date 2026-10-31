import { forwardToQrMenu } from "@/lib/qrMenuPosServer";

// Free Dine pushing its menu into the restaurant's premium QR Menu.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  return forwardToQrMenu(request, "/pos/menu", "PUT");
}
