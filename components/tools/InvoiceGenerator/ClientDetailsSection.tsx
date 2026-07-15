import type { ClientDetails } from "@/lib/types/invoice";

interface ClientDetailsSectionProps {
  data: ClientDetails;
  onChange: (data: Partial<ClientDetails>) => void;
}

export function ClientDetailsSection({
  data,
  onChange,
}: ClientDetailsSectionProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        Bill To
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink">Client Name *</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Client Business Name"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">Address *</label>
          <textarea
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="Street, City, State, PIN"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-ink">Phone</label>
            <input
              type="tel"
              value={data.phone || ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink">Email</label>
            <input
              type="email"
              value={data.email || ""}
              onChange={(e) => onChange({ email: e.target.value })}
              className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
              placeholder="client@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink">GSTIN (Optional)</label>
          <input
            type="text"
            value={data.gstin || ""}
            onChange={(e) => onChange({ gstin: e.target.value.toUpperCase() })}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder="27AABCT5678H2Z0"
            maxLength={15}
          />
          <p className="mt-1 text-xs text-muted-warm">
            Leave empty for B2C invoices
          </p>
        </div>
      </div>
    </div>
  );
}
