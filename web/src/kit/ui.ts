import { safeGet, safeRemove, safeSet } from "../storage";
import { ALL_ITEM_IDS, KIT, needsFor, sanitizeChecked } from "./data";

const KEY = "posta.kit.v1";

interface KitState {
  checked: string[];
  people: number;
  pets: number;
}

function load(): KitState {
  try {
    const raw = JSON.parse(safeGet(KEY) ?? "{}") as Record<string, unknown>;
    return {
      checked: sanitizeChecked(raw.checked),
      people: Number(raw.people) || 2,
      pets: Number(raw.pets) || 0,
    };
  } catch {
    return { checked: [], people: 2, pets: 0 };
  }
}

export function mountKit(root: HTMLElement): void {
  const state = load();
  const list = root.querySelector<HTMLElement>("[data-kit-list]")!;
  const progress = root.querySelector<HTMLElement>("[data-kit-progress]")!;
  const bar = root.querySelector<HTMLElement>("[data-kit-bar]")!;
  const people = root.querySelector<HTMLInputElement>("#kit-people")!;
  const pets = root.querySelector<HTMLInputElement>("#kit-pets")!;
  const water = root.querySelector<HTMLElement>("[data-kit-water]")!;
  const meals = root.querySelector<HTMLElement>("[data-kit-meals]")!;

  const save = () => safeSet(KEY, JSON.stringify(state));

  function refresh(): void {
    const n = needsFor(state.people, state.pets);
    water.textContent = `${n.waterLitres} litros`;
    meals.textContent = `${n.meals} raciones`;
    const done = state.checked.length;
    const pct = Math.round((done / ALL_ITEM_IDS.length) * 100);
    progress.textContent = `${done} de ${ALL_ITEM_IDS.length} · ${pct} %`;
    bar.style.width = `${pct}%`;
  }

  people.value = String(state.people);
  pets.value = String(state.pets);

  const checked = new Set(state.checked);
  list.replaceChildren(
    ...KIT.map((group) => {
      const box = document.createElement("fieldset");
      box.className = "kit-group";
      const legend = document.createElement("legend");
      legend.textContent = group.title;
      box.append(legend);
      for (const item of group.items) {
        const label = document.createElement("label");
        label.className = "kit-item";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = item.id;
        input.checked = checked.has(item.id);
        const text = document.createElement("span");
        const b = document.createElement("b");
        b.textContent = item.label;
        text.append(b);
        if (item.hint) {
          const small = document.createElement("small");
          small.textContent = item.hint;
          text.append(small);
        }
        label.append(input, text);
        box.append(label);
      }
      return box;
    }),
  );

  list.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type !== "checkbox") return;
    const set = new Set(state.checked);
    if (t.checked) set.add(t.value);
    else set.delete(t.value);
    state.checked = sanitizeChecked([...set]);
    save();
    refresh();
  });

  for (const input of [people, pets]) {
    input.addEventListener("input", () => {
      state.people = Number(people.value) || 1;
      state.pets = Number(pets.value) || 0;
      save();
      refresh();
    });
  }

  root.querySelector('[data-act="kit-print"]')?.addEventListener("click", () => window.print());
  root.querySelector('[data-act="kit-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("¿Desmarcar toda la lista?")) return;
    safeRemove(KEY);
    state.checked = [];
    for (const i of list.querySelectorAll<HTMLInputElement>("input[type=checkbox]")) i.checked = false;
    refresh();
  });

  refresh();
}
