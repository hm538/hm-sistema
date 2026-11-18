// Configuração do HM Sistema.
// Supabase → Project Settings → API (ou "Data API"):
//   url  = "Project URL"
//   key  = chave "anon public" (ou "publishable"). NUNCA coloque aqui a "service_role"/"secret".
// Com url vazio, o sistema abre em MODO DEMONSTRAÇÃO, com dados de exemplo salvos só no navegador.
export const SUPABASE = {
  url: "https://kywilkofisywtmysxbmo.supabase.co",
  key: "sb_publishable_SZieJMpzsUucS4DALgkxqg_xbquJHBH"
};

// Quem trabalha na HM (aparece em responsável, horas e agenda)
export const PEOPLE = ["Neto", "Mariana"];

// Serviços que a HM vende
export const SERVICES = ["Marketing digital", "Sistemas sob medida", "CRM e automação", "Delivery", "Sites e cartões digitais", "Identidade visual", "Outro"];

// Calendário de postagens
export const CHANNELS = ["Instagram", "TikTok", "Facebook", "YouTube", "LinkedIn", "WhatsApp", "Outro"];
export const FORMATS = ["Reels", "Carrossel", "Feed (foto)", "Stories", "Vídeo", "Outro"];

// Formas de pagamento
export const METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência"];

// Categorias do financeiro
export const CATEGORIES = {
  entrada: ["Pagamento semanal", "Pagamento quinzenal", "Mensalidade", "Projeto", "Outro"],
  saida: ["Aluguel e contas", "Ferramentas e assinaturas", "Anúncios", "Equipe e freelancers", "Impostos", "Equipamentos", "Pró-labore", "Outro"]
};

// Dados da HM (cobrança, propostas e contratos)
export const HM = {
  name: "HM Digital", cnpj: "32.354.551/0001-40", pix: "32354551000140", pixLabel: "CNPJ 32.354.551/0001-40",
  whatsapp: "5562984134046", whatsappLabel: "(62) 98413-4046", site: "www.hmdigitalgo.com", city: "Goiânia - GO"
};

// Prospecção (aba Prospecção)
// Variáveis das mensagens: {nome} (vira " Fulano" ou nada), {empresa}, {gancho}, {assinatura}, {sair}
export const PROSPECT = {
  dailyLimit: 25,          // mensagens por dia (novas + follow-ups). Mais que isso arrisca bloqueio do número/conta
  followupDays: 3,         // dias até o follow-up
  maxAttempts: 2,          // 1ª mensagem + 1 follow-up; depois disso não insiste
  signature: "Neto, da HM Digital",
  optOut: "Se não fizer sentido agora, é só me avisar que eu não mando mais mensagem 🙂",
  offers: [
    ["pitch", "HM Pitch"], ["site", "Site"], ["sistema", "Sistema"], ["marketing", "Instagram"], ["trafego", "Tráfego"]
  ],
  // Gancho padrão quando o lead não tem um gancho próprio
  hooks: {
    pitch: "o link da bio ainda não leva para uma página própria de vocês",
    site: "vocês ainda não têm um site próprio",
    sistema: "boa parte do atendimento parece passar pelo WhatsApp e pelo direct na mão",
    marketing: "o Instagram está com poucas postagens nas últimas semanas",
    trafego: "vocês têm ótimas avaliações, mas ainda não aparecem em anúncios"
  },
  templates: {
    pitch: "Oi{nome}, tudo bem? Aqui é o {assinatura}, de Goiânia. Dei uma olhada na {empresa} e reparei que {gancho}. A gente faz o HM Pitch: um cartão digital com abertura animada que junta WhatsApp, localização, catálogo e redes num link só, com a cara da empresa. Posso te mandar um exemplo rapidinho?\n\n{sair}",
    site: "Oi{nome}, tudo bem? Aqui é o {assinatura}, de Goiânia. Vi a {empresa} e reparei que {gancho}. Hoje muita gente pesquisa no Google antes de chamar, e um site rápido, bonito e com botão de WhatsApp passa confiança e traz pedido. Posso te mostrar alguns que fizemos aqui em Goiânia?\n\n{sair}",
    sistema: "Oi{nome}, tudo bem? Aqui é o {assinatura}, de Goiânia. Acompanhando a {empresa}, reparei que {gancho}. A gente cria sistemas sob medida (agenda, pedidos, CRM de clientes, cobrança pelo WhatsApp) para tirar esse trabalho manual do dia a dia. Posso te mostrar como ficou num cliente parecido?\n\n{sair}",
    marketing: "Oi{nome}, tudo bem? Aqui é o {assinatura}, de Goiânia. Vi o perfil da {empresa} e reparei que {gancho}. A gente cuida do Instagram de empresas daqui (roteiro, gravação, artes e legendas) com um ritmo que dá resultado sem tomar o tempo de vocês. Posso te mandar 2 ideias de post pra {empresa}, sem compromisso?\n\n{sair}",
    trafego: "Oi{nome}, tudo bem? Aqui é o {assinatura}, de Goiânia. Vi a {empresa} e reparei que {gancho}. Com anúncio bem feito no Instagram, dá para levar isso para quem está aqui perto e chamar direto no WhatsApp. Posso te mostrar quanto custaria um teste pequeno?\n\n{sair}",
    followup: "Oi{nome}! Passando só pra ver se você chegou a ver minha mensagem sobre a {empresa}. Se preferir, te mando um exemplo pronto pra você olhar com calma.\n\n{sair}"
  }
};
