// Rótulos e formulários compartilhados entre as telas.
import { PEOPLE, SERVICES, CATEGORIES, METHODS, CHANNELS, FORMATS } from "../config.js";
import { formModal, confirmModal, todayISO, addMonths, addDays, toISO, toast, money } from "../ui.js";

export const STAGES = [
  ["contato", "Contato"], ["proposta", "Proposta"], ["fechado", "Fechado"], ["ativo", "Ativo"], ["encerrado", "Encerrado"]
];
export const STATUSES = [
  ["a_fazer", "A fazer"], ["em_andamento", "Em andamento"], ["revisao", "Em revisão"], ["concluido", "Concluído"], ["pausado", "Pausado"]
];
export const KINDS = [["reuniao", "Reunião"], ["gravacao", "Gravação"], ["entrega", "Entrega"], ["outro", "Outro"]];
export const label = (list, v) => (list.find(([k]) => k === v) || [, v || ""])[1];

// Frequência de pagamento
export const FREQS = [["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"]];
const FREQ_SUFFIX = { semanal: "/semana", quinzenal: "/15 dias", mensal: "/mês" };
export const FREQ_CATEGORY = { semanal: "Pagamento semanal", quinzenal: "Pagamento quinzenal", mensal: "Mensalidade" };
export const priceLabel = (value, freq) => value ? `${money(value)}${FREQ_SUFFIX[freq] || ""}` : "";
// Próxima data de uma série, conforme a frequência
const stepDate = (iso, freq, i) => freq === "semanal" ? addDays(iso, 7 * i) : freq === "quinzenal" ? addDays(iso, 14 * i) : addMonths(iso, i);
const defaultTimes = { semanal: 12, quinzenal: 6, mensal: 6 };
// Dia da semana do pagamento (1 = segunda … 7 = domingo)
export const WEEKDAYS = [[1, "Segunda"], [2, "Terça"], [3, "Quarta"], [4, "Quinta"], [5, "Sexta"], [6, "Sábado"], [7, "Domingo"]];
const isoWeekday = iso => { const d = new Date(iso + "T12:00").getDay(); return d === 0 ? 7 : d };
export const isFixed = c => c.fee > 0 && FREQS.some(([k]) => k === c.billing) && ["ativo", "fechado"].includes(c.stage);

// Datas de cobrança de um cliente fixo dentro de um mês ("AAAA-MM")
export function chargeDates(ctx, c, ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
  const wd = Number(c.pay_day) || 1;
  const onDay = days.filter(d => isoWeekday(d) === wd);
  if (c.billing === "semanal") return onDay;
  if (c.billing === "mensal") return onDay.slice(0, 1);
  // quinzenal: segue de 14 em 14 dias a partir da última cobrança já lançada
  const prev = ctx.db.transactions.filter(t => t.client_id === c.id && t.type === "entrada" && t.due_date < days[0]).map(t => t.due_date).sort().pop();
  if (!prev) return onDay.filter((_, i) => i % 2 === 0);
  const out = []; let d = addDays(prev, 14);
  while (d < days[0]) d = addDays(d, 14);
  while (d <= days[last - 1]) { out.push(d); d = addDays(d, 14) }
  return out;
}

// Cria as cobranças do mês para todos os clientes fixos, sem duplicar as que já existem
export async function generateCharges(ctx, ym) {
  const rows = [];
  ctx.db.clients.filter(isFixed).forEach(c => {
    const project = ctx.db.projects.find(p => p.client_id === c.id && !["concluido", "pausado"].includes(p.status));
    chargeDates(ctx, c, ym).forEach(due => {
      const exists = ctx.db.transactions.some(t => t.client_id === c.id && t.type === "entrada" && t.due_date === due);
      if (!exists) rows.push({
        type: "entrada", amount: c.fee, due_date: due, paid: false, paid_date: null,
        description: `${FREQ_CATEGORY[c.billing]} · ${c.company || c.name}`, category: FREQ_CATEGORY[c.billing],
        client_id: c.id, project_id: project?.id || null
      });
    });
  });
  const fixed = ctx.db.clients.filter(isFixed);
  if (!fixed.length) return toast("Nenhum cliente fixo. Preencha valor, frequência e dia do pagamento no cadastro do cliente (etapa Ativo).", "erro");
  if (!rows.length) return toast("As cobranças deste mês já estão todas lançadas.");
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const ok = await confirmModal(`Criar ${rows.length} cobrança(s) de ${new Set(rows.map(r => r.client_id)).size} cliente(s), somando ${money(total)}?`, "Criar cobranças");
  if (ok) return ctx.run(() => ctx.store.insert("transactions", rows), `${rows.length} cobranças criadas`, ["transactions"]);
}

