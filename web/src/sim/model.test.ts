import { describe, expect, it } from "vitest";
import {
  DEFAULT_TTL,
  WALL_FACTOR,
  flood,
  generateWorld,
  linked,
  links,
  segmentCrossesRect,
  seededRandom,
  type World,
} from "./model";

const line = (count: number, gap: number, range: number): World => ({
  nodes: Array.from({ length: count }, (_, i) => ({ id: i, x: i * gap, y: 0.5 })),
  obstacles: [],
  range,
});

describe("flood", () => {
  it("entrega directamente a un vecino en un salto", () => {
    const r = flood(line(2, 0.1, 0.15), 0, 1);
    expect(r.deliveredHop).toBe(1);
    expect(r.waves).toHaveLength(1);
  });

  it("cuenta los saltos a lo largo de una cadena", () => {
    const r = flood(line(5, 0.1, 0.15), 0, 4);
    expect(r.deliveredHop).toBe(4);
  });

  it("no entrega si falta un teléfono intermedio", () => {
    const w: World = { ...line(3, 0.1, 0.15), nodes: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 0.5, y: 0 }] };
    expect(flood(w, 0, 1).deliveredHop).toBeNull();
  });

  it("respeta el TTL: no pasa de 7 saltos", () => {
    const w = line(10, 0.1, 0.15);
    expect(flood(w, 0, DEFAULT_TTL).deliveredHop).toBe(DEFAULT_TTL);
    expect(flood(w, 0, DEFAULT_TTL + 1).deliveredHop).toBeNull();
    expect(flood(w, 0, 9, 9).deliveredHop).toBe(9);
  });

  it("cada teléfono recibe el mensaje una sola vez (deduplicación)", () => {
    const w = generateWorld({ seed: 7, count: 30, range: 0.3, obstacles: false });
    const r = flood(w, 0, 1, 20);
    const receivers = r.waves.flat().map((h) => h.to);
    expect(new Set(receivers).size).toBe(receivers.length);
    expect(receivers).not.toContain(0);
  });

  it("devuelve null con un origen inexistente", () => {
    expect(flood(line(2, 0.1, 0.15), 99, 1).deliveredHop).toBeNull();
  });

  it("el origen es destino en 0 saltos", () => {
    expect(flood(line(2, 0.1, 0.15), 0, 0).deliveredHop).toBe(0);
  });
});

describe("obstáculos", () => {
  const a = { id: 0, x: 0.1, y: 0.5 };
  const b = { id: 1, x: 0.3, y: 0.5 };
  const wall = { x: 0.18, y: 0.4, w: 0.04, h: 0.2 };

  it("detecta que el segmento cruza un edificio", () => {
    expect(segmentCrossesRect(a, b, wall)).toBe(true);
    expect(segmentCrossesRect(a, { id: 2, x: 0.1, y: 0.9 }, wall)).toBe(false);
  });

  it("los edificios reducen el alcance", () => {
    const open: World = { nodes: [a, b], obstacles: [], range: 0.25 };
    const blocked: World = { ...open, obstacles: [wall] };
    expect(linked(open, a, b)).toBe(true);
    expect(linked(blocked, a, b)).toBe(false);
    const near: World = { nodes: [a, { id: 1, x: 0.1 + 0.25 * WALL_FACTOR - 0.01, y: 0.5 }], obstacles: [{ ...wall, x: 0.12, w: 0.02 }], range: 0.25 };
    expect(linked(near, near.nodes[0]!, near.nodes[1]!)).toBe(true);
  });
});

describe("generateWorld", () => {
  it("es determinista con la misma semilla", () => {
    const o = { seed: 42, count: 20, range: 0.2, obstacles: true };
    expect(generateWorld(o)).toEqual(generateWorld(o));
  });

  it("genera el número de teléfonos pedido dentro del mapa", () => {
    const w = generateWorld({ seed: 3, count: 25, range: 0.2, obstacles: false });
    expect(w.nodes).toHaveLength(25);
    for (const n of w.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
  });

  it("links no repite pares", () => {
    const w = generateWorld({ seed: 5, count: 15, range: 0.4, obstacles: false });
    const keys = links(w).map((l) => `${Math.min(l.from, l.to)}-${Math.max(l.from, l.to)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("seededRandom da valores en [0,1)", () => {
    const r = seededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
