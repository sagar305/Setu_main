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
  ViewId: { FOLDERS: string };
  DocsView: new (viewId?: string) => {
    setIncludeFolders: (v: boolean) => unknown;
    setSelectFolderEnabled: (v: boolean) => unknown;
    setMimeTypes: (v: string) => unknown;
    setOwnedByMe: (v: boolean) => unknown;
    setParent: (id: string) => unknown;
  };
  PickerBuilder: new () => PickerBuilder;
};

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setCallback: (cb: (data: PickerData) => void) => PickerBuilder;
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
