// The assistant's privacy promise, enforced by reading its source.
//
// The panel says the assistant runs on this device and that its downloads
// carry nothing about the shop. Three things make that true, and each is
// pinned here: only one module can reach the model library, the only request
// the assistant itself makes is for its own language pack, and what crosses
// into the AI worker is limited to words, example phrasings and audio.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const FILES = [
  ...sourceFiles(join(process.cwd(), "lib", "pos", "assistant")),
  ...["AssistantPanel.tsx", "AssistantPackView.tsx"].map((f) => join(process.cwd(), "components", "tools", "FreePos", f)),
];
const read = (file: string) => stripComments(readFileSync(file, "utf8"));
const name = (file: string) => file.split("/").pop();

describe("POS assistant privacy", () => {
  it("has source to scan", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it("reaches the model library from exactly one module, loaded only by the worker", () => {
    expect(FILES.filter((f) => read(f).includes("@huggingface/transformers")).map(name)).toEqual(["modelProvider.ts"]);
    expect(FILES.filter((f) => /from "\.\/modelProvider"/.test(read(f))).map(name)).toEqual(["assistant-ai.worker.ts"]);
  });

  it("makes no request except for its own language pack", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const [index, line] of read(file).split("\n").entries()) {
        if (/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b/.test(line)) offenders.push(`${name(file)}:${index + 1}`);
        if (/\bfetch\s*\(/.test(line) && !/fetch\(PACK_URL\b/.test(line)) offenders.push(`${name(file)}:${index + 1}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(read(join(process.cwd(), "lib", "pos", "assistant", "pack.ts"))).toMatch(/PACK_URL = "\/pos-assistant\//);
  });

  it("sends the worker only words, example phrasings and audio", () => {
    const protocol = readFileSync(join(process.cwd(), "lib", "pos", "assistant", "ai", "protocol.ts"), "utf8");
    const declaration = protocol.match(/export type MainToWorker =([\s\S]*?);\n/);
    expect(declaration).not.toBeNull();
    const fields = new Set(
      [...(declaration as RegExpMatchArray)[1].matchAll(/(\w+)\s*:/g)].map((match) => match[1])
    );
    // A new field has to be justified here, in the test that keeps shop data out.
    expect([...fields].sort()).toEqual(["audio", "examples", "id", "language", "task", "text", "type"]);
  });

  it("never renders text as raw HTML", () => {
    expect(FILES.filter((f) => read(f).includes("dangerouslySetInnerHTML")).map(name)).toEqual([]);
  });

  it("tells the user what a download does and doesn't send", () => {
    const view = read(join(process.cwd(), "components", "tools", "FreePos", "AssistantPackView.tsx"));
    expect(view).toMatch(/sends nothing about your shop/);
    expect(view).toMatch(/turn your internet off/);
    const panel = read(join(process.cwd(), "components", "tools", "FreePos", "AssistantPanel.tsx"));
    // The browser-voice choice must say that it is online and where the audio goes.
    expect(panel).toMatch(/needs internet — your browser sends the audio to its speech service/);
  });
});