// "Recebi": marca como paga a cobrança pendente mais antiga até esta semana; se não houver, registra na hora
export async function receivePayment(ctx, c) {
  const limit = addDays(todayISO(), 6);
  const pending = ctx.db.transactions.filter(t => t.client_id === c.id && t.type === "entrada" && !t.paid && t.due_date <= limit)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  if (pending) {
    return payModal(ctx, pending, `Recebi de ${c.company || c.name} · cobrança de ${pending.due_date.split("-").reverse().slice(0, 2).join("/")}`);
  }
  return txForm(ctx, {}, {
    type: "entrada", amount: c.fee, client_id: c.id, paid: true,
    category: FREQ_CATEGORY[c.billing] || "Projeto",
    description: `${FREQ_CATEGORY[c.billing] || "Pagamento"} · ${c.company || c.name}`
  });
}

const opts = arr => arr.map(v => [v, v]);
const none = (txt = "—") => [["", txt]];
const clientOpts = ctx => [...none("Sem cliente"), ...ctx.db.clients.map(c => [c.id, c.company ? `${c.company} (${c.name})` : c.name])];
const projectOpts = ctx => [...none("Sem trabalho"), ...ctx.db.projects.map(p => [p.id, `${p.title}${p.client_id ? " · " + ctx.clientLabel(p.client_id) : ""}`])];

// ---------- Cliente ----------
export async function clientForm(ctx, c = {}) {
  const r = await formModal({
    title: c.id ? "Editar cliente" : "Novo cliente",
    danger: c.id ? "Excluir" : null,
    fields: [
      { name: "name", label: "Nome do contato", required: true, value: c.name },
      { name: "company", label: "Empresa", value: c.company },
      { name: "phone", label: "WhatsApp", type: "tel", value: c.phone, placeholder: "62 99999-9999" },
      { name: "email", label: "E-mail", type: "email", value: c.email },
      { name: "instagram", label: "Instagram", value: c.instagram, placeholder: "@perfil" },
      { name: "stage", label: "Etapa", type: "select", options: STAGES, value: c.stage || "contato" },
      { name: "fee", label: "Valor que o cliente paga (R$)", type: "number", step: "0.01", value: c.fee },
      { name: "billing", label: "Frequência do pagamento", type: "select", options: [...FREQS, ["avulso", "Avulso / por projeto"]], value: c.billing || "semanal" },
      { name: "pay_day", label: "Dia em que paga", type: "select", options: WEEKDAYS, value: c.pay_day || 1, showIf: "billing!=avulso", hint: "Usado para gerar as cobranças no Financeiro" },
      { name: "notes", label: "Anotações", type: "textarea", value: c.notes, full: true, placeholder: "O que conversaram, o que o cliente quer, próximos passos…" }
    ]
  });
  if (!r) return;
  if (r.__danger) {
    if (await confirmModal(`Excluir ${c.company || c.name}? Trabalhos e lançamentos ficam, mas sem cliente.`))
      return ctx.run(() => ctx.store.remove("clients", c.id), "Cliente excluído");
    return;
  }
  if (r.instagram) r.instagram = r.instagram.replace(/^@/, "");
  r.pay_day = r.billing === "avulso" ? null : Number(r.pay_day) || null;
  // Guarda quando o cliente foi fechado (usado nas metas)
  if (["fechado", "ativo"].includes(r.stage) && !c.won_at) r.won_at = todayISO();
  if (!["fechado", "ativo", "encerrado"].includes(r.stage)) r.won_at = null;
  return ctx.run(() => c.id ? ctx.store.update("clients", c.id, r) : ctx.store.insert("clients", r), c.id ? "Cliente salvo" : "Cliente cadastrado");
}

