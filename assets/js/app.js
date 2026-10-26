// HM Sistema: login, menu, navegação e carregamento dos dados.
import { store, demo, TABLES } from "./store.js";
import { esc, icon, toast } from "./ui.js";
import painel from "./views/painel.js";
import clientes from "./views/clientes.js";
import trabalhos from "./views/trabalhos.js";
import financeiro from "./views/financeiro.js";
import agenda from "./views/agenda.js";
import conteudo from "./views/conteudo.js";

const ROUTES = {
  painel: { label: "Painel", icon: "home", view: painel },
  clientes: { label: "Clientes", icon: "users", view: clientes },
  trabalhos: { label: "Trabalhos", icon: "briefcase", view: trabalhos },
  financeiro: { label: "Financeiro", icon: "wallet", view: financeiro },
  agenda: { label: "Agenda", icon: "calendar", view: agenda },
  conteudo: { label: "Conteúdo", icon: "image", view: conteudo }
};

const db = Object.fromEntries(TABLES.map(t => [t, []]));
const OPTIONAL = ["goals", "posts"];
const OPTIONAL_LABEL = { goals: "Metas", posts: "Conteúdo (postagens)" };
const warned = new Set();
const app = document.getElementById("app");
let current = null;
let userEmail = "";

const ctx = {
  db, store,
  // Recarrega tabelas do banco e redesenha a tela atual
  async reload(tables = TABLES) {
    await Promise.all(tables.map(async t => {
      try { db[t] = await store.list(t) }
      catch (e) {
        // Tabelas novas ainda não criadas no banco não podem travar o sistema inteiro
        if (!OPTIONAL.includes(t)) throw e;
        db[t] = [];
        if (!warned.has(t)) { warned.add(t); toast(`Rode o arquivo supabase/schema.sql no Supabase para ativar: ${OPTIONAL_LABEL[t]}.`, "erro") }
      }
    }));
    render();
  },
  // Executa uma alteração no banco com aviso de erro
  async run(fn, ok, tables) {
    try { await fn(); if (ok) toast(ok); await ctx.reload(tables) }
    catch (e) { console.error(e); toast("Não deu certo: " + e.message, "erro") }
  },
  go(route) { location.hash = route },
  client: id => db.clients.find(c => c.id === id),
  project: id => db.projects.find(p => p.id === id),
  clientLabel(id) { const c = ctx.client(id); return c ? (c.company || c.name) : "" }
};

function layout(route) {
  const nav = Object.entries(ROUTES).map(([k, r]) =>
    `<a href="#${k}" class="${k === route ? "on" : ""}" ${k === route ? 'aria-current="page"' : ""}>${icon(r.icon)}<span>${r.label}</span></a>`).join("");
  return `
    <aside class="side">
      <div class="brand"><img src="/assets/img/logo-hm.png" alt="HM Digital" width="1000" height="586"><span>Sistema</span></div>
      <nav>${nav}</nav>
      <div class="side-foot">
        <small>${esc(userEmail)}</small>
        <button class="btn ghost sm" data-logout>${icon("logout")}${demo ? "Recomeçar demo" : "Sair"}</button>
      </div>
    </aside>
    <div class="content">
      ${demo ? `<div class="demo-bar">${icon("alert")}<span><b>Modo demonstração.</b> Os dados são de exemplo e ficam só neste navegador. Configure o Supabase em <code>assets/js/config.js</code> para usar de verdade.</span></div>` : ""}
      <main id="view" class="view"></main>
    </div>
    <nav class="tabbar">${nav}</nav>`;
}

function render() {
  const route = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : "painel";
  if (route !== current || !document.getElementById("view")) {
    current = route;
    app.innerHTML = layout(route);
    app.querySelector("[data-logout]").addEventListener("click", () => store.signOut());
    document.title = `${ROUTES[route].label} · HM Sistema`;
    window.scrollTo(0, 0);
  }
  const view = document.getElementById("view");
  ROUTES[route].view(view, ctx);
}

function loginScreen(msg = "") {
  current = null;
  app.innerHTML = `
    <div class="login">
      <form class="login-card" novalidate>
        <img src="/assets/img/logo-hm.png" alt="HM Digital" width="1000" height="586">
        <h1>HM Sistema</h1>
        <p>Entre com o e-mail e a senha da equipe.</p>
        <label class="fld"><span>E-mail</span><input id="login-email" type="email" autocomplete="username" required></label>
        <label class="fld"><span>Senha</span><input id="login-pass" type="password" autocomplete="current-password" required></label>
        <p class="form-err" ${msg ? "" : "hidden"}>${esc(msg)}</p>
        <button class="btn primary wide" type="submit">Entrar</button>
      </form>
    </div>`;
  const form = app.querySelector("form");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button");
    btn.disabled = true; btn.textContent = "Entrando…";
    try { await store.signIn(form.elements[0].value.trim(), form.elements[1].value); await start() }
    catch (err) { loginScreen(err.message) }
  });
}

async function start() {
  const session = await store.session();
  if (!session) return loginScreen();
  userEmail = demo ? "Modo demonstração" : session.user.email;
  app.innerHTML = `<div class="loading">${icon("clock")}Carregando…</div>`;
  try { await ctx.reload() }
  catch (e) { app.innerHTML = `<div class="loading err">Não foi possível carregar os dados: ${esc(e.message)}<br><small>Confira se o arquivo supabase/schema.sql já foi rodado no Supabase.</small></div>` }
}

window.addEventListener("hashchange", render);
store.onAuth(s => { if (!s) loginScreen() });
start();
