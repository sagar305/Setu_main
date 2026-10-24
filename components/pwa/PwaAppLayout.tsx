import type { ReactNode } from "react";
import { getPwaApp, type PwaAppId } from "@/lib/pwa/apps";
import { InstallAppBar } from "./InstallAppBar";

// Chrome fires beforeinstallprompt once, often before React hydrates. Catch
// it in plain script as the page parses so the Install button can use it.
const CAPTURE_PROMPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__setuInstallPrompt=e;});`;

/** Wraps an installable product's pages: install bar + offline worker. */
export function PwaAppLayout({ appId, children }: { appId: PwaAppId; children: ReactNode }) {
  const app = getPwaApp(appId);
  // Feature-flagged off: the page 404s anyway, and nothing should name it.
  if (!app) return <>{children}</>;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: CAPTURE_PROMPT }} />
      <InstallAppBar app={{ id: app.id, name: app.name, shortName: app.shortName, path: app.path }} />
      {children}
    </>
  );
}
