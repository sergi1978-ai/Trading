# BTC/USD · Contrastre real d'espelmes Alpaca Crypto US

Data de l'auditoria: 28 d'octubre de 2026. Símbol `BTC/USD`, feed `us` d'Alpaca Crypto. Dies complets en horari UTC: 23, 24, 25 i 26 d'octubre de 2026.

## Comparació real
El connector Alpaca ha retornat espelmes natives `1Min`, `1Hour`, `4Hour` i `1Day`. Cada barra reconstruïda s'ha comparat amb la barra nativa del **mateix feed** i el **mateix timestamp UTC**.

| Dia UTC | Minuts observats / 1440 | Minuts amb volum 0 | 1H OHLC coincidents | 4H OHLC coincidents | 1D OHLC coincident |
|---|---:|---:|---:|---:|---|
| 2026-10-23 | 1440 | 964 | 24/24 | 6/6 | Sí |
| 2026-10-24 | 1433 | 1003 | 24/24 | 6/6 | Sí |
| 2026-10-25 | 1440 | 1069 | 24/24 | 6/6 | Sí |
| 2026-10-26 | 1440 | 1027 | 24/24 | 6/6 | **No: tancament** |

Resultat global: **96/96 1H** i **24/24 4H** coincideixen en O/H/L/C. Les sumes dels volums d'1 minut coincideixen amb el volum natiu diari fins a la precisió de coma flotant en tots quatre dies; els comptadors d'operacions també coincideixen.

### Discrepància del 26 d'octubre
- Tancament a les 23:59 UTC de la barra nativa `1Min`: **80011.435 USD**.
- Tancament de les barres natives `1Hour` (23:00 UTC) i `4Hour` (20:00 UTC): **80011.435 USD**.
- Tancament natiu `1Day` del 26-10: **80007.24 USD**.
- Diferència exacta: **4.195 USD** (aprox. 0.0052%).
- Aquest desajust no s'ha corregit, arrodonit ni ignorat.

### Qualitat del volum
- Bars d'1 minut amb volum zero: **67%–74%** aproximadament.
- Volum total del feed `us` en cadascun dels dies: 1.451044713 BTC, 1.425781622 BTC, 0.790055233 BTC i 1.295915362 BTC.
- Són xifres pròpies del feed consultat, **no representen el volum global de BTC** i no s'han d'interpretar com a liquiditat mundial.
- Les regles de volum relatiu dels motors LONG AI PROFIT **NO es validen** amb aquest conjunt; requereixen un feed de mercat fiable i coherent per a l'exchange o mercat on s'executin les operacions.

### Comparació 4H
- A Alpaca Crypto `us`, les barres 4H d'aquesta mostra comencen a **00:00, 04:00, 08:00, 12:00, 16:00 i 20:00 UTC**.
- Això coincideix amb la convenció BTC 24/7 UTC definida per a LONG AI PROFIT.
- **No verifica encara la paritat amb Pine**: cal confirmar el símbol concret (exchange), el feed i la zona horària de la gràfica TradingView.

## Decisions
1. Usar la reconstrucció de `1Min` com a font principal per a comparacions temporals a cripto, amb finestres UTC i control d'espelmes tancades.
2. Registrar la discrepància diària del 26/10 com a incidència de paritat; impedir que una igualtat de preus oculti el desajust.
3. No utilitzar el volum d'aquest feed d'Alpaca com a prova de confirmació d'entrada o de liquiditat.
4. No fer merge a `main`, ni desplegar, ni activar paper trading només amb aquesta prova de quatre dies.
5. Executar el contrast reproduïble sobre més dies i altres proveïdors (Coinbase/Kraken) abans de qualificar el motor com a validat.

## Font de les dades
Connector connectat Alpaca: `get_crypto_bars`, símbol `BTC/USD`, `feed=us`, `tz=UTC`, temporalitats `1Min`, `1Hour`, `4Hour`, `1Day`. Consultes realitzades el 28/10/2026.
