// Trabalhos: status, prazo, horas estimadas x gastas (com cronômetro) e resultado financeiro de cada um.
import { PEOPLE } from "../config.js";
import { esc, icon, money, fmtDate, fmtHours, daysFrom, todayISO } from "../ui.js";
import { projectForm, timeForm, txForm, STATUSES, label, projectMinutes, projectMoney, completion } from "./common.js";

let show = "abertos";
let owner = "todos";
let tick;

const TIMER_KEY = "hm-timer";
const getTimer = () => { try { return JSON.parse(localStorage.getItem(TIMER_KEY)) } catch { return null } };
const setTimer = v => { try { v ? localStorage.setItem(TIMER_KEY, JSON.stringify(v)) : localStorage.removeItem(TIMER_KEY) } catch {} };
const elapsed = t => Math.max(0, Math.floor((Date.now() - t.start) / 1000));
const clock = s => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":");

export default function trabalhos(el, ctx) {
  const { db } = ctx;
  clearInterval(tick);
  const today = todayISO();
  const timer = getTimer();
  const list = db.projects
    .filter(p => show === "todos" || (show === "abertos" ? !["concluido", "pausado"].includes(p.status) : p.status === show))
    .filter(p => owner === "todos" || p.owner === owner)
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));

  const card = p => {
    const spent = projectMinutes(ctx, p.id);
    const est = (p.hours_estimated || 0) * 60;
    const pct = est ? Math.min(100, (spent / est) * 100) : 0;
    const over = est && spent > est;
    const m = projectMoney(ctx, p.id);
    const late = p.due_date && p.due_date < today && !["concluido", "pausado"].includes(p.status);
    const dueTxt = p.due_date ? (late ? `Atrasado ${-daysFrom(p.due_date)}d` : p.status === "concluido" ? fmtDate(p.due_date) : daysFrom(p.due_date) === 0 ? "Entrega hoje" : `Entrega ${fmtDate(p.due_date)}`) : "Sem prazo";
    const entries = db.time_entries.filter(t => t.project_id === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const running = timer && timer.project_id === p.id;
    const valueHour = spent ? (m.inPaid - m.outPaid) / (spent / 60) : null;
    return `
    <article class="item proj ${late ? "is-late" : ""}" data-id="${p.id}">
      <div class="item-top">
        <div class="min0">
          <h3>${esc(p.title)}</h3>
          <small>${esc([ctx.clientLabel(p.client_id), p.service].filter(Boolean).join(" · "))}</small>
        </div>
        <select class="status-sel st-${p.status}" data-status="${p.id}" aria-label="Status">
          ${STATUSES.map(([k, l]) => `<option value="${k}" ${k === p.status ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="item-meta">
        <span>${icon("users")}${esc(p.owner || "—")}</span>
        <span class="${late ? "bad" : ""}">${icon("calendar")}${esc(dueTxt)}</span>
        <span>${p.billing === "mensal" ? `${money(p.price)}/mês` : money(p.price)}</span>
      </div>
      <div class="hours">
        <div class="hours-top"><span>${icon("clock")}<b>${fmtHours(spent)}</b> ${est ? `de ${fmtHours(est)} estimadas` : "trabalhadas"}</span>${over ? `<span class="warn">+${fmtHours(spent - est)}</span>` : ""}</div>
        ${est ? `<div class="bar ${over ? "over" : ""}"><i style="width:${pct}%"></i></div>` : ""}
      </div>
      <div class="money-row">
        <div><span>Recebido</span><b class="pos">${money(m.inPaid)}</b>${m.inTotal > m.inPaid ? `<small>falta ${money(m.inTotal - m.inPaid)}</small>` : ""}</div>
        <div><span>Gastos</span><b class="neg">${money(m.outPaid)}</b></div>
        <div><span>Lucro</span><b>${money(m.inPaid - m.outPaid)}</b>${valueHour !== null ? `<small>${money(valueHour)}/hora</small>` : ""}</div>
      </div>
      <div class="item-actions">
        ${running
          ? `<button class="btn sm danger-solid" data-stop>${icon("stop")}Parar <span class="mono" data-clock>${clock(elapsed(timer))}</span></button>`
          : `<button class="btn sm" data-start="${p.id}" ${timer ? "disabled title=\"Já tem um cronômetro rodando\"" : ""}>${icon("play")}Cronômetro</button>`}
        <button class="btn sm ghost" data-time="${p.id}">${icon("plus")}Horas</button>
        <button class="btn sm ghost" data-tx="${p.id}">${icon("plus")}Lançamento</button>
        <button class="btn sm ghost" data-edit="${p.id}">${icon("edit")}Editar</button>
      </div>
      ${entries.length ? `<details class="entries"><summary>${entries.length} registro(s) de horas</summary><ul>${entries.map(t => `
        <li><button data-entry="${t.id}"><span>${fmtDate(t.date)}</span><span class="min0">${esc(t.person || "")}${t.note ? " · " + esc(t.note) : ""}</span><b>${fmtHours(t.minutes)}</b></button></li>`).join("")}</ul></details>` : ""}
    </article>`;
  };

  const timerProject = timer && ctx.project(timer.project_id);
  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Projetos</span><h1>Trabalhos</h1></div>
      <button class="btn primary" data-new>${icon("plus")}Novo trabalho</button>
    </header>
    ${timerProject ? `<div class="timer-bar">${icon("clock")}<span>Cronômetro: <b>${esc(timerProject.title)}</b> · ${esc(timer.person)}</span><b class="mono" data-clock>${clock(elapsed(timer))}</b><button class="btn sm danger-solid" data-stop>${icon("stop")}Parar</button></div>` : ""}
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status">
        ${[["abertos", "Em aberto"], ...STATUSES.filter(([k]) => ["concluido", "pausado"].includes(k)), ["todos", "Todos"]].map(([k, l]) =>
          `<button data-show="${k}" aria-pressed="${show === k}">${l}</button>`).join("")}
      </div>
      <div class="seg" role="group" aria-label="Responsável">
        ${["todos", ...PEOPLE].map(o => `<button data-owner="${o}" aria-pressed="${owner === o}">${o === "todos" ? "Todos" : esc(o)}</button>`).join("")}
      </div>
    </div>
    ${list.length ? `<div class="cards">${list.map(card).join("")}</div>`
      : `<div class="empty-box"><p>${db.projects.length ? "Nenhum trabalho nesse filtro." : "Nenhum trabalho cadastrado ainda."}</p><button class="btn primary" data-new>${icon("plus")}Novo trabalho</button></div>`}`;

  const byId = id => db.projects.find(p => p.id === id);
  el.querySelectorAll("[data-new]").forEach(b => b.onclick = () => projectForm(ctx));
  el.querySelectorAll("[data-show]").forEach(b => b.onclick = () => { show = b.dataset.show; trabalhos(el, ctx) });
  el.querySelectorAll("[data-owner]").forEach(b => b.onclick = () => { owner = b.dataset.owner; trabalhos(el, ctx) });
  el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => projectForm(ctx, byId(b.dataset.edit)));
  el.querySelectorAll("[data-time]").forEach(b => b.onclick = () => timeForm(ctx, byId(b.dataset.time)));
  el.querySelectorAll("[data-tx]").forEach(b => b.onclick = () => {
    const p = byId(b.dataset.tx);
    txForm(ctx, {}, { project_id: p.id, client_id: p.client_id, description: p.title, amount: p.price, category: p.billing === "mensal" ? "Mensalidade" : "Projeto", repeat: p.billing === "mensal" });
  });
  el.querySelectorAll("[data-entry]").forEach(b => b.onclick = () => {
    const t = db.time_entries.find(x => x.id === b.dataset.entry);
    timeForm(ctx, byId(t.project_id), t);
  });
  el.querySelectorAll("[data-status]").forEach(s => s.onchange = () =>
    ctx.run(() => ctx.store.update("projects", s.dataset.status, { status: s.value, ...completion(byId(s.dataset.status), s.value) }), `Status: ${label(STATUSES, s.value)}`, ["projects"]));
  el.querySelectorAll("[data-start]").forEach(b => b.onclick = () => {
    const p = byId(b.dataset.start);
    setTimer({ project_id: p.id, person: p.owner || PEOPLE[0], start: Date.now() });
    trabalhos(el, ctx);
  });
  el.querySelectorAll("[data-stop]").forEach(b => b.onclick = async () => {
    const t = getTimer(); setTimer(null);
    const p = byId(t.project_id);
    trabalhos(el, ctx);
    if (p) await timeForm(ctx, p, { minutes: Math.max(1, Math.round(elapsed(t) / 60)), person: t.person, date: todayISO() });
  });
  if (timer) tick = setInterval(() => {
    if (!document.body.contains(el)) return clearInterval(tick);
    el.querySelectorAll("[data-clock]").forEach(c => c.textContent = clock(elapsed(timer)));
  }, 1000);
}
