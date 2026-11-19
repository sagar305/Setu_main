// Thin wrappers over the Google Drive v3 REST API for POS team sync.
// Plain fetch, no Google SDK. Every call takes the access token from auth.ts,
// so this file has no browser globals and can be tested with a mocked fetch.

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Google's machine-readable reason, e.g. "insufficientPermissions". */
    readonly reason = "",
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export type DriveFile = { id: string; name: string; modifiedTime: string; mimeType?: string };

export type DriveUser = { emailAddress: string; permissionId: string; displayName: string };

export type DrivePermission = {
  id: string;
  emailAddress?: string;
  role: "owner" | "writer" | "commenter" | "reader";
  type: string;
};

type Fetch = typeof fetch;

export class DriveClient {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  private async call<T>(url: string, init: RequestInit = {}, parse: "json" | "text" = "json"): Promise<T> {
    const token = await this.getToken();
    const response = await this.fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      let detail = "";
      let reason = "";
      try {
        const body = (await response.json()) as {
          error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] };
        };
        detail = body.error?.message ?? "";
        reason = body.error?.errors?.[0]?.reason ?? body.error?.details?.[0]?.reason ?? "";
      } catch {
        // Body was not JSON; the status says enough.
      }
      throw new DriveError(driveErrorMessage(response.status, detail, reason), response.status, reason);
    }
    if (response.status === 204) return undefined as T;
    return (parse === "json" ? response.json() : response.text()) as Promise<T>;
  }

  /** Who is signed in. */
  about(): Promise<DriveUser> {
    return this.call<{ user: DriveUser }>(
      `${API}/about?fields=user(emailAddress,permissionId,displayName)`,
    ).then((r) => r.user);
  }

  getFile(id: string): Promise<DriveFile> {
    return this.call<DriveFile>(`${API}/files/${encodeURIComponent(id)}?fields=id,name,modifiedTime,mimeType`);
  }

  createFolder(name: string, parentId?: string): Promise<DriveFile> {
    return this.call<DriveFile>(`${API}/files?fields=id,name,modifiedTime,mimeType`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    });
  }

  /** Files directly inside a folder (not trashed). */
  async listChildren(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken = "";
    do {
      const q = encodeURIComponent(`'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`);
      const page = await this.call<{ files: DriveFile[]; nextPageToken?: string }>(
        `${API}/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime,mimeType)&pageSize=200` +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""),
      );
      files.push(...page.files);
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    return files;
  }

  /** Create a JSON file in a folder (multipart upload: metadata + content). */
  createJson(name: string, parentId: string, data: unknown): Promise<DriveFile> {
    const boundary = `setu${Math.random().toString(36).slice(2)}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [parentId], mimeType: "application/json" }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(data) +
      `\r\n--${boundary}--`;
    return this.call<DriveFile>(`${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  /** Replace a JSON file's content. */
  updateJson(id: string, data: unknown): Promise<DriveFile> {
    return this.call<DriveFile>(
      `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,modifiedTime`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) },
    );
  }

  async readJson<T>(id: string): Promise<T> {
    const text = await this.call<string>(`${API}/files/${encodeURIComponent(id)}?alt=media`, {}, "text");
    return JSON.parse(text) as T;
  }

  /** Share a file or folder with an email. Google emails them when `notify`. */
  share(
    id: string,
    email: string,
    role: "reader" | "writer",
    notify: boolean,
    message = "",
  ): Promise<DrivePermission> {
    const params = new URLSearchParams({
      sendNotificationEmail: String(notify),
      fields: "id,emailAddress,role,type",
    });
    if (notify && message) params.set("emailMessage", message);
    return this.call<DrivePermission>(`${API}/files/${encodeURIComponent(id)}/permissions?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", role, emailAddress: email }),
    });
  }

  async listPermissions(id: string): Promise<DrivePermission[]> {
    const r = await this.call<{ permissions: DrivePermission[] }>(
      `${API}/files/${encodeURIComponent(id)}/permissions?fields=permissions(id,emailAddress,role,type)`,
    );
    return r.permissions;
  }

  removePermission(id: string, permissionId: string): Promise<void> {
    return this.call<void>(
      `${API}/files/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permissionId)}`,
      { method: "DELETE" },
    );
  }

  /** Remove every permission a given email holds on a file or folder. */
  async unshare(id: string, email: string): Promise<void> {
    const target = email.trim().toLowerCase();
    const permissions = await this.listPermissions(id);
    for (const p of permissions) {
      if (p.role !== "owner" && p.emailAddress?.toLowerCase() === target) {
        await this.removePermission(id, p.id);
      }
    }
  }
}

export function driveErrorMessage(status: number, detail: string, reason = ""): string {
  const text = `${reason} ${detail}`.toLowerCase();
  if (status === 401) return "Your Google sign-in expired. Sign in again to keep syncing.";
  if (status === 403) {
    if (text.includes("ratelimit") || text.includes("rate limit") || text.includes("userratelimitexceeded")) {
      return "Google Drive is busy. Sync will retry shortly.";
    }
    if (text.includes("accessnotconfigured") || text.includes("service_disabled") || text.includes("has not been used") || text.includes("is disabled")) {
      return "The Google Drive API is not turned on for this site's Google Cloud project. The site owner needs to enable \"Google Drive API\" in Google Cloud → APIs & Services → Library.";
    }
    if (text.includes("filepermission") || text.includes("sufficient permissions for this file")) {
      return "You don't have access to this shop's Drive files. Ask the owner to invite you again.";
    }
    if (text.includes("insufficient") || text.includes("scope")) {
      return "Google Drive permission wasn't given. Sign in again and tick the Google Drive box on Google's screen.";
    }
    if (text.includes("storagequota") || text.includes("quota")) {
      return "The owner's Google Drive is full. Free up space in Drive to keep syncing.";
    }
    if (text.includes("notfound") || text.includes("forbidden") || text.includes("permission")) {
      return "You don't have access to this shop's Drive files. Ask the owner to invite you again.";
    }
    return detail || "Google Drive refused the request (403).";
  }
  if (status === 404) return "The shop's Drive folder or file was not found. It may have been deleted or unshared.";
  if (status === 507 || detail.toLowerCase().includes("quota")) {
    return "The owner's Google Drive is full. Free up space in Drive to keep syncing.";
  }
  return detail || `Google Drive request failed (${status}).`;
}
