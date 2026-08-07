"use client";

import { useState } from "react";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SectionHeading,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

/**
 * Areas and tables. Editing the floor is rare — you lay it out once and touch
 * it when you add a terrace — so this lives away from the order screens.
 */
export function TablesScreen() {
  const {
    areas,
    tables,
    openTickets,
    createArea,
    renameArea,
    deleteArea,
    createTable,
    updateTable,
    deleteTable,
    addTables,
  } = useDine();

  const [areaName, setAreaName] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState("4");
  const [bulkSeats, setBulkSeats] = useState("4");
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<string | null>(null);

  const busyTableIds = new Set(
    openTickets.map((ticket) => ticket.tableId).filter((id): id is string => Boolean(id))
  );

  const orderedAreas = areas.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Tables and areas"
        subtitle={`${tables.length} table${tables.length === 1 ? "" : "s"} across ${
          areas.length
        } area${areas.length === 1 ? "" : "s"}`}
      />

      <div className="flex flex-wrap gap-2">
        <input
          value={areaName}
          onChange={(event) => setAreaName(event.target.value)}
          placeholder="New area — Terrace, AC Section…"
          className={`${inputClass} max-w-xs flex-1`}
        />
        <button
          type="button"
          onClick={async () => {
            if (!areaName.trim()) return;
            await createArea(areaName.trim());
            setAreaName("");
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" />
          Add area
        </button>
      </div>

      {orderedAreas.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-6 w-6" />}
          title="No areas yet"
          message="Add an area — Main Hall, Terrace — and put some tables in it."
        />
      ) : (
        orderedAreas.map((area) => {
          const areaTables = tables
            .filter((table) => table.areaId === area.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div
              key={area.id}
              className="space-y-3 rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={area.name}
                  onChange={(event) => void renameArea(area.id, event.target.value)}
                  aria-label="Area name"
                  className={`${inputClass} max-w-[220px] flex-1 font-semibold`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setAddingTo(area.id);
                    setBulkCount("4");
                    setBulkSeats("4");
                  }}
                  className={secondaryBtnClass}
                >
                  <Plus className="h-4 w-4" />
                  Add tables
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteAreaTarget(area.id)}
                  aria-label={`Delete ${area.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {areaTables.length === 0 ? (
                <p className="text-sm text-muted">No tables in this area yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {areaTables.map((table) => {
                    const busy = busyTableIds.has(table.id);
                    return (
                      <div
                        key={table.id}
                        className="rounded-xl border border-muted-line/30 bg-cream/40 p-2"
                      >
                        <input
                          value={table.name}
                          onChange={(event) =>
                            void updateTable(table.id, event.target.value, table.seats)
                          }
                          aria-label="Table name"
                          className={`${inputClass} font-semibold`}
                        />
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            inputMode="numeric"
                            value={String(table.seats)}
                            onChange={(event) =>
                              void updateTable(
                                table.id,
                                table.name,
                                Number(event.target.value) || 1
                              )
                            }
                            aria-label="Seats"
                            className={`${inputClass} w-14`}
                          />
                          <span className="text-xs text-muted">seats</span>
                          <button
                            type="button"
                            onClick={() => void deleteTable(table.id)}
                            disabled={busy}
                            title={busy ? "This table has a running ticket." : "Delete table"}
                            aria-label={`Delete ${table.name}`}
                            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {busy && (
                          <p className="mt-1 text-[10px] font-semibold uppercase text-saffron">
                            Running
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      <Modal open={addingTo !== null} onClose={() => setAddingTo(null)} title="Add tables">
        <div className="space-y-4">
          <Field label="How many?">
            <input
              inputMode="numeric"
              value={bulkCount}
              onChange={(event) => setBulkCount(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Seats per table">
            <input
              inputMode="numeric"
              value={bulkSeats}
              onChange={(event) => setBulkSeats(event.target.value)}
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-muted">
            They are named T1, T2 and so on, carrying on from the tables already in this area. Rename
            any of them afterwards.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAddingTo(null)} className={secondaryBtnClass}>
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!addingTo) return;
                await addTables(addingTo, Number(bulkCount) || 0, Number(bulkSeats) || 4);
                setAddingTo(null);
              }}
              className={`${primaryBtnClass} ${tapTargetClass}`}
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteAreaTarget !== null}
        title="Delete this area?"
        message="Its tables go with it. Bills already taken on those tables keep their record."
        onCancel={() => setDeleteAreaTarget(null)}
        onConfirm={async () => {
          if (deleteAreaTarget) await deleteArea(deleteAreaTarget);
          setDeleteAreaTarget(null);
        }}
      />
    </div>
  );
}

/** One-off table creator used from the floor's empty state. */
export function useCreateSingleTable() {
  const { createTable } = useDine();
  return createTable;
}
