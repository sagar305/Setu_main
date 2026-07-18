"use client";

// The consent banner every toolkit tool shows when a workspace exists on this
// device but the tool hasn't been connected yet. Import is offered, never
// automatic (Principle 2 / Import Strategy).

import { PrimaryButton, SecondaryButton } from "@/components/toolkit/ui";
import type { WorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useState } from "react";

export function WorkspaceBanner({
  connection,
  message,
}: {
  connection: WorkspaceConnection;
  message: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const { ready, exists, connected, connect } = connection;
  if (!ready || !exists || connected || dismissed) return null;
  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-indigo/30 bg-indigo/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        <span className="font-semibold">Workspace found on this device. </span>
        {message}
      </p>
      <div className="flex shrink-0 gap-2">
        <PrimaryButton onClick={() => connect()}>Use workspace</PrimaryButton>
        <SecondaryButton onClick={() => setDismissed(true)}>Not now</SecondaryButton>
      </div>
    </div>
  );
}
