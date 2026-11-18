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
