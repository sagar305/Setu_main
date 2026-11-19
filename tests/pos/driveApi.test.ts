import { describe, expect, it } from "vitest";
import { DriveClient, DriveError, driveErrorMessage } from "@/lib/pos/drive/api";

/** A fetch that always answers with this status and Google-style error body. */
const failing = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("Drive errors say what actually went wrong", () => {
  it("tells the site owner when the Drive API is not enabled", async () => {
    const client = new DriveClient(async () => "token", failing(403, {
      error: {
        message: "Google Drive API has not been used in project 280754696024 before or it is disabled.",
        errors: [{ reason: "accessNotConfigured" }],
      },
    }));
    const error = await client.createFolder("Setu POS – test").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect((error as DriveError).message).toMatch(/Google Drive API is not turned on/);
    expect((error as DriveError).reason).toBe("accessNotConfigured");
  });

  it("asks to tick the Drive box when the permission was not granted", () => {
    expect(driveErrorMessage(403, "Request had insufficient authentication scopes.", "insufficientPermissions")).toMatch(
      /tick the Google Drive box/,
    );
  });

  it("only blames shop access for real permission problems", () => {
    expect(driveErrorMessage(403, "The user does not have sufficient permissions for this file.", "insufficientFilePermissions")).toMatch(
      /Ask the owner to invite you again/,
    );
  });

  it("keeps rate limits and full Drives separate", () => {
    expect(driveErrorMessage(403, "Rate Limit Exceeded", "userRateLimitExceeded")).toMatch(/busy/);
    expect(driveErrorMessage(403, "The user's Drive storage quota has been exceeded.", "storageQuotaExceeded")).toMatch(/full/);
  });

  it("shows Google's own message for anything else", () => {
    expect(driveErrorMessage(403, "Something unusual happened.", "weirdReason")).toBe("Something unusual happened.");
  });
});
