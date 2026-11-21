// Google Picker for joining a shop: the invited person picks the shop folder
// from "Shared with me" once. With the drive.file scope, picking is what
// grants this app access to that folder.

import { driveConfig, getToken, loadScript } from "./auth";
import { FOLDER_MIME } from "./api";

const GAPI_SRC = "https://apis.google.com/js/api.js";

type PickerDoc = { id: string; name: string; mimeType: string };
type PickerData = { action: string; docs?: PickerDoc[] };

type PickerNamespace = {
  Action: { PICKED: string; CANCEL: string };
  ViewId: { FOLDERS: string; DOCS: string };
  Feature: { MULTISELECT_ENABLED: string };
  DocsView: new (viewId?: string) => {
    setIncludeFolders: (v: boolean) => unknown;
    setSelectFolderEnabled: (v: boolean) => unknown;
    setMimeTypes: (v: string) => unknown;
    setOwnedByMe: (v: boolean) => unknown;
    setParent: (id: string) => unknown;
    setFileIds: (ids: string) => unknown;
    setMode: (mode: string) => unknown;
  };
  DocsViewMode: { LIST: string };
  PickerBuilder: new () => PickerBuilder;
};

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setCallback: (cb: (data: PickerData) => void) => PickerBuilder;
  enableFeature: (feature: string) => PickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};

declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void };
  }
}

function pickerNamespace(): PickerNamespace | undefined {
  return (window.google as unknown as { picker?: PickerNamespace } | undefined)?.picker;
}

async function loadPicker(): Promise<PickerNamespace> {
  await loadScript(GAPI_SRC);
  if (!pickerNamespace()) {
    await new Promise<void>((resolve) => window.gapi!.load("picker", resolve));
  }
  const picker = pickerNamespace();
  if (!picker) throw new Error("Google Picker did not load.");
  return picker;
}

// Every picker names the page's origin. Without it, Google infers the origin
// from the referrer, which iPhone Safari and some in-app browsers trim or
// drop — and a website-restricted API key is then refused as "invalid".

/** Let the user pick a shared shop folder. Resolves null if they cancel. */
export async function pickShopFolder(): Promise<{ id: string; name: string } | null> {
  const config = driveConfig();
  if (!config) throw new Error("Google Drive sync is not set up on this site.");
  const [picker, token] = await Promise.all([loadPicker(), getToken()]);

  const view = new picker.DocsView(picker.ViewId.FOLDERS);
  view.setIncludeFolders(true);
  view.setSelectFolderEnabled(true);
  view.setMimeTypes(FOLDER_MIME);
  view.setOwnedByMe(false); // "Shared with me"

  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.projectNumber)
        .setOrigin(window.location.origin)
      .setTitle("Pick the shop folder you were invited to")
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          resolve({ id: data.docs[0].id, name: data.docs[0].name });
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
}

/** One Google Picker round: returns the ids picked, or null if cancelled. */
export type PickRound = (remaining: string[], step: number, total: number) => Promise<string[] | null>;

/**
 * Keep asking until every invited file has been picked. On a phone Google's
 * picker selects one file at a time, so each round shows only the files still
 * missing; on a computer someone may pick them all in one go. Stops after a
 * few rounds that pick nothing new, so a stuck picker can't loop forever.
 */
export async function pickAllFiles(fileIds: string[], pickOnce: PickRound): Promise<string[] | null> {
  const picked = new Set<string>();
  let idleRounds = 0;
  while (picked.size < fileIds.length && idleRounds < 3) {
    const remaining = fileIds.filter((id) => !picked.has(id));
    const result = await pickOnce(remaining, picked.size + 1, fileIds.length);
    if (result === null) return null;
    const before = picked.size;
    for (const id of result) if (fileIds.includes(id)) picked.add(id);
    idleRounds = picked.size > before ? 0 : idleRounds + 1;
  }
  return Array.from(picked);
}

/**
 * Ask the user to pick the exact files they were invited to. With the
 * drive.file permission, picking a file is what lets this app open it; a
 * picked folder would not give access to the files inside. Resolves with the
 * ids picked, or null if they cancel.
 */
export async function pickInvitedFiles(fileIds: string[]): Promise<string[] | null> {
  const config = driveConfig();
  if (!config) throw new Error("Google Drive sync is not set up on this site.");
  const [picker, token] = await Promise.all([loadPicker(), getToken()]);

  const pickOnce: PickRound = (remaining, step, total) => {
    const view = new picker.DocsView(picker.ViewId.DOCS);
    view.setFileIds(remaining.join(","));
    view.setMode(picker.DocsViewMode.LIST);
    const title =
      remaining.length === 1
        ? `Step ${step} of ${total}: select this file, then Select`
        : `Step ${step} of ${total}: select a file (or all), then Select`;
    return new Promise((resolve) => {
      new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.projectNumber)
        .setOrigin(window.location.origin)
        .setTitle(title)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED) resolve((data.docs ?? []).map((d) => d.id));
          else if (data.action === picker.Action.CANCEL) resolve(null);
        })
        .build()
        .setVisible(true);
    });
  };

  return pickAllFiles(fileIds, pickOnce);
}
