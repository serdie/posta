import { DEFAULT_TTL, flood, generateWorld, links, type World } from "./model";

const SVG_NS = "http://www.w3.org/2000/svg";
const W = 800;
const H = 500;
const RANGES = { 1: 0.13, 2: 0.18, 3: 0.25 } as const;
const RANGE_LABEL = { 1: "corto", 2: "medio", 3: "largo" } as const;
const WAVE_MS = 520;

const COLORS = {
  node: "#5b626c",
  link: "#2c3036",
  src: "#ef6a5b",
  dst: "#7cc39c",
  relay: "#f1c27d",
  wave: "#f1c27d",
  wall: "#24282e",
  wallStroke: "#3a3f46",
};

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountSimulator(root: HTMLElement): void {
  const svg = root.querySelector<SVGSVGElement>("[data-sim-svg]")!;
  const result = root.querySelector<HTMLElement>("[data-result]")!;
  const countIn = root.querySelector<HTMLInputElement>('[data-in="count"]')!;
  const rangeIn = root.querySelector<HTMLInputElement>('[data-in="range"]')!;
  const obstaclesIn = root.querySelector<HTMLInputElement>('[data-in="obstacles"]')!;
  const countOut = root.querySelector<HTMLOutputElement>('[data-out="count"]')!;
  const rangeOut = root.querySelector<HTMLOutputElement>('[data-out="range"]')!;

  let seed = 20261107;
  let world: World;
  let source: number | null = null;
  let target: number | null = null;
  let timers: number[] = [];

  const layers = {
    walls: el("g", {}),
    links: el("g", {}),
    waves: el("g", {}),
    nodes: el("g", {}),
  };
  svg.append(layers.walls, layers.links, layers.waves, layers.nodes);

  const rangeKey = () => Math.min(3, Math.max(1, Number(rangeIn.value))) as 1 | 2 | 3;

  function setResult(kind: "idle" | "ok" | "fail", title: string, text: string): void {
    result.className = `sim-result${kind === "idle" ? "" : ` ${kind}`}`;
    result.replaceChildren();
    const b = document.createElement("b");
    b.textContent = title;
    const span = document.createElement("span");
    span.className = "sim-hint";
    span.textContent = text;
    result.append(b, span);
  }

  function stopAnimation(): void {
    for (const t of timers) window.clearTimeout(t);
    timers = [];
    layers.waves.replaceChildren();
  }

  function build(): void {
    stopAnimation();
    world = generateWorld({
      seed,
      count: Number(countIn.value),
      range: RANGES[rangeKey()],
      obstacles: obstaclesIn.checked,
    });
    if (source !== null && source >= world.nodes.length) source = null;
    if (target !== null && target >= world.nodes.length) target = null;
    countOut.value = countIn.value;
    rangeOut.value = RANGE_LABEL[rangeKey()];
    draw();
  }

  function draw(relays: ReadonlySet<number> = new Set()): void {
    layers.walls.replaceChildren(
      ...world.obstacles.map((o) =>
        el("rect", {
          x: o.x * W, y: o.y * H, width: o.w * W, height: o.h * H, rx: 6,
          fill: COLORS.wall, stroke: COLORS.wallStroke, "stroke-width": 1.5,
        }),
      ),
    );
    layers.links.replaceChildren(
      ...links(world).map((l) => {
        const a = world.nodes[l.from]!;
        const b = world.nodes[l.to]!;
        return el("line", {
          x1: a.x * W, y1: a.y * H, x2: b.x * W, y2: b.y * H,
          stroke: COLORS.link, "stroke-width": 1.5,
        });
      }),
    );
    layers.nodes.replaceChildren(
      ...world.nodes.map((n) => {
        const isSrc = n.id === source;
        const isDst = n.id === target;
        const fill = isSrc ? COLORS.src : isDst ? COLORS.dst : relays.has(n.id) ? COLORS.relay : COLORS.node;
        const g = el("g", { "data-id": n.id, tabindex: 0, role: "button" });
        g.setAttribute("aria-label", `Teléfono ${n.id + 1}${isSrc ? ", envía" : ""}${isDst ? ", recibe" : ""}`);
        if (isSrc || isDst) {
          g.append(el("circle", { cx: n.x * W, cy: n.y * H, r: world.range * W, fill: fill, opacity: 0.07 }));
        }
        g.append(el("circle", { cx: n.x * W, cy: n.y * H, r: 18, fill: "transparent" }));
        g.append(el("circle", { cx: n.x * W, cy: n.y * H, r: isSrc || isDst ? 9 : 7, fill, stroke: "#101215", "stroke-width": 2 }));
        return g;
      }),
    );
  }

  function pickDefaults(): void {
    // El par con el camino más largo que sí llega: el ejemplo más ilustrativo.
    // Si ninguno llega, los dos teléfonos más alejados.
    let bestHops = 0;
    let bestDist = -1;
    for (const a of world.nodes) {
      const res = flood(world, a.id, a.id, DEFAULT_TTL);
      for (const [id, hop] of res.reachedAt) {
        if (hop > bestHops) { bestHops = hop; source = a.id; target = id; }
      }
    }
    if (bestHops > 0) return;
    for (const a of world.nodes) {
      for (const b of world.nodes) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > bestDist) { bestDist = d; source = a.id; target = b.id; }
      }
    }
  }

  function send(): void {
    if (world.nodes.length < 2) return;
    if (source === null || target === null || source === target) pickDefaults();
    if (source === null || target === null) return;
    stopAnimation();
    const res = flood(world, source, target, DEFAULT_TTL);
    const relays = new Set<number>();
    const deliveredAt = res.deliveredHop;

    const finish = () => {
      draw(relays);
      if (deliveredAt !== null) {
        const reached = res.reachedAt.size - 1;
        setResult(
          "ok",
          deliveredAt === 1 ? "Entregado directamente" : `Entregado en ${deliveredAt} saltos`,
          `${reached} teléfono${reached === 1 ? "" : "s"} recibieron y reenviaron el mensaje sin poder leerlo (si es privado).`,
        );
      } else {
        const maxHop = Math.max(0, ...res.reachedAt.values());
        setResult(
          "fail",
          "No ha llegado",
          maxHop >= DEFAULT_TTL
            ? `Se agotaron los ${DEFAULT_TTL} saltos. Hacen falta más teléfonos en el camino.`
            : "No hay una cadena de teléfonos hasta el destino. Añade gente o quita edificios.",
        );
      }
    };

    setResult("idle", "Enviando…", "El mensaje salta de teléfono en teléfono.");
    if (reducedMotion()) {
      for (const wave of res.waves) for (const h of wave) relays.add(h.to);
      relays.delete(target);
      finish();
      return;
    }
    draw();
    res.waves.forEach((wave, i) => {
      timers.push(window.setTimeout(() => {
        for (const h of wave) {
          const a = world.nodes[h.from]!;
          const b = world.nodes[h.to]!;
          const line = el("line", {
            x1: a.x * W, y1: a.y * H, x2: a.x * W, y2: a.y * H,
            stroke: COLORS.wave, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.95,
          });
          layers.waves.append(line);
          line.animate(
            [{ x2: a.x * W, y2: a.y * H } as Keyframe, { x2: b.x * W, y2: b.y * H } as Keyframe],
            { duration: WAVE_MS * 0.8, fill: "forwards", easing: "ease-out" },
          );
          // Firefox/Safari no animan atributos SVG con WAAPI: dejamos el valor final igualmente.
          timers.push(window.setTimeout(() => { line.setAttribute("x2", String(b.x * W)); line.setAttribute("y2", String(b.y * H)); }, WAVE_MS * 0.8));
          if (h.to !== target) relays.add(h.to);
        }
        timers.push(window.setTimeout(() => draw(relays), WAVE_MS * 0.8));
      }, i * WAVE_MS));
    });
    timers.push(window.setTimeout(finish, res.waves.length * WAVE_MS + 120));
  }

  function nodeFromEvent(e: Event): number | null {
    const g = (e.target as Element).closest("[data-id]");
    return g ? Number(g.getAttribute("data-id")) : null;
  }

  function choose(id: number): void {
    stopAnimation();
    if (source === null || (source !== null && target !== null)) {
      source = id;
      target = null;
      draw();
      setResult("idle", "Ahora, quién recibe", "Toca otro teléfono para elegir el destinatario.");
    } else if (id === source) {
      source = null;
      draw();
      setResult("idle", "Elige quién envía", "Toca un teléfono del mapa.");
    } else {
      target = id;
      send();
    }
  }

  svg.addEventListener("click", (e) => {
    const id = nodeFromEvent(e);
    if (id !== null) choose(id);
  });
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = nodeFromEvent(e);
    if (id !== null) { e.preventDefault(); choose(id); }
  });
  countIn.addEventListener("input", build);
  rangeIn.addEventListener("input", build);
  obstaclesIn.addEventListener("change", build);
  root.querySelector('[data-act="send"]')?.addEventListener("click", send);
  root.querySelector('[data-act="shuffle"]')?.addEventListener("click", () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    source = null;
    target = null;
    build();
    setResult("idle", "Elige quién envía", "Toca un teléfono del mapa (o pulsa «Enviar mensaje»).");
  });

  build();
}
