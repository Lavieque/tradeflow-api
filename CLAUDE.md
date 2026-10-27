# TradeFlow — Contexto do Projecto

## O que é

TradeFlow é um serviço SaaS **completamente independente** de scraping de produtos de marketplaces (Shein, Temu, AliExpress, Zara, etc.).

É um serviço de API que:
- Recebe URLs de produtos
- Usa Playwright (browser real) para extrair dados via intercepção de API interna
- Gere subscrições por license key com planos e créditos
- Serve qualquer site cliente — o Real Stiles é o primeiro cliente

**Não é** parte do site Real Stiles. É um produto separado.

---

## Stack

| Componente | Tecnologia |
|---|---|
| API | NestJS + TypeScript |
| Browser automation | Playwright (pool de páginas) |
| Base de dados | Firebase Firestore (projecto novo, separado do Real Stiles) |
| Imagens | Cloudinary (do cliente, não do TradeFlow) |
| Deploy | Docker no servidor próprio + Cloudflare Tunnel (`api.tradeflow.pt`) |

**Sem Redis, sem PostgreSQL, sem BullMQ** — a fila de jobs usa Firebase Firestore directamente (worker faz poll a cada 3s).

---

## Estrutura de ficheiros

```
src/
├── main.ts                       # entrada NestJS (helmet, CORS, rawBody p/ Stripe), PORT
├── app.module.ts                 # módulo raiz
├── common/types/index.ts         # tipos TypeScript
├── firebase/                     # FirebaseService — todas as operações Firestore
├── browser/                      # BrowserService — pool de páginas Playwright (stealth)
├── mail/                         # MailService — emails via Gmail (nodemailer)
├── extractors/
│   ├── base/extractor.interface.ts   # interface: canHandle + extract
│   ├── factory/extractor.factory.ts  # escolhe extractor pelo URL
│   ├── shein/                        # Shein (sidecar + fallback browser)
│   ├── sidecar/                      # marketplaces servidos pelo scraping-sidecar
│   └── claude/                       # extracção assistida por Claude
├── workers/import.worker.ts      # @Cron 3s, processa jobs pending
└── modules/
    ├── auth/auth.guard.ts        # LicenseGuard: key + store + créditos
    ├── scrape/                   # POST /scrape, GET /job/:id, /usage, /plans
    ├── admin/                    # /admin/* (x-admin-token)
    ├── registar/                 # /registar — registo público (landing)
    ├── stripe/                   # /stripe/* checkout, portal, cancel, webhook
    ├── billing/                  # cron de trials/renovações
    └── cookies/                  # /cookies — sessões/cookies p/ o sidecar
scripts/seed-plans.ts             # cria planos iniciais no Firestore
```

---

## Firebase — colecções (projecto novo)

```
accounts          # contas/tenants com license_key, plano, créditos
stores            # sites registados por conta
plans             # planos editáveis pelo admin (sem tocar no código)
jobs              # fila + resultados de scraping
logs              # audit log de todas as operações
token_resets      # histórico de resets de créditos e keys
```

---

## Modelo de licenciamento

```
1 License Key → 1 Conta → N Stores (sites)
```

- Cada request precisa de `x-license-key` + `x-store-url` nos headers
- Admin usa header `x-admin-token` (valor em env var `ADMIN_SECRET`)
- Créditos decrementados após job concluído com sucesso

### Sistema de créditos

| Operação | Custo |
|---|---|
| import | 1.0 |
| price_sync | 0.2 |
| stock_sync | 0.2 |
| translation | 2.0 |

---

## API endpoints

```
POST /scrape              # criar job (requer LicenseGuard)
GET  /job/:id             # estado + resultado (requer LicenseGuard)
GET  /usage               # créditos usados/limite (requer LicenseGuard)

GET  /admin/accounts                    # listar contas
POST /admin/accounts                    # criar conta
PUT  /admin/accounts/:id/block          # bloquear
PUT  /admin/accounts/:id/unblock        # desbloquear
PUT  /admin/accounts/:id/reset-credits  # reset créditos
PUT  /admin/accounts/:id/new-key        # nova license key
PUT  /admin/accounts/:id/plan           # mudar plano
PUT  /admin/accounts/:id/credits/add    # adicionar créditos manualmente
GET  /admin/accounts/:id/stores
GET  /admin/accounts/:id/jobs

GET  /admin/plans
PUT  /admin/plans/:id                   # criar/editar plano

GET  /admin/logs?account_id=&nivel=&limit=
GET  /admin/jobs?status=&limit=
POST /admin/jobs/:id/retry

GET  /admin/stats
```

