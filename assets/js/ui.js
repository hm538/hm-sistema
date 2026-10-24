// Utilidades de interface: formatação, ícones, modal com formulário, toast e confirmação.

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = v => brl.format(Number(v) || 0);

export const todayISO = () => toISO(new Date());
export function toISO(d) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function parseISO(s) { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d) }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d) }
export function addMonths(iso, n) {
  const d = parseISO(iso), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
}
export const fmtDate = iso => iso ? parseISO(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—";
export const fmtDateLong = iso => iso ? parseISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "") : "—";
export const fmtTime = ts => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const monthName = (y, m) => { const t = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t[0].toUpperCase() + t.slice(1) };
export function fmtHours(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m}min`;
}
export function daysFrom(iso) { return Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5) }

// ---------- ícones ----------
const P = {
  home: '<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  wallet: '<path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><circle cx="16.5" cy="13.5" r="1.3" fill="currentColor"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="m14 7 3 3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  whatsapp: '<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>',
  alert: '<path d="M12 4 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  repeat: '<path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2M18 4v5h-5M6 20v-5h5"/>'
};
export const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;

// ---------- toast ----------
let toastTimer;
export function toast(msg, kind = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), kind === "erro" ? 5000 : 2400);
}

// ---------- modal ----------
// fields: [{ name, label, type, options:[[value,label]], required, value, full, placeholder, step, hint }]
// Retorna os valores preenchidos, ou null se cancelar.
export function formModal({ title, fields, submit = "Salvar", danger }) {
  return new Promise(resolve => {
    const root = document.getElementById("modal");
    const field = f => {
      const id = "f-" + f.name;
      const v = f.value ?? "";
      const req = f.required ? "required" : "";
      let input;
      if (f.type === "select") {
        input = `<select id="${id}" name="${f.name}" ${req}>${(f.options || []).map(([val, lab]) =>
          `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
      } else if (f.type === "textarea") {
        input = `<textarea id="${id}" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
      } else if (f.type === "checkbox") {
        return `<label class="check ${f.full ? "full" : ""}"><input type="checkbox" id="${id}" name="${f.name}" ${v ? "checked" : ""}><span>${esc(f.label)}</span></label>`;
      } else {
        input = `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" ${req}
          ${f.step ? `step="${f.step}"` : ""} ${f.type === "number" ? 'inputmode="decimal" min="0"' : ""} placeholder="${esc(f.placeholder || "")}">`;
      }
      return `<label class="fld ${f.full ? "full" : ""}" ${f.showIf ? `data-show-if="${esc(f.showIf)}"` : ""}>
        <span>${esc(f.label)}${f.required ? " *" : ""}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
    };
    root.innerHTML = `
      <div class="modal-back" data-close></div>
      <form class="sheet" novalidate>
        <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon("x")}</button></header>
        <div class="form-grid">${fields.map(field).join("")}</div>
        <p class="form-err" hidden></p>
        <footer>
          ${danger ? `<button type="button" class="btn ghost danger" data-danger>${icon("trash")}${esc(danger)}</button>` : "<span></span>"}
          <div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" type="submit">${esc(submit)}</button></div>
        </footer>
      </form>`;
    root.hidden = false;
    document.documentElement.classList.add("modal-open");
    const form = root.querySelector("form");
    const syncShow = () => root.querySelectorAll("[data-show-if]").forEach(el => {
      const [name, val] = el.dataset.showIf.split("=");
      const ctl = form.elements[name];
      const cur = ctl?.type === "checkbox" ? String(ctl.checked) : ctl?.value;
      el.hidden = cur !== val;
    });
    form.addEventListener("change", syncShow); syncShow();
    const first = form.querySelector("input:not([type=checkbox]),select,textarea");
    setTimeout(() => first?.focus(), 30);

    const close = val => {
      root.hidden = true; root.innerHTML = "";
      document.documentElement.classList.remove("modal-open");
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onKey = e => { if (e.key === "Escape") close(null) };
    document.addEventListener("keydown", onKey);
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => close(null)));
    root.querySelector("[data-danger]")?.addEventListener("click", () => close({ __danger: true }));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        const el = form.elements[f.name];
        const hidden = el.closest("[data-show-if]")?.hidden;
        if (f.type === "checkbox") out[f.name] = el.checked;
        else if (f.type === "number") out[f.name] = el.value === "" ? null : Number(String(el.value).replace(",", "."));
        else out[f.name] = el.value.trim() === "" ? null : el.value.trim();
        if (f.required && !hidden && (out[f.name] === null || out[f.name] === "")) {
          const err = root.querySelector(".form-err");
          err.textContent = `Preencha "${f.label}".`; err.hidden = false; el.focus(); return;
        }
      }
      close(out);
    });
  });
}

export async function confirmModal(message, action = "Excluir") {
  const r = await formModal({ title: message, fields: [], submit: action });
  return r !== null;
}
