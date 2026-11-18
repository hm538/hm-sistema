// Direct: respostas automáticas no Instagram dos clientes (comentário vira Direct, palavra-chave no
// Direct, menção em story e boas-vindas no 1º Direct). O servidor hm-direct lê estas regras do banco.
// Aqui também ficam os números dos últimos 30 dias (o banco não guarda nome nem texto de ninguém).
import { esc, icon, toast, fmtDate, formModal, confirmModal } from "../ui.js";
import { label } from "./common.js";

export const RULE_KINDS = [
  ["comment", "Comentário em post/reel"], ["dm", "Mensagem no Direct"],
  ["story_mention", "Marcou no story"], ["welcome", "Boas-vindas (1º Direct)"]
];
const NEEDS_WORDS = ["comment", "dm"];

let accountId = null;
let stats = null, statsFor = null, statsErr = "";

const words = s => String(s || "").split(",").map(w => w.trim()).filter(Boolean);
const lines = s => String(s || "").split("\n").map(w => w.trim()).filter(Boolean);

async function loadStats(ctx) {
  statsFor = accountId;
  try { stats = await ctx.store.view("ig_stats"); statsErr = "" }
  catch (e) { stats = []; statsErr = e.message }
}

export default function direct(el, ctx) {
  const { db } = ctx;
  const accounts = db.ig_accounts || [];
  if (!accounts.some(a => a.id === accountId)) accountId = accounts[0]?.id || null;
  const acc = accounts.find(a => a.id === accountId);
  if (acc && statsFor !== accountId) {
    stats = null;
    loadStats(ctx).then(() => { if (location.hash === "#direct") direct(el, ctx) });
  }
  const rules = (db.ig_rules || []).filter(r => r.account_id === accountId)
    .sort((a, b) => (b.active - a.active) || a.priority - b.priority || a.name.localeCompare(b.name));
  const st = (stats || []).filter(s => s.account_id === accountId);
  const sum = arr => arr.reduce((n, s) => n + s.n, 0);
  const sent = st.filter(s => s.status === "enviado"), failed = st.filter(s => s.status === "falhou");
  const byRule = id => sum(sent.filter(s => s.rule_id === id));
  const posts = Object.values(sent.filter(s => s.media_id).reduce((m, s) => {
    const k = s.media_id; m[k] = m[k] || { url: s.media_url, n: 0, last: s.last_at };
    m[k].n += s.n; m[k].url = m[k].url || s.media_url; if (s.last_at > m[k].last) m[k].last = s.last_at; return m;
  }, {})).sort((a, b) => b.n - a.n).slice(0, 5);
  const loading = acc && stats === null;
  const num = v => loading ? "…" : v;

  el.innerHTML = `
    <header class="page-head">
      <div><span class="eyebrow">Instagram</span><h1>Direct automático</h1></div>
      <div class="row">
        <button class="btn ghost" data-acc-new>${icon("plus")}Conta</button>
        ${acc ? `<button class="btn primary" data-rule-new>${icon("plus")}Nova regra</button>` : ""}
      </div>
    </header>

    ${accounts.length > 1 ? `<div class="seg" role="group" aria-label="Conta">${accounts.map(a =>
      `<button data-acc="${a.id}" aria-pressed="${a.id === accountId}">@${esc(a.username || a.ig_id)}</button>`).join("")}</div>` : ""}

    ${!acc ? `<div class="empty-box"><p>Nenhuma conta do Instagram ligada ainda.<br><small>Cadastre a conta do cliente com o ID que aparece no painel da Meta (passo 2, "Gerar tokens de acesso").</small></p>
      <button class="btn primary" data-acc-new>${icon("plus")}Ligar conta</button></div>` : `

    <div class="dm-acc">
      <div class="min0"><b>@${esc(acc.username || "")}</b><small>${esc(ctx.clientLabel(acc.client_id) || "Sem cliente")} · ID ${esc(acc.ig_id)}</small></div>
      <span class="pill ${acc.active ? "st-ativo" : ""}">${acc.active ? "Ligado" : "Desligado"}</span>
      <button class="btn sm ghost" data-acc-edit>${icon("edit")}Editar</button>
    </div>

    <div class="kpis">
      <div class="kpi hero"><span>Mensagens enviadas</span><b>${num(sum(sent))}</b><small>últimos 30 dias</small></div>
      <div class="kpi"><span>Por comentário</span><b>${num(sum(sent.filter(s => s.kind === "comment")))}</b><small>${num(posts.length)} post(s) diferentes</small></div>
      <div class="kpi"><span>Falhas</span><b>${num(sum(failed))}</b>${failed.length ? `<small class="bad">veja abaixo</small>` : `<small>nenhuma</small>`}</div>
    </div>
    ${statsErr ? `<p class="dm-warn">${icon("alert")}Não deu para carregar os números (${esc(statsErr)}). Confira se o arquivo hm-direct.sql foi rodado.</p>` : ""}

    <section class="card">
      <div class="card-head"><h2>${icon("chat")}Regras</h2><small class="muted">Mudou aqui, vale em até 1 minuto</small></div>
      ${rules.length ? `<div class="dm-rules">${rules.map(r => `
        <article class="item dm-rule ${r.active ? "" : "off"}" data-rule="${r.id}" tabindex="0">
          <div class="item-top">
            <div class="min0"><h3>${esc(r.name)}</h3><small>${esc(label(RULE_KINDS, r.kind))}</small></div>
            <button class="btn sm ${r.active ? "" : "ghost"}" data-toggle="${r.id}" aria-pressed="${r.active}">${r.active ? "Ligada" : "Desligada"}</button>
          </div>
          ${r.keywords?.length ? `<div class="dm-words">${r.keywords.map(w => `<span>${esc(w)}</span>`).join("")}</div>` : ""}
          <p class="dm-msg">${esc(r.dm)}</p>
          ${r.public_replies?.length ? `<small class="muted">Resposta pública: ${r.public_replies.map(esc).join(" · ")}</small>` : ""}
          <div class="item-meta"><span>${num(byRule(r.id))} enviada(s) em 30 dias</span></div>
        </article>`).join("")}</div>`
      : `<div class="empty-box"><p>Nenhuma regra nesta conta.</p><button class="btn primary" data-rule-new>${icon("plus")}Criar a primeira</button></div>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>${icon("image")}Posts que mais trouxeram conversa</h2><small class="muted">últimos 30 dias</small></div>
      ${loading ? `<p class="muted">Carregando…</p>` : posts.length ? `<ol class="dm-posts">${posts.map(p => `
        <li><span>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https:\/\/(www\.)?instagram\.com\//, ""))}</a>` : "Post sem link"}</span>
        <b>${p.n}</b><small>último em ${esc(fmtDate(String(p.last).slice(0, 10)))}</small></li>`).join("")}</ol>`
      : `<p class="muted">Ainda não chegou nenhum comentário com palavra-chave.</p>`}
      ${failed.length ? `<p class="dm-warn">${icon("alert")}${sum(failed)} mensagem(ns) não foram enviadas. Causa mais comum: a pessoa apagou o comentário ou passou de 7 dias.</p>` : ""}
    </section>`}`;

  // ---------- ações ----------
  el.querySelectorAll("[data-acc-new]").forEach(b => b.onclick = () => accountForm(ctx));
  el.querySelector("[data-acc-edit]")?.addEventListener("click", () => accountForm(ctx, acc));
  el.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { accountId = b.dataset.acc; direct(el, ctx) });
  el.querySelectorAll("[data-rule-new]").forEach(b => b.onclick = () => ruleForm(ctx, { account_id: accountId }));
  el.querySelectorAll("[data-toggle]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const r = rules.find(x => x.id === b.dataset.toggle);
    ctx.run(() => ctx.store.update("ig_rules", r.id, { active: !r.active }), r.active ? "Regra desligada" : "Regra ligada", ["ig_rules"]);
  });
  el.querySelectorAll("[data-rule]").forEach(card => {
    const open = e => { if (e.target.closest("a,button")) return; ruleForm(ctx, rules.find(r => r.id === card.dataset.rule)) };
    card.onclick = open;
    card.onkeydown = e => { if (e.key === "Enter") open(e) };
  });
}

