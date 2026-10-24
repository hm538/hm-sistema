# HM Sistema

Sistema interno da HM Digital: clientes (CRM), trabalhos com horas estimadas x gastas, financeiro (entradas, saídas e mensalidades) e agenda.

Site estático (HTML + JavaScript, sem build) com dados e login no **Supabase**.

## Telas

| Tela | O que faz |
| --- | --- |
| Painel | Metas do mês (faturamento, lucro, clientes novos, trabalhos entregues) com ritmo; recebido, gasto e saldo do mês; a receber e a pagar; alertas de atrasos; próximos 7 dias; horas por pessoa |
| Clientes | Funil por etapa (Contato → Proposta → Fechado → Ativo → Encerrado), busca, WhatsApp e Instagram, quanto cada cliente já pagou |
| Trabalhos | Status, prazo, responsável, horas estimadas x gastas (cronômetro ou à mão), recebido, gastos, lucro e valor por hora |
| Financeiro | Lançamentos do mês com previsto x realizado, mensalidades repetidas, atrasados, últimos 6 meses e gastos por categoria |
| Agenda | Calendário com compromissos, prazos de trabalhos e vencimentos do financeiro |

## Configurar o Supabase (uma vez)

1. **Criar as tabelas:** Supabase → *SQL Editor* → *New query* → cole o conteúdo de `supabase/schema.sql` → *Run*. Sempre que o arquivo mudar, rode de novo: ele só cria o que falta, sem apagar dados.
2. **Fechar o cadastro público:** *Authentication* → *Sign In / Providers* → desligue **Allow new users to sign up**.
3. **Criar os usuários:** *Authentication* → *Users* → *Add user* → *Create new user* (marque *Auto Confirm User*). Um para o Neto e um para a Mariana.
4. **Ligar o site ao banco:** *Project Settings* → *API* (ou *Data API*): copie a **Project URL** e a chave **anon / publishable** para `assets/js/config.js`.
   Nunca use a chave `service_role` / `secret` no site.

Sem a configuração do passo 4, o sistema abre em **modo demonstração**, com dados de exemplo salvos só no navegador.

## Personalizar

`assets/js/config.js`: pessoas da equipe, lista de serviços e categorias do financeiro.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Publicar na Vercel

**Add New → Project → importar este repositório → Deploy** (Framework Preset: *Other*). Domínio sugerido: `sistema.hmdigitalgo.com`.
O site pede para não ser indexado pelo Google (`noindex`).

## Arquivos

```
index.html                 página única
assets/css/app.css         visual
assets/js/config.js        Supabase, equipe, serviços, categorias
assets/js/store.js         acesso aos dados (Supabase ou demonstração)
assets/js/ui.js            formatação, ícones, formulários
assets/js/app.js           login, menu e navegação
assets/js/views/*.js       uma tela por arquivo
supabase/schema.sql        tabelas e regras de acesso
```
