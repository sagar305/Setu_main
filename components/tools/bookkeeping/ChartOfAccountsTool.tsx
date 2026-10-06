"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  ConfirmDialog,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { generateId } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import {
  ACCOUNT_TYPES,
  defaultAccounts,
  industryTemplates,
  type Account,
  type AccountType,
} from "@/lib/bookkeeping";

const TYPE_STYLES: Record<AccountType, string> = {
  asset: "bg-emerald-100 text-emerald-700",
  liability: "bg-red-100 text-red-600",
  equity: "bg-indigo/10 text-indigo",
  income: "bg-sky-100 text-sky-700",
  expense: "bg-amber-100 text-amber-700",
};

export function ChartOfAccountsTool() {
  // Chart of Accounts is a SHARED workspace entity — the Journal Entry, General
  // Ledger and Trial Balance tools read the same store. First-time users get a
  // ready-made small-business chart seeded once.
  const { t, lang } = useI18n();
  // The starter chart and the industry templates carry account names, which
  // are seeded into the shared chart, so they are built in the reader's
  // language — see lib/bookkeeping.
  const templates = useMemo(() => industryTemplates(lang), [lang]);
  const { items: accounts, loading, save, remove } = useEntityList<Account>("coa_accounts");
  const seededRef = useRef(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [templateId, setTemplateId] = useState("general");
  const [confirmTemplate, setConfirmTemplate] = useState(false);

  // Replace the whole chart with an industry template (confirmed first).
  const applyTemplate = async () => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    for (const account of accounts) await remove(account.id);
    for (const account of template.accounts) await save(account);
  };

  useEffect(() => {
    if (loading || seededRef.current || accounts.length > 0) return;
    seededRef.current = true;
    (async () => {
      for (const account of defaultAccounts(lang)) await save(account);
    })();
  }, [loading, accounts.length, save, lang]);

  const loaded = !loading;
  const canAdd = code.trim().length > 0 && name.trim().length > 0;

  const addAccount = () => {
    if (!canAdd) return;
    void save({ id: generateId(), code: code.trim(), name: name.trim(), type });
    setCode("");
    setName("");
  };

  const grouped = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return ACCOUNT_TYPES.map((group) => ({
      ...group,
      accounts: sorted.filter((a) => a.type === group.value),
    })).filter((g) => g.accounts.length > 0);
  }, [accounts]);

  const exportCsv = () =>
    downloadCsv(
      "chart-of-accounts.csv",
      toCsv(
        ["Code", "Account Name", "Type"],
        [...accounts]
          .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
          .map((a) => [a.code, a.name, a.type])
      )
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("coaStartFromTemplate")}</h2>
        <div className="mb-6 space-y-3">
          <Field label={t("coaIndustry")}>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {fill(t("coaTemplateOption"), {
                    name: item.name,
                    count: item.accounts.length,
                  })}
                </option>
              ))}
            </Select>
          </Field>
          <SecondaryButton className="w-full" onClick={() => setConfirmTemplate(true)}>
            {t("coaLoadTemplate")}
          </SecondaryButton>
        </div>

        <h2 className="mb-4 text-lg font-bold text-ink">{t("coaAddAccount")}</h2>
        <div className="space-y-4">
          <Field label={t("coaAccountCode")}>
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("coaCodePlaceholder")}
            />
          </Field>
          <Field label={t("coaAccountName")}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("coaNamePlaceholder")}
            />
          </Field>
          <Field label={t("typeLabel")}>
            <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </Select>
          </Field>
          <PrimaryButton className="w-full" onClick={addAccount} disabled={!canAdd}>
            {t("coaAddAccount")}
          </PrimaryButton>
          <p className="text-xs text-muted">{t("coaConvention")}</p>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("coaYourChart")}</h2>
          <SecondaryButton onClick={exportCsv} disabled={accounts.length === 0}>
            {t("exportCsv")}
          </SecondaryButton>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted">{t("loading")}</p>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.value}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {fill(t("coaGroupAccounts"), { type: t(group.label) })}
                </h3>
                <div className="space-y-1.5">
                  {group.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-sm font-semibold text-muted">{account.code}</span>
                        <span className="text-sm font-medium text-ink">{account.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLES[account.type]}`}
                        >
                          {t(group.label)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleting(account)}
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title={t("coaDeleteTitle")}
        message={
          deleting
            ? fill(t("coaDeleteMessage"), {
                code: deleting.code,
                name: deleting.name,
                deleted: t("bkDeletedAccount"),
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (deleting) void remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={confirmTemplate}
        title={t("coaReplaceTitle")}
        message={fill(t("coaReplaceMessage"), {
          name: templates.find((item) => item.id === templateId)?.name ?? "",
          deleted: t("bkDeletedAccount"),
        })}
        confirmLabel={t("coaLoadTemplateConfirm")}
        onConfirm={async () => {
          setConfirmTemplate(false);
          await applyTemplate();
        }}
        onCancel={() => setConfirmTemplate(false)}
      />
    </div>
  );
}
