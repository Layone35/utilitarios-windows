# GEMINI.md — Regras Globais (Antigravity IDE)

Estas são regras **inegociáveis** para todas as interações neste ambiente. Aplicam-se a qualquer projeto, em qualquer linguagem, em qualquer tarefa.

---

## 🌐 Idioma e Comunicação

- **Sempre responder em português (pt-BR).**
- Tom direto, técnico, prático. Zero enrolação.
- Sem introduções longas, sem disclaimers, sem "vamos lá".
- Comentários no código: pt-BR.
- Mensagens de commit: pt-BR, formato semântico (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

---

## 👤 Contexto do Usuário

- Desenvolvedor solo, projetos para **uso pessoal**.
- Aprende na prática (vibe coding controlado por SDD).
- **Orçamento zero ou mínimo possível** — sempre priorizar free tiers.
- Sem equipe: precisa de soluções **completas e funcionais**, nunca parciais.
- Spec-Driven Development: planejamento no Gemini Gem, execução no Antigravity.

---

## 🛠️ Stack Padrão (use sempre, salvo instrução contrária)

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Gerenciador de pacotes | **pnpm** (único permitido — nunca npm, nunca yarn) |
| Backend / BaaS | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Backend próprio (se necessário) | FastAPI (Python 3.11+) em Cloud Run **ou** VM e2-micro + Cloudflare Tunnel |
| Scripts / Automações | Python 3.11+ com type hints |
| Deploy frontend | Netlify (GitHub branch `main`, build automático) |
| Versionamento | Git + GitHub, branch única `main` |
| Prototipação UI | Google Stitch (opcional) |

### Bibliotecas visuais obrigatórias (frontend)

Sempre que criar ou modificar componentes React, use estas bibliotecas:

- **`framer-motion`** — animações e transições. Todo componente interativo deve ter pelo menos uma animação sutil (hover, fade, slide).
- **`recharts`** — qualquer dashboard, gráfico ou visualização de dados.
- **`lucide-react`** — ícones. Nunca use emojis no lugar de ícones em UI séria.
- **`shadcn/ui`** — componentes base (Button, Card, Dialog, Input, etc.). Instalar via CLI conforme necessário.

### Restrições de free tier

**Supabase Free:**
- 500 MB database, 1 GB storage, 50.000 MAUs.
- Projeto pausa após 7 dias de inatividade — projetar para tolerância a cold starts.
- Evitar Edge Functions em uso intensivo.

**Google Cloud Free:**
- e2-micro: 1 GB RAM, 30 GB disco, 1 GB egress/mês, regiões `us-central1`/`us-east1`/`us-west1`.
- Cloud Run: 180k vCPU-seconds/mês, 2M requests/mês, escala a zero.

**Regra geral:** se Supabase resolve sozinho com client-side + RLS, **não criar backend próprio**.

---

## 📐 Convenções de Código

### Geral
- **Código completo, sempre.** Nunca entregar com `// resto aqui...`, `// TODO`, ou placeholders.
- **Tratamento de erros em TODA operação async** (`try/catch` ou `.catch()`).
- **Tipagem estrita** — proibido `any` em TypeScript, exceto com comentário justificando.
- Variáveis de ambiente via `.env` (nunca hardcoded). Sempre criar `.env.example` junto.
- Imports organizados: bibliotecas externas → internas → tipos → estilos.

### React + TypeScript
- **Um componente por arquivo**, nome em PascalCase: `NomeComponente.tsx`.
- Functional Components + Hooks. Nunca class components.
- Props tipadas com `interface` (não `type`) quando descrevem objetos.
- Custom hooks em `src/hooks/`, sempre prefixados com `use`.
- Cliente Supabase **centralizado** em `src/lib/supabase.ts`.
- Tipos compartilhados em `src/types/`.
- Tailwind: usar **design tokens** do `tailwind.config.js`, evitar valores arbitrários como `text-[#1a2b3c]`.
- Mobile-first: começar pelo layout mobile, depois adicionar `md:`, `lg:`.

### Python
- Type hints em todas as funções (parâmetros e retorno).
- `requirements.txt` sempre presente e atualizado.
- Docstrings curtas em pt-BR no formato Google Style.
- Variáveis de ambiente via `os.getenv()` ou `python-dotenv`.
- FastAPI: routers separados por domínio em `app/routes/`.

### Estrutura de pastas padrão (React)

```
src/
├── components/
│   ├── ui/          # Componentes shadcn/ui e genéricos
│   └── features/    # Componentes específicos por funcionalidade
├── hooks/           # Custom hooks
├── lib/
│   └── supabase.ts  # Cliente centralizado
├── pages/           # Páginas/rotas
├── types/           # Interfaces TypeScript compartilhadas
├── utils/           # Funções utilitárias puras
├── App.tsx
└── main.tsx
```

---

## 🔒 Segurança e Auditoria (OBRIGATÓRIO)

### Secrets e variáveis de ambiente
- **Nunca** hardcodar API keys, tokens, senhas, URLs de banco.
- Sempre usar `.env` + `.env.example` (este último com placeholders).
- `.env` deve estar no `.gitignore` (verificar antes de qualquer commit).
- Variáveis do frontend Vite: prefixo `VITE_` (sabendo que ficam expostas no bundle — nunca colocar service_role ou secrets reais aí).
- Service role keys do Supabase: **só no backend**, nunca no frontend.
- Antes de commitar, fazer grep mental: `grep -r "sk-" .`, `grep -r "eyJ" .`, `grep -r "supabase.co" .`.

### Supabase RLS (Row Level Security)
- **TODA tabela criada deve ter RLS ativado.** Sem exceção.
- Comando obrigatório após `CREATE TABLE`:
  ```sql
  ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
  ```
- Sempre criar policies explícitas para `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- Filtrar por `auth.uid()` quando os dados forem do usuário:
  ```sql
  CREATE POLICY "users_select_own" ON nome_tabela
  FOR SELECT USING (auth.uid() = user_id);
  ```
- Nunca usar `USING (true)` em produção sem justificativa.
- Tabelas públicas (read-only) devem ter policy explícita `USING (true)` apenas para `SELECT`.

### Validação de input
- **Toda entrada do usuário deve ser validada** antes de chegar no banco.
- Frontend: validar com biblioteca leve (zod, ou validação manual). Não confiar só no HTML.
- Backend Python: validar com Pydantic models no FastAPI.
- Sanitizar strings que vão para queries SQL — sempre usar **parameterized queries**, nunca concatenar.
- Limitar tamanho de uploads (Supabase Storage tem limite, mas validar no client também).
- Validar tipos MIME em uploads de arquivos.

### Autenticação
- Sempre usar Supabase Auth (não criar sistema próprio).
- Páginas privadas: verificar sessão com `supabase.auth.getSession()` no carregamento.
- Implementar logout limpando localStorage/sessionStorage além do Supabase.
- Tokens JWT: deixar Supabase gerenciar refresh automaticamente.

### CORS e headers (backend próprio)
- FastAPI: configurar CORS explicitamente, listar origens permitidas, **nunca** `allow_origins=["*"]` em produção.
- Headers de segurança: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

### Auditoria antes de commitar
Antes de cada commit, verificar mentalmente:
1. ✅ Nenhum secret hardcoded?
2. ✅ `.env` está no `.gitignore`?
3. ✅ RLS ativado nas novas tabelas?
4. ✅ Tratamento de erros em todas operações async?
5. ✅ Inputs validados?
6. ✅ Sem `console.log` deixados pra trás (a não ser intencionais)?
7. ✅ Sem `any` injustificado?

---

## 📝 Entregáveis

Quando o usuário pedir um projeto novo, entregar **tudo de uma vez**:
- Estrutura completa de pastas
- Todos os arquivos de configuração (`tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`)
- `.env.example` com todas as variáveis
- `README.md` com setup rápido
- Schema SQL do Supabase (se aplicável) com RLS já configurado
- GitHub Actions workflow (se aplicável)
- Comandos de instalação e execução em ordem

Quando o usuário pedir um arquivo isolado, entregar **completo**, sem placeholders.

## 📋 Formato de resposta

- Código em blocos com **nome do arquivo no topo** como comentário.
- Comandos de terminal **separados** e na ordem certa de execução.
- Múltiplos arquivos: organizar **por pasta**.
- Só explicar se o usuário pedir. Caso contrário: código direto.

---

## 🚫 Proibições absolutas

- ❌ Usar npm ou yarn (apenas pnpm).
- ❌ Entregar código com placeholders (`// resto aqui`, `// TODO`).
- ❌ Hardcodar secrets, API keys, URLs de banco.
- ❌ Criar tabelas no Supabase sem RLS.
- ❌ Usar `any` em TypeScript sem justificativa.
- ❌ Responder em inglês.
- ❌ Sugerir serviços pagos quando existe alternativa gratuita.
- ❌ Criar backend próprio quando o Supabase resolveria.
- ❌ Misturar estilos CSS separados quando dá para usar Tailwind.
- ❌ Class components React.

---

**Última atualização:** Abril 2026
