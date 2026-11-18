// Proposta comercial e contrato de prestação de serviços, gerados a partir do cadastro do cliente.
// Abre uma página pronta para imprimir ou "Salvar como PDF", com a logo e os dados da HM.
import { HM } from "../config.js";
import { esc, icon, money, todayISO, addMonths, formModal, parseISO } from "../ui.js";
import { FREQS, WEEKDAYS, label } from "./common.js";

const longDate = iso => parseISO(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const FREQ_TXT = { semanal: "por semana", quinzenal: "a cada 15 dias", mensal: "por mês", avulso: "valor único" };
const lines = s => String(s || "").split(/\n+/).map(x => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

export async function docForm(ctx, c) {
  const projects = ctx.db.projects.filter(p => p.client_id === c.id && p.status !== "concluido");
  const services = projects.length ? projects.map(p => `${p.title}${p.service && p.service !== p.title ? ` (${p.service})` : ""}`).join("\n")
    : "Gestão do Instagram (planejamento, artes, legendas e publicação)\nRelatório mensal de resultados";
  const r = await formModal({
    title: `Proposta ou contrato · ${c.company || c.name}`,
    submit: "Gerar documento",
    fields: [
      { name: "kind", label: "Documento", type: "select", options: [["proposta", "Proposta comercial"], ["contrato", "Contrato de prestação de serviços"]], value: "proposta", full: true },
      { name: "services", label: "O que está incluso (um item por linha)", type: "textarea", value: services, full: true },
      { name: "fee", label: "Valor (R$)", type: "number", step: "0.01", value: c.fee || "" },
      { name: "billing", label: "Frequência", type: "select", options: [...FREQS, ["avulso", "Valor único / por projeto"]], value: c.billing || "mensal" },
      { name: "pay_day", label: "Pagamento", type: "select", options: [["", "—"], ...WEEKDAYS.map(([k, l]) => [k, `Toda ${l.toLowerCase()}`]), ...[5, 10, 15, 20].map(d => [`d${d}`, `Todo dia ${d}`])], value: c.pay_day || "" },
      { name: "start", label: "Início", type: "date", value: todayISO() },
      { name: "months", label: "Prazo mínimo (meses)", type: "number", step: "1", value: 3 },
      { name: "free_until", label: "Cortesia até (sem cobrança)", type: "date", value: c.free_until || "" },
      { name: "doc", label: "CPF/CNPJ do cliente", value: "", placeholder: "Para o contrato", showIf: "kind=contrato" },
      { name: "address", label: "Endereço do cliente", value: "", placeholder: "Rua, número, bairro, cidade", showIf: "kind=contrato", full: true },
      { name: "notes", label: "Observações", type: "textarea", value: "", full: true, placeholder: "Condições especiais, bônus, o que fica por conta do cliente…" }
    ]
  });
  if (!r) return;
  openDoc(r.kind === "contrato" ? contractHTML(c, r) : proposalHTML(c, r), `${r.kind === "contrato" ? "Contrato" : "Proposta"} - ${c.company || c.name}`);
}

function payText(r) {
  if (!r.pay_day) return "";
  return String(r.pay_day).startsWith("d") ? `todo dia ${r.pay_day.slice(1)}` : `toda ${label(WEEKDAYS, Number(r.pay_day)).toLowerCase()}`;
}
function priceText(r) {
  if (!r.fee) return "a combinar";
  return `<b>${money(r.fee)}</b> ${FREQ_TXT[r.billing] || ""}${payText(r) ? `, com pagamento ${payText(r)}` : ""}`;
}

const head = (title, sub) => `
  <header class="doc-head">
    <img src="/assets/img/logo-hm.png" alt="HM Digital" width="1000" height="586">
    <div><b>${esc(HM.name)}</b><small>CNPJ ${esc(HM.cnpj)} · ${esc(HM.city)}</small><small>WhatsApp ${esc(HM.whatsappLabel)} · ${esc(HM.site)}</small></div>
  </header>
  <h1>${esc(title)}</h1>${sub ? `<p class="doc-sub">${sub}</p>` : ""}`;
const foot = `<footer class="doc-foot"><img src="/assets/img/logo-hm.png" alt="" width="1000" height="586">Feito por <b>HM Digital</b> · ${esc(HM.site)}</footer>`;

function proposalHTML(c, r) {
  const who = c.company ? `${esc(c.company)} · aos cuidados de ${esc(c.name)}` : esc(c.name);
  return `${head("Proposta comercial", `Para <b>${who}</b> · ${esc(longDate(todayISO()))}`)}
    <section><h2>Objetivo</h2><p>Fortalecer a presença digital da ${esc(c.company || c.name)} com estratégia, conteúdo e acompanhamento de resultados, para atrair mais clientes e vender mais.</p></section>
    <section><h2>O que está incluso</h2><ul>${lines(r.services).map(s => `<li>${esc(s)}</li>`).join("")}</ul>
      <p class="muted">Acompanhamento pelo <b>Portal do Cliente HM</b>: aprovação das artes, calendário, relatórios e pedidos em um só lugar.</p></section>
    <section><h2>Investimento</h2><p>${priceText(r)}.${r.free_until ? ` Cortesia: sem cobrança até <b>${esc(longDate(r.free_until))}</b>.` : ""}</p>
      <p>Pagamento por Pix (${esc(HM.pixLabel)}), favorecido ${esc(HM.name)}.</p></section>
    <section><h2>Início e prazo</h2><p>Início em <b>${esc(longDate(r.start))}</b>${r.months ? `, com prazo mínimo de ${Number(r.months)} ${Number(r.months) === 1 ? "mês" : "meses"}` : ""}.</p></section>
    ${r.notes ? `<section><h2>Observações</h2><p>${esc(r.notes).replace(/\n/g, "<br>")}</p></section>` : ""}
    <section><h2>Próximos passos</h2><ol><li>Aprovação desta proposta.</li><li>Assinatura do contrato.</li><li>Reunião de briefing e acesso ao Portal do Cliente.</li></ol>
      <p class="muted">Proposta válida por 10 dias.</p></section>
    <div class="sign"><div><i></i>${esc(HM.name)}</div><div><i></i>${esc(c.company || c.name)}</div></div>
    ${foot}`;
}

function contractHTML(c, r) {
  const end = r.months ? addMonths(r.start, Number(r.months)) : null;
  const party = `<b>${esc(c.company || c.name)}</b>${c.company ? `, representada por ${esc(c.name)}` : ""}${r.doc ? `, inscrita no CPF/CNPJ sob o nº ${esc(r.doc)}` : ", CPF/CNPJ nº ____________________"}${r.address ? `, com endereço em ${esc(r.address)}` : ""}`;
  let n = 0; const cl = (t, body) => `<section><h2>Cláusula ${++n}ª · ${t}</h2>${body}</section>`;
  return `${head("Contrato de prestação de serviços de marketing digital")}
    <p><b>CONTRATADA:</b> ${esc(HM.name)}, inscrita no CNPJ sob o nº ${esc(HM.cnpj)}, com sede em ${esc(HM.city)}.</p>
    <p><b>CONTRATANTE:</b> ${party}.</p>
    <p>As partes acima ajustam o presente contrato, que se regerá pelas cláusulas a seguir.</p>
    ${cl("Objeto", `<p>A CONTRATADA prestará à CONTRATANTE os seguintes serviços:</p><ul>${lines(r.services).map(s => `<li>${esc(s)}</li>`).join("")}</ul>`)}
    ${cl("Valor e pagamento", `<p>Pelos serviços, a CONTRATANTE pagará ${priceText(r)}, por Pix (${esc(HM.pixLabel)}) ou outro meio combinado por escrito.${r.free_until ? ` Fica concedida cortesia, sem cobrança, até ${esc(longDate(r.free_until))}; após essa data, os valores poderão ser renegociados de comum acordo.` : ""} O atraso superior a 10 dias permite à CONTRATADA suspender os serviços até a regularização.</p>`)}
    ${cl("Prazo", `<p>Este contrato começa em ${esc(longDate(r.start))}${end ? ` e tem prazo mínimo até ${esc(longDate(end))}` : ""}, renovando-se automaticamente por períodos iguais, salvo aviso de qualquer das partes.</p>`)}
    ${cl("Obrigações da CONTRATADA", `<ul><li>Executar os serviços com qualidade e nos prazos combinados.</li><li>Enviar as peças para aprovação antes da publicação, pelo Portal do Cliente HM.</li><li>Manter sigilo sobre informações e dados da CONTRATANTE.</li></ul>`)}
    ${cl("Obrigações da CONTRATANTE", `<ul><li>Fornecer informações, fotos, acessos e aprovações em tempo hábil.</li><li>Efetuar os pagamentos nas datas combinadas.</li><li>Responder pela veracidade das informações e ofertas divulgadas.</li></ul><p>O valor investido em anúncios (Meta, Google etc.) é pago diretamente pela CONTRATANTE às plataformas e não está incluso no valor deste contrato, salvo se dito acima.</p>`)}
    ${cl("Rescisão", `<p>Qualquer das partes pode encerrar este contrato com aviso prévio de 30 dias, por escrito (inclusive WhatsApp ou e-mail). Os serviços prestados até a data do encerramento serão pagos normalmente.</p>`)}
    ${cl("Conteúdo e dados", `<p>As peças aprovadas e pagas podem ser usadas livremente pela CONTRATANTE. A CONTRATADA pode citar a CONTRATANTE como cliente e mostrar os trabalhos em seu portfólio, salvo pedido em contrário. Os dados pessoais serão tratados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), apenas para a execução deste contrato.</p>`)}
    ${r.notes ? cl("Condições especiais", `<p>${esc(r.notes).replace(/\n/g, "<br>")}</p>`) : ""}
    ${cl("Foro", `<p>Fica eleito o foro da comarca de Goiânia - GO para resolver qualquer questão deste contrato.</p>`)}
    <p>${esc(HM.city.split(" - ")[0])}, ${esc(longDate(todayISO()))}.</p>
    <div class="sign"><div><i></i>${esc(HM.name)}<small>CONTRATADA</small></div><div><i></i>${esc(c.company || c.name)}<small>CONTRATANTE</small></div></div>
    ${foot}`;
}

// Mostra o documento por cima do sistema, com botões de imprimir/PDF e fechar
function openDoc(html, title) {
  document.querySelector(".doc-view")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "doc-view";
  wrap.innerHTML = `<div class="doc-bar"><b>${esc(title)}</b><span class="row">
      <button class="btn primary" data-print>${icon("printer")}Imprimir / Salvar PDF</button>
      <button class="btn ghost" data-close>${icon("x")}Fechar</button></span></div>
    <article class="doc">${html}</article>`;
  document.body.appendChild(wrap);
  document.documentElement.classList.add("doc-open");
  const old = document.title;
  wrap.querySelector("[data-print]").onclick = () => { document.title = title; window.print(); setTimeout(() => document.title = old, 500) };
  const close = () => { wrap.remove(); document.documentElement.classList.remove("doc-open"); document.removeEventListener("keydown", esc_) };
  const esc_ = e => { if (e.key === "Escape") close() };
  document.addEventListener("keydown", esc_);
  wrap.querySelector("[data-close]").onclick = close;
}
