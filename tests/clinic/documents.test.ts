import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import {
  buildChartHtml,
  buildPrescriptionHtml,
  buildReceiptHtml,
  type ReceiptContext,
  type RxContext,
} from "@/lib/clinic/print";
import {
  DEFAULT_CLINIC_SETTINGS,
  DEFAULT_PAYMENT_MODES,
  EMPTY_VITALS,
  defaultClinicSettings,
  defaultMessageTemplates,
  defaultRxFooter,
  formatDate,
  formatDayMonth,
  formatTime,
  formShort,
  paymentModeLabel,
  rxFooterFor,
  statusLabel,
  timingLabel,
  type Doctor,
  type Patient,
  type Visit,
} from "@/lib/clinic/types";
import { clinicPlaceholders } from "@/lib/clinic/messages";
import { formatAge, formatAgeSex, sexLabel } from "@/lib/clinic/calc";

const CODES = LANGUAGES.map((l) => l.code);
const OTHERS = CODES.filter((code) => code !== "en");

const patient: Patient = {
  id: "p1",
  code: "SC-0142",
  name: "Asha Rao",
  dob: "1990-04-02",
  ageYearsAtRegistration: null,
  registeredOn: "2026-01-02",
  sex: "female",
  phone: "9876543210",
  altPhone: "",
  address: "",
  bloodGroup: "O+",
  allergies: ["Penicillin"],
  chronicConditions: ["Asthma"],
  familyId: null,
  photoDataUrl: "",
  customFields: [],
  notes: "",
  customerId: null,
  createdAt: "2026-01-02",
  updatedAt: "2026-01-02",
};

const doctor: Doctor = {
  id: "d1",
  name: "Dr Meera Nair",
  qualifications: "MBBS, MD",
  registrationNo: "KMC/12345",
  speciality: "Physician",
  consultationFee: 300,
  followUpFee: 0,
  followUpFreeDays: 7,
  signatureDataUrl: "",
  active: true,
  createdAt: "2026-01-02",
  updatedAt: "2026-01-02",
};

const visit: Visit = {
  id: "v1",
  patientId: "p1",
  doctorId: "d1",
  appointmentId: null,
  date: "2026-08-11",
  vitals: { ...EMPTY_VITALS, bp: "120/80", pulse: 78, weightKg: 61 },
  complaints: "Cough for four days",
  findings: "Chest clear",
  diagnosis: "Viral URI",
  advice: "Steam inhalation",
  investigations: ["CBC"],
  medicines: [
    {
      id: "m1",
      medicineId: null,
      name: "Paracetamol",
      strength: "500 mg",
      form: "tablet",
      frequency: "1-0-1",
      durationDays: 3,
      timing: "after-food",
      quantity: 6,
      instructions: "",
    },
  ],
  followUpDays: 5,
  internalNotes: "",
  finalisedAt: "2026-08-11",
  editedAfterFinaliseAt: null,
  createdAt: "2026-08-11",
  updatedAt: "2026-08-11",
};

const rxContext = (lang: LanguageCode): RxContext => ({
  business: { id: "main", name: "Sunrise Clinic" } as RxContext["business"],
  settings: defaultClinicSettings(lang),
  doctor,
  patient,
  visit,
  lang,
});

const receiptContext = (lang: LanguageCode): ReceiptContext => ({
  business: { id: "main", name: "Sunrise Clinic" } as ReceiptContext["business"],
  settings: defaultClinicSettings(lang),
  patient,
  doctorName: doctor.name,
  receiptNo: "RCP-0231",
  date: "2026-08-11",
  lines: [{ label: "Consultation", amount: 300 }],
  discount: 50,
  total: 250,
  paid: 100,
  paymentMode: "Cash",
  currencySymbol: "₹",
  lang,
});

describe("clinic stored values versus their labels", () => {
  /**
   * The appointment status, the medicine form and the dose timing are all
   * stored as coded values and only displayed through these, so a queue saved
   * in one language stays filterable in every other.
   */
  it("translates a status, a form and a timing", () => {
    expect(statusLabel("in-consult", "en")).toBe("In consult");
    expect(statusLabel("in-consult", "hi")).not.toBe(statusLabel("in-consult", "en"));
    expect(formShort("tablet", "en")).toBe("Tab.");
    expect(formShort("tablet", "ta")).not.toBe("Tab.");
    expect(timingLabel("after-food", "hi")).toBe(translate("hi", "clTimingAfterFood"));
  });

  it("has no label for the formless medicine or the blank timing", () => {
    expect(formShort("other", "hi")).toBe("");
    expect(timingLabel("", "hi")).toBe("");
  });

  it.each(OTHERS)("labels every status and form in %s", (lang) => {
    const code = lang as LanguageCode;
    for (const status of ["booked", "waiting", "in-consult", "done", "no-show", "cancelled"] as const) {
      expect(statusLabel(status, code).trim()).not.toBe("");
    }
    for (const form of ["tablet", "capsule", "syrup", "injection", "drops", "ointment", "inhaler", "sachet"] as const) {
      expect(formShort(form, code).trim()).not.toBe("");
    }
  });
});

