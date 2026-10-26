// Painel: resumo do mês, alertas e próximos compromissos.
import { PEOPLE } from "../config.js";
import { esc, icon, money, todayISO, toISO, fmtDate, fmtDateLong, fmtTime, fmtHours, monthName, daysFrom, addDays } from "../ui.js";
import { clientForm, projectForm, txForm, eventForm, goalForm, postForm, togglePaid, projectMinutes, label, KINDS, POST_STATUS } from "./common.js";

export default function painel(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  const ym = today.slice(0, 7);
  const now = new Date();
  const inMonth = d => d && d.slice(0, 7) === ym;
  const sum = arr => arr.reduce((s, t) => s + Number(t.amount), 0);

  const received = sum(db.transactions.filter(t => t.type === "entrada" && t.paid && inMonth(t.paid_date)));
  const spent = sum(db.transactions.filter(t => t.type === "saida" && t.paid && inMonth(t.paid_date)));
  const toReceive = db.transactions.filter(t => t.type === "entrada" && !t.paid && t.due_date.slice(0, 7) <= ym);
  const toPay = db.transactions.filter(t => t.type === "saida" && !t.paid && t.due_date.slice(0, 7) <= ym);
  const lateIn = toReceive.filter(t => t.due_date < today);
  const lateOut = toPay.filter(t => t.due_date < today);

  const open = db.projects.filter(p => !["concluido", "pausado"].includes(p.status));
  const lateProjects = open.filter(p => p.due_date && p.due_date < today);
  const overHours = open.filter(p => p.hours_estimated && projectMinutes(ctx, p.id) > p.hours_estimated * 60);

  // Próximos 7 dias: compromissos + prazos + vencimentos
  const limit = addDays(today, 7);
  const upcoming = [
    ...db.events.filter(e => new Date(e.start_at) >= new Date(now.getTime() - 36e5) && toISO(new Date(e.start_at)) <= limit)
      .map(e => ({ when: toISO(new Date(e.start_at)) + "T" + new Date(e.start_at).toTimeString().slice(0, 5), date: toISO(new Date(e.start_at)), kind: label(KINDS, e.kind), title: e.title, sub: [fmtTime(e.start_at), e.person !== "Todos" ? e.person : "", ctx.clientLabel(e.client_id)].filter(Boolean).join(" · "), open: () => eventForm(ctx, e) })),
    ...open.filter(p => p.due_date && p.due_date >= today && p.due_date <= limit)
      .map(p => ({ when: p.due_date + "T23:00", date: p.due_date, kind: "Prazo", title: p.title, sub: [p.owner, ctx.clientLabel(p.client_id)].filter(Boolean).join(" · "), open: () => projectForm(ctx, p) })),
    ...db.posts.filter(p => p.status !== "publicado" && p.date >= today && p.date <= limit)
      .map(p => ({ when: p.date + "T" + (p.time || "20:00"), date: p.date, kind: "Post", title: `${ctx.clientLabel(p.client_id)} · ${p.title}`, sub: [p.format, p.time, label(POST_STATUS, p.status)].filter(Boolean).join(" · "), open: () => postForm(ctx, p) })),
    ...db.transactions.filter(t => !t.paid && t.due_date >= today && t.due_date <= limit)
      .map(t => ({ when: t.due_date + "T22:00", date: t.due_date, kind: t.type === "entrada" ? "A receber" : "A pagar", title: t.description, sub: money(t.amount), open: () => txForm(ctx, t) }))
  ].sort((a, b) => a.when.localeCompare(b.when));

  const minutesBy = PEOPLE.map(p => [p, db.time_entries.filter(t => t.person === p && inMonth(t.date)).reduce((s, t) => s + t.minutes, 0)]);
  const maxMin = Math.max(60, ...minutesBy.map(([, m]) => m));

  // Metas do mês
  const goal = db.goals.find(g => g.month === ym);
  const prevYm = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` })();
  const lastGoal = db.goals.find(g => g.month === prevYm) || [...db.goals].sort((a, b) => b.month.localeCompare(a.month))[0];
  const pace = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const goalRows = goal ? [
    ["Faturamento", received, goal.revenue, money],
    ["Lucro", received - spent, goal.profit, money],
    ["Clientes novos fechados", db.clients.filter(c => inMonth(c.won_at)).length, goal.new_clients, String],
    ["Trabalhos entregues", db.projects.filter(p => inMonth(p.completed_at)).length, goal.delivered, String]
  ].filter(([, , target]) => target) : [];
  const goalHtml = ([name, actual, target, fmt]) => {
    const pct = Math.max(0, actual / target);
    const state = pct >= 1 ? ["done", "Meta batida"] : pct >= pace - .05 ? ["ok", "No ritmo"] : ["behind", "Abaixo do ritmo"];
    return `<li class="goal ${state[0]}">
      <div class="goal-top"><span>${esc(name)}</span><em>${state[1]}</em></div>
      <div class="goal-num"><b>${esc(fmt(actual))}</b><small>de ${esc(fmt(target))}${pct < 1 ? ` · faltam ${esc(fmt(target - actual))}` : ""}</small></div>
      <div class="bar goal-bar"><i style="width:${Math.min(100, pct * 100)}%"></i><s style="left:${pace * 100}%" title="Onde deveria estar hoje"></s></div>
    </li>`;
  };

  const alerts = [
    ...lateIn.map(t => ({ tone: "bad", text: `Recebimento atrasado: ${t.description} (${money(t.amount)}), venceu ${fmtDate(t.due_date)}`, act: "Recebido", fn: () => togglePaid(ctx, t) })),
    ...lateOut.map(t => ({ tone: "warn", text: `Conta atrasada: ${t.description} (${money(t.amount)}), venceu ${fmtDate(t.due_date)}`, act: "Paguei", fn: () => togglePaid(ctx, t) })),
    ...lateProjects.map(p => ({ tone: "bad", text: `Trabalho atrasado: ${p.title}${p.client_id ? " · " + ctx.clientLabel(p.client_id) : ""} (prazo ${fmtDate(p.due_date)}, ${-daysFrom(p.due_date)} dia(s))`, act: "Abrir", fn: () => projectForm(ctx, p) })),
    ...db.posts.filter(p => p.date < today && p.status !== "publicado").map(p => ({ tone: "warn", text: `Post atrasado: ${ctx.clientLabel(p.client_id)} · ${p.title} (${fmtDate(p.date)}, ${label(POST_STATUS, p.status)})`, act: "Abrir", fn: () => postForm(ctx, p) })),
    ...overHours.map(p => ({ tone: "warn", text: `${p.title} passou das horas estimadas: ${fmtHours(projectMinutes(ctx, p.id))} de ${fmtHours(p.hours_estimated * 60)}`, act: "Ver", fn: () => ctx.go("trabalhos") }))
  ];

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">${esc(monthName(now.getFullYear(), now.getMonth()))}</span><h1>Painel</h1></div>
      <div class="quick">
        <button class="btn sm" data-q="tx">${icon("plus")}Lançamento</button>
        <button class="btn sm" data-q="event">${icon("plus")}Compromisso</button>
        <button class="btn sm" data-q="project">${icon("plus")}Trabalho</button>
        <button class="btn sm" data-q="client">${icon("plus")}Cliente</button>
      </div>
    </header>

    <section class="kpis">
      <div class="kpi"><span>Recebido no mês</span><b class="pos">${money(received)}</b></div>
      <div class="kpi"><span>Gasto no mês</span><b class="neg">${money(spent)}</b></div>
      <div class="kpi hero"><span>Saldo do mês</span><b class="${received - spent >= 0 ? "pos" : "neg"}">${money(received - spent)}</b></div>
      <div class="kpi"><span>A receber até o fim do mês</span><b>${money(sum(toReceive))}</b>${lateIn.length ? `<small class="bad">${lateIn.length} atrasado(s)</small>` : ""}</div>
      <div class="kpi"><span>A pagar até o fim do mês</span><b>${money(sum(toPay))}</b>${lateOut.length ? `<small class="warn">${lateOut.length} atrasado(s)</small>` : ""}</div>
      <div class="kpi"><span>Trabalhos em aberto</span><b>${open.length}</b>${lateProjects.length ? `<small class="bad">${lateProjects.length} atrasado(s)</small>` : ""}</div>
    </section>

    <section class="card goals-card">
      <div class="card-head"><h2>Metas do mês</h2><button class="btn sm ghost" data-goal>${icon(goal ? "edit" : "plus")}${goal ? "Editar metas" : "Definir metas"}</button></div>
      ${goalRows.length ? `<ul class="goals">${goalRows.map(goalHtml).join("")}</ul><p class="muted">A marca na barra mostra onde vocês deveriam estar hoje (dia ${now.getDate()}) para bater a meta no fim do mês.</p>`
        : `<p class="empty">Nenhuma meta definida para este mês.${lastGoal ? " Dá para começar com as do mês passado." : ""}</p>`}
    </section>

    ${alerts.length ? `<section class="card"><h2>Precisa de atenção</h2><ul class="alerts">${alerts.map((a, i) =>
      `<li class="${a.tone}">${icon("alert")}<span>${esc(a.text)}</span><button class="btn sm ghost" data-alert="${i}">${esc(a.act)}</button></li>`).join("")}</ul></section>` : ""}

    <div class="two">
      <section class="card">
        <h2>Próximos 7 dias</h2>
        ${upcoming.length ? `<ul class="agenda-list">${upcoming.map((u, i) => `
          <li><button data-up="${i}">
            <span class="when">${esc(fmtDateLong(u.date))}</span>
            <span class="what"><b>${esc(u.title)}</b><small>${esc(u.kind)}${u.sub ? " · " + esc(u.sub) : ""}</small></span>
          </button></li>`).join("")}</ul>`
          : `<p class="empty">Nada marcado para os próximos 7 dias.</p>`}
      </section>
      <section class="card">
        <h2>Horas trabalhadas no mês</h2>
        <ul class="bars">${minutesBy.map(([p, m]) => `
          <li><span>${esc(p)}</span><div class="bar"><i style="width:${(m / maxMin) * 100}%"></i></div><b>${fmtHours(m)}</b></li>`).join("")}</ul>
        <p class="muted">Registre as horas dentro de cada trabalho, com o cronômetro ou à mão.</p>
      </section>
    </div>`;

  el.querySelector('[data-q="tx"]').onclick = () => txForm(ctx);
  el.querySelector('[data-q="event"]').onclick = () => eventForm(ctx);
  el.querySelector('[data-q="project"]').onclick = () => projectForm(ctx);
  el.querySelector('[data-q="client"]').onclick = () => clientForm(ctx);
  el.querySelector("[data-goal]").onclick = () => goalForm(ctx, ym, goal || {}, goal ? {} : (lastGoal || {}));
  el.querySelectorAll("[data-alert]").forEach(b => b.onclick = () => alerts[b.dataset.alert].fn());
  el.querySelectorAll("[data-up]").forEach(b => b.onclick = () => upcoming[b.dataset.up].open());
}
