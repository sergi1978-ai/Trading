# Trading 2026 Radar

Web dashboard amb preus reals d'Alpaca (IEX) i seguiment manual dels senyals del LONG AI ASSISTANT.

## Vercel
1. Importa aquesta carpeta/projecte a Vercel.
2. A Settings > Environment Variables afegeix:
   - ALPACA_API_KEY
   - ALPACA_API_SECRET
3. Deploy.

Les claus només s'utilitzen al backend `/api/quotes`; no s'exposen al navegador.

## Ús
- `Actualitza preus` refresca quotes d'Alpaca.
- Fes doble clic / edita les cel·les Estat, Entry Q., Trigger, Edat, Stop i R:R.
- Les dades editades es desen al navegador via localStorage.
- La pestanya `Propers a entrada` ordena per A+/A/READY/PRE/WATCH i proximitat al trigger.
