// Which models the assistant can download. A table only — nothing here loads
// anything, so the page can show names and sizes without touching the library.

export const AI_MODELS = {
  meaning: {
    repo: "Xenova/all-MiniLM-L6-v2",
    approximateMb: 23,
    label: "Smart understanding",
  },
  voice: {
    repo: "Xenova/whisper-tiny",
    approximateMb: 40,
    label: "Offline voice",
  },
} as const;
