import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readCallSheet } from "./read-call-sheet";
import { contactsFromSheet, planScheduledDials } from "./schedule-calls";

const now = new Date("2026-10-25T12:00:00.000Z");

describe("planScheduledDials", () => {
  it("spaces one person's attempts across two intervals", () => {
    const result = planScheduledDials(
      [{ patient_name: "Transcript Test", phone: "+14165550196", reason: "a hygiene visit" }],
      [
        { start: new Date("2026-10-25T14:00:00.000Z"), everyMinutes: 15, callCount: 2 },
        { start: new Date("2026-10-26T14:00:00.000Z"), everyMinutes: 30, callCount: 1 },
      ],
      "single",
      now
    );
    expect("dials" in result).toBe(true);
    if (!("dials" in result)) return;
    expect(result.dials).toHaveLength(3);
    expect(result.dials[0]?.scheduled_at).toBe("2026-10-25T14:00:00.000Z");
    expect(result.dials[1]?.scheduled_at).toBe("2026-10-25T14:15:00.000Z");
    expect(result.dials[2]?.scheduled_at).toBe("2026-10-26T14:00:00.000Z");
  });

  it("fills the last interval with whoever is left in a batch", () => {
    const people = [
      { patient_name: "A", phone: "4165550101", reason: "a recall" },
      { patient_name: "B", phone: "4165550102", reason: "a recall" },
      { patient_name: "C", phone: "4165550103", reason: "a recall" },
    ];
    const result = planScheduledDials(
      people,
      [
        { start: new Date("2026-10-25T15:00:00.000Z"), everyMinutes: 5, callCount: 1 },
        { start: new Date("2026-10-25T18:00:00.000Z"), everyMinutes: 5, callCount: null },
      ],
      "batch",
      now
    );
    expect("dials" in result && result.dials.map((dial) => dial.patient_name)).toEqual(["A", "B", "C"]);
  });

  it("rejects a start time that has already passed", () => {
    const result = planScheduledDials(
      [{ patient_name: "A", phone: "4165550101", reason: "a recall" }],
      [{ start: new Date("2026-10-25T11:00:00.000Z"), everyMinutes: 5, callCount: 1 }],
      "single",
      now
    );
    expect(result).toEqual({ error: "The first call time has already passed." });
  });
});

describe("readCallSheet", () => {
  it("reads name and phone from an xlsx file", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Calls");
    sheet.addRow(["Name", "Phone"]);
    sheet.addRow(["Ada Jones", "4165550101"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], "calls.xlsx");
    const rows = await readCallSheet(file);
    expect(contactsFromSheet(rows, "a follow-up")).toEqual({
      people: [{ patient_name: "Ada Jones", phone: "4165550101", reason: "a follow-up" }],
    });
  });
});

describe("contactsFromSheet", () => {
  it("reads name, phone, and an optional reason", () => {
    const result = contactsFromSheet(
      [
        { Name: "Ada Jones", Phone: "(416) 555-0101", Reason: "your cleaning" },
        { Name: "Ben Singh", "Phone Number": "", Reason: "" },
      ],
      "a follow-up"
    );
    expect(result).toEqual({ error: "Row 3 needs a full phone number." });
  });

  it("uses the shared reason when a row does not have one", () => {
    const result = contactsFromSheet([{ "Full Name": "Ada Jones", Mobile: "4165550101" }], "a follow-up");
    expect(result).toEqual({ people: [{ patient_name: "Ada Jones", phone: "4165550101", reason: "a follow-up" }] });
  });
});
