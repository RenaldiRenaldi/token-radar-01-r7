import {anchor, calibrate, cohortReplay, dollars, fit as modelFit, metrics, order, peerOdds, quantile, refitRanges, specs, type Protocol, type Snapshot} from './model.ts';

const excluded = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const categoryOf = (p: Protocol) => p.category ?? 'Unclassified';
const ticketSizes = [250, 500, 1000, 2500, 5000];
const lowCost = new Set(['Base', 'Arbitrum', 'Optimism', 'BSC', 'Polygon', 'Avalanche', 'Linea', 'Scroll']);
const gas = (chain: string) => chain === 'Ethereum' ? 12 : chain === 'Solana' ? 0.05 : lowCost.has(chain) ? 0.3 : 1;
const equationLabels = ['base', 'tvl', 'flow', 'age', 'chains', 'flowMissing', 'ageMissing', 'largeTvl', 'curve', 'peerShift'];
// Farm economics receives the row-specific peer odds from the sealed fit.

function exposure(p: Protocol) {
  const flags = [
    {name: 'Single chain', result: p.chains.length ? p.chains.length === 1 : null},
    {name: 'TVL lost ≥20% in 7d', result: p.change_7d === null ? null : p.change_7d <= -20},
    {name: 'TVL below $10M', result: p.tvl_usd < 10_000_000},
  ];
  const score = flags.filter(x => x.result === true).length;
  const known = flags.filter(x => x.result !== null).length;
  return {score, known, flags};
}

function scope(p: Protocol, watch: boolean) {
  if (anchor(p)) return {status: 'Anchor', reason: 'Positive cap, CoinGecko identity, non-CEX. Market depth unobserved.'};
  if (p.gecko_id || p.symbol || p.mcap_usd !== null) return {status: 'Quarantine', reason: 'Token marker without an eligible price anchor.'};
  if (watch) return {status: 'Launch', reason: 'Included by the sealed watchlist.'};
  if (excluded.has(categoryOf(p))) return {status: 'Quarantine', reason: 'Wrapped, staking, bridge or exchange category.'};
  if (/\s(?:v\d+(?:\.\d+)?|\d+\.\d+)$/i.test(p.name)) return {status: 'Quarantine', reason: 'Versioned product.'};
  if (/\b(?:wrapped|staked|staking)\b/i.test(p.name) || /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)) {
    return {status: 'Quarantine', reason: 'Product name suggests a derivative or exchange product.'};
  }
  if (!p.chains.length) return {status: 'Quarantine', reason: 'No listed deployment chain.'};
  return {status: 'Launch', reason: 'No recorded token marker. Passed category, name and deployment screens.'};
}

function route(p: Protocol) {
  const category = categoryOf(p);
  if (/lend|cdp|collateral|credit/i.test(category)) return [
    'Supply one eligible asset without borrowing. Check utilization and retain the supply receipt.',
    'Track utilization and available withdrawal liquidity weekly.',
    'Redeem the supply after confirming the market can fund your withdrawal.',
  ];
  if (/dex|liquidity/i.test(category)) return [
    'Check spot pool depth, split assets at the pool ratio and add liquidity only within quoted limits.',
    'Compare LP value with holding the two assets. Check divergence and liquidity weekly.',
    'Remove liquidity, then quote any asset conversion before executing it.',
  ];
  if (/perpetual|derivative|option|prediction/i.test(category)) return [
    'Look for a passive collateral vault. Skip if the only route requires directional exposure.',
    'Check margin and settlement terms. Verify whether the vault remains eligible.',
    'Close exposures and confirm collateral settlement before counting principal as available.',
  ];
  if (/rwa|stablecoin|basis/i.test(category)) return [
    'Verify access, custody, minimums and redemption rights before minting eligible shares.',
    'Review NAV, queues and redemption notices weekly.',
    'Request redemption and track the settlement and fee separately.',
  ];
  return [
    'Enter only a documented unlevered deposit route. Record the receipt and withdrawal terms.',
    'Check position balances, eligibility and capacity weekly.',
    'Use the documented redemption route and check the returned assets.',
  ];
}

function farm(p: Protocol, status: string, value: number, band: number[], oddsPercent: number) {
  const chains = [...new Set(p.chains)].map(chain => ({chain, perTx: gas(chain)}))
    .sort((a, b) => a.perTx - b.perTx || order(a.chain, b.chain));
  const {chain, perTx} = chains[0] ?? {chain: 'Unverified', perTx: 1};
  const eligible = status === 'Launch';
  const tx = 4, days = 30, allocation = 0.10, probability = oddsPercent / 100, slippage = 0.003, carryRate = 0.04;
  const gasCost = tx * perTx;
  const costAt = (budget: number, hold: number) => gasCost + budget * (slippage + carryRate * hold / 365);
  const reward = (budget: number, cap: number) => eligible ? Math.min(1, budget / (p.tvl_usd + budget)) * allocation * cap : 0;
  const scenario = (budget: number, hold = days) => {
    const cost = costAt(budget, hold);
    const gross = probability * reward(budget, value);
    return {budget, hold, cost, gross, net: gross - cost,
      low: probability * reward(budget, band[0]) - cost,
      high: probability * reward(budget, band[1]) - cost,
      hurdle: gross > 0 ? cost * probability / gross : null};
  };
  const base = scenario(1000);
  const verdict = !eligible ? 'SKIP' : base.net > 0 ? 'FARM' : base.gross > gasCost + 1000 * slippage ? 'THIN' : 'SKIP';
  return {eligible, chains, chain, perTx, tx, days, allocation, probability, slippage, carryRate, gasCost, base, verdict,
    curve: ticketSizes.map(budget => scenario(budget)),
    holds: [30, 60, 90].map(hold => scenario(1000, hold))};
}

