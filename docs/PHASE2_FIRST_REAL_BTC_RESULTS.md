# LONG AI PROFIT v1.0 · Fase 2 — Primera prova real BTC i estat tècnic

Data: 28 d'octubre de 2026. Branca de treball: `feat/long-ai-profit-phase2-20261028` (derivada de l'auditoria de fase 1). **No desplegada a producció.**

## Arquitectura implementada

- `lib/profit-signals.js`: estratègies independents A (pullback), B (breakout retest) i C (early expansion); senyals en 1H tancada i context 4H/1D conegut a l'obertura de la barra de confirmació; font de volum autoritzada explícitament.
- `lib/profit-simulator.js`: cartera amb cash i MTM, risc objectiu 0,5% per entrada, risc obert màxim 1,5%, 3 posicions, màxim 25% de capital per actiu, comissió estimada 5 bps per costat, lliscament estimat 5 bps per costat, TP1 parcial 1,5R, TP2 3R, stop conservador, trailing després de TP1 i sortides temporals. Gaps poden superar el risc objectiu.
- `pine/LONG_AI_PROFIT_v1_0_LAB.pine`: nova estratègia independent per Strategy Tester; NO substitueix LONG AI ASSISTANT v6.6.27 ni pretén equivalència de fills amb el motor JS.
- `scripts/run-profit-lab.mjs`: replay públic de Coinbase BTC-USD, només lectura, amb dades d'1H, agregació 4H/1D i paràmetres bloquejats.

## Prova històrica real: Coinbase BTC-USD, 2026-07-01 a 2026-10-27 (dies UTC complets)

- 2.856 barres 1H, 714 de 4H i 119 de 1D.
- Aquest període va ser escollit per evitar cinc hores absents a les dades descarregades inicialment per a maig-octubre. El període juliol-octubre no tenia forats detectats. **No és una selecció per maximitzar el retorn**, però és imprescindible una futura mostra fora de mostra independent.
- Història inicial consumida per warmup dels indicadors: 65 dies aproximadament; per tant el nombre de sessions realment elegibles és menor que 119.
- Assumptions: capital inicial 10.000 USD, risc per entrada 0,5%, stop prioritzat quan stop/target es toquen dins una mateixa barra OHLC, costos d'execució simulats, màxim 7 dies, no reentrada a la mateixa barra.
- Sense ajustos de paràmetres després del test.

| Motor | Senyals | Entrades acceptades | Tancades | Retorn equity | Max DD MTM | Observacions |
|---|---:|---:|---:|---:|---:|---|
| A · Trend pullback | 3 | 2 | 2 | **-0,1825%** | 0,5028% | Profit factor 0,4494; 1 encert de 2 |
| B · Breakout retest | 0 | 0 | 0 | 0% | 0% | **Sense mostra per avaluar** |
| C · Early expansion | 5 | 2 | 1 | **+0,5194%** | 0,2564% | 1 operació oberta en la data final; retorn inclou MTM |
| Combinat, un sol BTC | 8 | 4 | 3 | **+0,3359%** | 0,5028% | 1 operació oberta; profit factor 1,6792 |

**No interpreteu el +0,3359% com a evidència de rendibilitat sostinguda.** Només hi ha 3 operacions tancades; la mostra és massa petita per inferir avantatge, taxa d'encert fiable, robustesa o resultats futurs.

## Limitacions pendents

1. Pine Strategy Tester encara **no s'ha compilat ni validat al web de TradingView**; requerirà una comprovació manual allí.
2. El JS i el Pine LAB encara tenen diferències en la definició exacta de la ruptura-retest, la gestió de les ordres i la prioritat intrabar. No es pot afirmar paritat de senyals/executions.
3. El motor de cartera encara **no s'ha integrat a `api/backtest.js` ni a la UI** de producció; les proves es fan com a scripts experimentals.
4. Aquest primer replay és d'un sol actiu; no és una prova de cartera diversificada amb tres posicions simultànies.
5. Falta incorporar accions americanes amb calendari i splits coherents i diverses criptomonedes amb liquiditat contrastable.
6. Falta walk-forward amb finestra de test reservada, stress de costos i una quantitat d'operacions suficient (criteri orientatiu ≥100 fora de mostra).
7. El simulador utilitza espelmes OHLC, no seqüències reals d'execució tick a tick; per això prioritize stops i no presumeix benefici en la mateixa barra d'entrada.
8. La gestió dinàmica de TP1/trailing en Pine necessita revisió del broker emulator amb captures d'operacions reals del Strategy Tester, no només compilació.

## Criteri de sortida de la fase 2

Codi implementat i proves unitàries automatitzades verdes. **Integració, paritat Pine i estratègia rendible: no aprovades.** Mantenir `main` intacte fins a acceptació de la fase 1 i completament del laboratori.
