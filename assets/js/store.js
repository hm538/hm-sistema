// Acesso aos dados. Mesma interface para o Supabase e para o modo demonstração.
import { SUPABASE } from "./config.js";

export const TABLES = ["clients", "projects", "time_entries", "transactions", "events", "goals", "posts", "bills"];
export const demo = !SUPABASE.url;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());

// ---------- Supabase ----------
function supabaseStore() {
  const sb = window.supabase.createClient(SUPABASE.url, SUPABASE.key);
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data };
  return {
    async session() { return (await sb.auth.getSession()).data.session },
    onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s)) },
    async signIn(email, password) {
      let res;
      try { res = await sb.auth.signInWithPassword({ email, password }) }
      catch { throw new Error("Sem conexão com o servidor. Confira a internet e o endereço do Supabase em config.js.") }
      const { error } = res;
      if (!error) return;
      if (error.message === "Invalid login credentials") throw new Error("E-mail ou senha incorretos.");
      if (/fetch/i.test(error.message)) throw new Error("Sem conexão com o servidor. Confira a internet e o endereço do Supabase em config.js.");
      throw new Error(error.message);
    },
    async signOut() { await sb.auth.signOut() },
    async list(table) { return check(await sb.from(table).select("*").order("created_at")) },
    async insert(table, rows) { return check(await sb.from(table).insert(rows).select()) },
    async update(table, id, patch) { return check(await sb.from(table).update(patch).eq("id", id).select()) },
    async remove(table, id) { check(await sb.from(table).delete().eq("id", id)) },
    async removeWhere(table, col, val) { check(await sb.from(table).delete().eq(col, val)) }
  };
}

// ---------- Modo demonstração (localStorage) ----------
function localStore() {
  const KEY = "hm-sistema-demo";
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) } catch { data = null }
  if (!data) data = seed();
  TABLES.forEach(t => { data[t] = data[t] || [] });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {} };
  save();
  const now = () => new Date().toISOString();
  return {
    async session() { return { user: { email: "demonstracao" } } },
    onAuth() {},
    async signIn() {},
    async signOut() { try { localStorage.removeItem(KEY) } catch {} location.reload() },
    async list(table) { return structuredClone(data[table] || []) },
    async insert(table, rows) {
      const arr = (Array.isArray(rows) ? rows : [rows]).map(r => ({ id: uuid(), created_at: now(), ...r }));
      data[table].push(...arr); save(); return arr;
    },
    async update(table, id, patch) {
      const r = data[table].find(x => x.id === id); Object.assign(r, patch); save(); return [r];
    },
    async remove(table, id) {
      data[table] = data[table].filter(x => x.id !== id);
      if (table === "projects") data.time_entries = data.time_entries.filter(x => x.project_id !== id);
      save();
    },
    async removeWhere(table, col, val) { data[table] = data[table].filter(x => x[col] !== val); save() }
  };
}

