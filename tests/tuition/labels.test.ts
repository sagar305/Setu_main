import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { describeConflict } from "@/lib/tuition/batchRules";
import { buildTuitionDue } from "@/lib/tuition/calc";
import { parseStudentImport } from "@/lib/tuition/csv";
import { messagePlaceholders } from "@/lib/tuition/messages";
import {
  DEFAULT_TUITION_SETTINGS,
  FEE_KIND_ORDER,
  TEMPLATE_ORDER,
  attendanceLabel,
  commonCustomFields,
  defaultPaymentModes,
  defaultTemplates,
  defaultTuitionSettings,
  describeDays,
  enquiryLabel,
  feeKindLabel,
  feeLabelFor,
  formatDate,
  formatMonth,
  formatTime,
  paymentModeLabel,
  templateFor,
  weekdayNames,
  type AttendanceStatus,
  type Batch,
  type EnquiryStatus,
  type Student,
} from "@/lib/tuition/types";

const CODES = LANGUAGES.map(({ code }) => code);

const ATTENDANCE: AttendanceStatus[] = ["present", "absent", "late", "leave", "holiday"];
const ENQUIRY: EnquiryStatus[] = ["new", "followup", "demo", "joined", "lost"];

const batch: Batch = {
  id: "b1",
  name: "Maths Evening",
  subject: "Maths",
  classLevel: "10",
  days: [1, 3, 5],
  startTime: "18:00",
  endTime: "19:30",
  monthlyFee: 1200,
  capacity: 20,
  active: true,
  notes: "",
  createdAt: "2026-01-01T04:00:00.000Z",
};

const student: Student = {
  id: "s1",
  name: "Aarav",
  rollNo: "",
  classLevel: "10",
  school: "",
  dob: "",
  batchIds: ["b1"],
  parentName: "Rakesh",
  parentPhone: "9876543210",
  altPhone: "",
  joinDate: "2026-01-01",
  customMonthlyFee: null,
  concession: 0,
  status: "active",
  leftOn: null,
  leaveReason: null,
  custom: {},
  notes: "",
  createdAt: "2026-01-01T04:00:00.000Z",
  updatedAt: "2026-01-01T04:00:00.000Z",
};

describe("coded values are named in the reader's language", () => {
  it("names every attendance mark in every language", () => {
    for (const code of CODES) {
      const labels = ATTENDANCE.map((status) => attendanceLabel(status, code));
      for (const [index, label] of labels.entries()) {
        expect(label.trim(), `${ATTENDANCE[index]}/${code}`).not.toBe("");
      }
      expect(new Set(labels).size, code).toBe(ATTENDANCE.length);
    }
  });

  it("names every fee kind and enquiry stage in every language", () => {
    for (const code of CODES) {
      const fees = FEE_KIND_ORDER.map((kind) => feeKindLabel(kind, code));
      expect(new Set(fees).size, code).toBe(FEE_KIND_ORDER.length);
      const stages = ENQUIRY.map((status) => enquiryLabel(status, code));
      expect(new Set(stages).size, code).toBe(ENQUIRY.length);
    }
  });

  it("falls back to the stored value for a status it has no word for", () => {
    expect(attendanceLabel("no-such-mark" as AttendanceStatus, "hi")).toBe("no-such-mark");
  });

  it("offers the custom fields and payment modes in the reader's language", () => {
    for (const code of CODES) {
      expect(commonCustomFields(code), code).toHaveLength(5);
      for (const field of commonCustomFields(code)) {
        expect(field.trim(), code).not.toBe("");
      }
      expect(defaultPaymentModes(code), code).toHaveLength(4);
    }
    expect(defaultPaymentModes("ta")).not.toEqual(defaultPaymentModes("en"));
  });
});

describe("a stored label follows the reader until somebody rewrites it", () => {
  it("re-languages a fee label that is still one of our seeds", () => {
    for (const from of CODES) {
      const seeded = feeKindLabel("tuition", from);
      expect(feeLabelFor(seeded, "bn")).toBe(feeKindLabel("tuition", "bn"));
    }
  });

  it("leaves a label the teacher typed exactly as it is", () => {
    for (const code of CODES) {
      expect(feeLabelFor("Diwali batch top-up", code)).toBe("Diwali batch top-up");
    }
  });

  it("re-languages a seeded payment mode and keeps a custom one", () => {
    expect(paymentModeLabel(defaultPaymentModes("en")[0], "te")).toBe(
      defaultPaymentModes("te")[0]
    );
    expect(paymentModeLabel("Paytm wallet", "te")).toBe("Paytm wallet");
  });
});

