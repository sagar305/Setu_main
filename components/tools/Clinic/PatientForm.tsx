"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { generateId } from "@/lib/pos/types";
import { useClinic, type PatientInput } from "@/lib/clinic/store";
import {
  BLOOD_GROUPS,
  patientCustomFields,
  todayIso,
  type CustomField,
  type Patient,
  type Sex,
} from "@/lib/clinic/types";
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";
import { useI18n } from "@/lib/i18n";
import { fill, splitAround, type TKey } from "@/lib/i18n/translate";

const SEX_OPTIONS: { value: Sex; label: TKey }[] = [
  { value: "male", label: "clSexMale" },
  { value: "female", label: "clSexFemale" },
  { value: "other", label: "clSexOther" },
];

/** Comma-separated text ⇄ string[], for the allergy and condition fields. */
function toList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function PatientForm({
  patient,
  initialPhone,
  initialName,
  onSaved,
  onCancel,
}: {
  /** Editing an existing patient, or undefined to register a new one. */
  patient?: Patient;
  initialPhone?: string;
  initialName?: string;
  onSaved: (patient: Patient) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const { createPatient, updatePatient, findCustomerByPhone, findPatientByPhone } = useClinic();

  const [name, setName] = useState(patient?.name ?? initialName ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? initialPhone ?? "");
  const [altPhone, setAltPhone] = useState(patient?.altPhone ?? "");
  const [sex, setSex] = useState<Sex>(patient?.sex ?? "male");
  // Age is captured either way round: a DOB when they know it, plain years
  // when they don't. Storing which one we got is what keeps the age correct
  // on a chart opened three years later.
  const [ageMode, setAgeMode] = useState<"years" | "dob">(patient?.dob ? "dob" : "years");
  const [ageYears, setAgeYears] = useState(
    patient?.ageYearsAtRegistration != null ? String(patient.ageYearsAtRegistration) : ""
  );
  const [dob, setDob] = useState(patient?.dob ?? "");
  const [address, setAddress] = useState(patient?.address ?? "");
  const [bloodGroup, setBloodGroup] = useState(patient?.bloodGroup ?? "");
  const [allergies, setAllergies] = useState((patient?.allergies ?? []).join(", "));
  const [conditions, setConditions] = useState((patient?.chronicConditions ?? []).join(", "));
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(patient?.photoDataUrl ?? "");
  const [customFields, setCustomFields] = useState<CustomField[]>(
    patient ? patientCustomFields(patient) : []
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Never ask twice: if this number is already a workspace customer (from the
  // POS, the ledger, anywhere), offer their name rather than a blank field.
  const knownCustomer = useMemo(
    () => (patient ? null : findCustomerByPhone(phone)),
    [patient, phone, findCustomerByPhone]
  );
  const duplicate = useMemo(() => {
    if (patient) return null;
    const found = findPatientByPhone(phone);
    return found ?? null;
  }, [patient, phone, findPatientByPhone]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("clPfErrName"));
      return;
    }
    if (!phone.trim()) {
      setError(t("clPfErrPhone"));
      return;
    }
    setError("");
    setSaving(true);
    const input: PatientInput = {
      name: name.trim(),
      dob: ageMode === "dob" && dob ? dob : null,
      ageYearsAtRegistration:
        ageMode === "years" && ageYears ? Math.floor(Number(ageYears)) || null : null,
      sex,
      phone: phone.trim(),
      altPhone: altPhone.trim(),
      address: address.trim(),
      bloodGroup,
      allergies: toList(allergies),
      chronicConditions: toList(conditions),
      familyId: patient?.familyId ?? null,
      photoDataUrl,
      customFields: customFields.filter((field) => field.label.trim()),
      notes: notes.trim(),
      customerId: patient?.customerId ?? knownCustomer?.id ?? null,
      registeredOn: patient?.registeredOn ?? todayIso(),
    };
    try {
      if (patient) {
        await updatePatient(patient.id, input);
        onSaved({ ...patient, ...input } as Patient);
      } else {
        const created = await createPatient(input);
        onSaved(created);
      }
    } catch {
      setError(t("clPfErrSave"));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {duplicate && (
        <p className="rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-ink">
          {fill(t("clPfDuplicate"), { name: duplicate.name, code: duplicate.code })}
        </p>
      )}
      {!duplicate && knownCustomer && !name && (
        <button
          type="button"
          onClick={() => setName(knownCustomer.name)}
          className="w-full rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-left text-sm text-ink"
        >
          {splitAround(t("clPfKnownCustomer"), "name")[0]}
          <b>{knownCustomer.name}</b>
          {splitAround(t("clPfKnownCustomer"), "name")[1]}
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clPfName")} required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label={t("phone")} required>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("clSetPhonePh")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("clImpSex")}>
          <select
            value={sex}
            onChange={(event) => setSex(event.target.value as Sex)}
            className={inputClass}
          >
            {SEX_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <span className="mb-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("clImpAge")}
            <button
              type="button"
              onClick={() => setAgeMode(ageMode === "years" ? "dob" : "years")}
              className="text-[11px] font-semibold normal-case text-indigo underline"
            >
              {t(ageMode === "years" ? "clPfDobToggle" : "clPfAgeToggle")}
            </button>
          </span>
          {ageMode === "years" ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              value={ageYears}
              onChange={(event) => setAgeYears(event.target.value)}
              placeholder={t("clPfAgePh")}
              className={inputClass}
            />
          ) : (
            <input
              type="date"
              value={dob}
              max={todayIso()}
              onChange={(event) => setDob(event.target.value)}
              className={inputClass}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clPfAltPhone")}>
          <input
            type="tel"
            value={altPhone}
            onChange={(event) => setAltPhone(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("clPfBloodGroup")}>
          <select
            value={bloodGroup}
            onChange={(event) => setBloodGroup(event.target.value)}
            className={inputClass}
          >
            <option value="">{t("clPfNotKnown")}</option>
            {BLOOD_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("address")}>
        <textarea
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>

      <Field label={t("clPfAllergies")} hint={t("clPfAllergiesHint")}>
        <input
          type="text"
          value={allergies}
          onChange={(event) => setAllergies(event.target.value)}
          placeholder={t("clPfAllergiesPh")}
          className={inputClass}
        />
      </Field>

      <Field label={t("clPfChronic")} hint={t("clPfChronicHint")}>
        <input
          type="text"
          value={conditions}
          onChange={(event) => setConditions(event.target.value)}
          placeholder={t("clPfChronicPh")}
          className={inputClass}
        />
      </Field>

      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clPfPhoto")}
        </span>
        <div className="flex items-center gap-3">
          {photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoDataUrl}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream text-muted">
              <Camera className="h-5 w-5" />
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={secondaryBtnClass}
            >
              {t("clPfChooseFile")}
            </button>
            <button type="button" onClick={() => setCameraOpen(true)} className={secondaryBtnClass}>
              <Camera className="h-4 w-4" />
              {t("clPfCamera")}
            </button>
            {photoDataUrl && (
              <button
                type="button"
                onClick={() => setPhotoDataUrl("")}
                className={secondaryBtnClass}
              >
                {t("remove")}
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setPhotoDataUrl(await downscaleImage(file));
          }}
        />
      </div>

      {cameraOpen && (
        <CameraCapture
          onCapture={(dataUrl) => {
            setPhotoDataUrl(dataUrl);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clPfOtherDetails")}
        </span>
        <div className="space-y-2">
          {customFields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <input
                type="text"
                value={field.label}
                onChange={(event) =>
                  setCustomFields((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item
                    )
                  )
                }
                placeholder={t("clPfLabelPh")}
                className={`${inputClass} w-1/3`}
              />
              <input
                type="text"
                value={field.value}
                onChange={(event) =>
                  setCustomFields((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
                placeholder={t("clPfValuePh")}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t("clPfRemoveField")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCustomFields((prev) => [...prev, { id: generateId(), label: "", value: "" }])
            }
            className={secondaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            {t("clPfAddField")}
          </button>
        </div>
      </div>

      <Field label={t("notes")}>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
        )}
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? t("clPfSaving") : t(patient ? "clPfSaveChanges" : "clPtRegisterTitle")}
        </button>
      </div>
    </form>
  );
}

/**
 * Photos are stored as data URLs inside the patient record, so they have to be
 * small — a 4MB phone photo per patient would fill the origin's storage quota
 * within a few hundred registrations.
 */
async function downscaleImage(file: File, maxSize = 480): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode the image."));
      element.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return dataUrl;
  }
}

/** Camera capture, with the file input above as the fallback when it fails. */
function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("clPfCameraError"));
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.8));
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-ink/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-ink">{t("clPfTakePhoto")}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full rounded-lg bg-ink/10"
              aria-label={t("clPfCameraPreview")}
            />
            <button type="button" onClick={capture} className={`${primaryBtnClass} mt-3 w-full`}>
              {t("clPfCapture")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
