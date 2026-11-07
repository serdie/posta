import { describe, expect, it } from "vitest";
import {
  LIMITS,
  PlanError,
  clean,
  daysSinceDrill,
  emptyPlan,
  parsePlan,
  parsePlanJson,
  readiness,
  readinessScore,
  serializePlan,
  type Plan,
} from "./model";

const fullPlan = (): Plan => ({
  ...emptyPlan(new Date("2026-01-01T00:00:00Z")),
  household: "Casa de prueba",
  members: [
    { id: "a", name: "Ana", phone: "600 000 001", nick: "ana-casa", care: "", appReady: true },
    { id: "b", name: "Luis", phone: "600 000 002", nick: "luis-casa", care: "Alergia a la penicilina", appReady: true },
  ],
  nearPoint: { name: "Plaza del Olmo", address: "Junto a la fuente" },
  farPoint: { name: "Polideportivo norte", address: "" },
  outsideContact: { name: "Tía Carmen", phone: "+34 900 000 000" },
  lastDrill: "2026-10-01",
  backup: { walkie: "Canal 7, subtono 12", radio: "Radio pública local", checkIn: "A las en punto, 10 minutos" },
});

describe("emptyPlan", () => {
  it("incluye el 112 y un miembro vacío", () => {
    const p = emptyPlan();
    expect(p.numbers[0]?.phone).toBe("112");
    expect(p.members).toHaveLength(1);
  });
});

describe("parsePlan", () => {
  it("ida y vuelta sin pérdidas", () => {
    const p = fullPlan();
    expect(parsePlanJson(serializePlan(p))).toEqual(p);
  });

  it("rechaza lo que no es un plan", () => {
    expect(() => parsePlan(null)).toThrow(PlanError);
    expect(() => parsePlan([])).toThrow(PlanError);
    expect(() => parsePlan({ version: 2 })).toThrow(PlanError);
    expect(() => parsePlanJson("{no json")).toThrow(PlanError);
    expect(() => parsePlanJson("x".repeat(200_001))).toThrow(PlanError);
  });

  it("recorta campos demasiado largos y elimina caracteres de control", () => {
    const p = parsePlan({ version: 1, household: "a\u0000b" + "x".repeat(500) });
    expect(p.household.startsWith("ab")).toBe(true);
    expect(p.household.length).toBe(LIMITS.short);
  });

  it("limpia teléfonos y tipos incorrectos", () => {
    const p = parsePlan({
      version: 1,
      members: [{ id: "a", name: 3, phone: "<script>600</script>", appReady: "yes" }],
    });
    expect(p.members[0]?.name).toBe("");
    expect(p.members[0]?.phone).toBe("600");
    expect(p.members[0]?.appReady).toBe(false);
  });

  it("regenera ids inválidos o repetidos", () => {
    const p = parsePlan({ version: 1, members: [{ id: "x" }, { id: "x" }, { id: "<b>" }] });
    const ids = p.members.map((m) => m.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe("x");
  });

  it("limita el número de miembros", () => {
    const p = parsePlan({ version: 1, members: Array.from({ length: 50 }, () => ({})) });
    expect(p.members).toHaveLength(LIMITS.members);
  });

  it("descarta fechas de simulacro mal formadas", () => {
    expect(parsePlan({ version: 1, lastDrill: "ayer" }).lastDrill).toBe("");
  });
});

describe("canales alternativos", () => {
  it("un plan antiguo sin backup se importa con campos vacíos", () => {
    const p = parsePlan({ version: 1, household: "x" });
    expect(p.backup).toEqual({ walkie: "", radio: "", checkIn: "" });
  });

  it("recorta y limpia los canales alternativos", () => {
    const p = parsePlan({ version: 1, backup: { walkie: "a".repeat(200), radio: 5, checkIn: "bc" } });
    expect(p.backup.walkie).toHaveLength(LIMITS.short);
    expect(p.backup.radio).toBe("");
    expect(p.backup.checkIn).toBe("bc");
  });
});

describe("clean", () => {
  it("devuelve cadena vacía para no-cadenas", () => {
    expect(clean(undefined, 10)).toBe("");
    expect(clean({}, 10)).toBe("");
  });
});

describe("readiness", () => {
  const today = new Date("2026-11-07T12:00:00Z");

  it("un plan vacío está al 0 %", () => {
    expect(readinessScore(emptyPlan(), today)).toBe(0);
  });

  it("un plan completo y reciente está al 100 %", () => {
    expect(readinessScore(fullPlan(), today)).toBe(100);
  });

  it("detecta a quien falta instalar la app", () => {
    const p = fullPlan();
    p.members[1]!.appReady = false;
    const apps = readiness(p, today).find((i) => i.key === "apps");
    expect(apps?.done).toBe(false);
  });

  it("un simulacro de hace más de 6 meses no cuenta", () => {
    const p = { ...fullPlan(), lastDrill: "2026-01-02" };
    expect(readiness(p, today).find((i) => i.key === "drill")?.done).toBe(false);
  });

  it("calcula días desde el simulacro", () => {
    expect(daysSinceDrill({ ...fullPlan(), lastDrill: "2026-11-01" }, today)).toBe(6);
    expect(daysSinceDrill(emptyPlan(), today)).toBeNull();
  });
});
