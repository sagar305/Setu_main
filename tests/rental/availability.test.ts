import { describe, expect, it } from "vitest";
import {
  availabilityFor,
  buildIndex,
  calendarStrip,
  commitmentEnd,
  findConflicts,
  freeUnits,
} from "@/lib/rental/availability";
import {
  bookingTotals,
  chargeableUnitsFor,
  damageChargeFor,
  defaultLossCharge,
  depositsHeld,
  lateDaysFor,
  lateFeeFor,
  settleBooking,
} from "@/lib/rental/calc";
import { DEFAULT_SETTINGS } from "@/lib/rental/types";
import type {
  Booking,
  BookingLine,
  BookingPayment,
  ItemUnit,
  MaintenanceLog,
  RentalItem,
  RentalSettings,
} from "@/lib/rental/types";

const TODAY = "2026-09-02";

function item(overrides: Partial<RentalItem> = {}): RentalItem {
  return {
    id: "chair",
    name: "Plastic chair",
    categoryId: "seating",
    tracking: "bulk",
    totalQuantity: 200,
    rateBasis: "per-day",
    rate: 15,
    depositPerUnit: 0,
    lateFeePerUnitPerDay: 0,
    replacementValue: 300,
    purchaseCost: 250,
    purchasedOn: "2024-01-01",
    imageDataUrl: "",
    active: true,
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function line(overrides: Partial<BookingLine> = {}): BookingLine {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    itemId: "chair",
    name: "Plastic chair",
    quantity: 50,
    unitIds: [],
    rateBasis: "per-day",
    rate: 15,
    chargeableUnits: 1,
    amount: 750,
    depositPerUnit: 0,
    returnedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    damageCharge: 0,
    lossCharge: 0,
    returnNote: "",
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    bookingNo: "BK-0001",
    customerId: "c1",
    status: "confirmed",
    fromDate: "2026-09-10",
    toDate: "2026-09-12",
    fromTime: "",
    toTime: "",
    eventName: "",
    venue: "",
    venueContact: "",
    lines: [line()],
    transportCharge: 0,
    labourCharge: 0,
    discount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    depositTotal: 0,
    advancePaid: 0,
    overCommitted: false,
    actualReturnedOn: null,
    lateDays: 0,
    lateFee: 0,
    damageTotal: 0,
    lossTotal: 0,
    depositRefunded: 0,
    finalPayable: 0,
    paid: 0,
    paymentMode: "",
    payments: [],
    dispatchedOn: null,
    dispatchSignature: "",
    returnSignature: "",
    invoiceNo: null,
    invoicedOn: null,
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function payment(overrides: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: Math.random().toString(36).slice(2),
    date: TODAY,
    amount: 0,
    mode: "Cash",
    kind: "advance",
    note: "",
    createdAt: `${TODAY}T00:00:00.000Z`,
    ...overrides,
  };
}

const settings: RentalSettings = { ...DEFAULT_SETTINGS };

function index(bookings: Booking[], logs: MaintenanceLog[] = [], bufferDays = 0) {
  return buildIndex(bookings, logs, { bufferDays, today: TODAY });
}

describe("committed stock", () => {
  it("is the maximum overlap on a single day, not the sum across the range", () => {
    // Two bookings of 50 that never share a day: 50 committed, not 100.
    const apart = index([
      booking({ fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ fromDate: "2026-09-14", toDate: "2026-09-14" }),
    ]);
    expect(availabilityFor(apart, item(), "2026-09-10", "2026-09-14").free).toBe(150);

    // The same two bookings on the same day: 100 committed.
    const together = index([
      booking({ fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ fromDate: "2026-09-10", toDate: "2026-09-10" }),
    ]);
    expect(availabilityFor(together, item(), "2026-09-10", "2026-09-14").free).toBe(100);
  });

  it("reports the day the pinch happens on", () => {
    const built = index([
      booking({ fromDate: "2026-09-10", toDate: "2026-09-12" }),
      booking({ fromDate: "2026-09-12", toDate: "2026-09-14" }),
    ]);
    const availability = availabilityFor(built, item(), "2026-09-10", "2026-09-14");
    expect(availability.tightestDate).toBe("2026-09-12");
    expect(availability.committed).toBe(100);
  });

  it("ignores enquiries and cancellations — a quote holds nothing", () => {
    const built = index([
      booking({ status: "enquiry" }),
      booking({ status: "cancelled" }),
      booking({ status: "returned" }),
      booking({ status: "closed" }),
    ]);
    expect(availabilityFor(built, item(), "2026-09-10", "2026-09-12").free).toBe(200);
  });

  it("counts confirmed and dispatched bookings", () => {
    const built = index([booking({ status: "confirmed" }), booking({ status: "dispatched" })]);
    expect(availabilityFor(built, item(), "2026-09-10", "2026-09-12").free).toBe(100);
  });

  it("holds stock for the buffer days after the return date", () => {
    const built = index([booking({ fromDate: "2026-09-10", toDate: "2026-09-12" })], [], 2);
    expect(availabilityFor(built, item(), "2026-09-14", "2026-09-14").free).toBe(150);
    expect(availabilityFor(built, item(), "2026-09-15", "2026-09-15").free).toBe(200);
  });

  it("keeps overdue stock committed rather than promising it out", () => {
    // Due back a week ago and still out: it is holding those chairs today.
    const overdue = booking({
      status: "dispatched",
      fromDate: "2026-08-20",
      toDate: "2026-08-26",
    });
    expect(commitmentEnd(overdue, 0, TODAY)).toBe(TODAY);

    const built = index([overdue]);
    expect(availabilityFor(built, item(), TODAY, TODAY).free).toBe(150);
  });

  it("releases stock the moment a booking is returned, even before it is settled", () => {
    const returned = booking({
      status: "returned",
      fromDate: "2026-08-20",
      toDate: "2026-08-26",
      actualReturnedOn: "2026-08-26",
    });
    expect(availabilityFor(index([returned]), item(), TODAY, TODAY).free).toBe(200);
  });
});

describe("maintenance", () => {
  function log(overrides: Partial<MaintenanceLog> = {}): MaintenanceLog {
    return {
      id: Math.random().toString(36).slice(2),
      itemId: "chair",
      unitId: null,
      quantity: 20,
      date: "2026-09-01",
      kind: "repair",
      description: "",
      cost: 500,
      outOfServiceFrom: "2026-09-10",
      outOfServiceTo: "2026-09-11",
      createdAt: "2026-09-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("removes the logged quantity from availability for its window", () => {
    const built = index([], [log()]);
    expect(availabilityFor(built, item(), "2026-09-10", "2026-09-10").free).toBe(180);
    expect(availabilityFor(built, item(), "2026-09-12", "2026-09-12").free).toBe(200);
  });

  it("treats an open-ended repair as blocking to the horizon", () => {
    const built = buildIndex([], [log({ outOfServiceTo: null })], {
      bufferDays: 0,
      today: TODAY,
      horizonEnd: "2026-12-31",
    });
    expect(availabilityFor(built, item(), "2026-11-01", "2026-11-01").free).toBe(180);
  });

  it("ignores a log with no out-of-service window — it is only a cost record", () => {
    const built = index([], [log({ outOfServiceFrom: null, outOfServiceTo: null })]);
    expect(availabilityFor(built, item(), "2026-09-10", "2026-09-10").free).toBe(200);
  });

  it("stacks with bookings on the same day", () => {
    const built = index([booking({ fromDate: "2026-09-10", toDate: "2026-09-10" })], [log()]);
    const availability = availabilityFor(built, item(), "2026-09-10", "2026-09-10");
    expect(availability.committed).toBe(50);
    expect(availability.maintenance).toBe(20);
    expect(availability.free).toBe(130);
  });
});

describe("conflicts", () => {
  it("flags a booking that promises more than is owned", () => {
    const small = item({ totalQuantity: 80 });
    const bookings = [
      booking({ id: "a", fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ id: "b", fromDate: "2026-09-10", toDate: "2026-09-10" }),
    ];
    const conflicts = findConflicts(bookings, [small], [], 0, TODAY);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].shortfall).toBe(20);
    expect(conflicts[0].date).toBe("2026-09-10");
  });

  it("stops flagging a shortfall the owner has already accepted", () => {
    // 80 owned, one sound booking for 50, and a second for 50 the owner
    // knowingly took while sub-hiring the difference. Neither is a problem: the
    // first fits, and the second has been dealt with. Flagging the first — the
    // one booking nobody should touch — is worse than saying nothing.
    const small = item({ totalQuantity: 80 });
    const bookings = [
      booking({ id: "a", fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ id: "b", fromDate: "2026-09-10", toDate: "2026-09-10", overCommitted: true }),
    ];
    expect(findConflicts(bookings, [small], [], 0, TODAY)).toEqual([]);
  });

  it("still flags a shortfall the acknowledged bookings do not explain", () => {
    const small = item({ totalQuantity: 80 });
    const bookings = [
      booking({ id: "a", fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ id: "b", fromDate: "2026-09-10", toDate: "2026-09-10" }),
      booking({ id: "c", fromDate: "2026-09-10", toDate: "2026-09-10", overCommitted: true }),
    ];
    // a + b alone are 100 against 80 owned, which the override on c does not
    // cover — both unacknowledged bookings are still in conflict.
    const conflicts = findConflicts(bookings, [small], [], 0, TODAY);
    expect(conflicts.map((conflict) => conflict.bookingId).sort()).toEqual(["a", "b"]);
    expect(conflicts[0].committed).toBe(100);
  });

  it("says nothing when everything fits", () => {
    expect(findConflicts([booking()], [item()], [], 0, TODAY)).toEqual([]);
  });
});

