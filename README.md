# SmartMoney

## Desenvolvimento local

O app usa Vite no frontend e Netlify Functions no backend (`/.netlify/functions/*`).

### Opção recomendada (funciona Pluggy/Stripe/local API)
```bash
npx netlify dev --port 5174
```

### Se rodar somente `vite`
As chamadas para `/.netlify/functions/*` podem retornar `404`.
Nesse caso, configure no `.env`:

```bash
VITE_FUNCTIONS_BASE_URL=http://localhost:8888/.netlify/functions
```

(ou a URL do backend serverless que estiver em execução).

## Build
```bash
npm run build
```
