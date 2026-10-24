// Clientes (CRM): funil por etapa, contato rápido e resumo do que cada cliente já rendeu.
import { esc, icon, money } from "../ui.js";
import { clientForm, projectForm, STAGES, label } from "./common.js";

let filter = "todos";
let query = "";

export default function clientes(el, ctx) {
  const { db } = ctx;
  const count = s => db.clients.filter(c => c.stage === s).length;
  const q = query.toLowerCase();
  const list = db.clients
    .filter(c => filter === "todos" || c.stage === filter)
    .filter(c => !q || [c.name, c.company, c.phone, c.instagram, c.email].some(v => (v || "").toLowerCase().includes(q)))
    .sort((a, b) => STAGES.findIndex(([k]) => k === a.stage) - STAGES.findIndex(([k]) => k === b.stage) || (a.company || a.name).localeCompare(b.company || b.name));

  const received = id => db.transactions.filter(t => t.client_id === id && t.type === "entrada" && t.paid).reduce((s, t) => s + Number(t.amount), 0);
  const projects = id => db.projects.filter(p => p.client_id === id);
  const wa = phone => { const d = (phone || "").replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : "" };

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">CRM</span><h1>Clientes</h1></div>
      <button class="btn primary" data-new>${icon("plus")}Novo cliente</button>
    </header>

    <div class="funnel" role="group" aria-label="Filtrar por etapa">
      <button data-f="todos" aria-pressed="${filter === "todos"}"><b>${db.clients.length}</b><span>Todos</span></button>
      ${STAGES.map(([k, l]) => `<button data-f="${k}" aria-pressed="${filter === k}" class="st-${k}"><b>${count(k)}</b><span>${l}</span></button>`).join("")}
    </div>

    <label class="search">${icon("search")}<input id="client-search" type="search" placeholder="Buscar por nome, empresa, telefone…" value="${esc(query)}"></label>

    ${list.length ? `<div class="cards">${list.map(c => {
      const ps = projects(c.id);
      return `
      <article class="item" data-id="${c.id}" tabindex="0">
        <div class="item-top">
          <div class="min0"><h3>${esc(c.company || c.name)}</h3><small>${esc(c.company ? c.name : (c.email || ""))}</small></div>
          <span class="pill st-${c.stage}">${esc(label(STAGES, c.stage))}</span>
        </div>
        ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ""}
        <div class="item-meta">
          <span>${ps.length} trabalho(s)</span>
          <span>Recebido: <b>${money(received(c.id))}</b></span>
        </div>
        <div class="item-actions">
          ${c.phone ? `<a class="btn sm ghost" href="${wa(c.phone)}" target="_blank" rel="noopener">${icon("whatsapp")}WhatsApp</a>` : ""}
          ${c.instagram ? `<a class="btn sm ghost" href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a>` : ""}
          <button class="btn sm ghost" data-proj="${c.id}">${icon("plus")}Trabalho</button>
        </div>
      </article>`;
    }).join("")}</div>`
    : `<div class="empty-box"><p>${db.clients.length ? "Nenhum cliente nesse filtro." : "Nenhum cliente ainda. Cadastre o primeiro para começar o funil."}</p><button class="btn primary" data-new>${icon("plus")}Novo cliente</button></div>`}`;

  el.querySelectorAll("[data-new]").forEach(b => b.onclick = () => clientForm(ctx));
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; clientes(el, ctx) });
  const search = el.querySelector("#client-search");
  search.oninput = () => { query = search.value; clientes(el, ctx); const s = el.querySelector("#client-search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length) };
  el.querySelectorAll(".item").forEach(card => {
    const open = e => { if (e.target.closest("a,button")) return; clientForm(ctx, db.clients.find(c => c.id === card.dataset.id)) };
    card.onclick = open;
    card.onkeydown = e => { if (e.key === "Enter") open(e) };
  });
  el.querySelectorAll("[data-proj]").forEach(b => b.onclick = () => projectForm(ctx, {}, { client_id: b.dataset.proj }));
}
