// Primera fitxa: xifres XBRL de KTOS, directament de la SEC.
const CIK = '0001069258';
const URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`;
const tags = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  netIncome: ['NetIncomeLoss'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  debtCurrent: ['LongTermDebtCurrent'],
  debtLong: ['LongTermDebtNoncurrent', 'LongTermDebt']
};

function latest(facts, names, kind, periodEnd) {
  const points = names.flatMap(name => facts?.[name]?.units?.USD || []);
  const eligible = points.filter(p =>
    ['10-Q', '10-K'].includes(p.form) && p.end === periodEnd &&
    Number.isFinite(p.val) &&
    (kind === 'instant' ? !p.start : !!p.start &&
      (new Date(p.end) - new Date(p.start)) / 86400000 >= 60 &&
      (new Date(p.end) - new Date(p.start)) / 86400000 <= 110)
  );
  eligible.sort((a,b) => b.filed.localeCompare(a.filed));
  return eligible[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  if (String(req.query.symbol || '').toUpperCase() !== 'KTOS')
    return res.status(404).json({error:'Fitxa empresarial encara no disponible per a aquest ticker'});
  if (!process.env.SEC_USER_AGENT)
    return res.status(503).json({error:'Cal configurar SEC_USER_AGENT a Vercel'});
  try {
    const response = await fetch(URL, {headers:{'User-Agent':process.env.SEC_USER_AGENT, Accept:'application/json'}});
    if (!response.ok) throw new Error(`SEC HTTP ${response.status}`);
    const data = await response.json();
    const us = data.facts?.['us-gaap'];
    const periods = (us?.Assets?.units?.USD || []).filter(p =>
      ['10-Q','10-K'].includes(p.form) && !p.start && p.filed && p.end <= new Date().toISOString().slice(0,10)
    ).sort((a,b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed));
    const period = periods[0];
    if (!period) throw new Error('Cap període comptable recent disponible');
    const values = Object.fromEntries(Object.entries(tags).map(([key, names]) =>
      [key, latest(us, names, key.startsWith('debt') || key === 'cash' ? 'instant' : 'quarter', period.end)?.val ?? null]
    ));
    // Deute total només si disposem de tots dos components; no barregem etiquetes alternatives.
    const debt = Number.isFinite(values.debtCurrent) && Number.isFinite(values.debtLong)
      ? values.debtCurrent + values.debtLong : null;
    return res.status(200).json({symbol:'KTOS', name:data.entityName, periodEnd:period.end,
      filed:period.filed, form:period.form, revenueQuarter:values.revenue,
      netIncomeQuarter:values.netIncome, cash:values.cash, debt,
      source:URL, note:'Ingressos i benefici del trimestre; caixa i deute al tancament del període. Xifres USD, sense ajustaments.'});
  } catch (error) {
    return res.status(502).json({error:'No s’han pogut verificar les dades de la SEC', detail:error.message});
  }
}