// ---------- Trabalho ----------
export async function projectForm(ctx, p = {}, preset = {}) {
  const r = await formModal({
    title: p.id ? "Editar trabalho" : "Novo trabalho",
    danger: p.id ? "Excluir" : null,
    fields: [
      { name: "title", label: "Nome do trabalho", required: true, value: p.title, full: true, placeholder: "Ex.: Gestão de Instagram, Site, Cardápio digital" },
      { name: "client_id", label: "Cliente", type: "select", options: clientOpts(ctx), value: p.client_id ?? preset.client_id },
      { name: "service", label: "Serviço", type: "select", options: opts(SERVICES), value: p.service || SERVICES[0] },
      { name: "owner", label: "Responsável", type: "select", options: opts(PEOPLE), value: p.owner || PEOPLE[0] },
      { name: "status", label: "Status", type: "select", options: STATUSES, value: p.status || "a_fazer" },
      { name: "start_date", label: "Início", type: "date", value: p.start_date || todayISO() },
      { name: "due_date", label: "Prazo de entrega", type: "date", value: p.due_date },
      { name: "hours_estimated", label: "Horas estimadas", type: "number", step: "0.5", value: p.hours_estimated, hint: "Quanto tempo vocês acham que vai levar" },
      { name: "billing", label: "Cobrança", type: "select", options: [["fechado", "Valor fechado"], ...FREQS], value: p.billing || "fechado" },
      { name: "price", label: "Valor (R$)", type: "number", step: "0.01", value: p.price, hint: "Total do projeto, ou valor de cada semana/quinzena/mês" },
      { name: "notes", label: "Anotações", type: "textarea", value: p.notes, full: true }
    ]
  });
  if (!r) return;
  if (r.__danger) {
    if (await confirmModal(`Excluir "${p.title}"? As horas registradas nele também serão apagadas.`))
      return ctx.run(() => ctx.store.remove("projects", p.id), "Trabalho excluído");
    return;
  }
  Object.assign(r, completion(p, r.status));
  return ctx.run(() => p.id ? ctx.store.update("projects", p.id, r) : ctx.store.insert("projects", r), p.id ? "Trabalho salvo" : "Trabalho cadastrado");
}

// Data de conclusão de um trabalho (usada nas metas)
export function completion(p, status) {
  if (status === "concluido") return { completed_at: p.completed_at || todayISO() };
  return { completed_at: null };
}

// ---------- Metas ----------
export async function goalForm(ctx, ym, g = {}, base = {}) {
  const v = k => g[k] ?? base[k] ?? null;
  const r = await formModal({
    title: `Metas de ${ym.slice(5)}/${ym.slice(0, 4)}`,
    fields: [
      { name: "revenue", label: "Faturamento (R$)", type: "number", step: "0.01", value: v("revenue"), hint: "Entradas recebidas no mês" },
      { name: "profit", label: "Lucro (R$)", type: "number", step: "0.01", value: v("profit"), hint: "Recebido menos gasto" },
      { name: "new_clients", label: "Clientes novos fechados", type: "number", step: "1", value: v("new_clients") },
      { name: "delivered", label: "Trabalhos entregues", type: "number", step: "1", value: v("delivered") }
    ],
    submit: "Salvar metas"
  });
  if (!r) return;
  return ctx.run(() => g.id ? ctx.store.update("goals", g.id, r) : ctx.store.insert("goals", { month: ym, ...r }), "Metas salvas", ["goals"]);
}

