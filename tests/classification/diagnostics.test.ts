// The import failure report. Its whole job is to be safe to send us.
// ---------------------------------------------------------------------------
// A statement is routinely called "SBI_Statement_<account holder>.pdf", so the
// file name is the one obvious thing that must never appear in a report the CA
// is invited to copy and paste to a stranger.

import { describe, expect, it } from "vitest";
import {
  describeFailure,
  formatDiagnostics,
  stackFrames,
} from "@/lib/bankStatement/utils/diagnostics";

const FILE = { name: "SBI_Statement_Ankit_Sharma_Apr2025.pdf", size: 482_000 };

describe("import diagnostics", () => {
  it("names the stage and the error class", () => {
    const failure = describeFailure(
      Object.assign(new Error("Invalid PDF structure."), { name: "InvalidPDFException" }),
      "Parsing statement",
      FILE
    );

    expect(failure.stage).toBe("Parsing statement");
    expect(failure.errorName).toBe("InvalidPDFException");
    expect(failure.message).toBe("Invalid PDF structure.");
  });

  it("keeps the file name out of the report entirely", () => {
    const report = formatDiagnostics(describeFailure(new Error("boom"), "Reading file", FILE));

    expect(report).not.toContain("Ankit");
    expect(report).not.toContain("Sharma");
    expect(report).not.toContain("SBI_Statement");
    // The shape is still reported, because that is what helps.
    expect(report).toContain(".pdf");
    expect(report).toContain("471 KB");
  });

  it("says so, in the report, that nothing from the statement is in it", () => {
    const report = formatDiagnostics(describeFailure(new Error("boom"), "Reading file", FILE));
    expect(report).toContain("no statement content is included");
  });

  it("survives something that is not an Error at all", () => {
    const failure = describeFailure("just a string", "Reading file", FILE);
    expect(failure.errorName).toBe("string");
    expect(failure.message).toBe("just a string");
    expect(failure.frames).toEqual([]);
  });

  it("keeps a file with no extension readable rather than guessing", () => {
    expect(describeFailure(new Error("x"), "Reading file", { name: "statement", size: 10 }).format).toBe(
      "(none)"
    );
  });

  it("strips absolute URLs out of the stack, keeping the function names", () => {
    const error = new Error("boom");
    error.stack = [
      "Error: boom",
      "    at readPage (https://setutechnology.com/_next/static/chunks/pdf.js:12:9)",
      "    at extractPdf (https://setutechnology.com/_next/static/chunks/pdf.js:40:2)",
    ].join("\n");

    const frames = stackFrames(error);
    expect(frames.length).toBe(2);
    expect(frames[0]).toContain("readPage");
    expect(frames.join(" ")).not.toContain("https://");
  });
});
