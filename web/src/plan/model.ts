/**
 * Plan familiar de emergencia de Posta.
 *
 * Todo el plan vive solo en el dispositivo de quien lo rellena. Este módulo es
 * puro (sin DOM) para poder probarlo: crea, valida, importa y evalúa planes.
 */

export const PLAN_VERSION = 1 as const;

export const LIMITS = {
  short: 80,
  phone: 32,
  long: 600,
  members: 20,
  numbers: 10,
} as const;

export interface Member {
  id: string;
  name: string;
  phone: string;
  /** Apodo acordado en Posta/Bitchat, para reconocerse en la malla. */
  nick: string;
  /** Alergias, medicación, movilidad… lo que deba saber quien ayude. */
  care: string;
  /** Ha instalado Posta (o Bitchat) y lo ha probado con la familia. */
  appReady: boolean;
}

export interface Place {
  name: string;
  address: string;
}

export interface Contact {
  name: string;
  phone: string;
}

export interface EmergencyNumber {
  label: string;
  phone: string;
}

export interface BackupChannels {
  /** Canal de walkie-talkie PMR446 (1–16) y subtono, p. ej. «Canal 7, subtono 12». */
  walkie: string;
  /** Emisora de radio para escuchar avisos oficiales, p. ej. «RNE 1 – 88.2 FM». */
  radio: string;
  /** Cuándo encender walkie/Posta para ahorrar batería, p. ej. «a las en punto, 10 min». */
  checkIn: string;
}

export function emptyBackup(): BackupChannels {
  return { walkie: "", radio: "", checkIn: "" };
}

export interface Plan {
  version: typeof PLAN_VERSION;
  household: string;
  members: Member[];
  /** Punto de encuentro cercano (calle, portal, plaza). */
  nearPoint: Place;
  /** Punto de encuentro fuera del barrio, si no se puede volver a casa. */
  farPoint: Place;
  /** Contacto fuera de la zona: a menudo es más fácil llamar lejos que cerca. */
  outsideContact: Contact;
  numbers: EmergencyNumber[];
  /** Qué hacer: quién recoge a quién, mascotas, llaves, documentos… */
  notes: string;
  /** Fecha del último simulacro con Posta, ISO yyyy-mm-dd. */
  lastDrill: string;
  /** Canales alternativos acordados para cuando no hay red. */
  backup: BackupChannels;
  updatedAt: string;
}

