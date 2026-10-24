// Agenda: calendário do mês com compromissos, prazos de trabalhos e vencimentos do financeiro.
import { esc, icon, money, fmtTime, monthName, todayISO, toISO, fmtDateLong } from "../ui.js";
import { eventForm, projectForm, txForm, KINDS, label } from "./common.js";

let cursor = null;   // primeiro dia do mês aberto
let selected = null; // dia selecionado (AAAA-MM-DD)

export default function agenda(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  if (!cursor) { const d = new Date(); cursor = new Date(d.getFullYear(), d.getMonth(), 1) }
  selected = selected || today;
  const Y = cursor.getFullYear(), M = cursor.getMonth();

  // Tudo que cai em cada dia
  const items = {};
  const add = (date, it) => (items[date] = items[date] || []).push(it);
  db.events.forEach(e => add(toISO(new Date(e.start_at)), {
    type: "ev", kind: e.kind, sort: e.start_at, title: e.title, time: fmtTime(e.start_at),
    sub: [label(KINDS, e.kind), e.person && e.person !== "Todos" ? e.person : "", ctx.clientLabel(e.client_id), e.location].filter(Boolean).join(" · "),
    open: () => eventForm(ctx, e)
  }));
  db.projects.filter(p => p.due_date && p.status !== "concluido").forEach(p => add(p.due_date, {
    type: "due", sort: p.due_date + "T23", title: `Prazo: ${p.title}`, time: "",
    sub: [p.owner, ctx.clientLabel(p.client_id)].filter(Boolean).join(" · "), open: () => projectForm(ctx, p)
  }));
  db.transactions.filter(t => !t.paid).forEach(t => add(t.due_date, {
    type: t.type === "entrada" ? "in" : "out", sort: t.due_date + "T22", title: `${t.type === "entrada" ? "Receber" : "Pagar"}: ${t.description}`, time: "",
    sub: money(t.amount), open: () => txForm(ctx, t)
  }));
  Object.values(items).forEach(a => a.sort((x, y) => x.sort.localeCompare(y.sort)));

  // Grade começando na segunda-feira
  const first = new Date(Y, M, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(Y, M, 1 - startOffset + i));
  const weeks = days[35].getMonth() !== M ? 5 : 6;

  const dayItems = items[selected] || [];
  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Agenda</span>
        <div class="month-nav">
          <button class="icon-btn" data-m="-1" aria-label="Mês anterior">${icon("left")}</button>
          <h1>${esc(monthName(Y, M))}</h1>
          <button class="icon-btn" data-m="1" aria-label="Próximo mês">${icon("right")}</button>
        </div>
      </div>
      <div class="quick">
        <button class="btn sm ghost" data-today>Hoje</button>
        <button class="btn primary" data-new>${icon("plus")}Compromisso</button>
      </div>
    </header>

    <div class="cal-wrap">
      <section class="cal card">
        <div class="cal-head">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => `<span>${d}</span>`).join("")}</div>
        <div class="cal-grid">${days.slice(0, weeks * 7).map(d => {
          const iso = toISO(d), its = items[iso] || [];
          return `<button class="day ${d.getMonth() !== M ? "out" : ""} ${iso === today ? "today" : ""} ${iso === selected ? "sel" : ""}" data-day="${iso}" aria-label="${esc(fmtDateLong(iso))}, ${its.length} item(ns)">
            <span class="n">${d.getDate()}</span>
            <span class="chips">${its.slice(0, 3).map(it => `<i class="c-${it.type} k-${it.kind || ""}"><em>${esc(it.time ? it.time + " " : "")}${esc(it.title)}</em></i>`).join("")}${its.length > 3 ? `<i class="more"><em>+${its.length - 3}</em></i>` : ""}</span>
          </button>`;
        }).join("")}</div>
        <div class="legend">
          <span><i class="c-ev"></i>Compromisso</span><span><i class="c-due"></i>Prazo de trabalho</span><span><i class="c-in"></i>A receber</span><span><i class="c-out"></i>A pagar</span>
        </div>
      </section>

      <section class="card day-panel">
        <div class="card-head"><h2>${esc(fmtDateLong(selected))}</h2><button class="btn sm" data-new-day>${icon("plus")}Adicionar</button></div>
        ${dayItems.length ? `<ul class="agenda-list">${dayItems.map((it, i) => `
          <li><button data-it="${i}" class="c-${it.type}">
            <span class="when">${esc(it.time || "Dia todo")}</span>
            <span class="what"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>
          </button></li>`).join("")}</ul>` : `<p class="empty">Nada neste dia.</p>`}
      </section>
    </div>`;

  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { cursor = new Date(Y, M + Number(b.dataset.m), 1); agenda(el, ctx) });
  el.querySelector("[data-today]").onclick = () => { const d = new Date(); cursor = new Date(d.getFullYear(), d.getMonth(), 1); selected = today; agenda(el, ctx) };
  el.querySelectorAll("[data-day]").forEach(b => b.onclick = () => {
    selected = b.dataset.day;
    const d = new Date(selected + "T12:00");
    if (d.getMonth() !== M) cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    agenda(el, ctx);
    if (matchMedia("(max-width: 900px)").matches) el.querySelector(".day-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  el.querySelector("[data-new]").onclick = () => eventForm(ctx, {}, { date: selected });
  el.querySelector("[data-new-day]").onclick = () => eventForm(ctx, {}, { date: selected });
  el.querySelectorAll("[data-it]").forEach(b => b.onclick = () => dayItems[b.dataset.it].open());
}
