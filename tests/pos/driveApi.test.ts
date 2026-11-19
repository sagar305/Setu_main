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

import { pickAllFiles, type PickRound } from "@/lib/pos/drive/picker";

describe("joining picks every invited file, one at a time if needed", () => {
  it("asks again for the remaining file when the picker allows only one (phones)", async () => {
    const rounds: string[][] = [];
    const onePerRound: PickRound = async (remaining) => {
      rounds.push(remaining);
      return [remaining[0]];
    };
    expect(await pickAllFiles(["shop", "mine"], onePerRound)).toEqual(["shop", "mine"]);
    expect(rounds).toEqual([["shop", "mine"], ["mine"]]);
  });

  it("finishes in one round when all are picked together (computers)", async () => {
    let calls = 0;
    const all: PickRound = async (remaining) => {
      calls += 1;
      return remaining;
    };
    expect(await pickAllFiles(["shop", "books", "mine"], all)).toHaveLength(3);
    expect(calls).toBe(1);
  });

  it("stops when the person cancels", async () => {
    const cancel: PickRound = async () => null;
    expect(await pickAllFiles(["shop", "mine"], cancel)).toBeNull();
  });

  it("gives up after rounds that pick nothing new instead of looping forever", async () => {
    let calls = 0;
    const stuck: PickRound = async () => {
      calls += 1;
      return ["something-else"];
    };
    expect(await pickAllFiles(["shop", "mine"], stuck)).toEqual([]);
    expect(calls).toBe(3);
  });
});
