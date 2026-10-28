# Diagnosi v6.6.27 a partir de captures 28/10/2026 23:21–23:22 (Madrid)

Referència: Pine complet aportat a la conversa, LONG AI ASSISTANT v6.6.27. Aquest fitxer és un **pla de correcció** per al Pine existent a TradingView; el codi original v6.6.27 no consta al repositori. NO s'ha modificat el Pine de l'usuari automàticament.

## Validació de les cinc captures (1H)

| Símbol | Estat de panell | Qualitat | Potencial | R/R mostrat | Volum 1H | Context / observació |
|---|---|---:|---:|---:|---|---|
| NASDAQ:MU | ESPERAR | 40 | 45 | 1.47R | 1.28x, TANCAT ALCISTA | 1W MIXTA, 1D/4H FEBLE. Fora d'horari regular EUA a les 22:22 UTC. |
| NYSE:UBER | ESPERAR | 30 | 10 | 2.23R | 0.84x, TANCAT ALCISTA | 1W BAIXISTA, 1D/4H FEBLE; 4H EMA20=67.73, EMA50=69.13 vs preu ~65.27. Fora de RTH. |
| NASDAQ:NVDA | ESPERAR | 55 | 55 | 2.09R | 1.84x, TANCAT ALCISTA | SETUP "SUPORT/RUPTURA OK" però no tendència 4H; EMA20=217.98, EMA50=221.22 vs ~215.41. Fora de RTH. |
| COINBASE:SOLUSD | EXP · PROP RUPTURA | 30 | 65 | 2.06R | 0.19x, EN CURS BAIXISTA | Barra cripto oberta, manca confirmació; EMA20=101.56, EMA50=102.55. NO READY. |

**Important:** a les 22:22 UTC del 28/10/2026, Nova York era a les 18:22 EDT (16:00 tancament RTH). En accions, el codi Pine fa `sessionOK=isRegular and not staleBar`, i `commonOK=contextBaseOK and sessionOK`. Per tant, les pantalles "ESPERAR" fora de sessió NO demostren per elles mateixes un error; és un fre de seguretat. Un gràfic que mostra una sessió passada o una finestra històrica i un panell actual pot donar una impressió visual confusa.

## Problemes de comunicació i possible defecte real de classificació

1. En el panell COMPACTE, `nextCompact` prioritza **tendència** abans que **sessió regular**. Així, després del tancament d'accions diu "RECUPERAR TENDENCIA" sense destacar la raó immediata "FORA HORARI". Canviar la prioritat de missatges, NO la política de compres.
2. `rrCompact` mostra `planRR` encara que `hasPlan=false` i `planCompact="SENSE PLA EXECUTABLE"`. Mostrar clarament `R/R TEORIC | NO ORDRE` per impedir que 2.23R es confongui amb un senyal vàlid.
3. `volumeCompact` a SOL és `0.19x | EN CURS | BAIXISTA`. Les lectures de volum i ruptura d'espelmes obertes NO han de presentar-se com a confirmació ni activar READY.
4. En el Pine original, `state = ... fullSignal ? (planRR >= minRR ? "READY A" : "NO PERSEGUIR") ...`, però `fullSignal` ja valida els plans **a preu de tancament** `bsValid/psValid` mentre `planRR` pot ser el càlcul d'un **pla pendent d'una altra via**. Aquest és un potencial error de classificació: substituir la validació pel R/R confirmat `buyBreak ? bsRR : buyPull ? psRR : na`. Cal provar en un conjunt de senyals abans de donar-ho per resolt.
5. Les etiquetes històriques READY/INVALIDAT no representen l'estat actual, i el panell s'actualitza fins i tot quan la finestra del gràfic està desplaçada a dates passades. Diferenciar visualment HISTÒRIC i ACTUAL.

## Patch mínim suggerit a v6.6.27 (NO aplicat al compte TradingView)

Al voltant de `fullSignal` i de `state`:

```pine
fullSignal = buySignal
confirmedSignalRR = buyBreak ? bsRR : buyPull ? psRR : na
confirmedSignalRRok = buySignal and not na(confirmedSignalRR) and confirmedSignalRR >= minRR
// A la definició de state, substituir solament la branca:
// fullSignal ? (planRR >= minRR ? "READY A" : "NO PERSEGUIR")
// per:
// fullSignal ? (confirmedSignalRRok ? "READY A" : "NO PERSEGUIR")
```

Al panell compacte, definir:

```pine
string rrCompact = not hasPlan ? (na(planRR) ? "SENSE R/R" : fmt2(planRR) + "R TEORIC | NO ORDRE") : fmt2(planRR) + "R | min " + fmt2(minRR) + "R"
string nextCompact = not sessionOK ? (staleBar ? "SENSE COTITZACIO RECENT" : isExt ? "FORA SESSIO REGULAR · EXT" : "MERCAT TANCAT") : not liquidOK ? "LIQUIDITAT INSUFICIENT" : not trendOK ? "RECUPERAR TENDENCIA" : not structureOK ? "FALTA SETUP" : not volumeOK ? "CONFIRMAR VOLUM" : not triggerOK ? "FALTA TANCAMENT" : not rrOK ? "R/R INSUFICIENT" : missing
```

En les captures de SOL no cal relaxar el filtre de volum per crear un READY. La nova v1.1 s'ha de provar amb dades històriques no utilitzades per ajustar els llindars.

## Resultat de la investigació

Els 4 valors dels panells s'han llegit manualment de les captures (no són barres futures ni backtests). Les condicions de READY i els motius d'aturada estan fonamentats en el codi Pine subministrat. **Cap dels 4 casos és una entrada READY a la captura**.

La fase 2 independent ha mostrat A/B/C sense avantatge validat en dues finestres cripto; no inferir-ne rendibilitat ni calibrar-la amb aquestes imatges. L'estratègia nova no està desplegada a TradingView ni Vercel.
