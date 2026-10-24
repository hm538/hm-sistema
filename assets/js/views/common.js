// Rótulos e formulários compartilhados entre as telas.
import { PEOPLE, SERVICES, CATEGORIES } from "../config.js";
import { formModal, confirmModal, todayISO, addMonths, toISO, toast } from "../ui.js";

export const STAGES = [
  ["contato", "Contato"], ["proposta", "Proposta"], ["fechado", "Fechado"], ["ativo", "Ativo"], ["encerrado", "Encerrado"]
];
export const STATUSES = [
  ["a_fazer", "A fazer"], ["em_andamento", "Em andamento"], ["revisao", "Em revisão"], ["concluido", "Concluído"], ["pausado", "Pausado"]
];
export const KINDS = [["reuniao", "Reunião"], ["gravacao", "Gravação"], ["entrega", "Entrega"], ["outro", "Outro"]];
export const label = (list, v) => (list.find(([k]) => k === v) || [, v || ""])[1];

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
      { name: "billing", label: "Cobrança", type: "select", options: [["fechado", "Valor fechado"], ["mensal", "Mensalidade"]], value: p.billing || "fechado" },
      { name: "price", label: "Valor (R$)", type: "number", step: "0.01", value: p.price, hint: "Total do projeto ou valor de cada mês" },
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
    { name: "paid", label: type === "entrada" ? "Já recebido" : "Já pago", type: "checkbox", value: t.paid ?? false },
    { name: "paid_date", label: "Data do pagamento", type: "date", value: t.paid_date || todayISO(), showIf: "paid=true" }
  ];
  if (isNew) fields.push(
    { name: "repeat", label: "Repetir todo mês (mensalidade ou assinatura)", type: "checkbox", value: preset.repeat || false, full: true },
    { name: "months", label: "Por quantos meses", type: "number", step: "1", value: 12, showIf: "repeat=true", hint: "Cria um lançamento por mês, a partir do vencimento" }
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
        { name: "scope", label: "O que excluir", type: "select", full: true, options: [["one", "Só este mês"], ["future", "Este e os próximos não pagos da mensalidade"]], value: "one" }
      ], submit: "Excluir" });
      if (!all) return;
      if (all.scope === "future") {
        const ids = ctx.db.transactions.filter(x => x.series_id === t.series_id && !x.paid && x.due_date >= t.due_date).map(x => x.id);
        return ctx.run(() => Promise.all(ids.map(id => ctx.store.remove("transactions", id))), `${ids.length} lançamentos excluídos`, ["transactions"]);
      }
    } else if (!(await confirmModal(`Excluir "${t.description}"?`))) return;
    return ctx.run(() => ctx.store.remove("transactions", t.id), "Lançamento excluído", ["transactions"]);
  }
  const { repeat, months, ...row } = r;
  if (!row.paid) row.paid_date = null;
  if (isNew && repeat && months > 1) {
    const series = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const rows = Array.from({ length: Math.min(months, 60) }, (_, i) => ({
      ...row, series_id: series, due_date: addMonths(row.due_date, i),
      paid: i === 0 ? row.paid : false, paid_date: i === 0 ? row.paid_date : null
    }));
    return ctx.run(() => ctx.store.insert("transactions", rows), `${rows.length} lançamentos criados`, ["transactions"]);
  }
  return ctx.run(() => t.id ? ctx.store.update("transactions", t.id, row) : ctx.store.insert("transactions", row), "Lançamento salvo", ["transactions"]);
}

export function togglePaid(ctx, t) {
  const paid = !t.paid;
  return ctx.run(() => ctx.store.update("transactions", t.id, { paid, paid_date: paid ? todayISO() : null }),
    paid ? (t.type === "entrada" ? "Marcado como recebido" : "Marcado como pago") : "Marcado como pendente", ["transactions"]);
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
