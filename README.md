# Trading 2026 Radar v2.1

Versió sense TradingView Webhooks.

## Què fa
- Llegeix dades 1D, 4H i 1H directament d'Alpaca (feed IEX).
- Calcula un motor propi de Trend Score, Entry Quality, zona d'interès, trigger, stop, R:R i estats WATCH/PRE/READY/A/A+.
- Escaneja la watchlist automàticament cada 60 segons.
- Mostra sectors, dividends i una vista d'entrades imminents.

## Vercel
Mantén aquestes variables:
- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`

Ja no necessites:
- `TRADINGVIEW_WEBHOOK_SECRET`
- Upstash Redis
- Webhooks de TradingView

## Instal·lació
Substitueix al repositori:
- `index.html`
- `package.json`
- `vercel.json`
- `api/quotes.js`

Afegeix:
- `api/scan.js`

Després fes commit. Vercel farà redeploy automàtic.

## Nota
El motor v2 replica la filosofia del LONG AI ASSISTANT, però no és una còpia bit-a-bit del Pine. Els senyals són deterministes segons aquest motor i no són probabilitats de guany.


## v2.1
- Corregeix la truncació d'Alpaca quan s'escanegen molts símbols alhora.
- Les dades 1D/4H/1H es demanen en lots de 7 tickers.
- `undefined` passa a mostrar-se com `SENSE DADES` amb diagnòstic intern.
- Lookback intradia ampliat a 60 dies.


## v2.2
- Retry individual automàtic quan un ticker arriba sense prou 1D/4H/1H.
- Diagnòstic de dades: diferencia històric insuficient de limitació intradia IEX.