describe("serialised units", () => {
  function unit(overrides: Partial<ItemUnit> = {}): ItemUnit {
    return {
      id: overrides.id ?? Math.random().toString(36).slice(2),
      itemId: "camera",
      serialNo: "CAM-001",
      condition: "good",
      currentBookingId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("offers only good units that no other live booking holds", () => {
    const units = [
      unit({ id: "u1" }),
      unit({ id: "u2", condition: "needs-repair" }),
      unit({ id: "u3" }),
      unit({ id: "u4", condition: "retired" }),
    ];
    const held = booking({
      status: "dispatched",
      lines: [line({ itemId: "camera", quantity: 1, unitIds: ["u3"] })],
    });
    const built = index([held]);
    expect(freeUnits(built, units, "camera").map((row) => row.id)).toEqual(["u1"]);
  });

  it("still offers the units the booking being edited already holds", () => {
    const units = [unit({ id: "u1" }), unit({ id: "u3" })];
    const held = booking({
      id: "edit-me",
      status: "dispatched",
      lines: [line({ itemId: "camera", quantity: 1, unitIds: ["u3"] })],
    });
    const built = index([held]);
    expect(freeUnits(built, units, "camera", "edit-me").map((row) => row.id)).toEqual([
      "u1",
      "u3",
    ]);
  });

  it("drops retired units from the total owned", () => {
    const camera = item({ id: "camera", totalQuantity: 4 });
    expect(availabilityFor(index([]), camera, TODAY, TODAY, 1).total).toBe(3);
  });
});

describe("calendar strip", () => {
  it("returns one cell per day, starting at the given date", () => {
    const built = index([booking({ fromDate: "2026-09-03", toDate: "2026-09-03" })]);
    const days = calendarStrip(built, "chair", TODAY, 3);
    expect(days.map((day) => day.date)).toEqual(["2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(days.map((day) => day.committed)).toEqual([0, 50, 0]);
  });
});

describe("chargeable units", () => {
  const window = {
    fromDate: "2026-09-10",
    toDate: "2026-09-12",
    fromTime: "09:00",
    toTime: "17:00",
  };

  it("counts the return day when the setting says to", () => {
    expect(chargeableUnitsFor("per-day", window, { countReturnDay: true })).toBe(3);
    expect(chargeableUnitsFor("per-day", window, { countReturnDay: false })).toBe(2);
  });

  it("never charges less than one day", () => {
    const sameDay = { ...window, toDate: "2026-09-10" };
    expect(chargeableUnitsFor("per-day", sameDay, { countReturnDay: false })).toBe(1);
  });

  it("charges a per-event line once, however long it runs", () => {
    expect(chargeableUnitsFor("per-event", window, { countReturnDay: true })).toBe(1);
  });

  it("rounds per-hour up from the clock fields", () => {
    const sameDay = { fromDate: "2026-09-10", toDate: "2026-09-10", fromTime: "09:00", toTime: "13:30" };
    expect(chargeableUnitsFor("per-hour", sameDay, { countReturnDay: true })).toBe(5);
  });
});

describe("totals", () => {
  it("taxes transport and labour with the rent, after the discount, and never the deposit", () => {
    const totals = bookingTotals(
      {
        lines: [line({ amount: 2000, quantity: 100, depositPerUnit: 10 })],
        transportCharge: 500,
        labourCharge: 300,
        discount: 800,
        taxRate: 18,
      },
      { taxEnabled: true }
    );
    expect(totals.subtotal).toBe(2000);
    expect(totals.taxableBase).toBe(2000);
    expect(totals.taxAmount).toBe(360);
    expect(totals.total).toBe(2360);
    expect(totals.depositTotal).toBe(1000);
  });

  it("charges no tax when tax is switched off", () => {
    const totals = bookingTotals(
      { lines: [line({ amount: 1000 })], transportCharge: 0, labourCharge: 0, discount: 0, taxRate: 18 },
      { taxEnabled: false }
    );
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1000);
  });
});

describe("late returns", () => {
  it("counts late days from the agreed date, floored at zero", () => {
    const early = booking({ toDate: "2026-09-12", actualReturnedOn: "2026-09-11" });
    expect(lateDaysFor(early, TODAY)).toBe(0);

    const late = booking({ toDate: "2026-09-12", actualReturnedOn: "2026-09-15" });
    expect(lateDaysFor(late, TODAY)).toBe(3);
  });

  it("accrues against today while the stock is still out", () => {
    const out = booking({ status: "dispatched", toDate: "2026-08-30" });
    expect(lateDaysFor(out, TODAY)).toBe(3);
  });

  it("charges the per-item rate by default", () => {
    const chairs = new Map([["chair", item({ lateFeePerUnitPerDay: 2 })]]);
    const late = booking({ lines: [line({ quantity: 50 })] });
    expect(lateFeeFor(late, 3, settings, chairs)).toBe(300);
  });

  it("charges a flat figure when the basis is fixed", () => {
    const chairs = new Map([["chair", item({ lateFeePerUnitPerDay: 2 })]]);
    const late = booking({ lines: [line({ quantity: 50 })] });
    expect(
      lateFeeFor(late, 3, { defaultLateFeeBasis: "fixed", fixedLateFeePerDay: 500 }, chairs)
    ).toBe(1500);
  });
});

describe("damage and loss", () => {
  it("charges loss at full replacement value", () => {
    expect(defaultLossCharge(4, item({ replacementValue: 300 }))).toBe(1200);
  });

  it("charges damage at the chosen share of replacement value", () => {
    expect(damageChargeFor(4, 50, item({ replacementValue: 300 }))).toBe(600);
  });
});

describe("settlement", () => {
  const chairs = new Map([["chair", item({ replacementValue: 300, lateFeePerUnitPerDay: 1 })]]);

  it("applies the deposit to what is outstanding and refunds the rest", () => {
    const settled = booking({
      status: "returned",
      toDate: "2026-08-30",
      actualReturnedOn: "2026-08-30",
      lines: [line({ quantity: 100, amount: 3000, depositPerUnit: 20, lossCharge: 600, lostQuantity: 2 })],
      payments: [payment({ amount: 1000, kind: "advance" })],
    });

    const result = settleBooking(settled, settings, chairs, TODAY);
    expect(result.total).toBe(3000);
    expect(result.lossTotal).toBe(600);
    expect(result.charges).toBe(3600);
    expect(result.paidTowardsCharges).toBe(1000);
    expect(result.outstanding).toBe(2600);
    expect(result.depositTotal).toBe(2000);
    // The deposit does not cover the outstanding charges, so nothing comes back
    // and the difference is payable.
    expect(result.depositRefunded).toBe(0);
    expect(result.finalPayable).toBe(600);
  });

  it("refunds what the charges did not eat", () => {
    const settled = booking({
      status: "returned",
      toDate: "2026-08-30",
      actualReturnedOn: "2026-08-30",
      lines: [line({ quantity: 100, amount: 3000, depositPerUnit: 20 })],
      payments: [payment({ amount: 3000, kind: "advance" })],
    });

    const result = settleBooking(settled, settings, chairs, TODAY);
    expect(result.outstanding).toBe(0);
    expect(result.depositRefunded).toBe(2000);
    expect(result.finalPayable).toBe(0);
  });

  it("adds the late fee to the charges before the deposit is applied", () => {
    const settled = booking({
      status: "returned",
      toDate: "2026-08-30",
      actualReturnedOn: "2026-09-02",
      lines: [line({ quantity: 100, amount: 3000, depositPerUnit: 20 })],
      payments: [payment({ amount: 3000, kind: "advance" })],
    });

    const result = settleBooking(settled, settings, chairs, TODAY);
    expect(result.lateDays).toBe(3);
    expect(result.lateFee).toBe(300);
    expect(result.charges).toBe(3300);
    expect(result.outstanding).toBe(300);
    expect(result.depositRefunded).toBe(1700);
    expect(result.finalPayable).toBe(0);
  });

  it("counts a refund payment separately from money taken against charges", () => {
    const settled = booking({
      lines: [line({ quantity: 100, amount: 3000, depositPerUnit: 20 })],
      payments: [
        payment({ amount: 3000, kind: "advance" }),
        payment({ amount: 2000, kind: "refund" }),
      ],
    });
    expect(settleBooking(settled, settings, chairs, TODAY).paidTowardsCharges).toBe(3000);
  });
});

describe("deposits held", () => {
  const withDeposit = (overrides: Partial<Booking>) =>
    booking({
      lines: [line({ quantity: 100, depositPerUnit: 20 })],
      depositTotal: 2000,
      ...overrides,
    });

  it("counts a deposit from dispatch", () => {
    expect(depositsHeld([withDeposit({ status: "dispatched" })])).toBe(2000);
  });

  it("stops counting it once the return is settled", () => {
    // The money has either gone back or been eaten by the charges; either way it
    // is no longer a liability sitting in the till.
    expect(
      depositsHeld([withDeposit({ status: "returned", actualReturnedOn: "2026-09-01" })])
    ).toBe(0);
    expect(depositsHeld([withDeposit({ status: "closed" })])).toBe(0);
  });

  it("ignores confirmed bookings — nothing has gone out, so nothing was taken", () => {
    expect(depositsHeld([withDeposit({ status: "confirmed" })])).toBe(0);
  });
});
