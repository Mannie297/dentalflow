import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-text";

describe("chunkText", () => {
  it("returns nothing for blank text", () => {
    expect(chunkText("   \n")).toEqual([]);
  });

  it("keeps a short policy as one chunk", () => {
    expect(chunkText("Cleanings are offered Monday through Friday.")).toEqual(["Cleanings are offered Monday through Friday."]);
  });

  it("splits a long passage into overlapping chunks", () => {
    const text = Array.from({ length: 40 }, (_, index) => `Sentence ${index} about hygiene visits and booking.`).join(" ");
    const chunks = chunkText(text, 120, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true);
    expect(chunks[0].includes("Sentence 0")).toBe(true);
  });
});
