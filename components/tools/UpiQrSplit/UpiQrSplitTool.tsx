"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { UPIQRCode } from "@/components/tools/UpiQrGenerator/UPIQRCode";
import { generateUPIUrl, isValidUPIId } from "@/lib/upi";
import {
  DEFAULT_QR_CAP,
  MAX_QR_CHUNKS,
  UPI_MDR_FEE_CAP,
  ZERO_MDR_THRESHOLD,
  calculateMdr,
  splitForZeroMdr,
} from "@/lib/mdr";

const STORAGE_KEY = "setu.upi-qr-split.payee";

/**
 * UPI settles in INR only, so these amounts are always rupees — they do not
 * follow the workspace currency preference the calculators use.
 */
function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function UpiQrSplitTool() {
  const searchParams = useSearchParams();

  const [total, setTotal] = useState("");
  const [capPerQr, setCapPerQr] = useState(String(DEFAULT_QR_CAP));
  const [ratePct, setRatePct] = useState("0.4");
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [notePrefix, setNotePrefix] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // The MDR calculator hands the amount over in the URL.
  useEffect(() => {
    const fromUrl = searchParams.get("amount");
    if (fromUrl && Number.isFinite(Number(fromUrl)) && Number(fromUrl) > 0) {
      setTotal(fromUrl);
    }
  }, [searchParams]);

  // Payee details are the only thing worth remembering between visits, and they
  // stay on the device — nothing here is sent anywhere.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { upiId?: string; payeeName?: string };
      if (parsed.upiId) setUpiId(parsed.upiId);
      if (parsed.payeeName) setPayeeName(parsed.payeeName);
    } catch {
      // A blocked or corrupt localStorage just means no prefill.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ upiId, payeeName }));
    } catch {
      // Ignore — persistence is a convenience, not a requirement.
    }
  }, [upiId, payeeName]);

  const totalValue = Number(total) || 0;
  const capValue = Number(capPerQr) || 0;

  const split = useMemo(() => splitForZeroMdr(totalValue, capValue), [totalValue, capValue]);

  // What the same total would have cost as one transaction above the threshold.
  // Runs through the shared rail maths so the ₹300 cap is respected rather than
  // overstating the saving on a large collection.
  const mdrAvoided = useMemo(
    () =>
      calculateMdr({
        amount: totalValue,
        mode: "inclusive",
        ratePct: Number(ratePct) || 0,
        fixedFee: 0,
        gstPct: 18,
        thresholdAmount: ZERO_MDR_THRESHOLD,
        feeCap: UPI_MDR_FEE_CAP,
      }).totalDeduction,
    [totalValue, ratePct],
  );

  const upiTrimmed = upiId.trim();
  const upiValid = upiTrimmed.length > 0 && isValidUPIId(upiTrimmed);
  const upiError = upiTrimmed.length > 0 && !upiValid;
  const capTooHigh = capValue > ZERO_MDR_THRESHOLD;

  async function copyLink(index: number, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
    } catch {
      // Clipboard permission denied — the link is still visible on the card.
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ---- Form ---- */}
      <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-ink">Payment details</h2>

        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Total amount to collect</span>
            <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
              <span className="mr-2 text-sm text-muted-warm">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="7500"
                className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted-line"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Maximum per QR code</span>
            <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
              <span className="mr-2 text-sm text-muted-warm">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={capPerQr}
                onChange={(e) => setCapPerQr(e.target.value)}
                className="w-full bg-transparent py-3 text-base text-ink outline-none"
              />
            </div>
            <span className="mt-1.5 block text-xs text-muted">
              MDR starts above ₹{ZERO_MDR_THRESHOLD.toLocaleString("en-IN")}. The default sits a rupee
              under it.
            </span>
            {capTooHigh && (
              <span className="mt-1.5 block text-xs font-semibold text-red-600">
                Above ₹{ZERO_MDR_THRESHOLD.toLocaleString("en-IN")}, so these QR codes will attract MDR.
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Your UPI ID</span>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line ${
                upiError ? "border-red-400" : "border-muted-line/40 focus:border-indigo"
              }`}
            />
            {upiError && (
              <span className="mt-1.5 block text-xs font-semibold text-red-600">
                Invalid UPI ID format. Example: name@bankname
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">
              Business name <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder="Sharma Traders"
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">
              Reference note <span className="font-normal text-muted">(optional)</span>
            </span>
            <input
              type="text"
              value={notePrefix}
              onChange={(e) => setNotePrefix(e.target.value)}
              placeholder="Invoice 1042"
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus:border-indigo"
            />
            <span className="mt-1.5 block text-xs text-muted">
              Each QR is tagged with the part number, so payments are easy to reconcile.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-ink">MDR rate you would otherwise pay</span>
            <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
              <input
                type="number"
                inputMode="decimal"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                className="w-full bg-transparent py-3 text-base text-ink outline-none"
              />
              <span className="ml-2 text-sm text-muted-warm">%</span>
            </div>
          </label>
        </div>
      </div>

      {/* ---- Results ---- */}
      <div>
        {split.chunks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted-line/40 bg-cream p-10 text-center">
            <p className="text-muted">
              Enter the total you need to collect and your UPI ID to generate the QR codes.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-indigo/15 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                  QR codes needed
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                  {split.chunks.length}
                </p>
              </div>
              <div className="rounded-xl border border-indigo/15 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                  Total collected
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                  {inr(split.covered)}
                </p>
              </div>
              <div className="rounded-xl bg-indigo p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cream-paper/70">
                  MDR avoided
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-cream-paper">
                  {inr(mdrAvoided)}
                </p>
              </div>
            </div>

            {split.capped && (
              <p className="mt-4 rounded-xl border border-indigo/15 bg-white p-4 text-sm text-muted">
                This total needs more than {MAX_QR_CHUNKS} QR codes, so only the first{" "}
                {MAX_QR_CHUNKS} are shown, covering {inr(split.covered)}. A further{" "}
                {inr(split.shortfall)} is still outstanding — raise the amount per QR, or collect the
                balance separately.
              </p>
            )}

            {!upiValid && (
              <p className="mt-4 rounded-xl border border-indigo/15 bg-white p-4 text-sm text-muted">
                The split is ready. Add a valid UPI ID on the left to turn each part into a scannable
                QR code.
              </p>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {split.chunks.map((chunk, index) => {
                const note = notePrefix.trim()
                  ? `${notePrefix.trim()} (${index + 1}/${split.chunks.length})`
                  : `Part ${index + 1} of ${split.chunks.length}`;
                const url = upiValid
                  ? generateUPIUrl(upiTrimmed, chunk, note, payeeName.trim() || undefined)
                  : "";

                return (
                  <div
                    key={`${index}-${chunk}`}
                    className="rounded-2xl border border-indigo/15 bg-white p-5 text-center shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                      Part {index + 1} of {split.chunks.length}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{inr(chunk)}</p>

                    <div className="mt-4 flex min-h-[13rem] items-center justify-center">
                      {upiValid ? (
                        <UPIQRCode
                          upiId={upiTrimmed}
                          amount={chunk}
                          notes={note}
                          businessName={payeeName.trim() || undefined}
                        />
                      ) : (
                        <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-muted-line/40 text-xs text-muted">
                          Add a UPI ID
                        </div>
                      )}
                    </div>

                    {upiValid && (
                      <button
                        type="button"
                        onClick={() => copyLink(index, url)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" aria-hidden="true" /> Copy UPI link
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
