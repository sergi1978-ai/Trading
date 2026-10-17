# Trading 2026 · Paper trading al servidor (configuració pendent)

**Estat: infraestructura al repositori, NO activada ni verificada en producció.** No envia ordres reals.

## Passos per activar-ho

1. Identifica el projecte Vercel de producció que desplega `sergi1978-ai/Trading`. El Vercel connectat en aquesta conversa no té visibilitat del projecte.
2. A Vercel > Project Settings > Environment Variables configura:
   - `ALPACA_API_KEY` i `ALPACA_API_SECRET` (credencials ja utilitzades pel motor d'accions).
   - `PAPER_REDIS_REST_URL` i `PAPER_REDIS_REST_TOKEN` d'una base Upstash Redis (REST API).
   - `PAPER_BASE_URL`: origen HTTPS públic del desplegament (sense barra final).
   - `CRON_SECRET`: secret aleatori fort; Vercel el passa a la tasca cron com a Bearer.
   - `PAPER_READ_TOKEN`: secret de lectura diferent, per consultar les operacions amb autorització.
3. Torna a desplegar i comprova el cron configurat a `vercel.json`: 19:00 UTC cada dia, compatible amb restriccions dels plans amb freqüència diària. Per fer comprovacions horàries en un pla compatible, canvia a `0 * * * *` i torna a desplegar.
4. Revisa a Vercel > Cron Jobs i a Function Logs si `/api/paper-cron` s'executa correctament.
5. Pots consultar resultats amb `GET /api/paper-status` i capçalera `Authorization: Bearer <PAPER_READ_TOKEN>`. No exposis el token ni l'incloguis a l'HTML.

## Com funciona

- Escaneja tandes petites i rotatòries (4 accions i 3 altcoins per execució).
- Només obre operacions simulades quan el motor web indica una entrada confirmada, amb preu recent, stop vàlid i risc acceptable.
- Conserva l'historial en Redis encara que tanquis l'iPad. Usa un bloqueig per evitar execucions simultànies.
- Detecta stops i objectius amb mostres puntuals de preu, no amb un registre continu. Una freqüència diària pot passar per alt entrades i sortides; **no és un backtest vàlid del Pine ni una mesura completa del rendiment**.
- Simula costos del 0,24% per operació tancada, amb lliscament real només aproximat pel preu mostrejat.
- No accedeix a cap compte de broker ni compra o ven actius.

## Estat de l'app

L'actual mòdul de paper trading a la interfície continua sent local i es distingeix explícitament del sistema de servidor. No fusionem dades locals amb Redis fins que existeixi un mecanisme d'autenticació segur.

## Limitacions

La càrrega de l'escàner d'Alpaca i Coinbase pot superar els límits temporals de funcions del pla. Cal comprovar la durada de les primeres execucions, errors de proveïdor i quantes operacions queden sense observar.
