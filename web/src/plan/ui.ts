import { toast } from "../main";
import { safeGet, safeRemove, safeSet } from "../storage";
import {
  PlanError,
  emptyMember,
  emptyPlan,
  parsePlanJson,
  readiness,
  readinessScore,
  serializePlan,
  type EmergencyNumber,
  type Member,
  type Plan,
} from "./model";

export const STORAGE_KEY = "posta.plan.v1";

type PathKey = "nearPoint.name" | "nearPoint.address" | "farPoint.name" | "farPoint.address" | "outsideContact.name" | "outsideContact.phone" | "notes" | "lastDrill";

export function loadPlan(): Plan {
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return emptyPlan();
  try {
    return parsePlanJson(raw);
  } catch {
    return emptyPlan();
  }
}

function getPath(plan: Plan, path: PathKey): string {
  switch (path) {
    case "nearPoint.name": return plan.nearPoint.name;
    case "nearPoint.address": return plan.nearPoint.address;
    case "farPoint.name": return plan.farPoint.name;
    case "farPoint.address": return plan.farPoint.address;
    case "outsideContact.name": return plan.outsideContact.name;
    case "outsideContact.phone": return plan.outsideContact.phone;
    case "notes": return plan.notes;
    case "lastDrill": return plan.lastDrill;
  }
}

function setPath(plan: Plan, path: PathKey, value: string): void {
  switch (path) {
    case "nearPoint.name": plan.nearPoint.name = value; break;
    case "nearPoint.address": plan.nearPoint.address = value; break;
    case "farPoint.name": plan.farPoint.name = value; break;
    case "farPoint.address": plan.farPoint.address = value; break;
    case "outsideContact.name": plan.outsideContact.name = value; break;
    case "outsideContact.phone": plan.outsideContact.phone = value; break;
    case "notes": plan.notes = value; break;
    case "lastDrill": plan.lastDrill = value; break;
  }
}

