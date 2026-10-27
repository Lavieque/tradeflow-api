# TradeFlow API

API NestJS de scraping de produtos de marketplaces (Shein, Temu, AliExpress, Zara…) com licenciamento por license key, planos e créditos. Dados em Firebase Firestore, pagamentos via Stripe.

Admin e landing vivem noutros repos e consomem esta API:
`tradeflow-admin` → `admin.tradeflow.pt` · `tradeflow-landing` → `tradeflow.pt` · API → `api.tradeflow.pt`.

## Desenvolvimento

```bash
cp .env.example .env     # preencher valores
npm ci
npm run start:dev        # http://localhost:3004
npm run typecheck
```

## Deploy (Docker)

No servidor, numa pasta com o `.env` e o `docker-compose.yml`:

```bash
docker compose build --no-cache && docker compose up -d
docker logs --tail 30 tradeflow-api
```

Expor com Cloudflare Tunnel: `api.tradeflow.pt` → `http://localhost:3004`.

## Endpoints principais

| Rota | Auth |
|---|---|
| `POST /scrape`, `GET /job/:id`, `GET /usage` | `x-license-key` + `x-store-url` |
| `GET /plans`, `POST /registar` | públicas |
| `/admin/*` | `x-admin-token` (`ADMIN_SECRET`) |
| `POST /stripe/webhook` | assinatura Stripe (`STRIPE_WEBHOOK_SECRET`) |

Detalhes de arquitetura, créditos e planos em [CLAUDE.md](CLAUDE.md).