let counter = 0;
export function newId(): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `m${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function emptyMember(): Member {
  return { id: newId(), name: "", phone: "", nick: "", care: "", appReady: false };
}

export const DEFAULT_NUMBERS: readonly EmergencyNumber[] = [
  { label: "Emergencias (UE)", phone: "112" },
];

export function emptyPlan(now = new Date()): Plan {
  return {
    version: PLAN_VERSION,
    household: "",
    members: [emptyMember()],
    nearPoint: { name: "", address: "" },
    farPoint: { name: "", address: "" },
    outsideContact: { name: "", phone: "" },
    numbers: DEFAULT_NUMBERS.map((n) => ({ ...n })),
    notes: "",
    lastDrill: "",
    backup: emptyBackup(),
    updatedAt: now.toISOString(),
  };
}

// ---------- Importación segura ----------

export class PlanError extends Error {}

type Unknown = Record<string, unknown>;

const isObj = (v: unknown): v is Unknown => typeof v === "object" && v !== null && !Array.isArray(v);

/** Quita caracteres de control y recorta a la longitud máxima. */
export function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

const cleanPhone = (v: unknown) => clean(v, LIMITS.phone).replace(/[^\d+()\-\s.]/g, "");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte cualquier JSON en un Plan válido o lanza PlanError.
 * Nunca confía en la entrada: los ficheros importados pueden venir de cualquier parte.
 */
export function parsePlan(input: unknown): Plan {
  if (!isObj(input)) throw new PlanError("El archivo no contiene un plan de Posta.");
  if (input.version !== PLAN_VERSION) throw new PlanError("Versión de plan no compatible.");
  const place = (v: unknown): Place => {
    const o = isObj(v) ? v : {};
    return { name: clean(o.name, LIMITS.short), address: clean(o.address, LIMITS.long) };
  };
  const contact = (v: unknown): Contact => {
    const o = isObj(v) ? v : {};
    return { name: clean(o.name, LIMITS.short), phone: cleanPhone(o.phone) };
  };
  const rawMembers = Array.isArray(input.members) ? input.members.slice(0, LIMITS.members) : [];
  const seen = new Set<string>();
  const members: Member[] = rawMembers.filter(isObj).map((m) => {
    let id = clean(m.id, 40);
    if (!/^[\w-]{1,40}$/.test(id) || seen.has(id)) id = newId();
    seen.add(id);
    return {
      id,
      name: clean(m.name, LIMITS.short),
      phone: cleanPhone(m.phone),
      nick: clean(m.nick, LIMITS.short),
      care: clean(m.care, LIMITS.long),
      appReady: m.appReady === true,
    };
  });
  const rawNumbers = Array.isArray(input.numbers) ? input.numbers.slice(0, LIMITS.numbers) : [];
  const numbers = rawNumbers
    .filter(isObj)
    .map((n) => ({ label: clean(n.label, LIMITS.short), phone: cleanPhone(n.phone) }));
  const lastDrill = clean(input.lastDrill, 10);
  const updatedAt = clean(input.updatedAt, 40);
  return {
    version: PLAN_VERSION,
    household: clean(input.household, LIMITS.short),
    members: members.length > 0 ? members : [emptyMember()],
    nearPoint: place(input.nearPoint),
    farPoint: place(input.farPoint),
    outsideContact: contact(input.outsideContact),
    numbers,
    notes: clean(input.notes, LIMITS.long * 3),
    lastDrill: ISO_DATE.test(lastDrill) ? lastDrill : "",
    backup: (() => {
      const b = isObj(input.backup) ? input.backup : {};
      return { walkie: clean(b.walkie, LIMITS.short), radio: clean(b.radio, LIMITS.short), checkIn: clean(b.checkIn, LIMITS.short) };
    })(),
    updatedAt: Number.isNaN(Date.parse(updatedAt)) ? new Date().toISOString() : updatedAt,
  };
}

export function parsePlanJson(text: string): Plan {
  if (text.length > 200_000) throw new PlanError("El archivo es demasiado grande.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PlanError("El archivo no es un JSON válido.");
  }
  return parsePlan(data);
}

export function serializePlan(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

// ---------- Preparación ----------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
}

const filled = (s: string) => s.trim().length > 0;

/** Días desde el último simulacro, o null si nunca se hizo. */
export function daysSinceDrill(plan: Plan, today = new Date()): number | null {
  if (!plan.lastDrill) return null;
  const t = Date.parse(`${plan.lastDrill}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((now - t) / 86_400_000);
}

export function readiness(plan: Plan, today = new Date()): ReadinessItem[] {
  const people = plan.members.filter((m) => filled(m.name));
  const drill = daysSinceDrill(plan, today);
  return [
    { key: "members", label: "Habéis apuntado a todas las personas de casa", done: people.length > 0 },
    {
      key: "nicks",
      label: "Cada persona tiene un apodo acordado para reconocerse en Posta",
      done: people.length > 0 && people.every((m) => filled(m.nick)),
    },
    {
      key: "apps",
      label: "Todas tienen Posta (o Bitchat) instalada y probada",
      done: people.length > 0 && people.every((m) => m.appReady),
    },
    { key: "near", label: "Hay un punto de encuentro cerca de casa", done: filled(plan.nearPoint.name) },
    { key: "far", label: "Hay un punto de encuentro fuera del barrio", done: filled(plan.farPoint.name) },
    {
      key: "outside",
      label: "Tenéis un contacto que vive lejos de la zona",
      done: filled(plan.outsideContact.name) && filled(plan.outsideContact.phone),
    },
    {
      key: "backup",
      label: "Tenéis un plan B sin móviles (walkie, radio u hora fija de contacto)",
      done: filled(plan.backup.walkie) || filled(plan.backup.checkIn),
    },
    {
      key: "drill",
      label: "Habéis hecho un simulacro en los últimos 6 meses",
      done: drill !== null && drill >= 0 && drill <= 183,
    },
  ];
}

export function readinessScore(plan: Plan, today = new Date()): number {
  const items = readiness(plan, today);
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
