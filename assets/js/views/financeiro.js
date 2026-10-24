// Financeiro: entradas e saídas do mês, previsto x realizado, atrasados e gastos por categoria.
import { esc, icon, money, fmtDate, monthName, todayISO } from "../ui.js";
import { txForm, togglePaid, generateCharges } from "./common.js";

let ym = null;          // "AAAA-MM" do mês aberto
let kind = "todos";     // todos | entrada | saida | pendentes

export default function financeiro(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  ym = ym || today.slice(0, 7);
  const [Y, M] = ym.split("-").map(Number);
  const shift = n => { const d = new Date(Y, M - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
  const sum = arr => arr.reduce((s, t) => s + Number(t.amount), 0);

  const month = db.transactions.filter(t => t.due_date.slice(0, 7) === ym);
  const ins = month.filter(t => t.type === "entrada"), outs = month.filter(t => t.type === "saida");
  const late = db.transactions.filter(t => !t.paid && t.due_date < today && t.due_date.slice(0, 7) < ym);
  const shown = month
    .filter(t => kind === "todos" || (kind === "pendentes" ? !t.paid : t.type === kind))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.type.localeCompare(b.type));

  // Últimos 6 meses (realizado, pela data de pagamento)
  const hist = Array.from({ length: 6 }, (_, i) => shift(i - 5)).map(k => ({
    k, in: sum(db.transactions.filter(t => t.type === "entrada" && t.paid && (t.paid_date || "").slice(0, 7) === k)),
    out: sum(db.transactions.filter(t => t.type === "saida" && t.paid && (t.paid_date || "").slice(0, 7) === k))
  }));
  const max = Math.max(1, ...hist.flatMap(h => [h.in, h.out]));

  const cats = Object.entries(outs.reduce((acc, t) => { acc[t.category || "Outro"] = (acc[t.category || "Outro"] || 0) + Number(t.amount); return acc }, {}))
    .sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...cats.map(c => c[1]));

  const row = t => {
    const overdue = !t.paid && t.due_date < today;
    const who = [ctx.clientLabel(t.client_id), ctx.project(t.project_id)?.title].filter(Boolean).join(" · ");
    return `
    <li class="tx ${t.type} ${t.paid ? "paid" : ""} ${overdue ? "overdue" : ""}">
      <button class="tick" data-paid="${t.id}" aria-label="${t.paid ? "Marcar como pendente" : t.type === "entrada" ? "Marcar como recebido" : "Marcar como pago"}" aria-pressed="${t.paid}">${icon("check")}</button>
      <button class="tx-main" data-edit="${t.id}">
        <span class="min0"><b>${esc(t.description)}</b><small>${esc([t.paid ? t.method : "", t.category, who].filter(Boolean).join(" · "))}${t.series_id ? ` · ${icon("repeat", "i xs")}recorrente` : ""}</small></span>
        <span class="tx-right"><b class="${t.type === "entrada" ? "pos" : "neg"}">${t.type === "entrada" ? "+" : "−"} ${money(t.amount)}</b>
        <small class="${overdue ? "bad" : ""}">${t.paid ? (t.type === "entrada" ? "Recebido " : "Pago ") + fmtDate(t.paid_date) : (overdue ? "Venceu " : "Vence ") + fmtDate(t.due_date)}</small></span>
      </button>
    </li>`;
  };

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Financeiro</span>
        <div class="month-nav">
          <button class="icon-btn" data-m="-1" aria-label="Mês anterior">${icon("left")}</button>
          <h1>${esc(monthName(Y, M - 1))}</h1>
          <button class="icon-btn" data-m="1" aria-label="Próximo mês">${icon("right")}</button>
        </div>
      </div>
      <div class="quick">
        <button class="btn sm" data-gen>${icon("repeat")}Gerar cobranças do mês</button>
        <button class="btn sm" data-new="saida">${icon("down")}Saída</button>
        <button class="btn primary" data-new="entrada">${icon("up")}Entrada</button>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi"><span>Entradas recebidas</span><b class="pos">${money(sum(ins.filter(t => t.paid)))}</b><small>previsto ${money(sum(ins))}</small></div>
      <div class="kpi"><span>Saídas pagas</span><b class="neg">${money(sum(outs.filter(t => t.paid)))}</b><small>previsto ${money(sum(outs))}</small></div>
      <div class="kpi hero"><span>Resultado do mês</span><b class="${sum(ins.filter(t => t.paid)) - sum(outs.filter(t => t.paid)) >= 0 ? "pos" : "neg"}">${money(sum(ins.filter(t => t.paid)) - sum(outs.filter(t => t.paid)))}</b><small>previsto ${money(sum(ins) - sum(outs))}</small></div>
    </section>

    ${late.length ? `<section class="card late-card"><h2>${icon("alert")}Atrasados de meses anteriores</h2><ul class="tx-list">${late.map(row).join("")}</ul></section>` : ""}

    <section class="card">
      <div class="card-head">
        <h2>Lançamentos</h2>
        <div class="seg" role="group" aria-label="Filtro">
          ${[["todos", "Todos"], ["entrada", "Entradas"], ["saida", "Saídas"], ["pendentes", "Pendentes"]].map(([k, l]) =>
            `<button data-kind="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}
        </div>
      </div>
      ${shown.length ? `<ul class="tx-list">${shown.map(row).join("")}</ul>` : `<p class="empty">Nenhum lançamento ${kind === "todos" ? "neste mês" : "nesse filtro"}.</p>`}
    </section>

    <div class="two">
      <section class="card">
        <h2>Últimos 6 meses</h2>
        <div class="chart" role="img" aria-label="Entradas e saídas recebidas e pagas nos últimos 6 meses">
          ${hist.map(h => `<div class="col ${h.k === ym ? "cur" : ""}">
            <div class="pair"><i class="in" style="height:${(h.in / max) * 100}%" title="Entradas ${money(h.in)}"></i><i class="out" style="height:${(h.out / max) * 100}%" title="Saídas ${money(h.out)}"></i></div>
            <span>${new Date(+h.k.slice(0, 4), +h.k.slice(5) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
          </div>`).join("")}
        </div>
        <div class="legend"><span><i class="in"></i>Entradas</span><span><i class="out"></i>Saídas</span></div>
      </section>
      <section class="card">
        <h2>Gastos por categoria</h2>
        ${cats.length ? `<ul class="bars">${cats.map(([c, v]) => `<li><span>${esc(c)}</span><div class="bar neg"><i style="width:${(v / catMax) * 100}%"></i></div><b>${money(v)}</b></li>`).join("")}</ul>`
          : `<p class="empty">Nenhuma saída neste mês.</p>`}
      </section>
    </div>`;

  const byId = id => db.transactions.find(t => t.id === id);
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { ym = shift(+b.dataset.m); financeiro(el, ctx) });
  el.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { kind = b.dataset.kind; financeiro(el, ctx) });
  el.querySelectorAll("[data-new]").forEach(b => b.onclick = () => txForm(ctx, {}, { type: b.dataset.new, due_date: ym === today.slice(0, 7) ? today : ym + "-01" }));
  el.querySelector("[data-gen]").onclick = () => generateCharges(ctx, ym);
  el.querySelectorAll("[data-paid]").forEach(b => b.onclick = () => togglePaid(ctx, byId(b.dataset.paid)));
  el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => txForm(ctx, byId(b.dataset.edit)));
}
