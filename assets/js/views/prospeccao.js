// Prospecção: lista de empresas que podem virar clientes, nota por oferta (Pitch, site, sistema,
// Instagram, tráfego), importação da coleta e a sessão de envios do dia (semiautomática: o sistema
// prepara a mensagem, a pessoa envia pelo WhatsApp/Direct e confirma).
import { PROSPECT } from "../config.js";
import { esc, icon, toast, todayISO, addDays, daysFrom, fmtDate, formModal, confirmModal } from "../ui.js";
import { label } from "./common.js";

export const LEAD_STATUS = [
  ["novo", "Novos"], ["abordado", "Abordados"], ["respondeu", "Responderam"], ["reuniao", "Reunião"],
  ["fechou", "Fecharam"], ["sem_interesse", "Sem interesse"], ["nao_contatar", "Não contatar"]
];
export const NICHES = [
  ["industria", "Indústria/fábrica"], ["servicos", "Serviços locais"], ["liberais", "Profissional liberal"],
  ["alimentacao", "Alimentação"], ["varejo", "Varejo/loja"], ["outro", "Outro"]
];
const OFFERS = PROSPECT.offers;
const SOURCES = [["instagram", "Instagram"], ["maps", "Google Maps"], ["indicacao", "Indicação"], ["manual", "Manual"]];
const BIO = [["", "—"], ["site", "Site próprio"], ["linktree", "Linktree/agregador"], ["whatsapp", "Link do WhatsApp"], ["nenhum", "Nenhum link"], ["outro", "Outro"]];

let filter = "novo", offerFilter = "todas", query = "", shown = 40;

// ---------- utilidades ----------
const digits = s => String(s || "").replace(/\D/g, "");
const waNumber = phone => { const d = digits(phone); return d ? (d.length <= 11 ? "55" + d : d) : "" };
const cleanIg = s => String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "").toLowerCase();
const toBool = v => v === true || v === false ? v : v == null || v === "" ? null : /^(1|s|sim|true|yes|y|x)$/i.test(String(v).trim());
const toNum = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null };
const daysSince = iso => iso ? -daysFrom(iso.slice(0, 10)) : null;
const isToday = ts => ts && new Date(ts).toDateString() === new Date().toDateString();
const firstName = n => (n || "").trim().split(/\s+/).find(w => !/^(dr|dra|sr|sra|prof|profa)\.?$/i.test(w)) || "";

// Nota de 0 a 100 para cada oferta, a partir dos sinais coletados
export function offerScores(l) {
  const s = { pitch: 0, site: 0, sistema: 0, marketing: 0, trafego: 0 };
  const idle = daysSince(l.last_post), rev = l.reviews || 0, fol = l.followers || 0;
  // HM Pitch: bio sem página própria; ótimo para profissional liberal e serviço local
  if (["linktree", "whatsapp", "nenhum"].includes(l.bio_link)) s.pitch += 40;
  if (["liberais", "servicos"].includes(l.niche)) s.pitch += 20;
  if (l.has_site === false) s.pitch += 10;
  // Site: sem site, mas com movimento
  if (l.has_site === false) s.site += 40;
  if (["industria", "alimentacao", "varejo", "liberais"].includes(l.niche)) s.site += 10;
  if (rev >= 50 || fol >= 5000) s.site += 15;
  // Sistema: operação na mão (agenda/pedidos pelo WhatsApp) e volume
  if (l.manual_ops) s.sistema += 45;
  if (rev >= 50 || fol >= 5000) s.sistema += 15;
  if (["servicos", "alimentacao", "industria"].includes(l.niche)) s.sistema += 10;
  // Instagram: parado ou postando pouco
  if (l.instagram) {
    if (idle != null && idle > 30) s.marketing += 40; else if (idle != null && idle > 10) s.marketing += 25;
    if (l.posts_30d != null && l.posts_30d < 6) s.marketing += 20;
    if (fol && fol < 2000) s.marketing += 10;
  }
  // Tráfego: bem avaliado, perfil ativo, sem anúncio
  if (l.runs_ads === false) s.trafego += 30;
  if (rev >= 30 && (l.rating || 0) >= 4.3) s.trafego += 25;
  if (idle != null && idle <= 10) s.trafego += 10;
  // Dá para falar com a pessoa?
  const bonus = (l.phone ? 15 : 0) + (l.instagram ? 5 : 0) + (fol > 50000 ? -20 : 0);
  for (const k in s) s[k] = Math.max(0, Math.min(100, s[k] + bonus));
  return s;
}
export function rankLead(l) {
  const s = offerScores(l);
  const offers = Object.keys(s).sort((a, b) => s[b] - s[a]).filter(k => s[k] >= 35);
  return { offers: offers.length ? offers : [Object.keys(s).sort((a, b) => s[b] - s[a])[0]], score: Math.max(...Object.values(s)) };
}
const mainOffer = l => l.offer || (l.offers && l.offers[0]) || rankLead(l).offers[0];