// ---------- Horas ----------
export async function timeForm(ctx, project, t = {}) {
  const r = await formModal({
    title: t.id ? "Editar horas" : `Registrar horas · ${project.title}`,
    danger: t.id ? "Excluir" : null,
    fields: [
      { name: "date", label: "Dia", type: "date", required: true, value: t.date || todayISO() },
      { name: "person", label: "Quem trabalhou", type: "select", options: opts(PEOPLE), value: t.person || project.owner || PEOPLE[0] },
      { name: "hours", label: "Horas", type: "number", step: "0.25", value: t.minutes ? Math.floor(t.minutes / 60) : null, placeholder: "0" },
      { name: "mins", label: "Minutos", type: "number", step: "5", value: t.minutes ? t.minutes % 60 : null, placeholder: "0" },
      { name: "note", label: "O que foi feito", value: t.note, full: true }
    ]
  });
  if (!r) return;
  if (r.__danger) return ctx.run(() => ctx.store.remove("time_entries", t.id), "Registro excluído", ["time_entries"]);
  const minutes = Math.round((r.hours || 0) * 60 + (r.mins || 0));
  if (minutes <= 0) return timeForm(ctx, project, { ...t, ...r });
  const row = { project_id: project.id, date: r.date, person: r.person, minutes, note: r.note };
  return ctx.run(() => t.id ? ctx.store.update("time_entries", t.id, row) : ctx.store.insert("time_entries", row), "Horas registradas", ["time_entries"]);
}

// ---------- Lançamento financeiro ----------
export async function txForm(ctx, t = {}, preset = {}) {
  const type = t.type || preset.type || "entrada";
  const isNew = !t.id;
  const fields = [
    { name: "type", label: "Tipo", type: "select", options: [["entrada", "Entrada (dinheiro que entra)"], ["saida", "Saída (gasto)"]], value: type },
    { name: "amount", label: "Valor (R$)", type: "number", step: "0.01", required: true, value: t.amount ?? preset.amount },
    { name: "description", label: "Descrição", required: true, value: t.description ?? preset.description, full: true },
    { name: "category", label: "Categoria", type: "select", options: opts([...new Set([...CATEGORIES.entrada, ...CATEGORIES.saida])]), value: t.category || preset.category || (type === "entrada" ? "Projeto" : "Ferramentas e assinaturas") },
    { name: "due_date", label: "Vencimento", type: "date", required: true, value: t.due_date || preset.due_date || todayISO() },
    { name: "client_id", label: "Cliente", type: "select", options: clientOpts(ctx), value: t.client_id ?? preset.client_id },
    { name: "project_id", label: "Trabalho", type: "select", options: projectOpts(ctx), value: t.project_id ?? preset.project_id },
    { name: "paid", label: type === "entrada" ? "Já recebido" : "Já pago", type: "checkbox", value: t.paid ?? preset.paid ?? false },
    { name: "paid_date", label: "Data do pagamento", type: "date", value: t.paid_date || todayISO(), showIf: "paid=true" },
    { name: "method", label: "Forma de pagamento", type: "select", options: [["", "—"], ...opts(METHODS)], value: t.method ?? preset.method ?? "Pix", showIf: "paid=true" },
    { name: "notes", label: "Observação", type: "textarea", value: t.notes, full: true, placeholder: type === "saida" ? "Ex.: microfone para as gravações da C7" : "Ex.: pago adiantado, referente a duas semanas" }
  ];
  if (isNew) fields.push(
    { name: "repeat", label: "Repetir", type: "select", options: [["nao", "Não repete"], ["semanal", "Toda semana"], ["quinzenal", "A cada 15 dias"], ["mensal", "Todo mês"]], value: preset.repeat || "nao" },
    { name: "times", label: "Quantas vezes", type: "number", step: "1", value: defaultTimes[preset.repeat] || 12, showIf: "repeat!=nao", hint: "Cria um lançamento para cada vez, a partir do vencimento" }
  );
  const r = await formModal({
    title: isNew ? "Novo lançamento" : "Editar lançamento",
    danger: t.id ? "Excluir" : null,
    fields
  });
  if (!r) return;
  if (r.__danger) {
    if (t.series_id) {
      const all = await formModal({ title: "Excluir lançamento", fields: [
        { name: "scope", label: "O que excluir", type: "select", full: true, options: [["one", "Só este lançamento"], ["future", "Este e os próximos não pagos da série"]], value: "one" }
      ], submit: "Excluir" });
      if (!all) return;
      if (all.scope === "future") {
        const ids = ctx.db.transactions.filter(x => x.series_id === t.series_id && !x.paid && x.due_date >= t.due_date).map(x => x.id);
        return ctx.run(() => Promise.all(ids.map(id => ctx.store.remove("transactions", id))), `${ids.length} lançamentos excluídos`, ["transactions"]);
      }
    } else if (!(await confirmModal(`Excluir "${t.description}"?`))) return;
    return ctx.run(() => ctx.store.remove("transactions", t.id), "Lançamento excluído", ["transactions"]);
  }
  const { repeat, times, ...row } = r;
  if (!row.paid) { row.paid_date = null; row.method = null }
  if (isNew && repeat && repeat !== "nao" && times > 1) {
    const series = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const rows = Array.from({ length: Math.min(times, 104) }, (_, i) => ({
      ...row, series_id: series, due_date: stepDate(row.due_date, repeat, i),
      paid: i === 0 ? row.paid : false, paid_date: i === 0 ? row.paid_date : null
    }));
    return ctx.run(() => ctx.store.insert("transactions", rows), `${rows.length} lançamentos criados`, ["transactions"]);
  }
  return ctx.run(() => t.id ? ctx.store.update("transactions", t.id, row) : ctx.store.insert("transactions", row), "Lançamento salvo", ["transactions"]);
}

