// Conteúdo: calendário de postagens dos clientes.
// Visões: Semana (calendário por dia) e Quadro (colunas por etapa). Filtros por cliente e responsável.
import { PEOPLE } from "../config.js";
import { esc, icon, todayISO, addDays, parseISO, fmtDateLong, fmtDate } from "../ui.js";
import { postForm, planForm, advancePost, POST_STATUS, nextStatus, label } from "./common.js";

let mode = "semana";      // "semana" | "quadro"
let cursor = null;        // um dia da semana aberta
let client = "todos";
let owner = "todos";

const mondayOf = iso => { const d = parseISO(iso); return addDays(iso, -((d.getDay() + 6) % 7)) };

export default function conteudo(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  cursor = cursor || today;
  const name = id => ctx.clientLabel(id) || "Sem cliente";

  const posts = db.posts
    .filter(p => client === "todos" || p.client_id === client)
    .filter(p => owner === "todos" || p.owner === owner)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const late = posts.filter(p => p.date < today && p.status !== "publicado");

  const card = p => {
    const n = nextStatus(p.status);
    const isLate = p.date < today && p.status !== "publicado";
    return `
    <article class="post st-${p.status} ${isLate ? "is-late" : ""}">
      <button class="post-main" data-edit="${p.id}">
        <span class="post-top"><b>${esc(name(p.client_id))}</b>${p.time ? `<em>${esc(p.time)}</em>` : ""}</span>
        <span class="post-title">${esc(p.title)}</span>
        <span class="post-meta">${esc([p.channel, p.format].filter(Boolean).join(" · "))}${p.owner ? ` · ${esc(p.owner)}` : ""}</span>
        <span class="post-status"><i></i>${esc(label(POST_STATUS, p.status))}${isLate ? " · atrasado" : ""}</span>
      </button>
      ${n ? `<button class="post-next" data-next="${p.id}" title="Passar para ${esc(label(POST_STATUS, n))}">${icon("right")}</button>` : ""}
    </article>`;
  };

  // ---------- semana ----------
  const start = mondayOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const a = parseISO(days[0]), b = parseISO(days[6]);
  const weekTitle = `${a.getDate()}${a.getMonth() !== b.getMonth() ? " " + a.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : ""} – ${b.getDate()} ${b.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`;
  const weekPosts = posts.filter(p => p.date >= days[0] && p.date <= days[6]);
  const week = `
    <div class="week-board">
      ${days.map(d => {
        const list = posts.filter(p => p.date === d);
        return `<section class="wcol ${d === today ? "today" : ""}">
          <header><span>${esc(fmtDateLong(d))}</span><button class="icon-btn sm" data-add="${d}" aria-label="Novo post em ${esc(fmtDateLong(d))}">${icon("plus")}</button></header>
          ${list.length ? list.map(card).join("") : `<button class="wcol-empty" data-add="${d}">+ post</button>`}
        </section>`;
      }).join("")}
    </div>`;

  // ---------- quadro ----------
  const boardRange = posts.filter(p => p.status !== "publicado" || p.date >= addDays(today, -14));
  const board = `
    <div class="kanban">
      ${POST_STATUS.map(([k, l]) => {
        const list = boardRange.filter(p => p.status === k);
        return `<section class="kcol st-${k}">
          <header><span>${esc(l)}</span><b>${list.length}</b></header>
          ${list.map(p => card(p).replace('<span class="post-top">', `<span class="post-date">${esc(fmtDate(p.date))}</span><span class="post-top">`)).join("") || `<p class="empty sm">Nada aqui.</p>`}
        </section>`;
      }).join("")}
    </div>
    <p class="muted">Publicados aparecem no quadro por 14 dias.</p>`;

  const counts = POST_STATUS.map(([k, l]) => [k, l, weekPosts.filter(p => p.status === k).length]);

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Conteúdo</span>
        ${mode === "semana" ? `<div class="month-nav">
          <button class="icon-btn" data-step="-1" aria-label="Semana anterior">${icon("left")}</button>
          <h1>${esc(weekTitle)}</h1>
          <button class="icon-btn" data-step="1" aria-label="Próxima semana">${icon("right")}</button>
        </div>` : `<h1>Quadro de postagens</h1>`}
      </div>
      <div class="quick">
        ${mode === "semana" ? `<button class="btn sm ghost" data-today>Hoje</button>` : ""}
        <button class="btn sm" data-plan>${icon("repeat")}Planejar semanas</button>
        <button class="btn primary" data-new>${icon("plus")}Novo post</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Visão">
        <button data-mode="semana" aria-pressed="${mode === "semana"}">Semana</button>
        <button data-mode="quadro" aria-pressed="${mode === "quadro"}">Quadro</button>
      </div>
      <label class="sel"><span class="sr">Cliente</span>
        <select id="post-client">${[["todos", "Todos os clientes"], ...db.clients.filter(c => c.stage !== "encerrado").map(c => [c.id, c.company || c.name])]
          .map(([v, l]) => `<option value="${esc(v)}" ${v === client ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      </label>
      <div class="seg" role="group" aria-label="Responsável">
        ${["todos", ...PEOPLE].map(o => `<button data-owner="${esc(o)}" aria-pressed="${owner === o}">${o === "todos" ? "Todos" : esc(o)}</button>`).join("")}
      </div>
    </div>

    ${late.length ? `<div class="warn-box"><div class="wb-head">${icon("alert")}<b>${late.length} post(s) atrasado(s)</b><span>o dia passou e ainda não foi publicado</span></div>
      <ul>${late.slice(0, 6).map(p => `<li><button class="link-btn" data-edit="${p.id}">${esc(fmtDate(p.date))} · ${esc(name(p.client_id))} · ${esc(p.title)} (${esc(label(POST_STATUS, p.status))})</button></li>`).join("")}${late.length > 6 ? `<li>e mais ${late.length - 6}…</li>` : ""}</ul></div>` : ""}

    ${mode === "semana" ? `<div class="post-sum">${counts.map(([k, l, n]) => `<span class="st-${k}"><i></i>${esc(l)} <b>${n}</b></span>`).join("")}</div>` : ""}
    ${db.posts.length ? (mode === "semana" ? week : board)
      : `<div class="empty-box"><p>Nenhum post ainda. Use <b>Planejar semanas</b> para criar a rotina de um cliente de uma vez, ou <b>Novo post</b> para um post avulso.</p>
          <div class="row"><button class="btn" data-plan>${icon("repeat")}Planejar semanas</button><button class="btn primary" data-new>${icon("plus")}Novo post</button></div></div>`}`;

  // ---------- ações ----------
  const rerender = () => conteudo(el, ctx);
  const byId = id => db.posts.find(p => p.id === id);
  el.querySelectorAll("[data-step]").forEach(btn => btn.onclick = () => { cursor = addDays(cursor, 7 * btn.dataset.step); rerender() });
  el.querySelector("[data-today]")?.addEventListener("click", () => { cursor = today; rerender() });
  el.querySelectorAll("[data-mode]").forEach(btn => btn.onclick = () => { mode = btn.dataset.mode; rerender() });
  el.querySelectorAll("[data-owner]").forEach(btn => btn.onclick = () => { owner = btn.dataset.owner; rerender() });
  el.querySelector("#post-client").onchange = e => { client = e.target.value; rerender() };
  const preset = extra => ({ client_id: client !== "todos" ? client : undefined, owner: owner !== "todos" ? owner : undefined, ...extra });
  el.querySelectorAll("[data-new]").forEach(btn => btn.onclick = () => postForm(ctx, {}, preset({ date: mode === "semana" && mondayOf(cursor) !== mondayOf(today) ? days[0] : today })));
  el.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => postForm(ctx, {}, preset({ date: btn.dataset.add })));
  el.querySelectorAll("[data-plan]").forEach(btn => btn.onclick = () => planForm(ctx, { client_id: client !== "todos" ? client : "", start: mode === "semana" && days[0] > today ? days[0] : today }));
  el.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => postForm(ctx, byId(btn.dataset.edit)));
  el.querySelectorAll("[data-next]").forEach(btn => btn.onclick = () => advancePost(ctx, byId(btn.dataset.next)));
}
