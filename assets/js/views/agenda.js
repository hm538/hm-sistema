// Agenda: visões de mês, semana e dia. Compromissos aparecem na linha do tempo, lado a lado quando
// coincidem, com local (abre no Maps), cor por pessoa e aviso de conflito de horário ou de deslocamento.
import { PEOPLE } from "../config.js";
import { esc, icon, money, fmtTime, monthName, todayISO, toISO, parseISO, addDays, fmtDateLong } from "../ui.js";
import { eventForm, projectForm, txForm, KINDS, label } from "./common.js";

let mode = null;      // "mes" | "semana" | "dia"
let cursor = null;    // dia de referência (AAAA-MM-DD)
let who = "todos";    // filtro de pessoa
let showMoney = true; // mostrar entradas e saídas na agenda

const HOUR_PX = 52;
const GAP_MIN = 30;   // menos que isso entre locais diferentes gera aviso
const PERSON_CLASS = p => p === "Todos" || !p ? "p-all" : `p-${Math.max(0, PEOPLE.indexOf(p))}`;
const isUrl = s => /^https?:\/\//i.test(s || "");
const isOnline = s => isUrl(s) || /\b(online|meet|zoom|teams|videochamada|chamada)\b/i.test(s || "");
const mapsUrl = loc => isUrl(loc) ? loc : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
const minutesOf = d => d.getHours() * 60 + d.getMinutes();
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mondayOf = iso => { const d = parseISO(iso); return addDays(iso, -((d.getDay() + 6) % 7)) };

