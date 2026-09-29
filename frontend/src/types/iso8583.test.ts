import { describe, it, expect } from "vitest";
import { TEST_CARDS } from "./iso8583";

const luhn = (pan: string) =>
  pan
    .split("")
    .reverse()
    .map(Number)
    .reduce((sum, d, i) => sum + (i % 2 ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d), 0) % 10 === 0;

describe("test cards", () => {
  it("are Luhn-valid, except the one that demonstrates response code 14", () => {
    for (const card of TEST_CARDS) {
      expect(luhn(card.pan)).toBe(!card.label.includes("(14)"));
    }
  });
});
