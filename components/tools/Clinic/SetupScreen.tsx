"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { CURRENCIES } from "@/lib/pos/types";
import { Field, inputClass, primaryBtnClass } from "@/components/tools/FreePos/ui";
import { useI18n } from "@/lib/i18n";

/**
 * Two things in one form: the clinic (the workspace Business) and the doctor
 * who signs the prescriptions. A doctor is not optional — a prescription
 * without a name and a registration number on it is not a prescription.
 */
export function SetupScreen() {
  const { t } = useI18n();
  const { createClinic, backToWelcome, business } = useClinic();

  const [name, setName] = useState(business?.name ?? "");
  const [phone, setPhone] = useState(business?.phone ?? "");
  const [address, setAddress] = useState(business?.address ?? "");
  const [currency, setCurrency] = useState(business?.currency ?? "INR");
  const [upiId, setUpiId] = useState(business?.upiId ?? "");

  const [doctorName, setDoctorName] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [followUpFee, setFollowUpFee] = useState("");
  const [followUpFreeDays, setFollowUpFreeDays] = useState("7");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("clSetErrName"));
      return;
    }
    if (!phone.trim()) {
      setError(t("clSetErrPhone"));
      return;
    }
    if (!doctorName.trim()) {
      setError(t("clSetErrDoctor"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createClinic(
        {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          currency,
          email: business?.email ?? "",
          taxNumber: business?.taxNumber ?? "",
          upiId: upiId.trim(),
          logoDataUrl: business?.logoDataUrl ?? "",
        },
        {
          name: doctorName.trim(),
          qualifications: qualifications.trim(),
          registrationNo: registrationNo.trim(),
          speciality: speciality.trim(),
          consultationFee: Number(consultationFee) || 0,
          followUpFee: Number(followUpFee) || 0,
          followUpFreeDays: Number(followUpFreeDays) || 0,
          signatureDataUrl: "",
          active: true,
        }
      );
    } catch {
      setError(t("clSetErrSave"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-8">
      <button
        type="button"
        onClick={backToWelcome}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </button>

      <h2 className="text-2xl font-bold tracking-tight text-ink">{t("clSetTitle")}</h2>
      <p className="mt-2 text-sm text-muted">{t("clSetBlurb")}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t("clSetClinicName")} required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("clSetClinicNamePh")}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label={t("clSetPhone")} required>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("clSetPhonePh")}
            className={inputClass}
          />
        </Field>
        <Field label={t("address")} hint={t("clSetAddressHint")}>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("currency")}>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("upiId")} hint={t("clSetUpiHint")}>
            <input
              type="text"
              value={upiId}
              onChange={(event) => setUpiId(event.target.value)}
              placeholder="clinic@okhdfcbank"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="border-t border-muted-line/30 pt-5">
          <h3 className="text-base font-bold text-ink">{t("clSetDoctorSection")}</h3>
          <p className="mt-1 text-sm text-muted">{t("clSetDoctorNote")}</p>
        </div>

        <Field label={t("clPhDoctorName")} required>
          <input
            type="text"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            placeholder={t("clSetDoctorNamePh")}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("clSetQualifications")}>
            <input
              type="text"
              value={qualifications}
              onChange={(event) => setQualifications(event.target.value)}
              placeholder="MBBS, MD (Medicine)"
              className={inputClass}
            />
          </Field>
          <Field label={t("clSetSpeciality")}>
            <input
              type="text"
              value={speciality}
              onChange={(event) => setSpeciality(event.target.value)}
              placeholder={t("clSetSpecialityPh")}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label={t("clSetRegNo")}>
          <input
            type="text"
            value={registrationNo}
            onChange={(event) => setRegistrationNo(event.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("clSetConsultFee")}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={consultationFee}
              onChange={(event) => setConsultationFee(event.target.value)}
              placeholder="300"
              className={inputClass}
            />
          </Field>
          <Field label={t("clSetFollowUpFee")} hint={t("clSetFreeHintZero")}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={followUpFee}
              onChange={(event) => setFollowUpFee(event.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label={t("clSetFreeWithin")} hint={t("clSetNeverHint")}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={followUpFreeDays}
              onChange={(event) => setFollowUpFreeDays(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className={`${primaryBtnClass} w-full`}>
          {saving ? t("clSetSaving") : t("clSetOpen")}
        </button>
      </form>
    </div>
  );
}