export default function agenda(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  const mobile = matchMedia("(max-width: 900px)").matches;
  mode = mode || (mobile ? "dia" : "semana");
  cursor = cursor || today;

  // ---------- dados ----------
  const personOk = p => who === "todos" || !p || p === "Todos" || p === who;
  const timed = {};   // compromissos com horário, por dia
  const allDay = {};  // prazos e vencimentos, por dia
  const push = (map, d, it) => (map[d] = map[d] || []).push(it);
  db.events.filter(e => personOk(e.person)).forEach(e => {
    const s = new Date(e.start_at);
    const en = e.end_at ? new Date(e.end_at) : null;
    const start = minutesOf(s);
    const end = en ? Math.max(start + 15, minutesOf(en)) : start + 60;
    push(timed, toISO(s), {
      e, start, end, hasEnd: !!en, title: e.title, person: e.person || "Todos", kind: e.kind,
      client: ctx.clientLabel(e.client_id), location: e.location || "",
      open: () => eventForm(ctx, e)
    });
  });
  db.projects.filter(p => p.due_date && p.status !== "concluido" && personOk(p.owner)).forEach(p => push(allDay, p.due_date, {
    type: "due", title: `Prazo: ${p.title}`, sub: [p.owner, ctx.clientLabel(p.client_id)].filter(Boolean).join(" · "), open: () => projectForm(ctx, p)
  }));
  // Dinheiro: o que foi pago aparece no dia do pagamento; o que falta, no vencimento
  const moneyDay = {};
  if (showMoney) db.transactions.forEach(t => {
    const d = t.paid ? (t.paid_date || t.due_date) : t.due_date;
    const inc = t.type === "entrada";
    push(moneyDay, d, {
      t, paid: !!t.paid, inc, type: inc ? "in" : "out",
      label: t.paid ? (inc ? "Entrou" : "Saiu") : (inc ? "A receber" : "A pagar"),
      sub: [t.paid ? t.method : (d < today ? "atrasado" : "previsto"), t.category, ctx.clientLabel(t.client_id)].filter(Boolean).join(" · "),
      open: () => txForm(ctx, t)
    });
  });
  Object.values(moneyDay).forEach(a => a.sort((x, y) => (y.paid - x.paid) || (y.inc - x.inc)));
  const totals = d => {
    const l = moneyDay[d] || [];
    const s = (inc, paid) => l.filter(x => x.inc === inc && x.paid === paid).reduce((a, x) => a + Number(x.t.amount), 0);
    return { inP: s(true, true), outP: s(false, true), inD: s(true, false), outD: s(false, false) };
  };
  const moneyChip = (d, it, i) => `<button class="chip c-${it.type} ${it.paid ? "ok" : "due"}" data-money="${d}|${i}" title="${esc(`${it.label}: ${it.t.description} · ${money(it.t.amount)}`)}">${it.paid ? (it.inc ? "+" : "−") : ""}${esc(money(it.t.amount))} ${esc(it.t.description)}</button>`;
  Object.values(timed).forEach(a => a.sort((x, y) => x.start - y.start || x.end - y.end));

  // Lado a lado: distribui compromissos que se sobrepõem em colunas
  function lanes(list) {
    let group = [], groupEnd = -1;
    const flush = () => { const n = Math.max(...group.map(g => g.lane)) + 1; group.forEach(g => g.lanes = n); group = [] };
    list.forEach(it => {
      if (it.start >= groupEnd && group.length) flush();
      const used = group.filter(g => g.end > it.start).map(g => g.lane);
      it.lane = 0; while (used.includes(it.lane)) it.lane++;
      group.push(it); groupEnd = Math.max(groupEnd, it.end);
    });
    if (group.length) flush();
    return list;
  }

  // Avisos: mesma pessoa em dois lugares ao mesmo tempo, ou pouco tempo entre locais diferentes
  function conflicts(list) {
    const out = [];
    const people = p => p === "Todos" ? PEOPLE : [p];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const shared = people(a.person).filter(p => people(b.person).includes(p));
      if (!shared.length) continue;
      const names = shared.join(" e ");
      if (b.start < a.end) out.push(`${names}: "${a.title}" (${hhmm(a.start)}–${hhmm(a.end)}) e "${b.title}" (${hhmm(b.start)}) no mesmo horário.`);
      else if (b.start - a.end < GAP_MIN && a.location && b.location && a.location.trim().toLowerCase() !== b.location.trim().toLowerCase() && !isOnline(a.location) && !isOnline(b.location))
        out.push(`${names}: só ${b.start - a.end} min entre "${a.title}" e "${b.title}", em locais diferentes. Dá tempo do deslocamento?`);
    }
    return out;
  }

  // ---------- peças ----------
  const evBlock = (it, range) => {
    const top = (it.start - range[0]) * HOUR_PX / 60;
    const h = Math.max(22, (it.end - it.start) * HOUR_PX / 60 - 2);
    const w = 100 / it.lanes;
    return `<button class="ev ${PERSON_CLASS(it.person)} k-${it.kind}" data-ev="${it.e.id}"
      style="top:${top}px;height:${h}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px)">
      <b>${esc(it.title)}</b>
      <span>${hhmm(it.start)}${it.hasEnd ? "–" + hhmm(it.end) : ""}${it.client ? " · " + esc(it.client) : ""}</span>
      ${it.location && h > 50 ? `<span class="loc">${icon("pin", "i xs")}${esc(isOnline(it.location) && isUrl(it.location) ? "Online" : it.location)}</span>` : ""}
      ${it.person !== "Todos" && h > 66 ? `<span>${esc(it.person)}</span>` : ""}
    </button>`;
  };
  const range = days => {
    let lo = 8 * 60, hi = 19 * 60;
    days.forEach(d => (timed[d] || []).forEach(it => { lo = Math.min(lo, Math.floor(it.start / 60) * 60); hi = Math.max(hi, Math.ceil(it.end / 60) * 60) }));
    return [lo, Math.min(24 * 60, hi)];
  };
  const timeGrid = (days, wide) => {
    const r = range(days);
    const hours = Array.from({ length: (r[1] - r[0]) / 60 }, (_, i) => r[0] / 60 + i);
    const nowMin = minutesOf(new Date());
    // Dias com compromissos simultâneos ganham colunas mais largas
    days.forEach(d => lanes(timed[d] || []));
    const weight = d => Math.min(3, Math.max(1, ...(timed[d] || []).map(it => it.lanes * .75)));
    const cols = `var(--gutter) ${days.map(d => `minmax(0, ${weight(d)}fr)`).join(" ")}`;
    return `
      <div class="tg ${wide ? "wide" : ""}" style="--cols:${days.length};--tpl:${cols}">
        <div class="tg-head"><span></span>${days.map(d => { const tt = totals(d); return `<button class="tg-day ${d === today ? "today" : ""}" data-goday="${d}">${esc(fmtDateLong(d))}${showMoney && (tt.inP || tt.outP) ? `<small class="day-sum">${tt.inP ? `<b class="pos">+${esc(money(tt.inP))}</b>` : ""}${tt.outP ? `<b class="neg">−${esc(money(tt.outP))}</b>` : ""}</small>` : ""}</button>` }).join("")}</div>
        <div class="tg-all"><span>Dia todo</span>${days.map(d => `<div>${(allDay[d] || []).map((it, i) =>
          `<button class="chip c-${it.type}" data-all="${d}|${i}" title="${esc(it.title)}">${esc(it.title)}</button>`).join("")}${(moneyDay[d] || []).map((it, i) => moneyChip(d, it, i)).join("")}</div>`).join("")}</div>
        <div class="tg-body" style="height:${hours.length * HOUR_PX}px">
          <div class="tg-hours">${hours.map(h => `<span style="top:${(h * 60 - r[0]) * HOUR_PX / 60}px">${String(h).padStart(2, "0")}:00</span>`).join("")}</div>
          ${days.map(d => `<div class="tg-col ${d === today ? "today" : ""}" data-col="${d}">
            ${hours.map(h => `<div class="slot" data-slot="${d}|${h}" style="top:${(h * 60 - r[0]) * HOUR_PX / 60}px;height:${HOUR_PX}px"></div>`).join("")}
            ${(timed[d] || []).map(it => evBlock(it, r)).join("")}
            ${d === today && nowMin >= r[0] && nowMin <= r[1] ? `<i class="now" style="top:${(nowMin - r[0]) * HOUR_PX / 60}px"></i>` : ""}
          </div>`).join("")}
        </div>
      </div>`;
  };
  const dayList = d => {
    const its = timed[d] || [], all = allDay[d] || [], ms = moneyDay[d] || [];
    if (!its.length && !all.length && !ms.length) return `<p class="empty">Nada neste dia.</p>`;
    const tt = totals(d);
    const moneyHtml = ms.length ? `
      <div class="money-day">
        <div class="md-head">
          <span>Entrou <b class="pos">${money(tt.inP)}</b></span><span>Saiu <b class="neg">${money(tt.outP)}</b></span>
          ${tt.inD || tt.outD ? `<span class="muted-s">Previsto: ${tt.inD ? `+${money(tt.inD)}` : ""} ${tt.outD ? `−${money(tt.outD)}` : ""}</span>` : ""}
        </div>
        <ul class="agenda-list">${ms.map((it, i) => `
          <li><button data-money="${d}|${i}" class="c-${it.type} ${it.paid ? "ok" : "pending"}">
            <span class="when">${esc(it.label)}</span>
            <span class="what"><b><span class="${it.inc ? "pos" : "neg"}">${it.inc ? "+" : "−"} ${esc(money(it.t.amount))}</span> · ${esc(it.t.description)}</b><small>${esc(it.sub)}</small>${it.t.notes ? `<small class="loc">${esc(it.t.notes)}</small>` : ""}</span>
          </button></li>`).join("")}</ul>
      </div>` : "";
    if (!its.length && !all.length) return moneyHtml;
    return moneyHtml + `<ul class="agenda-list">
      ${all.map((it, i) => `<li><button data-all="${d}|${i}" class="c-${it.type}"><span class="when">Dia todo</span><span class="what"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></span></button></li>`).join("")}
      ${its.map(it => `<li class="ev-row">
        <button data-ev="${it.e.id}" class="${PERSON_CLASS(it.person)}">
          <span class="when">${hhmm(it.start)}${it.hasEnd ? `<br>${hhmm(it.end)}` : ""}</span>
          <span class="what"><b>${esc(it.title)}</b><small>${esc([label(KINDS, it.kind), it.person === "Todos" ? "Os dois" : it.person, it.client].filter(Boolean).join(" · "))}</small>
          ${it.location ? `<small class="loc">${icon("pin", "i xs")}${esc(isUrl(it.location) ? "Reunião online" : it.location)}</small>` : ""}</span>
        </button>
        ${isUrl(it.location) ? `<a class="btn sm ghost map" href="${esc(it.location)}" target="_blank" rel="noopener">Entrar</a>`
          : it.location && !isOnline(it.location) ? `<a class="btn sm ghost map" href="${esc(mapsUrl(it.location))}" target="_blank" rel="noopener">Mapa</a>` : ""}
      </li>`).join("")}
    </ul>`;
  };
  const warnBox = list => !list.length ? "" : `
    <details class="warn-box" ${list.length <= 2 ? "open" : ""}>
      <summary>${icon("alert")}<b>${list.length === 1 ? "1 aviso de horário" : `${list.length} avisos de horário`}</b><span>conflitos ou pouco tempo para deslocamento</span></summary>
      <ul>${list.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
    </details>`;

  // ---------- visão ----------
  let title, body, step;
  if (mode === "mes") {
    const d0 = parseISO(cursor), Y = d0.getFullYear(), M = d0.getMonth();
    title = monthName(Y, M);
    step = n => { const d = new Date(Y, M + n, 1); return toISO(d) };
    const first = toISO(new Date(Y, M, 1));
    const start = mondayOf(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const weeks = parseISO(days[35]).getMonth() !== M ? 5 : 6;
    body = `
      <div class="cal-wrap">
        <section class="cal card">
          <div class="cal-head">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => `<span>${d}</span>`).join("")}</div>
          <div class="cal-grid">${days.slice(0, weeks * 7).map(iso => {
            const its = [...(timed[iso] || []).map(t => ({ type: "ev", title: `${hhmm(t.start)} ${t.title}`, cls: PERSON_CLASS(t.person) })), ...(allDay[iso] || []),
              ...(moneyDay[iso] || []).map(m => ({ type: m.type, title: `${m.paid ? (m.inc ? "+" : "−") : ""}${money(m.t.amount)} ${m.t.description}`, cls: m.paid ? "ok" : "" }))];
            return `<button class="day ${parseISO(iso).getMonth() !== M ? "out" : ""} ${iso === today ? "today" : ""} ${iso === cursor ? "sel" : ""}" data-pick="${iso}" aria-label="${esc(fmtDateLong(iso))}, ${its.length} item(ns)">
              <span class="n">${parseISO(iso).getDate()}</span>
              <span class="chips">${its.slice(0, 3).map(it => `<i class="c-${it.type} ${it.cls || ""}"><em>${esc(it.title)}</em></i>`).join("")}${its.length > 3 ? `<i class="more"><em>+${its.length - 3}</em></i>` : ""}</span>
            </button>`;
          }).join("")}</div>
          ${legend()}
        </section>
        <section class="card day-panel">
          <div class="card-head"><h2>${esc(fmtDateLong(cursor))}</h2><button class="btn sm" data-new-day>${icon("plus")}Adicionar</button></div>
          ${warnBox(conflicts(timed[cursor] || []))}
          ${dayList(cursor)}
        </section>
      </div>`;
  } else if (mode === "semana") {
    const start = mondayOf(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const a = parseISO(days[0]), b = parseISO(days[6]);
    title = `${a.getDate()} ${a.getMonth() !== b.getMonth() ? a.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + " " : ""}– ${b.getDate()} ${b.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")} ${b.getFullYear()}`;
    step = n => addDays(cursor, 7 * n);
    const warns = days.flatMap(d => conflicts(timed[d] || []).map(c => `${fmtDateLong(d)}: ${c}`));
    body = mobile
      ? `${warnBox(warns)}<div class="week-list">${days.map(d => `<section class="card"><div class="card-head"><h2>${esc(fmtDateLong(d))}${d === today ? ' <span class="pill">Hoje</span>' : ""}</h2></div>${dayList(d)}</section>`).join("")}</div>`
      : `${warnBox(warns)}<section class="card tg-card">${timeGrid(days)}${legend()}</section>`;
  } else {
    title = fmtDateLong(cursor);
    step = n => addDays(cursor, n);
    body = `
      ${warnBox(conflicts(timed[cursor] || []))}
      <div class="day-view">
        <section class="card tg-card">${timeGrid([cursor], true)}</section>
        <section class="card"><div class="card-head"><h2>Lista do dia</h2><button class="btn sm" data-new-day>${icon("plus")}Adicionar</button></div>${dayList(cursor)}</section>
      </div>`;
  }

  function legend() {
    return `<div class="legend">
      ${PEOPLE.map((p, i) => `<span><i class="ev-dot p-${i}"></i>${esc(p)}</span>`).join("")}<span><i class="ev-dot p-all"></i>Os dois</span>
      <span><i class="c-due"></i>Prazo</span>${showMoney ? `<span><i class="c-in ok"></i>Entrou</span><span><i class="c-out ok"></i>Saiu</span><span><i class="c-in"></i>A receber</span><span><i class="c-out"></i>A pagar</span>` : ""}
    </div>`;
  }

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Agenda</span>
        <div class="month-nav">
          <button class="icon-btn" data-step="-1" aria-label="Anterior">${icon("left")}</button>
          <h1>${esc(title)}</h1>
          <button class="icon-btn" data-step="1" aria-label="Próximo">${icon("right")}</button>
        </div>
      </div>
      <div class="quick">
        <button class="btn sm ghost" data-today>Hoje</button>
        <button class="btn primary" data-new>${icon("plus")}Compromisso</button>
      </div>
    </header>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Visão">
        ${[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([k, l]) => `<button data-mode="${k}" aria-pressed="${mode === k}">${l}</button>`).join("")}
      </div>
      <div class="seg" role="group" aria-label="Pessoa">
        ${["todos", ...PEOPLE].map(p => `<button data-who="${p}" aria-pressed="${who === p}">${p === "todos" ? "Todos" : esc(p)}</button>`).join("")}
      </div>
      <div class="seg" role="group" aria-label="Financeiro na agenda">
        <button data-money-toggle aria-pressed="${showMoney}">${icon("wallet", "i xs")} Financeiro</button>
      </div>
    </div>
    ${body}`;

  // ---------- ações ----------
  const rerender = () => agenda(el, ctx);
  const findEv = id => db.events.find(e => e.id === id);
  el.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { cursor = step(+b.dataset.step); rerender() });
  el.querySelector("[data-today]").onclick = () => { cursor = today; rerender() };
  el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; rerender() });
  el.querySelectorAll("[data-who]").forEach(b => b.onclick = () => { who = b.dataset.who; rerender() });
  el.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => eventForm(ctx, findEv(b.dataset.ev)));
  el.querySelector("[data-money-toggle]").onclick = () => { showMoney = !showMoney; rerender() };
  el.querySelectorAll("[data-money]").forEach(b => b.onclick = () => { const [d, i] = b.dataset.money.split("|"); moneyDay[d][i].open() });
  el.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { const [d, i] = b.dataset.all.split("|"); allDay[d][i].open() });
  el.querySelectorAll("[data-goday]").forEach(b => b.onclick = () => { cursor = b.dataset.goday; mode = "dia"; rerender() });
  el.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
    const changedMonth = b.dataset.pick.slice(0, 7) !== cursor.slice(0, 7);
    cursor = b.dataset.pick; rerender();
    if (!changedMonth && mobile) el.querySelector(".day-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  el.querySelectorAll("[data-slot]").forEach(s => s.onclick = () => {
    const [d, h] = s.dataset.slot.split("|");
    eventForm(ctx, {}, { date: d, start: hhmm(h * 60), end: hhmm(Math.min(23 * 60 + 59, h * 60 + 60)), person: who !== "todos" ? who : undefined });
  });
  const newEv = () => eventForm(ctx, {}, { date: mode === "semana" && mondayOf(cursor) === mondayOf(today) ? today : cursor, person: who !== "todos" ? who : undefined });
  el.querySelector("[data-new]").onclick = newEv;
  el.querySelectorAll("[data-new-day]").forEach(b => b.onclick = () => eventForm(ctx, {}, { date: cursor }));

}
