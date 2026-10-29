# LONG AI PROFIT v1.6.1 LAB — per què v1.6 no generava ordres (29/10/2026)

**Estat:** experiment de diagnòstic. No profitabilitat confirmada. No integració a Trading 2026 ni cap ordre real.

## Reproducció independent parcial del coll d'ampolla

S'ha reconstruït el conjunt de filtres de LONG AI v1.6 en JavaScript, sobre Binance BTCUSDT Spot (1H, 4H, 1D històriques), per a barres 1H entre 2026-07-01 i 2026-10-28 inclosos. Context 4H/diari de barres TANCADES; dades 4H des d'abril i diàries des de gener 2025. La reproducció és una **aproximació independent** d'indicadors EMA, RSI, ATR, ADX/DMI, MACD i volume, NO paritat matemàtica/execució validada de Pine.

Resultat de l'embut seqüencial de C CONTINUACIO, 2.860 espelmes 1H de la finestra:
- 450 barres amb règim complet després de filtres 1D, 4H, força, liquiditat i extensió.
- 270 barres també amb base de 8x1H vàlida.
- 15 també amb ruptura/volum/RSI confirmats.
- 15 amb stop de geometria vàlida (mida <=8%).
- 4 amb mínim R/R net 1,70 després de la reserva de costos.
- **0** amb la resistència 60D 2R original, encara que hi havia 4 candidates després de stop/fees.

Això explica per què la v1.6 podria no generar cap ordre al BTCUSDT 1H. **No prova** que les quatre operacions excloses haguessin estat guanyadores ni que el motiu sigui exactament el mateix en un altre exchange/període.

## Canvis controlats

Fitxer nou `pine/LONG_AI_PROFIT_v1_6_1_DIAGNOSTIC.pine`. No substitueix la v1.6 original, que queda congelada.

- Nou selector: `Resistencia 60D (comparacio)`.
  - `ESTRICTA (v1.6)`: manté el veto original d'almenys 2R de recorregut fins al màxim dels 60 dies anteriors; control.
  - `INFORMATIVA (LAB)`: exposa **els conflictes** de resistència al panell però NO exclou la compra per aquest filtre. Hipòtesi exploratòria, no recomanació d'ignorar resistències.
- NO s'alteren les condicions C i B, els llindars RSI/ADX/MACD/RVOL, la gestió del risc 0,5%, la cap 25%, l'stop estructural ni el TP teòric 2R.
- Es manté la condició mínima `netRR >= 1.70` (relació teòrica ajustada per reserva estimada).
- S'amplia la data final de prova per defecte a 2030-01-01 UTC perquè el 2026-10-29 00:00 UTC original ja s'havia acabat quan l'usuari provava la v1.6. Aquesta data no crea dades futures ni validació OOS automàtica.
- El panell separa **senyals abans del filtre de risc**, **candidats nets acceptables**, **conflictes de resistència**, **ordres tramitades**, **executades** i **caducades sense omplir**. Els comptadors són diferents: una proposta no equival a una compra.
- Marques gràfiques: cercle taronja = senyal abans de la validació final; triangle verd = ordre candidata, no execució confirmada.
- L'entrada continua sent **stop-limit** (trigger = màxim de la barra del senyal + mínim tick; límit = trigger + 0,20 ATR 4H). Pot haver-hi senyals/ordres sense fills a TradingView si el preu no torna al límit; no cal alterar-lo sense revisar el registre de fills.

## Protocol de prova

1. A TradingView, obrir `BINANCE:BTCUSDT` en 1H, veles normals, capital 10k USD, mateixa comissió i slippage; enganxar el Pine v1.6.1 a un script NOU.
2. Provar primer `C · CONTINUACIO` amb `ESTRICTA (v1.6)`, comprovar zero/poques ordres i el comptador de conflictes. Després canviar **només** `INFORMATIVA (LAB)`, sense tocar dates, actiu o altres propietats.
3. Comparar `SENYALS / RR NET`, `CONFLICTES 60D`, `TRAMITADES / EXEC.`, `CADUCADES / TANCADES`. Si `TRAMITADES > 0` i `EXEC. = 0`, el problema és EXECUCIÓ stop-limit/caducitat, no absència de senyals.
4. Repetir després amb B RUPTURA-RETEST i ETH/SOL. No sumar els retorns de motors de forma retroactiva.
5. Guardar resultat net, profit factor, drawdown, n posicions, no només senyals. Fer proves de costos ×2 i validació prospectiva sense modificar presets a partir dels resultats revisats.
6. Compilar a Pine Editor: les proves Node de GitHub NO són el compilador de Pine. No fusionar ni desplegar l'app Trading 2026 sense paritat 1H/4H/1D i d'ordres.

## Resultat exigible

Que el mode exploratori generi més ordres **no és èxit de trading**. Requereix resultat net positiu després de costos, robustesa fora de mostra i suficients posicions independents; si no, descartar la hipòtesi.

Docs TradingView:
- https://www.tradingview.com/pine-script-docs/concepts/strategies/
- https://www.tradingview.com/pine-script-docs/faq/strategies/