// Dados de exemplo para o modo demonstração (não são dados reais)
function seed() {
  const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10) };
  const at = (offset, h) => { const x = new Date(); x.setDate(x.getDate() + offset); x.setHours(h, 0, 0, 0); return x.toISOString() };
  const c1 = uuid(), c2 = uuid(), c3 = uuid(), p1 = uuid(), p2 = uuid(), p3 = uuid(), s1 = uuid();
  const ts = new Date().toISOString();
  return {
    clients: [
      { id: c1, name: "Cliente Exemplo 1", company: "Padaria Exemplo", phone: "62 90000-0001", stage: "ativo", won_at: d(-20), fee: 350, billing: "semanal", pay_day: 5, notes: "Exemplo do modo demonstração.", created_at: ts },
      { id: c2, name: "Cliente Exemplo 2", company: "Loja Exemplo", phone: "62 90000-0002", stage: "proposta", notes: "", created_at: ts },
      { id: c3, name: "Cliente Exemplo 3", company: "Clínica Exemplo", stage: "contato", notes: "", created_at: ts }
    ],
    projects: [
      { id: p1, client_id: c1, title: "Gestão de Instagram", service: "Marketing digital", owner: "Mariana", status: "em_andamento", start_date: d(-20), due_date: d(10), hours_estimated: 20, price: 1500, billing: "mensal", created_at: ts },
      { id: p2, client_id: c1, title: "Cardápio digital", service: "Delivery", owner: "Neto", status: "revisao", start_date: d(-10), due_date: d(-1), hours_estimated: 12, price: 1200, billing: "fechado", created_at: ts },
      { id: p3, client_id: c2, title: "Site institucional", service: "Sites e cartões digitais", owner: "Neto", status: "a_fazer", start_date: d(3), due_date: d(25), hours_estimated: 30, price: 3000, billing: "fechado", created_at: ts }
    ],
    time_entries: [
      { id: uuid(), project_id: p1, person: "Mariana", date: d(-5), minutes: 240, note: "Posts da semana", created_at: ts },
      { id: uuid(), project_id: p2, person: "Neto", date: d(-3), minutes: 300, note: "Montagem do cardápio", created_at: ts },
      { id: uuid(), project_id: p2, person: "Neto", date: d(-2), minutes: 180, note: "Ajustes", created_at: ts }
    ],
    transactions: [
      { id: uuid(), type: "entrada", description: "Mensalidade Instagram", amount: 1500, category: "Mensalidade", client_id: c1, project_id: p1, due_date: d(-15), paid: true, paid_date: d(-15), series_id: s1, created_at: ts },
      { id: uuid(), type: "entrada", description: "Mensalidade Instagram", amount: 1500, category: "Mensalidade", client_id: c1, project_id: p1, due_date: d(15), paid: false, series_id: s1, created_at: ts },
      { id: uuid(), type: "entrada", description: "Cardápio digital (50%)", amount: 600, category: "Projeto", client_id: c1, project_id: p2, due_date: d(-8), paid: true, paid_date: d(-8), created_at: ts },
      { id: uuid(), type: "entrada", description: "Cardápio digital (50%)", amount: 600, category: "Projeto", client_id: c1, project_id: p2, due_date: d(-1), paid: false, created_at: ts },
      { id: uuid(), type: "saida", description: "Ferramenta de design", amount: 89.9, category: "Ferramentas e assinaturas", due_date: d(-6), paid: true, paid_date: d(-6), created_at: ts },
      { id: uuid(), type: "saida", description: "Anúncios", amount: 300, category: "Anúncios", project_id: p1, due_date: d(5), paid: false, created_at: ts }
    ],
    bills: [
      { id: uuid(), name: "Aluguel do escritório", category: "Aluguel e contas", amount: 1500, freq: "mensal", due_day: 5, variable: false, active: true, method: "Pix", created_at: ts },
      { id: uuid(), name: "Energia", category: "Aluguel e contas", amount: 250, freq: "mensal", due_day: 12, variable: true, active: true, method: "Boleto", created_at: ts },
      { id: uuid(), name: "Internet", category: "Aluguel e contas", amount: 120, freq: "mensal", due_day: 20, variable: false, active: true, method: "Cartão de crédito", created_at: ts }
    ],
    posts: [
      { id: uuid(), client_id: c1, date: d(-1), time: "18:00", channel: "Instagram", format: "Reels", title: "Bastidores da cozinha", status: "aprovacao", owner: "Mariana", created_at: ts },
      { id: uuid(), client_id: c1, date: d(0), time: "12:00", channel: "Instagram", format: "Carrossel", title: "Cardápio da semana", status: "agendado", owner: "Mariana", created_at: ts },
      { id: uuid(), client_id: c2, date: d(1), time: "19:00", channel: "Instagram", format: "Stories", title: "Enquete de produtos", status: "producao", owner: "Neto", created_at: ts },
      { id: uuid(), client_id: c1, date: d(2), time: "18:00", channel: "TikTok", format: "Vídeo", title: "Receita rápida", status: "ideia", owner: "Mariana", created_at: ts },
      { id: uuid(), client_id: c2, date: d(-3), time: "10:00", channel: "Instagram", format: "Feed", title: "Promoção de outubro", status: "publicado", owner: "Neto", created_at: ts }
    ],
    goals: [
      { id: uuid(), month: d(0).slice(0, 7), revenue: 5000, profit: 3500, new_clients: 2, delivered: 2, created_at: ts }
    ],
    events: [
      { id: uuid(), title: "Reunião de proposta", kind: "reuniao", start_at: at(1, 10), end_at: at(1, 11), client_id: c2, person: "Neto", location: "Online", created_at: ts },
      { id: uuid(), title: "Gravação de conteúdo", kind: "gravacao", start_at: at(3, 14), end_at: at(3, 17), client_id: c1, project_id: p1, person: "Mariana", created_at: ts }
    ]
  };
}

export const store = demo ? localStore() : supabaseStore();