export async function togglePaid(ctx, t) {
  if (t.paid) return ctx.run(() => ctx.store.update("transactions", t.id, { paid: false, paid_date: null, method: null }), "Marcado como pendente", ["transactions"]);
  return payModal(ctx, t);
}

// Pergunta quando e como foi pago, e marca o lançamento como pago
export async function payModal(ctx, t, title) {
  const r = await formModal({
    title: title || `${t.type === "entrada" ? "Recebimento" : "Pagamento"}: ${t.description} (${money(t.amount)})`,
    submit: t.type === "entrada" ? "Recebi" : "Paguei",
    fields: [
      { name: "paid_date", label: t.type === "entrada" ? "Recebido em" : "Pago em", type: "date", required: true, value: todayISO() },
      { name: "method", label: "Forma de pagamento", type: "select", options: opts(METHODS), value: t.method || "Pix" },
      { name: "amount", label: "Valor (R$)", type: "number", step: "0.01", required: true, value: t.amount, hint: "Altere se o valor pago foi diferente" },
      { name: "notes", label: "Observação", value: t.notes, full: true }
    ]
  });
  if (!r) return;
  return ctx.run(() => ctx.store.update("transactions", t.id, { paid: true, ...r }), t.type === "entrada" ? "Recebimento registrado" : "Pagamento registrado", ["transactions"]);
}