let uid = 0;
/** Enlaza cada <label data-for> con su campo dentro de una plantilla clonada. */
function wireLabels(fragment: ParentNode): void {
  for (const label of fragment.querySelectorAll<HTMLLabelElement>("label[data-for]")) {
    const input = label.parentElement?.querySelector<HTMLInputElement>(`[data-key="${label.dataset.for}"]`);
    if (!input) continue;
    input.id = `f${++uid}`;
    label.htmlFor = input.id;
  }
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

/** Tarjeta de cartera. Solo usa textContent: los datos nunca se interpretan como HTML. */
export function buildCard(plan: Plan, member: Member | null): HTMLElement {
  const card = h("article", undefined, "wallet");
  const title = h("h4", plan.household.trim() || "Plan de emergencia");
  title.append(h("small", member?.name.trim() ? member.name.trim() : "Posta"));
  const dl = h("dl");
  const row = (k: string, v: string) => {
    if (!v.trim()) return;
    dl.append(h("dt", k), h("dd", v.trim()));
  };
  const place = (p: { name: string; address: string }) => [p.name, p.address].filter((s) => s.trim()).join(" · ");
  row("Encuentro", place(plan.nearPoint));
  row("Si no", place(plan.farPoint));
  row("Avisar a", [plan.outsideContact.name, plan.outsideContact.phone].filter((s) => s.trim()).join(" · "));
  const nicks = plan.members.filter((m) => m.nick.trim()).map((m) => m.nick.trim());
  row("En Posta", nicks.join(", "));
  for (const n of plan.numbers.filter((x) => x.phone.trim()).slice(0, 3)) row(n.label || "Teléfono", n.phone);
  if (member) row("Salud", member.care);
  card.append(title, dl, h("p", "🟢 Estoy bien · 📍 Voy al punto · 🟠 Ayuda — usa los botones de estado de Posta. Emergencias: 112", "foot"));
  return card;
}

export function mountPlan(root: HTMLElement): void {
  let plan = loadPlan();
  const form = root.querySelector<HTMLFormElement>("[data-form]")!;
  const membersBox = root.querySelector<HTMLElement>("[data-members]")!;
  const numbersBox = root.querySelector<HTMLElement>("[data-numbers]")!;
  const memberTpl = root.querySelector<HTMLTemplateElement>("#member-tpl")!;
  const numberTpl = root.querySelector<HTMLTemplateElement>("#number-tpl")!;
  const checklist = root.querySelector<HTMLUListElement>("[data-checklist]")!;
  const scoreNum = root.querySelector<HTMLElement>("[data-score-num]")!;
  const ring = root.querySelector<SVGCircleElement>("[data-ring]")!;
  const cards = root.querySelector<HTMLElement>("[data-cards]")!;
  const saved = root.querySelector<HTMLElement>("[data-saved]")!;
  const printTitle = root.querySelector<HTMLElement>("[data-print-title]")!;
  const household = root.querySelector<HTMLInputElement>("#household")!;

  let saveTimer: number | undefined;
  function persist(): void {
    plan.updatedAt = new Date().toISOString();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const ok = safeSet(STORAGE_KEY, serializePlan(plan));
      saved.textContent = ok
        ? `Guardado en este dispositivo a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.`
        : "Este navegador no permite guardar (¿modo privado?). Usa «Guardar copia» para no perderlo.";
    }, 300);
  }

  function refreshSummary(): void {
    const items = readiness(plan);
    const score = readinessScore(plan);
    scoreNum.textContent = `${score} %`;
    ring.setAttribute("stroke-dasharray", `${score} 100`);
    checklist.replaceChildren(
      ...items.map((i) => {
        const li = h("li", i.label, i.done ? "done" : "");
        li.setAttribute("aria-label", `${i.done ? "Hecho" : "Pendiente"}: ${i.label}`);
        return li;
      }),
    );
    const named = plan.members.filter((m) => m.name.trim());
    cards.replaceChildren(...(named.length ? named.map((m) => buildCard(plan, m)) : [buildCard(plan, null)]));
    printTitle.textContent = plan.household.trim() ? `Plan de emergencia · ${plan.household.trim()}` : "Plan de emergencia";
  }

  function renderMembers(): void {
    membersBox.replaceChildren(
      ...plan.members.map((m, index) => {
        const frag = memberTpl.content.cloneNode(true) as DocumentFragment;
        wireLabels(frag);
        const box = frag.querySelector<HTMLElement>("[data-member]")!;
        box.dataset.id = m.id;
        box.querySelector("[data-member-title]")!.textContent = m.name.trim() || `Persona ${index + 1}`;
        for (const input of box.querySelectorAll<HTMLInputElement>("[data-key]")) {
          const key = input.dataset.key as keyof Member;
          if (key === "appReady") input.checked = m.appReady;
          else if (key !== "id") input.value = m[key];
        }
        const remove = box.querySelector<HTMLButtonElement>('[data-act="remove-member"]')!;
        remove.hidden = plan.members.length === 1;
        remove.setAttribute("aria-label", `Quitar a ${m.name.trim() || `persona ${index + 1}`}`);
        return box;
      }),
    );
  }

  function renderNumbers(): void {
    numbersBox.replaceChildren(
      ...plan.numbers.map((n, index) => {
        const frag = numberTpl.content.cloneNode(true) as DocumentFragment;
        wireLabels(frag);
        const row = frag.querySelector<HTMLElement>("[data-number]")!;
        row.dataset.index = String(index);
        for (const input of row.querySelectorAll<HTMLInputElement>("[data-key]")) {
          input.value = n[input.dataset.key as keyof EmergencyNumber];
        }
        return row;
      }),
    );
  }

  function renderAll(): void {
    household.value = plan.household;
    for (const input of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-path]")) {
      input.value = getPath(plan, input.dataset.path as PathKey);
    }
    renderMembers();
    renderNumbers();
    refreshSummary();
  }

  form.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (t === household) plan.household = t.value;
    else if (t.dataset.path) setPath(plan, t.dataset.path as PathKey, t.value);
    else if (t.dataset.key) {
      const memberBox = t.closest<HTMLElement>("[data-member]");
      const numberRow = t.closest<HTMLElement>("[data-number]");
      if (memberBox) {
        const m = plan.members.find((x) => x.id === memberBox.dataset.id);
        if (!m) return;
        const key = t.dataset.key as keyof Member;
        if (key === "appReady") m.appReady = (t as HTMLInputElement).checked;
        else if (key !== "id") m[key] = t.value;
        if (key === "name") memberBox.querySelector("[data-member-title]")!.textContent = t.value.trim() || "Persona";
      } else if (numberRow) {
        const n = plan.numbers[Number(numberRow.dataset.index)];
        if (n) n[t.dataset.key as keyof EmergencyNumber] = t.value;
      }
    }
    persist();
    refreshSummary();
  });
  form.addEventListener("submit", (e) => e.preventDefault());

  root.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLElement>("[data-act]");
    if (!btn) return;
    switch (btn.dataset.act) {
      case "add-member": {
        if (plan.members.length >= 20) return toast("Máximo 20 personas por plan.");
        const m = emptyMember();
        plan.members.push(m);
        renderMembers();
        membersBox.querySelector<HTMLInputElement>(`[data-id="${m.id}"] [data-key="name"]`)?.focus();
        break;
      }
      case "remove-member": {
        const id = btn.closest<HTMLElement>("[data-member]")?.dataset.id;
        plan.members = plan.members.filter((m) => m.id !== id);
        if (plan.members.length === 0) plan.members.push(emptyMember());
        renderMembers();
        break;
      }
      case "add-number": {
        if (plan.numbers.length >= 10) return toast("Máximo 10 teléfonos.");
        plan.numbers.push({ label: "", phone: "" });
        renderNumbers();
        numbersBox.querySelector<HTMLInputElement>(`[data-index="${plan.numbers.length - 1}"] input`)?.focus();
        break;
      }
      case "print":
        refreshSummary();
        window.print();
        return;
      case "export": {
        const blob = new Blob([serializePlan(plan)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "plan-posta.json";
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Copia guardada. Contiene datos personales: guárdala con cuidado.");
        return;
      }
      case "wipe":
        if (!window.confirm("¿Borrar todo el plan de este dispositivo? No se puede deshacer.")) return;
        safeRemove(STORAGE_KEY);
        plan = emptyPlan();
        renderAll();
        saved.textContent = "Plan borrado de este dispositivo.";
        return;
      default:
        return;
    }
    persist();
    refreshSummary();
  });

  root.querySelector<HTMLInputElement>('[data-act="import"]')?.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const next = parsePlanJson(await file.text());
      const hasData = plan.members.some((m) => m.name.trim()) || plan.household.trim();
      if (hasData && !window.confirm("¿Sustituir el plan actual por la copia?")) return;
      plan = next;
      renderAll();
      persist();
      toast("Plan cargado.");
    } catch (err) {
      toast(err instanceof PlanError ? err.message : "No se pudo leer el archivo.");
    }
  });

  renderAll();
}