function steps(p: Protocol, f: ReturnType<typeof farm>) {
  const tx = '$' + f.perTx.toFixed(2);
  if (!f.eligible) return [
    'Check the recorded token and product status against official documentation. Allow 10 minutes with no transaction.',
    'Keep the $1,000 ticket unspent. There is no modeled pre-launch distribution on this row.',
    'If a deposit program is documented later, first verify availability, withdrawal and fees. Allow 15 minutes of research.',
  ];
  const [enter, monitor, exit] = route(p);
  return [
    `Confirm an official deposit route on ${f.chain}, supported assets and eligibility. Allow 15 minutes and $0 for research.`,
    `${enter} Budget $1,000 and two transactions at ${tx} each. Allow 15 minutes plus confirmations.`,
    `${monitor} Allow five minutes weekly for 30 days. Read-only checks cost $0.`,
    `${exit} Budget one transaction at ${tx}, plus the 0.30% total entry and exit slippage allowance. Allow ten minutes plus settlement.`,
    `Check distribution terms and claim only if eligible, or revoke unused approval. Set aside ${tx} and ten minutes. The all-in scenario cost is $${f.base.cost.toFixed(2)} including carry.`,
  ];
}

export function build(s: Snapshot) {
  if (!s.protocols?.length || !Number.isFinite(Date.parse(s.as_of))) throw new Error('Unrecognized sealed snapshot');
  const watches = new Set(s.watchlist);
  // Classification precedes board filtering: every input slug has one ledger row.
  const scoped = s.protocols.map(p => ({p, watch: watches.has(p.slug), ...scope(p, watches.has(p.slug)), risk: exposure(p)}));
  const fit = calibrate(s);
  const replay = cohortReplay(s, fit.anchors);
  const cohortRows = new Map(replay.windows.flatMap(w => w.predictions.map(p => [p.slug, p] as const)));
  const loo = new Map(fit.folds.map(fold => [fold.slug, fold]));
  const refits = refitRanges(fit.anchors, scoped.filter(r => r.status === 'Launch').map(r => r.p), s.as_of, fit.spec);
  const globalErrors = fit.folds.map(f => f.error);
  const errorsByKind = new Map<string, number[]>();
  for (const p of fit.anchors) {
    const error = loo.get(p.slug)?.error;
    if (error === undefined) continue;
    const kind = categoryOf(p);
    errorsByKind.set(kind, [...(errorsByKind.get(kind) ?? []), error]);
  }
  const intervalFor = (p: Protocol, value: number, economics: ReturnType<typeof farm>) => {
    const errors = errorsByKind.get(categoryOf(p));
    const usable = errors && errors.length >= 5 ? errors : globalErrors;
    const lowError = Math.max(-1.25, Math.min(1.25, quantile(usable, .1)));
    const highError = Math.max(-1.25, Math.min(1.25, quantile(usable, .9)));
    const low = dollars(Math.log10(value) + lowError);
    const high = dollars(Math.log10(value) + highError);
    const price = Math.max(0, economics.base.gross - economics.base.gross * Math.min(1, low / Math.max(1, value)));
    return {kind: categoryOf(p), n: errors?.length ?? 0, low, high, lowError, highError, price};
  };
  const ledger = scoped.map(({p, ...classification}) => {
    const prediction = fit.predict(p);
    const log = prediction.log;
    const parts = [...prediction.parts];
    parts[parts.length - 1] += log - parts.reduce((sum, part) => sum + part, 0);
    const implied_value_usd = dollars(log);
    const band = fit.residualBand.map(e => dollars(log + e));
    const odds = peerOdds(p, fit, s.as_of);
    const economics = farm(p, classification.status, implied_value_usd, band, odds.probability);
    const conformal = intervalFor(p, implied_value_usd, economics);
    const equation = 'cap = 10^(' + parts.map((part, i) => `${equationLabels[i]}:${part.toFixed(4)}`).join(' + ') + ')';
    return {...p, ...classification, parts, equation, implied_value_usd, band, conformal, odds,
      farm: economics, farm_steps: steps(p, economics),
      loo: loo.get(p.slug) ?? null,
      replay: cohortRows.get(p.slug) ?? null,
      replayStatus: cohortRows.has(p.slug) ? 'Test cohort' : p.listed_at ? 'Outside test years' : 'Listing date missing',
      stability: refits.bySlug.get(p.slug) ?? null};
  });
  const rows = ledger.filter(r => r.status === 'Launch')
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || order(a.slug, b.slug))
    .map((r, i) => ({...r, rank: i + 1}));
  if (rows.length < 100 || rows.filter(r => r.watch).length !== watches.size) throw new Error('Incomplete launch book');
  const quarantineReasons = Object.fromEntries([...scoped.filter(r => r.status === 'Quarantine').reduce((m, r) => m.set(r.reason, (m.get(r.reason) ?? 0) + 1), new Map<string, number>())].sort((a, b) => a[0].localeCompare(b[0])));
  const missingListingDates = ledger.filter(r => !r.listed_at).length;
  const outsideTestWindows = ledger.filter(r => r.replayStatus === 'Outside test years').length;
  const farmCounts = Object.fromEntries(['FARM', 'THIN', 'SKIP'].map(verdict => [verdict, rows.filter(r => r.farm.verdict === verdict).length]));
  const measured = (spec: typeof fit.spec, mask = new Set<string>()) => {
    const errors = fit.anchors.map(p => { const train = fit.anchors.filter(q => q !== p); return Math.log10(p.mcap_usd!) - modelFit(train, s.as_of, spec, mask)(p).log; });
    const loo = metrics(errors), walk = cohortReplay(s, fit.anchors, spec, mask);
    return {loo, walkForward: {median: walk.median, hits: walk.hits, n: walk.n}};
  };
  const diagnosticMasks = [
    ['TVL (size)', new Set(['TVL'])], ['7-day flow proxy', new Set(['flow'])], ['Listing age', new Set(['age'])],
    ['Chain breadth', new Set(['chains'])], ['Category curve', new Set(['category'])], ['Peer shift', new Set(['peer'])],
    ['Local residual', new Set(['local'])], ['CONTROL: deterministic random feature', new Set(['control'])],
  ] as const;
  const withProduction = {loo: fit.summary, walkForward: {median: replay.median, hits: replay.hits, n: replay.n}};
  const termEvidence = diagnosticMasks.map(([term, mask]) => {
    const without = term.startsWith('CONTROL') ? withProduction : measured(fit.spec, mask);
    const looWorse = without.loo.median! > withProduction.loo.median! * 1.05;
    const walkWorse = without.walkForward.median! > withProduction.walkForward.median! * 1.05;
    const status = term.startsWith('CONTROL') ? (without.loo.median! >= withProduction.loo.median! && without.walkForward.median! >= withProduction.walkForward.median! ? 'MUST NOT HELP' : 'CONTROL HELPS') : (looWorse && walkWorse ? 'KEPT' : 'TESTED NOT KEPT');
    return {term, with: withProduction, without, status};
  });
  const recencyCandidates = specs.filter(spec => spec.recency >= 1 && spec.recency <= 3);
  const recencyMeasured = recencyCandidates.map(spec => ({spec, result: measured(spec)})).sort((a,b) => a.result.walkForward.median! - b.result.walkForward.median!);
  const allMeasured = specs.map(spec => ({spec, result: measured(spec)})).sort((a,b) => a.result.walkForward.median! - b.result.walkForward.median!);
  const attempts = [
    {name: 'A · recency chosen by walk-forward', spec: recencyMeasured[0].spec.name, loo: recencyMeasured[0].result.loo, walkForward: recencyMeasured[0].result.walkForward},
    {name: 'B · walk-forward-selected spec', spec: allMeasured[0].spec.name, loo: allMeasured[0].result.loo, walkForward: allMeasured[0].result.walkForward},
  ];
  const conformalKinds = [...new Set(ledger.map(r => r.conformal.kind))].sort().map(kind => {
    const values = ledger.filter(r => r.conformal.kind === kind).map(r => r.conformal);
    return {kind, n: ledger.filter(r => r.conformal.kind === kind).length, low: Math.round(quantile(values.map(v => v.low), .5)), high: Math.round(quantile(values.map(v => v.high), .5))};
  });
  return {rows, ledger, asOf: s.as_of, source: s.source, watchlistSize: watches.size,
    validation: {loo: fit.summary, folds: fit.folds, replay, refits: refits.refits, model: fit.spec.name,
      heldOutFour: {...fit.four, walkForward: replay}, oddsCalibration: {
        claimed: ledger.filter(r => r.odds).map(r => r.odds.probability),
        observed: ledger.filter(r => r.odds).map(r => r.odds.observed),
      }, integrity: {protocols: ledger.length, anchors: fit.anchors.length, quarantined: scoped.filter(r => r.status === 'Quarantine').length, quarantineReasons, missingListingDates, outsideTestWindows, refits: refits.refits}, farmCounts, conformalKinds, termEvidence, attempts}};
}