// ---------- Compromisso ----------
export async function eventForm(ctx, e = {}, preset = {}) {
  const start = e.start_at ? new Date(e.start_at) : null;
  const end = e.end_at ? new Date(e.end_at) : null;
  const hhmm = d => d ? d.toTimeString().slice(0, 5) : "";
  const r = await formModal({
    title: e.id ? "Editar compromisso" : "Novo compromisso",
    danger: e.id ? "Excluir" : null,
    fields: [
      { name: "title", label: "Título", required: true, value: e.title, full: true, placeholder: "Ex.: Reunião com cliente, Gravação, Entrega do site" },
      { name: "kind", label: "Tipo", type: "select", options: KINDS, value: e.kind || "reuniao" },
      { name: "person", label: "Quem vai", type: "select", options: [["Todos", "Os dois"], ...opts(PEOPLE)], value: e.person || preset.person || "Todos" },
      { name: "date", label: "Dia", type: "date", required: true, value: start ? toISO(start) : (preset.date || todayISO()) },
      { name: "start", label: "Começa", type: "time", required: true, value: hhmm(start) || preset.start || "09:00" },
      { name: "end", label: "Termina", type: "time", value: hhmm(end) || preset.end || "", hint: "Ajuda a ver conflitos de horário" },
      { name: "client_id", label: "Cliente", type: "select", options: clientOpts(ctx), value: e.client_id ?? preset.client_id },
      { name: "project_id", label: "Trabalho", type: "select", options: projectOpts(ctx), value: e.project_id ?? preset.project_id },
      { name: "location", label: "Local (endereço) ou link da reunião", value: e.location, full: true, placeholder: "Ex.: Av. T-63, 1200 - Setor Bueno, ou link do Meet" },
      { name: "notes", label: "Anotações", type: "textarea", value: e.notes, full: true }
    ]
  });
  if (!r) return;
  if (r.__danger) {
    if (await confirmModal(`Excluir "${e.title}"?`)) return ctx.run(() => ctx.store.remove("events", e.id), "Compromisso excluído", ["events"]);
    return;
  }
  const { date, start: s, end: en, ...row } = r;
  if (en && en <= s) {
    toast("O horário de término precisa ser depois do início.", "erro");
    return eventForm(ctx, { ...e, ...row, start_at: new Date(`${date}T${s}`).toISOString(), end_at: null }, preset);
  }
  row.start_at = new Date(`${date}T${s}`).toISOString();
  row.end_at = en ? new Date(`${date}T${en}`).toISOString() : null;
  return ctx.run(() => e.id ? ctx.store.update("events", e.id, row) : ctx.store.insert("events", row), "Compromisso salvo", ["events"]);
}

// Horas gastas em um trabalho (minutos)
export const projectMinutes = (ctx, id) => ctx.db.time_entries.filter(t => t.project_id === id).reduce((s, t) => s + t.minutes, 0);
// Entradas e saídas ligadas a um trabalho
export function projectMoney(ctx, id) {
  const tx = ctx.db.transactions.filter(t => t.project_id === id);
  const sum = (type, paidOnly) => tx.filter(t => t.type === type && (!paidOnly || t.paid)).reduce((s, t) => s + Number(t.amount), 0);
  return { inPaid: sum("entrada", true), inTotal: sum("entrada"), outPaid: sum("saida", true), outTotal: sum("saida") };
}

// ---------- Postagens ----------
export const POST_STATUS = [["ideia", "Ideia"], ["producao", "Em produção"], ["aprovacao", "Aprovação do cliente"], ["agendado", "Agendado"], ["publicado", "Publicado"]];
export const nextStatus = st => { const i = POST_STATUS.findIndex(([k]) => k === st); return i >= 0 && i < POST_STATUS.length - 1 ? POST_STATUS[i + 1][0] : null };
const activeClients = ctx => ctx.db.clients.filter(c => c.stage !== "encerrado");
const postClientOpts = ctx => [["", "Escolha o cliente"], ...activeClients(ctx).map(c => [c.id, c.company || c.name])];

