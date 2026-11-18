// Backup semanal dos dados (o plano grátis do Supabase não faz backup).
// No Chrome/Edge do computador: na primeira vez você escolhe a pasta (HM DIGITAL › dados › backups) e,
// a cada semana, o sistema grava sozinho um arquivo .json lá ao abrir (se o navegador lembrar a permissão;
// senão, o Painel mostra o botão "Fazer backup" e basta um clique). Em outros navegadores, o arquivo vai para Downloads.
import { store, TABLES, demo } from "./store.js";
import { toast, todayISO } from "./ui.js";

// Tabelas do sistema + do Portal do Cliente (as que não existirem no banco são puladas)
const PORTAL = ["team_members", "portal_users", "post_media", "post_reviews", "ad_reports", "ad_rows", "portal_requests",
  "brand_files", "portal_feedback", "delivery_weeks", "delivery_rows", "portal_month_notes"];
const KEY = "hm-sistema-backup-ultimo";
const EVERY_DAYS = 7;

export const lastBackup = () => { try { return localStorage.getItem(KEY) } catch { return null } };
export function backupDue() {
  if (demo) return false;
  const last = lastBackup();
  return !last || (new Date(todayISO()) - new Date(last)) / 864e5 >= EVERY_DAYS;
}

// ---- pasta escolhida (guardada no próprio navegador) ----
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("hm-sistema", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("kv", mode), req = fn(tx.objectStore("kv"));
      tx.oncomplete = () => resolve(req?.result); tx.onerror = () => reject(tx.error);
    };
  });
}
const getDir = () => idb("readonly", s => s.get("pasta-backup")).catch(() => null);
const setDir = h => idb("readwrite", s => s.put(h, "pasta-backup")).catch(() => {});

async function collect() {
  const out = { sistema: "HM Sistema", feito_por: "HM Digital · www.hmdigitalgo.com", gerado_em: new Date().toISOString(), tabelas: {} };
  for (const t of [...TABLES, ...PORTAL]) {
    try { out.tabelas[t] = await store.dump(t) } catch { /* tabela ainda não existe */ }
  }
  return out;
}

// interactive = veio de um clique (pode abrir o seletor de pasta / pedir permissão)
export async function saveBackup(ctx, { interactive = true, pick = false } = {}) {
  try {
    const data = await collect();
    const name = `hm-backup-${todayISO()}.json`;
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const rows = Object.values(data.tabelas).reduce((s, r) => s + r.length, 0);
    if ("showDirectoryPicker" in window) {
      let dir = pick ? null : await getDir();
      if (dir && (await dir.queryPermission({ mode: "readwrite" })) !== "granted") {
        if (!interactive || (await dir.requestPermission({ mode: "readwrite" })) !== "granted") dir = interactive ? null : undefined;
      }
      if (dir === undefined) return false;           // automático sem permissão: o Painel avisa
      if (!dir) {
        if (!interactive) return false;
        toast("Escolha a pasta HM DIGITAL › dados › backups na Área de Trabalho");
        dir = await window.showDirectoryPicker({ id: "hm-backup", mode: "readwrite", startIn: "desktop" });
        await setDir(dir);
      }
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
    } else {
      if (!interactive) return false;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    try { localStorage.setItem(KEY, todayISO()) } catch {}
    toast(`Backup salvo: ${name} (${rows} registros)`);
    ctx?.reload?.([]);
    return true;
  } catch (e) {
    if (e?.name === "AbortError") return false;     // fechou o seletor
    toast("Backup não deu certo: " + e.message, "erro");
    return false;
  }
}

// Ao abrir o sistema: se já passou uma semana e a pasta tem permissão, grava sozinho
export async function autoBackup(ctx) {
  if (!backupDue()) return;
  await saveBackup(ctx, { interactive: false });
}