describe("the WhatsApp templates", () => {
  it("carries the same placeholders as English in every language", () => {
    const english = defaultTemplates("en");
    for (const key of TEMPLATE_ORDER) {
      const wanted = [...english[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const code of CODES) {
        const got = [...defaultTemplates(code)[key].matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort();
        expect(got, `${key}/${code}`).toEqual(wanted);
      }
    }
  });

  it("re-languages a seeded template and keeps the teacher's own", () => {
    for (const key of TEMPLATE_ORDER) {
      expect(templateFor(key, defaultTemplates("en")[key], "mr")).toBe(
        defaultTemplates("mr")[key]
      );
      expect(templateFor(key, "Namaste {parent}", "mr")).toBe("Namaste {parent}");
    }
  });

  it("stands in the shipped wording when a template was never set", () => {
    for (const key of TEMPLATE_ORDER) {
      expect(templateFor(key, "", "gu")).toBe(defaultTemplates("gu")[key]);
    }
  });

  it("explains all nineteen placeholders in every language", () => {
    for (const code of CODES) {
      const rows = messagePlaceholders(code);
      expect(rows, code).toHaveLength(19);
      for (const row of rows) {
        expect(row.meaning.trim(), `${row.token}/${code}`).not.toBe("");
      }
    }
  });

  it("seeds a new install's settings in the reader's language", () => {
    const tamil = defaultTuitionSettings("ta");
    expect(tamil.templates).toEqual(defaultTemplates("ta"));
    expect(tamil.paymentModes).toEqual(defaultPaymentModes("ta"));
  });

  it("keeps the shipped defaults out of the merge-shape base", () => {
    // DEFAULT_TUITION_SETTINGS is folded onto a stored row, so an empty string
    // means "a key this install never had" rather than English.
    expect(DEFAULT_TUITION_SETTINGS.paymentModes).toEqual([]);
    for (const key of TEMPLATE_ORDER) {
      expect(DEFAULT_TUITION_SETTINGS.templates[key], key).toBe("");
    }
  });
});

describe("dates, days and times follow the reader's calendar", () => {
  it("starts the week on Sunday so the index matches Date.getDay()", () => {
    for (const code of CODES) {
      const names = weekdayNames(code);
      expect(names, code).toHaveLength(7);
      expect(new Set(names).size, code).toBe(7);
    }
    expect(weekdayNames("en")[0]).toBe("Sun");
  });

  it("describes a schedule without falling back to English", () => {
    for (const code of CODES) {
      expect(describeDays([], code), code).toBe(translate(code, "tuNoFixedDays"));
      expect(describeDays([0, 1, 2, 3, 4, 5, 6], code), code).toBe(translate(code, "tuDaily"));
      expect(describeDays([1, 3], code), code).toContain(weekdayNames(code)[1]);
    }
    expect(describeDays([], "hi")).not.toBe("No fixed days");
  });

  it("writes a month, a date and a clock the way the reader does", () => {
    expect(formatMonth("2026-08", "en")).toBe("Aug 2026");
    expect(formatMonth("2026-08", "hi")).not.toBe(formatMonth("2026-08", "en"));
    expect(formatDate("2026-08-11", "en")).toContain("2026");
    expect(formatDate("", "hi")).toBe("");
    expect(formatDate("not-a-date", "hi")).toBe("not-a-date");
    expect(formatTime("18:00", "en")).toMatch(/6/);
    expect(formatTime("notatime", "en")).toBe("notatime");
  });
});

describe("the messages a helper hands back", () => {
  it("snapshots a monthly due's label in the reader's language", () => {
    for (const code of CODES) {
      const due = buildTuitionDue(student, [batch], "2026-08", 5, student.createdAt, code);
      expect(due.label, code).toBe(feeKindLabel("tuition", code));
    }
  });

  it("explains every batch clash without bare English", () => {
    const kinds = ["duplicate-name", "time-clash", "same-subject"] as const;
    for (const kind of kinds) {
      for (const code of CODES) {
        const text = describeConflict({ kind, batch }, code);
        expect(text, `${kind}/${code}`).toContain(batch.name);
        expect(text, `${kind}/${code}`).not.toContain("{");
      }
      expect(describeConflict({ kind, batch }, "hi"), kind).not.toBe(
        describeConflict({ kind, batch }, "en")
      );
    }
  });

  it("reports an import problem in the reader's language", () => {
    for (const code of CODES) {
      const empty = parseStudentImport("", [batch], code);
      expect(empty.errors, code).toEqual([translate(code, "tuImNothingToImport")]);
      const nameless = parseStudentImport(",10,Rakesh,9876543210", [batch], code);
      expect(nameless.errors[0], code).toContain("1");
      expect(nameless.errors[0], code).not.toContain("{");
    }
  });
});

describe("what a spreadsheet reads stays English", () => {
  it("keeps a localized import working on English headers", () => {
    const result = parseStudentImport(
      "Name,Class,Parent,Phone,Batch\nAarav,10,Rakesh,9876543210,Maths Evening",
      [batch],
      "hi" as LanguageCode
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].batchIds).toEqual(["b1"]);
  });
});
