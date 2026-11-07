/**
 * Lista de preparación para 72 horas: lo que recomiendan Protección Civil y la
 * Unión Europea (autosuficiencia durante al menos tres días). Pensada para una
 * vivienda en España; adapta las cantidades a vuestra situación.
 */

export interface KitItem {
  id: string;
  label: string;
  /** Detalle práctico, opcional. */
  hint?: string;
}

export interface KitGroup {
  id: string;
  title: string;
  items: KitItem[];
}

export const DAYS = 3;
/** Litros de agua por persona y día (beber y algo de higiene básica). */
export const WATER_L_PER_PERSON_DAY = 3;

export interface KitNeeds {
  waterLitres: number;
  /** Raciones de comida (una por persona y comida, tres al día). */
  meals: number;
}

export function needsFor(people: number, pets = 0, days = DAYS): KitNeeds {
  const p = Math.max(1, Math.min(20, Math.floor(people || 1)));
  const a = Math.max(0, Math.min(20, Math.floor(pets || 0)));
  const d = Math.max(1, Math.min(14, Math.floor(days || DAYS)));
  // Una mascota mediana bebe aproximadamente un litro al día.
  return { waterLitres: p * WATER_L_PER_PERSON_DAY * d + a * d, meals: p * 3 * d };
}

export const KIT: KitGroup[] = [
  {
    id: "agua",
    title: "Agua y comida",
    items: [
      { id: "agua", label: "Agua embotellada para 3 días", hint: "La cantidad exacta para vuestra casa aparece arriba." },
      { id: "conservas", label: "Comida que no necesite nevera ni cocinar", hint: "Conservas con abrefácil, frutos secos, galletas, barritas." },
      { id: "abrelatas", label: "Abrelatas manual" },
      { id: "bebe", label: "Leche infantil, potitos o comida especial si hay bebés o dietas" },
      { id: "mascotas", label: "Comida y agua para las mascotas" },
    ],
  },
  {
    id: "energia",
    title: "Luz, energía y comunicación",
    items: [
      { id: "linterna", label: "Linterna (mejor frontal) y pilas de repuesto" },
      { id: "radio", label: "Radio a pilas o de dinamo", hint: "Para escuchar avisos oficiales cuando no hay internet." },
      { id: "powerbank", label: "Batería externa cargada y cables para todos los móviles" },
      { id: "posta", label: "Posta (o Bitchat) instalada y probada en todos los móviles", hint: "No se puede descargar cuando ya no hay internet." },
      { id: "walkie", label: "Walkie-talkies PMR446 con pilas", hint: "Sin licencia en Europa. Útiles si fallan los móviles." },
      { id: "silbato", label: "Silbato", hint: "Tres pitidos = petición de ayuda. Se oye más lejos que la voz y cansa menos." },
      { id: "velas", label: "Mechero o cerillas (y cuidado con las velas)" },
    ],
  },
  {
    id: "salud",
    title: "Salud e higiene",
    items: [
      { id: "botiquin", label: "Botiquín básico", hint: "Gasas, vendas, esparadrapo, desinfectante, tijeras, guantes." },
      { id: "medicacion", label: "Medicación habitual para al menos una semana y copia de las recetas" },
      { id: "gafas", label: "Gafas de repuesto, audífonos y sus pilas" },
      { id: "higiene", label: "Toallitas, gel, papel higiénico, bolsas de basura" },
      { id: "mascarillas", label: "Mascarillas" },
      { id: "manta", label: "Manta térmica y ropa de abrigo" },
    ],
  },
  {
    id: "docs",
    title: "Documentos y dinero",
    items: [
      { id: "copias", label: "Copias del DNI, tarjeta sanitaria y documentos del seguro en bolsa estanca" },
      { id: "efectivo", label: "Dinero en efectivo y monedas", hint: "Sin luz no funcionan los datáfonos ni los cajeros." },
      { id: "tarjeta-plan", label: "Tarjeta del plan familiar de Posta impresa", hint: "La generas en la página del plan." },
      { id: "llaves", label: "Copia de las llaves de casa y del coche" },
      { id: "papel", label: "Libreta y bolígrafo", hint: "Para dejar notas en la puerta: «Estamos bien, vamos al punto de encuentro»." },
    ],
  },
  {
    id: "casa",
    title: "En casa",
    items: [
      { id: "cortes", label: "Sabemos cerrar la llave del agua, del gas y bajar el automático de la luz" },
      { id: "extintor", label: "Extintor y detector de humo revisados" },
      { id: "herramientas", label: "Multiherramienta o navaja, cinta americana, cuerda" },
      { id: "alertas", label: "Las alertas de emergencia del móvil están activadas", hint: "En España se llaman ES-Alert. Ajustes → Alertas de emergencia." },
      { id: "satelite", label: "Sabemos si algún móvil de casa tiene SOS por satélite y lo hemos probado en modo demo" },
    ],
  },
];

export const ALL_ITEM_IDS: readonly string[] = KIT.flatMap((g) => g.items.map((i) => i.id));

/** Limpia una lista de ids leída del almacenamiento: solo ids conocidos y sin repetir. */
export function sanitizeChecked(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(ALL_ITEM_IDS);
  return [...new Set(input.filter((x): x is string => typeof x === "string" && known.has(x)))];
}
