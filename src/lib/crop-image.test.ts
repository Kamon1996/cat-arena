import { describe, expect, it } from "vitest";

import { outputEdgeFor, stepDownEdges } from "./crop-image";

const MAX_OUTPUT_EDGE = 1600;
const MAX_CANVAS_EDGE = 4096;

describe("outputEdgeFor", () => {
  it("keeps small crops at their native size (rounded)", () => {
    expect(outputEdgeFor(800)).toBe(800);
    expect(outputEdgeFor(799.6)).toBe(800);
  });

  it("caps oversized crops at the output ceiling", () => {
    expect(outputEdgeFor(5000)).toBe(MAX_OUTPUT_EDGE);
  });

  it("never returns less than one pixel", () => {
    expect(outputEdgeFor(0)).toBe(1);
  });
});

describe("stepDownEdges", () => {
  it("returns no steps when one draw reduces by at most 2x", () => {
    expect(stepDownEdges(1600, 1600)).toEqual([]);
    expect(stepDownEdges(3000, 1600)).toEqual([]);
  });

  it("halves until the final draw is within a 2x reduction", () => {
    // 4000 -> 2000 (step), then 2000 -> 1600 is the final draw.
    expect(stepDownEdges(4000, 1600)).toEqual([2000]);
    // 4096 -> 2048 -> 1024 -> 512, final 512 -> 400.
    expect(stepDownEdges(4096, 400)).toEqual([2048, 1024, 512]);
  });

  it("caps the starting edge at the safe canvas maximum", () => {
    // A 10000px source is treated as 4096: 4096 -> 2048, final to 1600.
    expect(stepDownEdges(10_000, 1600)).toEqual([2048]);
    expect(stepDownEdges(10_000, 1600)[0]).toBeLessThanOrEqual(MAX_CANVAS_EDGE / 2);
  });
});
