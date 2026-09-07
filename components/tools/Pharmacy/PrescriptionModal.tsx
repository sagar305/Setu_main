"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { PrescriptionRef } from "@/lib/pharmacy/types";
import { todayKey } from "@/lib/pharmacy/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Shrink a photographed prescription before it goes anywhere near IndexedDB.
 *
 * A modern phone camera produces four or five megabytes per shot. A shop doing
 * twenty scheduled sales a day would fill its browser storage quota inside a
 * month, and the failure when it does is a bill that will not save — at the
 * counter, mid-sale. 1200px is comfortably enough to read a doctor's writing.
 */
async function downscale(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not read that image."));
    element.src = dataUrl;
  });

  const maxEdge = 1200;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

/**
 * Prescription capture, shown at bill completion and not before.
 *
 * The rule is enforced here because interrupting the operator the moment a
 * Schedule H strip is scanned makes the app something to work around. By the
 * time the bill is being closed the prescription is on the counter anyway.
 */
export function PrescriptionModal({
  open,
  initial,
  scheduledNames,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: PrescriptionRef | null;
  scheduledNames: string[];
  onSave: (prescription: PrescriptionRef) => void;
  onClose: () => void;
}) {
  const [doctorName, setDoctorName] = useState("");
  const [doctorRegNo, setDoctorRegNo] = useState("");
  const [patientName, setPatientName] = useState("");
  const [date, setDate] = useState(todayKey());
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDoctorName(initial?.doctorName ?? "");
    setDoctorRegNo(initial?.doctorRegNo ?? "");
    setPatientName(initial?.patientName ?? "");
    setDate(initial?.date || todayKey());
    setPhotoDataUrl(initial?.photoDataUrl ?? "");
    setError("");
  }, [initial, open]);

  const submit = () => {
    if (!doctorName.trim() || !doctorRegNo.trim() || !patientName.trim()) {
      setError("Doctor name, registration number and patient name are all required.");
      return;
    }
    onSave({
      doctorName: doctorName.trim(),
      doctorRegNo: doctorRegNo.trim(),
      patientName: patientName.trim(),
      date,
      photoDataUrl,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Prescription details">
      <div className="grid gap-4">
        <div className="rounded-lg border border-saffron/50 bg-saffron/10 p-3 text-sm text-ink">
          This bill has scheduled medicine
          {scheduledNames.length > 1 ? "s" : ""}:{" "}
          <strong>{scheduledNames.join(", ")}</strong>. Record the prescription before
          completing it.
        </div>

        <Field label="Patient name" required>
          <input
            className={inputClass}
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Doctor name" required>
            <input
              className={inputClass}
              value={doctorName}
              onChange={(event) => setDoctorName(event.target.value)}
            />
          </Field>
          <Field label="Registration no." required>
            <input
              className={inputClass}
              value={doctorRegNo}
              onChange={(event) => setDoctorRegNo(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Prescription date">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Field label="Photo of the prescription" hint="Optional — stored on this device only">
          {photoDataUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoDataUrl}
                alt="Prescription"
                className="max-h-40 rounded-lg border border-muted-line/30"
              />
              <button
                type="button"
                onClick={() => setPhotoDataUrl("")}
                className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-muted-line/40"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={secondaryBtnClass}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Add a photo
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                setPhotoDataUrl(await downscale(file));
              } catch {
                setError("That image could not be read.");
              }
            }}
          />
        </Field>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={submit} className={`${primaryBtnClass} sm:flex-1`}>
            Save and continue
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