describe("the seeds a clinic can edit", () => {
  it("re-languages a payment mode it seeded, and leaves one the clinic typed", () => {
    expect(paymentModeLabel("Cash", "hi")).toBe(translate("hi", "clPayCash"));
    // Seeded in one language, read in another: still the reader's.
    expect(paymentModeLabel(translate("ta", "clPayCard"), "de")).toBe(
      translate("de", "clPayCard")
    );
    expect(paymentModeLabel("Paytm wallet", "hi")).toBe("Paytm wallet");
  });

  it("re-languages our Rx footer and keeps the clinic's own wording", () => {
    expect(rxFooterFor(defaultRxFooter("en"), "bn")).toBe(defaultRxFooter("bn"));
    expect(rxFooterFor(defaultRxFooter("bn"), "en")).toBe(defaultRxFooter("en"));
    expect(rxFooterFor("Ask at the desk for a duplicate.", "hi")).toBe(
      "Ask at the desk for a duplicate."
    );
  });

  it("seeds the settings a fresh clinic starts on in its own language", () => {
    const hi = defaultClinicSettings("hi");
    expect(hi.rxFooterText).toBe(defaultRxFooter("hi"));
    expect(hi.messageTemplates.reportReady).toBe(translate("hi", "clTplReportReady"));
    // The merge base carries the shape, not the English copy.
    expect(DEFAULT_CLINIC_SETTINGS.rxFooterText).toBe("");
    expect(DEFAULT_PAYMENT_MODES).toEqual(["Cash", "UPI", "Card"]);
  });

  it.each(CODES)("keeps every template placeholder in %s", (lang) => {
    const templates = defaultMessageTemplates(lang as LanguageCode);
    const tokens = (text: string) =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");
    const english = defaultMessageTemplates("en");
    for (const key of Object.keys(english) as (keyof typeof english)[]) {
      expect(templates[key].trim()).not.toBe("");
      expect(tokens(templates[key])).toBe(tokens(english[key]));
    }
  });

  it("explains each placeholder in the reader's language", () => {
    const en = clinicPlaceholders("en");
    const hi = clinicPlaceholders("hi");
    expect(en.map((p) => p.token)).toEqual(hi.map((p) => p.token));
    expect(hi[0].meaning).toBe(translate("hi", "clPhPatientName"));
  });
});

describe("the patient strip", () => {
  it("writes the age unit and the sex in the reader's language", () => {
    expect(formatAge({ years: 34, months: 2 }, "en")).toBe("34 y");
    expect(formatAge({ years: 1, months: 3 }, "en")).toBe("15 m");
    expect(formatAge({ years: 34, months: 2 }, "hi")).toBe("34 वर्ष");
    expect(sexLabel("female", "hi")).toBe(translate("hi", "clSexFemale"));
    // Not the first letter of the stored English value any more.
    expect(formatAgeSex(patient, "hi", "2026-08-11")).not.toContain("F");
  });

  it("returns nothing for an unknown age", () => {
    expect(formatAge(null, "hi")).toBe("");
  });
});

describe("dates and times", () => {
  it("names the month in the reader's language", () => {
    expect(formatDate("2026-08-11", "en")).toBe("11 Aug 2026");
    expect(formatDate("2026-08-11", "hi")).not.toBe(formatDate("2026-08-11", "en"));
    expect(formatDayMonth("2026-08-11", "en")).toBe("11 Aug");
  });

  it("leaves a value that is not a date key alone", () => {
    expect(formatDate("", "hi")).toBe("");
    expect(formatTime("tomorrow", "hi")).toBe("tomorrow");
  });

  it("writes the clock the way the language writes it", () => {
    expect(formatTime("18:00", "en")).toMatch(/6:00/);
    expect(formatTime("18:00", "zh")).not.toBe(formatTime("18:00", "en"));
  });
});

describe("the printed documents", () => {
  it("prints a prescription with no English label left on it", () => {
    const html = buildPrescriptionHtml(rxContext("hi"));
    for (const english of ["Medicine", "Dosage", "Duration", "Advice", "Diagnosis", "Complaints", "Reg. No"]) {
      expect(html).not.toContain(`>${english}<`);
    }
    expect(html).toContain(translate("hi", "clDocMedicine"));
    expect(html).toContain(translate("hi", "clDocDiagnosis"));
    // The patient's own words and the medicine's name are never translated.
    expect(html).toContain("Viral URI");
    expect(html).toContain("Paracetamol");
  });

  it.each(OTHERS)("prints the Rx table headers in %s", (lang) => {
    const code = lang as LanguageCode;
    const html = buildPrescriptionHtml(rxContext(code));
    expect(html).toContain(translate(code, "clDocMedicine"));
    expect(html).toContain(translate(code, "clDocDosage"));
  });

  it("prints the chart export and the receipt in the reader's language", () => {
    const chart = buildChartHtml(
      { id: "main", name: "Sunrise Clinic" } as RxContext["business"],
      defaultClinicSettings("ta"),
      patient,
      [visit],
      [doctor],
      "ta"
    );
    expect(chart).toContain(translate("ta", "clDocPatientRecord"));
    expect(chart).not.toContain("Patient record");
    expect(chart).toContain(translate("ta", "clDocChronic"));

    const receipt = buildReceiptHtml(receiptContext("ta"));
    expect(receipt).toContain(translate("ta", "clDocReceipt"));
    expect(receipt).toContain(translate("ta", "clDocBalanceDue"));
    // The seeded payment mode is stored in English and printed in Tamil.
    expect(receipt).toContain(translate("ta", "clPayCash"));
    expect(receipt).not.toContain("Balance due");
  });

  it("says nothing about a history that is empty, in the reader's language", () => {
    const chart = buildChartHtml(null, defaultClinicSettings("de"), patient, [], [], "de");
    expect(chart).toContain(translate("de", "clDocNoConsults"));
  });
});