async function accountForm(ctx, a = {}) {
  const v = await formModal({
    title: a.id ? "Conta do Instagram" : "Ligar conta do Instagram",
    danger: a.id ? "Excluir conta" : null,
    fields: [
      { name: "client_id", label: "Cliente", type: "select", value: a.client_id || "",
        options: [["", "—"], ...ctx.db.clients.map(c => [c.id, c.company || c.name])] },
      { name: "username", label: "@ do Instagram", value: a.username, placeholder: "uselegendoficial", required: true },
      { name: "ig_id", label: "ID da conta (painel da Meta)", value: a.ig_id, placeholder: "17841…", required: true,
        hint: "Número que aparece embaixo do @ no passo 2 do app na Meta." },
      { name: "active", label: "Automação ligada", type: "checkbox", value: a.id ? a.active : true, full: true }
    ]
  });
  if (!v) return;
  if (v.__danger) {
    if (await confirmModal("Excluir a conta e todas as regras dela?")) ctx.run(() => ctx.store.remove("ig_accounts", a.id), "Conta excluída", ["ig_accounts", "ig_rules"]);
    return;
  }
  const row = { client_id: v.client_id || null, username: v.username.replace(/^@/, "").trim().toLowerCase(), ig_id: v.ig_id.replace(/\D/g, ""), active: v.active };
  if (!row.ig_id) return toast("O ID da conta tem que ser só números.", "erro");
  await ctx.run(async () => {
    if (a.id) await ctx.store.update("ig_accounts", a.id, row);
    else { const [n] = await ctx.store.insert("ig_accounts", row); accountId = n.id }
  }, "Conta salva", ["ig_accounts"]);
}

