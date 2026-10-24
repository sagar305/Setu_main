import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR, getPwaApp, livePwaApps } from "@/lib/pwa/apps";

// One web app manifest per installable product (see lib/pwa/apps.ts), so
// each installs as its own home-screen app that opens straight into the tool.

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return livePwaApps().map((app) => ({ id: app.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getPwaApp(id);
  if (!app) return new Response("Not found", { status: 404 });

  const icon = (size: number) => ({
    src: `/pwa/${app.id}-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
  });

  const manifest = {
    id: app.path,
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    start_url: `${app.path}?source=pwa`,
    scope: app.path,
    display: "standalone",
    orientation: "any",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: "en-IN",
    categories: ["business", "productivity", "finance"],
    icons: [
      { ...icon(192), purpose: "any" },
      { ...icon(512), purpose: "any" },
      { ...icon(192), purpose: "maskable" },
      { ...icon(512), purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
