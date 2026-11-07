# Migració del radar a LONG AI SWING v5.29.1

Estat: **preparació; motor de producció intacte**. Branca de treball: `feature/pine-v5291-parity`.

## Font de veritat
El Pine LONG AI SWING v5.29.1 aportat a la conversa és la font funcional. No s'ha de confondre amb el motor web anterior (pineReferenceVersion 6.6.x, score A/A+, o els proxy backtests diaris).

## Regles a reproduir
- Càlcul 1H amb context **4H i 1D tancats** (EMA20, EMA50, RSI); mercat SPY/QQQ per accions, BTC per cripto.
- Patrons A: ruptura del màxim de les 10 barres anteriors, retest de ruptura en 1–6 barres, continuació després de pullback EMA20.
- Patrons B: reclaim EMA20, RSI travessa 50, recuperació de pendent o compressió recent.
- Score A: 1D 15/8; 4H 20/10; mercat 10; trend 10; RSI 10; MACD hist/RSI creixent 10; volum 10; patró 10; ADX/DMI 5. Llindar 75.
- Score B: 1D 10; 4H 15/8; mercat 10; RSI 15; momentum 15; volum 10; patró 15; EMA20 i pendent 10. Llindar 65.
- Volum 1H relatiu SMA20: A >=1.0, B >=0.75. Cripto adaptatiu: si falta volum, confirmació amb espelma forta, momentum, ADX>=19, DI+>DI-, RSI>=50 (A) o >=48 (B), i close>EMA20.
- Cripto BTC: A amb BTC>EMA50 diària o recuperació dins del 3% + fortalesa 4H/1D i RS>=5%; B amb BTC no més del 3% sota EMA50.
- Stop: min(close - ATR*1.5 accions / ATR*2 cripto, mínim de 5 barres anteriors - 0.15 ATR). Stop màxim 3% accions / 7% cripto.
- No perseguir: distància a EMA20 en ATR <=1.6 (A), <=1.0 (B), i close>EMA20.
- Capital 15.000 EUR; risc A 0.5%, B 0.25%; exposició màxima 25%; qualitat multiplica risc 0.70/0.85/1.00; TP1 1.5R (50%), TP2 3R, BE 1.5R, trailing 2R / 2 ATR.
- **Important:** la prova R:R del Pine és tautològica (TP1 fixat a 1.5R). No presentar-la com a comprovació de resistències.

## Diferències de dades que cal resoldre abans de substituir
1. `api/scan.js` empra Alpaca IEX/SIP i calcula 4H amb possible reconstrucció; per a SPY/QQQ cal recuperar històric 1D complet i alineat. Les dades IEX no són volum consolidat.
2. `api/crypto-scan.js` empra Kraken/Coinbase, inclou 30m i té lògica antiga de `pineReferenceVersion: 6.6.20`. Cal eliminar aquesta autoritat i aplicar les noves regles a totes les sortides.
3. `api/backtest.js` és explícitament un proxy diari i **no** valida Pine 1D/4H/1H. Cal reescriure el replay amb espelmes tancades, entrada a la següent barra i stops/TP parcials.
4. `api/crypto-backtest.js`, `api/discover.js`, `api/paper-cron.js`, `index.html` han de consumir el mateix resultat del motor.
5. Comparar senyals i motius de bloqueig per BTC, SOL, INJ, ONDO, NVDA, PLTR i TEM en la mateixa font, zona horària i hora de tancament. Les diferències de feed han de quedar identificades.

## Criteris d'acceptació
- Sense falses etiquetes READY si no hi ha volum ni confirmació alternativa.
- Cap score o estat provinent de les regles 6.6.x antigues.
- Mateixa funció de decisió per llista, top, descobriment, laboratori i paper.
- Tests per patrons A/B, dades absents, filtre BTC, conversió EUR, stops i límit d'exposició.
- No fer deploy a producció fins a passar proves de regressió i comparació TradingView.