export async function postForm(ctx, p = {}, preset = {}) {
  const r = await formModal({
    title: p.id ? "Editar post" : "Novo post",
    danger: p.id ? "Excluir" : null,
    fields: [
      { name: "client_id", label: "Cliente", type: "select", required: true, options: postClientOpts(ctx), value: p.client_id ?? preset.client_id ?? "" },
      { name: "title", label: "Tema do post", required: true, value: p.title, placeholder: "Ex.: Bastidores da produção, Promoção da semana" },
      { name: "date", label: "Dia", type: "date", required: true, value: p.date || preset.date || todayISO() },
      { name: "time", label: "Horário", type: "time", value: p.time || preset.time || "" },
      { name: "channel", label: "Rede", type: "select", options: opts(CHANNELS), value: p.channel || "Instagram" },
      { name: "format", label: "Formato", type: "select", options: opts(FORMATS), value: p.format || "Reels" },
      { name: "status", label: "Etapa", type: "select", options: POST_STATUS, value: p.status || preset.status || "ideia" },
      { name: "owner", label: "Responsável", type: "select", options: opts(PEOPLE), value: p.owner || preset.owner || PEOPLE[0] },
      { name: "caption", label: "Legenda", type: "textarea", value: p.caption, full: true },
      { name: "link", label: "Arquivo (Drive, Canva…)", type: "url", value: p.link, full: true, placeholder: "https://" },
      { name: "published_url", label: "Link do post publicado", type: "url", value: p.published_url, full: true, showIf: "status=publicado" },
      { name: "notes", label: "Observações", type: "textarea", value: p.notes, full: true, placeholder: "Pedido do cliente, ajustes, referências…" }
    ]
  });
  if (!r) return;
  if (r.__danger) {
    if (await confirmModal(`Excluir o post "${p.title}"?`)) return ctx.run(() => ctx.store.remove("posts", p.id), "Post excluído", ["posts"]);
    return;
  }
  return ctx.run(() => p.id ? ctx.store.update("posts", p.id, r) : ctx.store.insert("posts", r), p.id ? "Post salvo" : "Post criado", ["posts"]);
}

export function advancePost(ctx, p) {
  const n = nextStatus(p.status);
  if (!n) return;
  return ctx.run(() => ctx.store.update("posts", p.id, { status: n }), `${p.title}: ${label(POST_STATUS, n)}`, ["posts"]);
}

// Planejar várias semanas de uma vez para um cliente
export async function planForm(ctx, preset = {}) {
  const days = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["7", "Dom"]];
  const r = await formModal({
    title: "Planejar semanas",
    submit: "Criar posts",
    fields: [
      { name: "client_id", label: "Cliente", type: "select", required: true, options: postClientOpts(ctx), value: preset.client_id || "", full: true },
      ...days.map(([v, l]) => ({ name: "d" + v, label: l, type: "checkbox", value: ["1", "3", "5"].includes(v) })),
      { name: "start", label: "A partir de", type: "date", required: true, value: preset.start || todayISO() },
      { name: "weeks", label: "Quantas semanas", type: "number", step: "1", value: 4 },
      { name: "time", label: "Horário", type: "time", value: "18:00" },
      { name: "channel", label: "Rede", type: "select", options: opts(CHANNELS), value: "Instagram" },
      { name: "format", label: "Formato", type: "select", options: opts(FORMATS), value: "Reels" },
      { name: "owner", label: "Responsável", type: "select", options: opts(PEOPLE), value: PEOPLE[0] },
      { name: "title", label: "Tema (opcional)", value: "", full: true, hint: "Se ficar vazio, os posts entram como \"Post\" para vocês definirem o tema depois" }
    ]
  });
  if (!r) return;
  const chosen = days.filter(([v]) => r["d" + v]).map(([v]) => Number(v));
  if (!chosen.length) { toast("Escolha pelo menos um dia da semana.", "erro"); return planForm(ctx, { client_id: r.client_id, start: r.start }) }
  const weeks = Math.min(Math.max(1, r.weeks || 1), 12);
  const iso = d => { const x = new Date(d + "T12:00").getDay(); return x === 0 ? 7 : x };
  const rows = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(r.start, i);
    if (chosen.includes(iso(d))) rows.push({ client_id: r.client_id, date: d, time: r.time, channel: r.channel, format: r.format, owner: r.owner, status: "ideia", title: r.title || "Post" });
  }
  const exists = new Set(ctx.db.posts.filter(p => p.client_id === r.client_id).map(p => p.date + "|" + p.format));
  const fresh = rows.filter(x => !exists.has(x.date + "|" + x.format));
  if (!fresh.length) return toast("Esses posts já estão no calendário.");
  return ctx.run(() => ctx.store.insert("posts", fresh), `${fresh.length} posts criados`, ["posts"]);
}
