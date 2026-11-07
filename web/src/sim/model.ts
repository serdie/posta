/**
 * Modelo de la simulación de malla de Posta.
 *
 * Reproduce, de forma simplificada, cómo viaja un mensaje en una malla Bluetooth
 * como la de Bitchat/Posta: cada teléfono reenvía una sola vez cada mensaje
 * (deduplicación por identificador) y el TTL baja en cada salto. Por eso el
 * avance equivale a un recorrido en anchura por oleadas.
 *
 * Es una herramienta educativa: el alcance real depende del hardware, del cuerpo
 * de las personas, de las paredes, de la batería y del sistema operativo.
 */

export interface PhoneNode {
  readonly id: number;
  /** Posición normalizada 0..1 */
  readonly x: number;
  readonly y: number;
}

export interface Obstacle {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface World {
  readonly nodes: readonly PhoneNode[];
  readonly obstacles: readonly Obstacle[];
  /** Alcance en campo abierto, en unidades normalizadas. */
  readonly range: number;
}

export interface Hop {
  readonly from: number;
  readonly to: number;
}

export interface FloodResult {
  /** Transmisiones por oleada. La oleada 0 la emite el origen. */
  readonly waves: readonly (readonly Hop[])[];
  /** Salto en el que cada teléfono recibió el mensaje por primera vez (origen = 0). */
  readonly reachedAt: ReadonlyMap<number, number>;
  /** Saltos hasta el destino, o null si no llegó. */
  readonly deliveredHop: number | null;
}

/** TTL inicial que usa el protocolo de Bitchat para los mensajes de la malla. */
export const DEFAULT_TTL = 7;

/** Fracción del alcance que queda cuando la señal atraviesa un edificio. */
export const WALL_FACTOR = 0.4;

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function distance(a: PhoneNode, b: PhoneNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRect(px: number, py: number, r: Obstacle): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** ¿Atraviesa el segmento a-b el rectángulo r? */
export function segmentCrossesRect(a: PhoneNode, b: PhoneNode, r: Obstacle): boolean {
  if (pointInRect(a.x, a.y, r) || pointInRect(b.x, b.y, r)) return true;
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  return (
    segmentsIntersect(a.x, a.y, b.x, b.y, r.x, r.y, x2, r.y) ||
    segmentsIntersect(a.x, a.y, b.x, b.y, x2, r.y, x2, y2) ||
    segmentsIntersect(a.x, a.y, b.x, b.y, x2, y2, r.x, y2) ||
    segmentsIntersect(a.x, a.y, b.x, b.y, r.x, y2, r.x, r.y)
  );
}

/** Alcance efectivo entre dos teléfonos, teniendo en cuenta los edificios. */
export function effectiveRange(world: World, a: PhoneNode, b: PhoneNode): number {
  const blocked = world.obstacles.some((o) => segmentCrossesRect(a, b, o));
  return blocked ? world.range * WALL_FACTOR : world.range;
}

export function linked(world: World, a: PhoneNode, b: PhoneNode): boolean {
  if (a.id === b.id) return false;
  return distance(a, b) <= effectiveRange(world, a, b);
}

export function neighbors(world: World, id: number): number[] {
  const self = world.nodes.find((n) => n.id === id);
  if (!self) return [];
  return world.nodes.filter((n) => linked(world, self, n)).map((n) => n.id);
}

/** Todas las conexiones posibles (sin duplicados), para dibujarlas. */
export function links(world: World): Hop[] {
  const out: Hop[] = [];
  const ns = world.nodes;
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i]!;
      const b = ns[j]!;
      if (linked(world, a, b)) out.push({ from: a.id, to: b.id });
    }
  }
  return out;
}

/**
 * Inundación con TTL y deduplicación: cada teléfono retransmite una vez a todos
 * sus vecinos. Un mensaje con TTL t puede recorrer como mucho t saltos.
 */
export function flood(world: World, source: number, target: number, ttl = DEFAULT_TTL): FloodResult {
  const reachedAt = new Map<number, number>();
  const waves: Hop[][] = [];
  if (!world.nodes.some((n) => n.id === source)) {
    return { waves, reachedAt, deliveredHop: null };
  }
  const adjacency = new Map<number, number[]>();
  for (const n of world.nodes) adjacency.set(n.id, neighbors(world, n.id));

  reachedAt.set(source, 0);
  let frontier = [source];
  for (let hop = 1; hop <= ttl && frontier.length > 0; hop++) {
    const wave: Hop[] = [];
    const next: number[] = [];
    for (const from of frontier) {
      for (const to of adjacency.get(from) ?? []) {
        if (reachedAt.has(to)) continue;
        reachedAt.set(to, hop);
        wave.push({ from, to });
        next.push(to);
      }
    }
    if (wave.length > 0) waves.push(wave);
    frontier = next;
  }
  const deliveredHop = source === target ? 0 : reachedAt.get(target) ?? null;
  return { waves, reachedAt, deliveredHop };
}

export interface WorldOptions {
  readonly seed: number;
  readonly count: number;
  readonly range: number;
  readonly obstacles: boolean;
}

/** Edificios de un barrio ficticio, siempre iguales para que el escenario sea comparable. */
export const TOWN_BLOCKS: readonly Obstacle[] = [
  { x: 0.2, y: 0.14, w: 0.16, h: 0.22 },
  { x: 0.52, y: 0.08, w: 0.2, h: 0.18 },
  { x: 0.4, y: 0.44, w: 0.18, h: 0.16 },
  { x: 0.12, y: 0.58, w: 0.18, h: 0.24 },
  { x: 0.66, y: 0.56, w: 0.2, h: 0.24 },
];

export function generateWorld(opts: WorldOptions): World {
  const rand = seededRandom(opts.seed);
  const obstacles = opts.obstacles ? TOWN_BLOCKS : [];
  const nodes: PhoneNode[] = [];
  let guard = 0;
  while (nodes.length < opts.count && guard++ < 5000) {
    const x = 0.04 + rand() * 0.92;
    const y = 0.06 + rand() * 0.88;
    // Las personas están en la calle o dentro de los edificios; evitamos solapes visuales.
    const tooClose = nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 0.045);
    if (tooClose) continue;
    nodes.push({ id: nodes.length, x, y });
  }
  return { nodes, obstacles, range: opts.range };
}
