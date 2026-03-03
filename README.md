# SmartMoney

## Desenvolvimento local

O app usa Vite no frontend e Netlify Functions no backend (`/.netlify/functions/*`).

### Opção recomendada (Pluggy/Stripe/API funcionando)
```bash
npx netlify dev --port 5174
```

### Se rodar somente `vite`
As chamadas para `/.netlify/functions/*` podem retornar `404`.
Nesse caso, configure no `.env`:

```bash
VITE_FUNCTIONS_BASE_URL=http://localhost:8888/.netlify/functions
```

## Variáveis de ambiente
Use `.env.example` como base.

### Regras críticas
- `VITE_SUPABASE_ANON_KEY` deve ser **anon key**.
- **Nunca** use `service_role` no frontend.
- `SUPABASE_SERVICE_ROLE_KEY` é apenas server-side (Netlify Functions).

## Build
```bash
npm run build
```
