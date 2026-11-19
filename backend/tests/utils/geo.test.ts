import { describe, expect, it } from "vitest";
import { haversineKm, roundCoordinate, roundLocation } from "../../src/utils/geo.js";

describe("roundCoordinate", () => {
  it("rounds to 2 decimals", () => {
    expect(roundCoordinate(46.770439)).toBe(46.77);
    expect(roundCoordinate(23.589434)).toBe(23.59);
    expect(roundCoordinate(46.775)).toBe(46.78);
  });

  it("handles floating point edge cases", () => {
    expect(roundCoordinate(1.005)).toBe(1.01);
  });

  it("handles negative coordinates", () => {
    expect(roundCoordinate(-122.41942)).toBe(-122.42);
  });

  it("rounds a full location", () => {
    expect(roundLocation(46.77123, 23.59987)).toEqual({ latitude: 46.77, longitude: 23.6 });
  });
});

describe("haversineKm", () => {
  it("is 0 for the same point", () => {
    expect(haversineKm(46.77, 23.59, 46.77, 23.59)).toBe(0);
  });

  it("computes Cluj-Napoca to Bucharest (~325 km)", () => {
    const km = haversineKm(46.7712, 23.6236, 44.4268, 26.1025);
    expect(km).toBeGreaterThan(315);
    expect(km).toBeLessThan(335);
  });
});