async function ruleForm(ctx, r = {}) {
  const v = await formModal({
    title: r.id ? "Editar regra" : "Nova regra",
    danger: r.id ? "Excluir regra" : null,
    fields: [
      { name: "name", label: "Nome da regra", value: r.name, placeholder: "Ex.: Comentou QUERO", required: true, full: true },
      { name: "kind", label: "Quando dispara", type: "select", value: r.kind || "comment", options: RULE_KINDS, full: true,
        hint: "Boas-vindas vai uma vez só, na 1ª mensagem da pessoa. Story e boas-vindas não usam palavra-chave." },
      { name: "keywords", label: "Palavras-chave (separe por vírgula)", value: (r.keywords || []).join(", "), placeholder: "quero, eu quero",
        full: true, hint: "Não diferencia maiúsculas nem acento. Vale a palavra inteira: \"quero\" não pega \"queroo\". Só para comentário e Direct." },
      { name: "dm", label: "Mensagem enviada no Direct", type: "textarea", value: r.dm, required: true, full: true,
        placeholder: "Oi! Que bom que você curtiu…" },
      { name: "public_replies", label: "Respostas públicas no comentário (uma por linha, opcional)", type: "textarea",
        value: (r.public_replies || []).join("\n"), full: true, showIf: "kind=comment",
        hint: "O sistema sorteia uma, para não parecer robô repetindo." },
      { name: "priority", label: "Ordem (menor vem primeiro)", type: "number", value: r.priority ?? 100, step: 1 },
      { name: "active", label: "Regra ligada", type: "checkbox", value: r.id ? r.active : true }
    ]
  });
  if (!v) return;
  if (v.__danger) {
    if (await confirmModal("Excluir esta regra?")) ctx.run(() => ctx.store.remove("ig_rules", r.id), "Regra excluída", ["ig_rules"]);
    return;
  }
  const row = {
    account_id: r.account_id, name: v.name, kind: v.kind,
    keywords: NEEDS_WORDS.includes(v.kind) ? words(v.keywords).map(w => w.toLowerCase()) : [],
    dm: v.dm, public_replies: v.kind === "comment" ? lines(v.public_replies) : [],
    priority: Math.round(v.priority ?? 100), active: v.active
  };
  if (NEEDS_WORDS.includes(row.kind) && !row.keywords.length) return toast("Coloque pelo menos uma palavra-chave.", "erro");
  if (row.dm.length > 1000) return toast("A mensagem passou de 1000 letras.", "erro");
  if (["welcome", "story_mention"].includes(row.kind) && row.active &&
      ctx.db.ig_rules.some(x => x.account_id === r.account_id && x.kind === row.kind && x.active && x.id !== r.id))
    return toast(`Já existe uma regra de "${label(RULE_KINDS, row.kind)}" ligada nesta conta. Desligue a outra antes.`, "erro");
  await ctx.run(() => r.id ? ctx.store.update("ig_rules", r.id, row) : ctx.store.insert("ig_rules", row), "Regra salva", ["ig_rules"]);
}