// Monta a mensagem a partir do modelo da oferta
export function buildMessage(l, offer = mainOffer(l), followup = false) {
  const tpl = followup ? PROSPECT.templates.followup : PROSPECT.templates[offer];
  const nome = firstName(l.name);
  return tpl
    .replaceAll("{nome}", nome ? " " + nome : "")
    .replaceAll("{empresa}", l.company)
    .replaceAll("{gancho}", (l.hook || PROSPECT.hooks[offer] || "").replace(/\.$/, ""))
    .replaceAll("{assinatura}", PROSPECT.signature)
    .replaceAll("{sair}", PROSPECT.optOut);
}

// Sinais em texto curto para o cartão
function signals(l) {
  const out = [];
  const idle = daysSince(l.last_post);
  if (l.followers != null) out.push(`${Number(l.followers).toLocaleString("pt-BR")} seguidores`);
  if (idle != null) out.push(idle <= 0 ? "postou hoje" : `último post há ${idle} dia(s)`);
  if (l.posts_30d != null) out.push(`${l.posts_30d} posts/30 dias`);
  if (l.has_site === false) out.push("sem site");
  if (l.bio_link && l.bio_link !== "site") out.push("bio: " + label(BIO, l.bio_link).toLowerCase());
  if (l.manual_ops) out.push("atende/agenda na mão");
  if (l.runs_ads === false) out.push("sem anúncios");
  if (l.runs_ads) out.push("já anuncia");
  if (l.rating != null) out.push(`★ ${String(l.rating).replace(".", ",")}${l.reviews ? ` (${l.reviews})` : ""}`);
  return out;
}

// Fila do dia: follow-ups vencidos primeiro, depois os novos de maior nota
function queue(db) {
  const today = todayISO();
  const reach = l => l.phone || l.instagram;
  const follow = db.leads.filter(l => l.status === "abordado" && l.followup_on && l.followup_on <= today && (l.attempts || 0) < PROSPECT.maxAttempts && reach(l))
    .sort((a, b) => a.followup_on.localeCompare(b.followup_on));
  const fresh = db.leads.filter(l => l.status === "novo" && reach(l)).sort((a, b) => (b.score || 0) - (a.score || 0));
  return [...follow.map(l => ({ l, followup: true })), ...fresh.map(l => ({ l, followup: false }))];
}
const sentToday = db => db.leads.filter(l => isToday(l.contacted_at)).length;