---

## Variáveis de ambiente (.env)

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
ADMIN_SECRET=
BROWSER_POOL_SIZE=3
PORT=3000
```

---

## Deploy

- Este repo é **só a API**. Admin (`tradeflow-admin`) e landing (`tradeflow-landing`) vivem em repos próprios e consomem esta API por HTTP.
- Runtime: Docker (`Dockerfile` na raiz, instala Chromium). `docker-compose.yml` constrói a partir do GitHub e lê o `.env` do servidor.
- Exposição pública: Cloudflare Tunnel → `api.tradeflow.pt` → `localhost:3004`.
- O sidecar (scraping + noVNC) é um serviço interno separado, acedido por `SIDECAR_URL`.
- Webhook Stripe: `https://api.tradeflow.pt/stripe/webhook`.

## Extractors — princípio fundamental

**NUNCA** usar CSS selectors ou parse de HTML.

**SEMPRE** preferir:
1. Intercepção de rede — Playwright captura respostas das APIs internas
2. Variáveis globais JS (`window.gbSsrData`, `window.__INITIAL_STATE__`)
3. JSON-LD structured data
4. Meta tags OG como último recurso

### Shein (implementado)
- Intercepta `**/api/productInfo/v3/**`
- Fallback: procura `window.gbSsrData` no DOM
- Último recurso: meta tags

### A implementar (Fase 2)
- TemuExtractor — intercepta API de produto (`/api/poppy/v1/goods/detail`)
- AliExpressExtractor
- ZaraExtractor — usa API pública `/product/:id/detail.json`

---

## Planos (guardados no Firebase, editáveis pelo admin)

Estrutura do documento `plans/{id}`:
```typescript
{
  nome: string
  preco: number
  creditos_mes: number
  stores_max: number
  concorrencia: number       // jobs em paralelo (futuro)
  rate_limit: number         // requests/min por store
  fontes: MarketplaceSource[] // ex: ["shein", "aliexpress"]
  activo: boolean
}
```

Planos sugeridos: `trial`, `starter`, `pro`, `business`

---

## Relação com Real Stiles

- Real Stiles (`c:\Users\virgilio.jose\source\repos\realstiles`) é o primeiro cliente
- Usa a API do TradeFlow em `admin/importar.html` (passar a `https://api.tradeflow.pt`)
- Tem a sua própria license key e store registada
- Os produtos são guardados no Firebase do Real Stiles (projecto diferente)
- O TradeFlow apenas extrai e devolve dados — não guarda produtos

---

## Estado actual (Fase 1 MVP)

- [x] Estrutura NestJS + TypeScript
- [x] Firebase service completo
- [x] Browser pool Playwright (stealth)
- [x] SheinExtractor com intercepção de API
- [x] ExtractorFactory
- [x] LicenseGuard (license key + store + créditos)
- [x] ImportWorker (poll Firebase a cada 3s)
- [x] ScrapeModule (POST /scrape, GET /job/:id, GET /usage)
- [x] AdminModule (gestão completa de contas, planos, logs)
- [x] Dockerfile com Chromium
- [ ] npm install + build testado
- [ ] Firebase projecto criado e configurado
- [ ] Deploy atrás do Cloudflare Tunnel (api.tradeflow.pt)
- [ ] Integração com Real Stiles (admin/importar.html)
- [ ] Planos iniciais criados no Firebase
- [ ] Primeira conta (Real Stiles) criada

## Próximos passos

1. Criar projecto Firebase novo em console.firebase.google.com
2. Gerar service account key (JSON)
3. Extrair `project_id`, `client_email`, `private_key` para o `.env`
4. `npm install` na pasta tradeflow
5. `npm run start:dev` para testar localmente
6. Deploy via Docker + Cloudflare Tunnel
7. Criar planos iniciais via `PUT /admin/plans/trial` etc.
8. Criar conta Real Stiles via `POST /admin/accounts`
9. Integrar `admin/importar.html` do Real Stiles com a nova API
