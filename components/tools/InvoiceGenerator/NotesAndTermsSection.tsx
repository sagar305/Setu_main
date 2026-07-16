interface NotesAndTermsSectionProps {
  notes: string;
  terms: string;
  onNotesChange: (notes: string) => void;
  onTermsChange: (terms: string) => void;
}

const TERMS_TEMPLATES = [
  "Payment due within 15 days",
  "Payment due upon receipt",
  "Payment due within 30 days. Late payment fee of 1.5% per month applies.",
  "Please make payment to UPI ID or Bank Account provided above",
];

export function NotesAndTermsSection({
  notes,
  terms,
  onNotesChange,
  onTermsChange,
}: NotesAndTermsSectionProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        Notes & Terms
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Thank you for your business! Any special notes here..."
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-semibold text-ink">
              Terms & Conditions
            </label>
          </div>
          <textarea
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Payment terms, conditions, late fees, etc."
          />

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold text-muted-warm">Quick Templates:</p>
            <div className="flex flex-wrap gap-2">
              {TERMS_TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => onTermsChange(template)}
                  className="rounded-full border border-muted-line/40 bg-cream px-3 py-1 text-xs text-muted transition hover:border-indigo hover:bg-indigo/5"
                >
                  {template.substring(0, 25)}...
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