// ---------- tela ----------
export default function prospeccao(el, ctx) {
  const { db } = ctx;
  const today = todayISO();
  const count = s => db.leads.filter(l => l.status === s).length;
  const contacted = db.leads.filter(l => l.attempts > 0).length;
  const answered = db.leads.filter(l => ["respondeu", "reuniao", "fechou", "sem_interesse"].includes(l.status) && l.attempts > 0).length;
  const due = db.leads.filter(l => l.status === "abordado" && l.followup_on && l.followup_on <= today && (l.attempts || 0) < PROSPECT.maxAttempts).length;
  const sent = sentToday(db);
  const q = query.toLowerCase();
  const all = db.leads
    .filter(l => filter === "todos" || l.status === filter)
    .filter(l => offerFilter === "todas" || mainOffer(l) === offerFilter || (l.offers || []).includes(offerFilter))
    .filter(l => !q || [l.company, l.name, l.instagram, l.phone, l.city, l.seed].some(v => (v || "").toLowerCase().includes(q)))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.company.localeCompare(b.company));
  const list = all.slice(0, shown);

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Novos clientes</span><h1>Prospecção</h1></div>
      <div class="row">
        <button class="btn ghost" data-import>${icon("download")}Importar lista</button>
        <button class="btn ghost" data-new>${icon("plus")}Novo lead</button>
      </div>
    </header>

    <div class="kpis prosp-kpis">
      <div class="kpi hero"><span>Envios de hoje</span><b>${sent} de ${PROSPECT.dailyLimit}</b>
        <small>${due ? `${due} follow-up(s) para hoje` : "nenhum follow-up para hoje"}</small></div>
      <div class="kpi"><span>Taxa de resposta</span><b>${contacted ? Math.round(answered / contacted * 100) + "%" : "—"}</b><small>${answered} de ${contacted} abordados</small></div>
      <div class="kpi"><span>Reuniões / fechados</span><b>${count("reuniao")} / ${count("fechou")}</b><small>${count("novo")} na fila</small></div>
    </div>

    <div class="send-cta">
      <div><b>Sessão de envios</b><small>O sistema mostra um lead por vez com a mensagem pronta. Você envia e confirma.</small></div>
      <button class="btn primary" data-session ${sent >= PROSPECT.dailyLimit ? "disabled" : ""}>${icon("play")}${sent >= PROSPECT.dailyLimit ? "Limite de hoje atingido" : "Começar envios"}</button>
    </div>

    <div class="funnel" role="group" aria-label="Filtrar por situação">
      ${LEAD_STATUS.map(([k, l]) => `<button data-f="${k}" aria-pressed="${filter === k}" class="ls-${k}"><b>${count(k)}</b><span>${l}</span></button>`).join("")}
    </div>

    <div class="row prosp-filters">
      <div class="seg" role="group" aria-label="Filtrar por oferta">
        <button data-o="todas" aria-pressed="${offerFilter === "todas"}">Todas</button>
        ${OFFERS.map(([k, l]) => `<button data-o="${k}" aria-pressed="${offerFilter === k}">${l}</button>`).join("")}
      </div>
      <label class="search">${icon("search")}<input id="lead-search" type="search" placeholder="Buscar empresa, @, telefone…" value="${esc(query)}"></label>
    </div>

    ${list.length ? `<div class="cards">${list.map(l => card(l)).join("")}</div>
      ${all.length > shown ? `<div class="row" style="justify-content:center"><button class="btn ghost" data-more>Mostrar mais (${all.length - shown})</button></div>` : ""}`
    : `<div class="empty-box"><p>${db.leads.length ? "Nenhum lead nesse filtro." : "Nenhum lead ainda. Importe a lista da coleta (skill hm-prospeccao) ou cadastre à mão."}</p>
        <button class="btn primary" data-import>${icon("download")}Importar lista</button></div>`}`;

  el.querySelectorAll("[data-import]").forEach(b => b.onclick = () => importLeads(ctx));
  el.querySelectorAll("[data-new]").forEach(b => b.onclick = () => leadForm(ctx));
  el.querySelector("[data-session]").onclick = () => session(ctx);
  el.querySelector("[data-more]")?.addEventListener("click", () => { shown += 40; prospeccao(el, ctx) });
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = filter === b.dataset.f ? "todos" : b.dataset.f; shown = 40; prospeccao(el, ctx) });
  el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { offerFilter = b.dataset.o; shown = 40; prospeccao(el, ctx) });
  const search = el.querySelector("#lead-search");
  search.oninput = () => { query = search.value; prospeccao(el, ctx); const s = el.querySelector("#lead-search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length) };
  el.querySelectorAll(".item[data-id]").forEach(c => {
    const lead = db.leads.find(l => l.id === c.dataset.id);
    const open = e => { if (e.target.closest("a,button,select")) return; leadForm(ctx, lead) };
    c.onclick = open; c.onkeydown = e => { if (e.key === "Enter") open(e) };
  });
  el.querySelectorAll("[data-status]").forEach(s => s.onchange = () => {
    const patch = { status: s.value };
    if (s.value !== "abordado") patch.followup_on = null;
    ctx.run(() => ctx.store.update("leads", s.dataset.status, patch), "Situação atualizada", ["leads"]);
  });
  el.querySelectorAll("[data-client]").forEach(b => b.onclick = () => toClient(ctx, db.leads.find(l => l.id === b.dataset.client)));
}

function card(l) {
  const offer = mainOffer(l);
  const sig = signals(l);
  const late = l.status === "abordado" && l.followup_on && l.followup_on <= todayISO();
  return `
  <article class="item" data-id="${l.id}" tabindex="0">
    <div class="item-top">
      <div class="min0"><h3>${esc(l.company)}</h3><small>${esc([label(NICHES, l.niche), l.city, l.instagram ? "@" + l.instagram : ""].filter(Boolean).join(" · "))}</small></div>
      <span class="score ${l.score >= 70 ? "hi" : l.score >= 45 ? "mid" : ""}" title="Nota do lead">${l.score ?? "—"}</span>
    </div>
    <div class="offer-row">${[offer, ...(l.offers || []).filter(o => o !== offer)].map((o, i) => `<span class="pill offer ${i ? "" : "main"}">${esc(label(OFFERS, o))}</span>`).join("")}</div>
    ${sig.length ? `<p class="sig">${sig.map(esc).join(" · ")}</p>` : ""}
    ${l.diagnosis ? `<p class="note">${esc(l.diagnosis)}</p>` : ""}
    <div class="item-meta">
      <span>${esc(label(SOURCES, l.source))}${l.seed ? ` · via ${esc(l.seed)}` : ""}</span>
      ${l.contacted_at ? `<span>Abordado ${esc(fmtDate(l.contacted_at.slice(0, 10)))}${l.attempts > 1 ? ` (${l.attempts}x)` : ""}</span>` : ""}
      ${late ? `<span class="bad">Follow-up hoje</span>` : l.followup_on && l.status === "abordado" ? `<span>Follow-up ${esc(fmtDate(l.followup_on))}</span>` : ""}
    </div>
    <div class="item-actions">
      <select class="status-sel ls-${l.status}" data-status="${l.id}" aria-label="Situação">${LEAD_STATUS.map(([k, t]) => `<option value="${k}" ${k === l.status ? "selected" : ""}>${t}</option>`).join("")}</select>
      ${l.phone ? `<a class="btn sm ghost" href="https://wa.me/${waNumber(l.phone)}" target="_blank" rel="noopener">${icon("whatsapp")}WhatsApp</a>` : ""}
      ${l.instagram ? `<a class="btn sm ghost" href="https://instagram.com/${esc(l.instagram)}" target="_blank" rel="noopener">Perfil</a>` : ""}
      ${l.client_id ? `<span class="pill st-ativo">Já é cliente no CRM</span>` : ["respondeu", "reuniao", "fechou"].includes(l.status) ? `<button class="btn sm" data-client="${l.id}">${icon("users")}Levar para Clientes</button>` : ""}
    </div>
  </article>`;
}

// ---------- cadastro / edição ----------
async function leadForm(ctx, l = {}) {
  const r = await formModal({
    title: l.id ? l.company : "Novo lead",
    danger: l.id ? "Excluir" : null,
    fields: [
      { name: "company", label: "Empresa", required: true, value: l.company, full: true },
      { name: "name", label: "Pessoa de contato", value: l.name },
      { name: "niche", label: "Nicho", type: "select", options: NICHES, value: l.niche || "outro" },
      { name: "instagram", label: "Instagram", value: l.instagram, placeholder: "sem @" },
      { name: "phone", label: "WhatsApp comercial", value: l.phone },
      { name: "site", label: "Site", value: l.site },
      { name: "bio_link", label: "Link da bio", type: "select", options: BIO, value: l.bio_link || "" },
      { name: "city", label: "Cidade", value: l.city ?? "Goiânia" },
      { name: "source", label: "Origem", type: "select", options: SOURCES, value: l.source || "manual" },
      { name: "seed", label: "Veio de", value: l.seed, placeholder: "@perfil ou busca no Maps" },
      { name: "followers", label: "Seguidores", type: "number", step: "1", value: l.followers },
      { name: "last_post", label: "Último post", type: "date", value: l.last_post },
      { name: "posts_30d", label: "Posts nos últimos 30 dias", type: "number", step: "1", value: l.posts_30d },
      { name: "rating", label: "Nota no Google", type: "number", step: "0.1", value: l.rating },
      { name: "reviews", label: "Avaliações no Google", type: "number", step: "1", value: l.reviews },
      { name: "has_site", label: "Tem site próprio", type: "checkbox", value: l.has_site ?? !!l.site },
      { name: "runs_ads", label: "Já faz anúncios", type: "checkbox", value: l.runs_ads || false },
      { name: "manual_ops", label: "Agenda/pedidos na mão (WhatsApp/direct)", type: "checkbox", value: l.manual_ops || false, full: true },
      { name: "offer", label: "Oferta principal", type: "select", options: [["", "Automática (pela nota)"], ...OFFERS], value: l.offer || "" },
      { name: "status", label: "Situação", type: "select", options: LEAD_STATUS, value: l.status || "novo" },
      { name: "hook", label: "Gancho da mensagem", value: l.hook, full: true, placeholder: "Ex.: o último post foi há 40 dias", hint: "Entra no lugar de {gancho} na mensagem" },
      { name: "diagnosis", label: "Diagnóstico", type: "textarea", value: l.diagnosis, full: true },
      { name: "notes", label: "Anotações", type: "textarea", value: l.notes, full: true }
    ]
  });
  if (!r) return;
  if (r.__danger) {
    if (!(await confirmModal(`Excluir "${l.company}"? Se a pessoa pediu para não receber mensagens, prefira marcar "Não contatar": assim ela não volta numa próxima importação.`))) return;
    return ctx.run(() => ctx.store.remove("leads", l.id), "Lead excluído", ["leads"]);
  }
  const row = normalize(r);
  if (!row.offer) row.offer = null;
  if (row.status !== "abordado") row.followup_on = null;
  const dup = findDup(ctx.db.leads, row, l.id);
  if (dup) return toast(`Já existe um lead com esse Instagram ou telefone: ${dup.company}.`, "erro");
  return ctx.run(() => l.id ? ctx.store.update("leads", l.id, row) : ctx.store.insert("leads", row), "Lead salvo", ["leads"]);
}

// Limpa os campos e recalcula ofertas e nota
function normalize(raw) {
  const pick = (...keys) => { for (const k of keys) if (raw[k] != null && raw[k] !== "") return raw[k]; return null };
  const l = {
    company: String(pick("company", "empresa", "nome_empresa", "name") || "").trim(),
    name: pick("contact", "contato", "pessoa") ?? (raw.company ? pick("name") : null),
    niche: NICHES.some(([k]) => k === pick("niche", "nicho")) ? pick("niche", "nicho") : "outro",
    instagram: cleanIg(pick("instagram", "ig", "perfil")) || null,
    phone: pick("phone", "telefone", "whatsapp") ? String(pick("phone", "telefone", "whatsapp")).trim() : null,
    site: pick("site", "website"),
    bio_link: BIO.some(([k]) => k && k === pick("bio_link")) ? pick("bio_link") : null,
    city: pick("city", "cidade") || "Goiânia",
    address: pick("address", "endereco"),
    maps_url: pick("maps_url"),
    source: SOURCES.some(([k]) => k === pick("source", "origem")) ? pick("source", "origem") : "manual",
    seed: pick("seed", "veio_de"),
    followers: toNum(pick("followers", "seguidores")),
    last_post: pick("last_post", "ultimo_post") ? String(pick("last_post", "ultimo_post")).slice(0, 10) : null,
    posts_30d: toNum(pick("posts_30d")),
    has_site: toBool(pick("has_site", "tem_site")),
    runs_ads: toBool(pick("runs_ads", "anuncia")),
    manual_ops: toBool(pick("manual_ops")),
    rating: toNum(pick("rating", "nota")),
    reviews: toNum(pick("reviews", "avaliacoes")),
    offer: OFFERS.some(([k]) => k === pick("offer", "oferta")) ? pick("offer", "oferta") : null,
    hook: pick("hook", "gancho"),
    diagnosis: pick("diagnosis", "diagnostico"),
    message: pick("message", "mensagem"),
    notes: pick("notes", "anotacoes")
  };
  if (raw.status && LEAD_STATUS.some(([k]) => k === raw.status)) l.status = raw.status;
  if (l.has_site == null && l.site) l.has_site = true;
  if (l.followers != null) l.followers = Math.round(l.followers);
  if (l.reviews != null) l.reviews = Math.round(l.reviews);
  if (l.posts_30d != null) l.posts_30d = Math.round(l.posts_30d);
  if (l.rating != null) l.rating = Math.max(0, Math.min(5, l.rating));
  const rk = rankLead(l);
  let offers = raw.offers ?? raw.ofertas;
  if (typeof offers === "string") offers = offers.split(/[,;|]/).map(s => s.trim());
  offers = Array.isArray(offers) ? offers.filter(o => OFFERS.some(([k]) => k === o)) : [];
  l.offers = offers.length ? offers : rk.offers;
  const sc = toNum(raw.score ?? raw.nota_lead);
  l.score = sc != null ? Math.max(0, Math.min(100, Math.round(sc))) : rk.score;
  return l;
}

function findDup(leads, l, ignoreId) {
  const ig = (l.instagram || "").toLowerCase(), ph = digits(l.phone).slice(-11);
  return leads.find(x => x.id !== ignoreId && ((ig && (x.instagram || "").toLowerCase() === ig) || (ph && ph.length >= 10 && digits(x.phone).slice(-11) === ph)));
}

// ---------- importação ----------
function parseCSV(text) {
  const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(v => v.trim())) rows.push(row); row = [] }
    else cur += c;
  }
  row.push(cur); if (row.some(v => v.trim())) rows.push(row);
  const head = rows.shift().map(h => h.trim().toLowerCase());
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function importLeads(ctx) {
  const root = document.getElementById("modal");
  root.innerHTML = `
    <div class="modal-back" data-close></div>
    <div class="sheet">
      <header><h2>Importar lista</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon("x")}</button></header>
      <p class="muted-p">Escolha o arquivo <b>.json</b> que a coleta gerou (pasta <b>HM DIGITAL\\dados\\prospeccao</b>) ou um <b>.csv</b> com cabeçalho (empresa, instagram, telefone, nicho…). Leads repetidos e quem pediu para não receber mensagem ficam de fora.</p>
      <label class="fld full"><span>Arquivo</span><input type="file" accept=".json,.csv,application/json,text/csv"></label>
      <label class="fld full"><span>…ou cole o conteúdo</span><textarea rows="6" placeholder='[{"company":"…","instagram":"…"}]'></textarea></label>
      <p class="form-err" hidden></p>
      <footer><span></span><div class="row"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="button" class="btn primary" data-go>Importar</button></div></footer>
    </div>`;
  root.hidden = false;
  document.documentElement.classList.add("modal-open");
  const close = () => { root.hidden = true; root.innerHTML = ""; document.documentElement.classList.remove("modal-open") };
  root.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
  const err = root.querySelector(".form-err");
  const fail = m => { err.textContent = m; err.hidden = false };
  root.querySelector("[data-go]").onclick = async () => {
    const file = root.querySelector("input[type=file]").files[0];
    if (file && file.size > 2 * 1024 * 1024) return fail("Arquivo grande demais (máximo 2 MB).");
    const text = (file ? await file.text() : root.querySelector("textarea").value).replace(/^﻿/, "").trim();
    if (!text) return fail("Escolha um arquivo ou cole a lista.");
    let raw;
    try {
      if (/^[[{]/.test(text)) { const j = JSON.parse(text); raw = Array.isArray(j) ? j : j.leads || [] }
      else raw = parseCSV(text);
    } catch (e) { return fail("Não consegui ler a lista: " + e.message) }
    const fresh = [], seen = [...ctx.db.leads];
    let dups = 0, blocked = 0, bad = 0;
    for (const r of raw) {
      const l = normalize(r || {});
      if (!l.company) { bad++; continue }
      const d = findDup(seen, l);
      if (d) { d.status === "nao_contatar" ? blocked++ : dups++; continue }
      l.status = "novo"; l.attempts = 0; // tudo que chega entra como "novo"
      fresh.push(l); seen.push(l);
    }
    if (!fresh.length) return fail(`Nada novo para importar (${dups} já existiam, ${blocked} em "não contatar", ${bad} sem nome).`);
    close();
    filter = "novo";
    await ctx.run(async () => {
      for (let i = 0; i < fresh.length; i += 50) await ctx.store.insert("leads", fresh.slice(i, i + 50));
    }, `${fresh.length} lead(s) importado(s)${dups ? ` · ${dups} repetido(s)` : ""}${blocked ? ` · ${blocked} em "não contatar"` : ""}`, ["leads"]);
  };
}

// ---------- levar para o CRM ----------
async function toClient(ctx, l) {
  if (!(await confirmModal(`Cadastrar "${l.company}" em Clientes, na etapa Contato?`, "Cadastrar"))) return;
  return ctx.run(async () => {
    const [c] = await ctx.store.insert("clients", {
      name: l.name || l.company, company: l.company, phone: l.phone, instagram: l.instagram, stage: "contato",
      notes: `Veio da prospecção (${label(OFFERS, mainOffer(l))}).${l.diagnosis ? " " + l.diagnosis : ""}`
    });
    await ctx.store.update("leads", l.id, { client_id: c.id });
  }, "Cadastrado em Clientes", ["leads", "clients"]);
}

// ---------- sessão de envios ----------
function session(ctx) {
  const root = document.getElementById("modal");
  const skipped = new Set();
  let opened = false, done = 0;

  const close = () => {
    root.hidden = true; root.innerHTML = "";
    document.documentElement.classList.remove("modal-open");
    document.removeEventListener("keydown", onKey);
    ctx.reload(["leads"]);
  };
  const onKey = e => { if (e.key === "Escape") close() };
  document.addEventListener("keydown", onKey);

  const draw = () => {
    const sent = sentToday(ctx.db);
    const next = queue(ctx.db).find(x => !skipped.has(x.l.id));
    root.hidden = false;
    document.documentElement.classList.add("modal-open");
    if (sent >= PROSPECT.dailyLimit || !next) {
      root.innerHTML = `
        <div class="modal-back" data-close></div>
        <div class="sheet">
          <header><h2>${sent >= PROSPECT.dailyLimit ? "Limite de hoje atingido" : "Fila vazia"}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon("x")}</button></header>
          <p class="muted-p">${done ? `Você enviou ${done} mensagem(ns) nesta sessão. ` : ""}${sent >= PROSPECT.dailyLimit
            ? `São ${PROSPECT.dailyLimit} por dia para não arriscar bloqueio do WhatsApp e do Instagram. Amanhã tem mais.`
            : "Não há leads novos nem follow-ups para hoje. Importe uma nova coleta."}</p>
          <footer><span></span><button class="btn primary" data-close>Fechar</button></footer>
        </div>`;
      root.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
      return;
    }
    const { l, followup } = next;
    let offer = mainOffer(l);
    const msg = () => followup ? buildMessage(l, offer, true) : (l.message && offer === mainOffer(l) ? l.message : buildMessage(l, offer));
    opened = false;
    root.innerHTML = `
      <div class="modal-back"></div>
      <div class="sheet send-sheet">
        <header>
          <div class="min0"><span class="eyebrow">${followup ? "Follow-up" : "Primeira mensagem"} · ${sent + 1} de ${PROSPECT.dailyLimit} hoje</span>
            <h2>${esc(l.company)}</h2></div>
          <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon("x")}</button>
        </header>
        <p class="sig">${esc([label(NICHES, l.niche), l.instagram ? "@" + l.instagram : "", l.phone || ""].filter(Boolean).join(" · "))}</p>
        ${signals(l).length ? `<p class="sig">${signals(l).map(esc).join(" · ")}</p>` : ""}
        ${l.diagnosis ? `<p class="diag">${esc(l.diagnosis)}</p>` : ""}
        ${followup ? "" : `<label class="fld full"><span>Oferta</span><select data-offer>${OFFERS.map(([k, t]) => `<option value="${k}" ${k === offer ? "selected" : ""}>${t}${(l.offers || []).includes(k) ? " ✓" : ""}</option>`).join("")}</select></label>`}
        <label class="fld full"><span>Mensagem (pode editar)</span><textarea rows="8" data-msg>${esc(msg())}</textarea></label>
        <div class="row send-btns">
          ${l.phone ? `<button class="btn primary" data-wa>${icon("whatsapp")}Abrir no WhatsApp</button>` : ""}
          ${l.instagram ? `<button class="btn ${l.phone ? "ghost" : "primary"}" data-ig>Copiar e abrir o Direct</button>` : ""}
        </div>
        <footer>
          <div class="row">
            <button class="btn ghost sm" data-skip>Pular</button>
            <button class="btn ghost sm danger" data-block>Não contatar</button>
          </div>
          <button class="btn primary" data-sent disabled>${icon("check")}Enviei, próximo</button>
        </footer>
      </div>`;
    const box = root.querySelector("[data-msg]");
    const sentBtn = root.querySelector("[data-sent]");
    let channel = null;
    root.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
    root.querySelector("[data-offer]")?.addEventListener("change", e => { offer = e.target.value; box.value = buildMessage(l, offer) });
    root.querySelector("[data-wa]")?.addEventListener("click", () => {
      window.open(`https://wa.me/${waNumber(l.phone)}?text=${encodeURIComponent(box.value)}`, "_blank", "noopener");
      channel = "whatsapp"; opened = true; sentBtn.disabled = false;
    });
    root.querySelector("[data-ig]")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(box.value); toast("Mensagem copiada. Cole no Direct.") } catch { toast("Não consegui copiar. Selecione o texto e copie.", "erro") }
      window.open(`https://ig.me/m/${encodeURIComponent(l.instagram)}`, "_blank", "noopener");
      channel = "instagram"; opened = true; sentBtn.disabled = false;
    });
    root.querySelector("[data-skip]").onclick = () => { skipped.add(l.id); draw() };
    root.querySelector("[data-block]").onclick = async () => {
      try { await ctx.store.update("leads", l.id, { status: "nao_contatar", followup_on: null }); Object.assign(l, { status: "nao_contatar" }) }
      catch (e) { return toast("Não deu certo: " + e.message, "erro") }
      draw();
    };
    sentBtn.onclick = async () => {
      if (!opened) return;
      const attempts = (l.attempts || 0) + 1;
      const patch = {
        status: "abordado", channel, attempts, contacted_at: new Date().toISOString(),
        followup_on: attempts < PROSPECT.maxAttempts ? addDays(todayISO(), PROSPECT.followupDays) : null,
        offer: followup ? l.offer : offer, message: followup ? l.message : box.value
      };
      sentBtn.disabled = true;
      try { await ctx.store.update("leads", l.id, patch); Object.assign(l, patch); done++ }
      catch (e) { sentBtn.disabled = false; return toast("Não deu certo: " + e.message, "erro") }
      draw();
    };
  };
  draw();
}
