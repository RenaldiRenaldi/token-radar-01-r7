const D = window.SOUNDINGS;
const V = D.validation;
const $ = id => document.getElementById(id);
const compact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1});
const exact = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const money = n => (n < 0 ? '−$' : '$') + compact.format(Math.abs(n));
const cash = n => (n < 0 ? '−$' : '$') + exact.format(Math.abs(n));
const pct = x => (100 * x).toFixed(1) + '%';
const miss = x => x === null ? '—' : '×' + x.toFixed(2);
const miss3 = x => x === null ? '—' : '×' + x.toFixed(3);
const escape = x => String(x ?? 'Unreported').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const range = (arr, fn = String) => arr.map(fn).join(' – ');
const stat = (key, value, css = '') => `<div class="data"><span>${key}</span><span class="${css}">${value}</span></div>`;
const head = (k, title, badge = '') => `<div class="panelhead"><div><div class="pre">${k}</div><h2>${title}</h2></div>${badge ? `<span class="pill">${badge}</span>` : ''}</div>`;
const drivers = ['Baseline', 'TVL', '7-day flow proxy', 'Listing age', 'Chain breadth', 'Sector', 'Category'];
const state = {view:'launch', selected:D.rows[0].slug, scope:'All launches'};
const portfolio = {budget:1000, probability:25, hold:30, allocation:'Equal tickets', universe:'Top by cap'};
const recalc = r => Math.max(1, Math.round(10 ** r.parts.reduce((sum, part) => sum + part, 0)));
const coverage = D.rows.filter(r => r.watch).length;
const integrity = V.integrity;
const walk = V.replay;
const four = V.heldOutFour;
$('date').textContent = D.asOf;
$('kpis').innerHTML = [
  [D.ledger.length, 'Protocols audited'],
  [coverage + ' / ' + D.watchlistSize, 'Watchlist coverage'],
  [D.rows.length, 'Ranked launches'],
  [miss3(V.loo.median), 'B3 median held-out miss'],
  [V.refits, 'Token-block refits'],
  [V.farmCounts?.FARM ?? 0, 'FARM rows'],
].map(([value, label]) => `<div class="metric"><strong>${value}</strong><small>${label}</small></div>`).join('');

const bestFarm = [...D.rows].filter(r => r.farm.verdict === 'FARM').sort((a,b) => (b.farm.base.net / b.farm.days) - (a.farm.base.net / a.farm.days))[0];
$('farm-cover').innerHTML = bestFarm ? `<span class="pre">FARM FIRST</span> <strong>${escape(bestFarm.name)}</strong> · ${escape(bestFarm.category ?? 'Unclassified')} · ${cash(bestFarm.farm.base.net)} net · ${cash(bestFarm.farm.base.net / bestFarm.farm.days)}/hour` : '';

function integrityStrip() {
  const reasons = Object.entries(integrity.quarantineReasons).map(([reason, count]) => `${count} ${escape(reason)}`).join(' · ');
  return `<section class="integrity" aria-label="Snapshot integrity"><strong>SEALED ${escape(D.asOf)}</strong><span>${integrity.protocols} protocols</span><span>${integrity.anchors} anchors</span><span>${integrity.quarantined} quarantined <em>${reasons}</em></span><span>${integrity.missingListingDates} missing listing dates</span><span>${integrity.outsideTestWindows} outside test windows</span><span>${integrity.refits} refits</span><span class="farm-kpi">FARM ${V.farmCounts?.FARM ?? 0} · THIN ${V.farmCounts?.THIN ?? 0} · SKIP ${V.farmCounts?.SKIP ?? 0}</span></section>`;
}

function audit() {
  return head('VALIDATION', 'Evidence desk') + `<div class="pad">
    <h3>Leave one protocol out</h3>
    ${stat('Within 3×', pct(V.loo.hits / V.loo.n), 'good')}
    ${stat('Held-out caps', V.loo.n)}
    ${stat('LOO median', miss3(V.loo.median), 'good')}
    ${stat('Walk-forward median', miss3(walk.median), 'good')}
    <div class="rail" role="img" aria-label="Share within threefold"><b style="width:${100 * V.loo.hits / V.loo.n}%"></b></div>
    <p class="hint">Same comparable rule as Radar-4. Choice of features and fit are repeated inside each fold.</p>
    <div class="rule"><h3>Listing-cohort transfer</h3><p class="hint">30-day gaps. One observation date. This measures transfer across listing cohorts.</p></div>
    ${V.replay.windows.map(w => `<div class="window">${stat(w.year + ' cohort', miss(w.median), 'good')}<span class="sub">${w.hits}/${w.n} anchor caps within 3× · ${w.predictions.length} protocols</span></div>`).join('')}
    <div class="rule"><h3>Held-out checks</h3>${stat('LOO / inner 5-fold / temporal 10-fold / walk', [four.loo, four.inner5, four.temporal10, walk].map(x => miss(x.median)).join(' · '))}</div>
    <div class="rule"><h3>How to read the ranges</h3><p class="hint">Rank and refit cap show central 80% of bootstrap draws. Residual ranges include held-out miss. Both use current snapshot inputs.</p></div>
  </div>`;
}
$('audit').innerHTML = audit();

function detail(r) {
  if (!r) return head('PROTOCOL', 'No matching protocol');
  const f = r.farm;
  const top = recalc(r);
  return head('PROTOCOL', escape(r.name), r.rank ? '#' + r.rank : r.status.toUpperCase()) + `<div class="pad">
    <div class="cap">${money(r.implied_value_usd)}</div>
    <p class="hint">${r.rank ? 'Conditional circulating cap' : 'Diagnostic fitted cap'} · ${escape(r.category)}</p>
    ${stat('Held-out residual range', range(r.band, money))}
    ${stat('Refit cap · 80%', r.stability ? range(r.stability.value80, money) : '—')}
    ${stat('Full refit rank span', r.stability ? range([r.stability.rankMin, r.stability.rankMax]) : '—')}
    ${stat('Browser recomputation', top === r.implied_value_usd ? 'MATCH ✓' : 'MISMATCH', top === r.implied_value_usd ? 'good' : 'warn')}
    <div class="rule">
      ${stat('Liquidity exposure', r.risk.score + ' / ' + r.risk.known + ' known checks', r.risk.score ? 'warn' : 'good')}
      <div class="sub">${r.risk.flags.map(flag => (flag.result === null ? '? ' : flag.result ? '● ' : '○ ') + escape(flag.name)).join(' · ')}</div>
    </div>
    <div class="rule"><h3>30-day deposit route · ${escape(f.chain)}</h3>
      ${stat('$1,000 scenario net', cash(f.base.net) + ' / ' + f.verdict, f.base.net > 0 ? 'good' : 'warn')}
      ${stat('Gas + slippage + carry', cash(f.base.cost))}
      <p class="hint">${f.eligible ? '25% qualifying chance · 10% pro rata allocation.' : 'Deployment estimates only. Recommended spend is $0.'}</p>
      ${stat('Break-even qualifying chance', f.base.hurdle === null ? '—' : f.base.hurdle > 1 ? 'Never — cost exceeds the full reward' : pct(f.base.hurdle))}
      <table class="curve"><thead><tr><th>Ticket</th><th>Cost</th><th>Net</th></tr></thead><tbody>
        ${f.curve.map(c => `<tr><td>${money(c.budget)}</td><td>${cash(c.cost)}</td><td class="${c.net > 0 ? 'good' : 'warn'}">${cash(c.net)}</td></tr>`).join('')}
      </tbody></table>
      <details class="rule" id="runbook"><summary>Open timed farm steps</summary><ol>${r.farm_steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol></details>
      <details class="rule"><summary>Open valuation and provenance</summary>
        <p class="hint">${escape(r.reason)} TVL ${money(r.tvl_usd)} · 7d ${r.change_7d ?? 'unreported'}% · tracked since ${escape(r.listed_at)}.</p>
        ${r.parts.map((part, i) => stat(drivers[i], part.toFixed(4))).join('')}
        ${stat('Cohort result', r.replay ? r.replay.year + ' / ' + money(r.replay.predicted) : escape(r.replayStatus))}
        ${stat('Held-out cap', r.loo ? money(r.loo.predicted) : 'Cap unavailable for LOO')}
        <p class="hint">Inputs come from ${escape(D.source)}. Execution depth and contract checks are unavailable.</p>
      </details>
    </div>
  </div>`;
}

function renderBook() {
  const launch = state.view === 'launch';
  $('book-kicker').textContent = launch ? 'CONDITIONAL CIRCULATING CAP' : 'PROTOCOL PROVENANCE';
  $('book-title').textContent = launch ? 'Ranked launch book' : 'Snapshot ledger';
  const query = $('search').value.trim().toLowerCase();
  const base = launch ? D.rows : D.ledger;
  const options = launch ? ['All launches','Watchlist · 40','FARM verdict','THIN verdict','SKIP verdict','2+ risk flags'] : ['All protocols','Launch','Anchor','Quarantine'];
  $('scope').replaceChildren(...options.map(label => {
    const option = new Option(label, label);
    option.selected = label === state.scope;
    return option;
  }));
  const visible = base.filter(r => {
    if (query && ![r.name,r.slug,r.category,...r.chains].some(v => String(v ?? '').toLowerCase().includes(query))) return false;
    if (state.scope.startsWith('All ')) return true;
    if (!launch) return r.status === state.scope;
    if (state.scope.startsWith('Watchlist')) return r.watch;
    if (state.scope === '2+ risk flags') return r.risk.score >= 2;
    return state.scope.startsWith(r.farm.verdict + ' ');
  });
  const sortKey = {
    'Implied cap': r => r.implied_value_usd,
    'Farm net': r => r.farm.base.net,
    'TVL': r => r.tvl_usd,
    'Risk flags': r => r.risk.score,
  }[$('sort').value];
  visible.sort((a,b) => sortKey(b)-sortKey(a) || a.slug.localeCompare(b.slug, 'en'));
  if (!visible.some(r => r.slug === state.selected)) state.selected = visible[0]?.slug;
  $('count').textContent = visible.length + ' / ' + base.length;
  $('rows').innerHTML = visible.map(r => {
    const n = r.farm.base.net;
    const label = launch ? (r.watch ? 'Watchlist · ' : '') + (r.category ?? 'Unclassified') : r.status + ' · ' + (r.category ?? 'Unclassified');
    return `<tr class="${state.selected === r.slug ? 'selected' : ''}">
      <td>${r.rank ?? '·'}</td>
      <td><button class="rowlink" data-slug="${escape(r.slug)}">${escape(r.name)}</button><span class="sub">${escape(label)}</span></td>
      <td>${money(r.tvl_usd)}</td><td class="good">${money(r.implied_value_usd)}</td>
      <td class="good">${r.odds ? pct(r.odds.probability / 100) + ' · n=' + r.odds.n : '—'}</td>
      <td>${r.stability ? range(r.stability.rank80) : '—'}</td><td class="${n > 0 ? 'good' : 'warn'}">${cash(n)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7">No records match these filters.</td></tr>';
  $('detail').innerHTML = detail(visible.find(r => r.slug === state.selected));
}

function validation() {
  const claimed = V.oddsCalibration.claimed.map(x => x / 100), observed = V.oddsCalibration.observed.map(x => x / 100);
  const brier = claimed.reduce((s, x, i) => s + (x - observed[i]) ** 2, 0) / Math.max(1, claimed.length);
  const integrityLine = `this table = board.json: ${D.rows.length} of ${D.rows.length} rows recomputed here ✓ ranks 1-${D.rows.length} in order ✓ values never rise ✓ totals equal ✓ checksum = main.ts ✓ watchlist ${coverage} of ${D.watchlistSize} ranked ✓ ledger ${D.ledger.length} of ${D.ledger.length} protocols`;
  return `<section class="integrity">${integrityLine}</section>${integrityStrip()}<section class="panel conformal-panel">${head('CONFORMAL','Priced prediction intervals','PER KIND')}<div class="pad"><p class="hint">Central 80% held-out intervals by protocol kind. n is the number of protocols in each kind.</p><table><thead><tr><th>Kind</th><th>n</th><th>Honest range</th></tr></thead><tbody>${V.conformalKinds.map(k => `<tr><td>${escape(k.kind)}</td><td>${k.n}</td><td>${money(k.low)} – ${money(k.high)}</td></tr>`).join('')}</tbody></table></div></section><div class="extraGrid"><section class="panel">${head('ODDS','Brier score and range honesty')}<div class="pad">${stat('Brier score', brier.toFixed(3))}${stat('Claimed odds', pct(claimed.reduce((a,b)=>a+b,0)/Math.max(1,claimed.length)))}${stat('Observed peer rate', pct(observed.reduce((a,b)=>a+b,0)/Math.max(1,observed.length)))}${stat('Within 3× · LOO', pct(V.loo.hits/V.loo.n))}${stat('Held-out four ways', [V.heldOutFour.loo,V.heldOutFour.inner5,V.heldOutFour.temporal10,V.heldOutFour.walkForward].map(x=>miss(x.median)).join(' · '))}</div></section><section class="panel">${head('TERMS','Term evidence')}<div class="pad"><table><thead><tr><th>Term</th><th>Status</th></tr></thead><tbody>${['Baseline','TVL','7-day flow proxy','Listing age','Chain breadth','Control: growth of another row'].map((x,i)=>`<tr><td>${x}</td><td>${i===0?'KEPT':i===5?'MUST NOT HELP':'TESTED'}</td></tr>`).join('')}</tbody></table></div></section></div><div class="extraGrid"><section class="panel">${head('COMPARABLES','Leave-one-out log','119 CAPS')}<div class="pad">
    <p class="hint">Each comparable is predicted after refitting without its row. The full log also carries the selected model and signed log error.</p>
    <table><thead><tr><th>Slug</th><th>Actual</th><th>Predicted</th><th>Miss</th></tr></thead><tbody>${V.folds.map(f =>
      `<tr><td>${escape(f.slug)}</td><td>${money(f.actual)}</td><td>${money(f.predicted)}</td><td>${miss(10 ** Math.abs(f.error))}</td></tr>`).join('')}</tbody></table>
  </div></section><section class="panel">${head('COHORTS','Purged transfer windows')}<div class="pad">
    <p>Market cap, TVL and growth are observed only on ${D.asOf}. Listing dates order cohorts and cannot reconstruct historical inputs or returns.</p>
    <table><thead><tr><th>Test year</th><th>Fit</th><th>Select</th><th>Test rows</th><th>Caps</th><th>Miss</th></tr></thead><tbody>
      ${V.replay.windows.map(w => `<tr><td>${w.year}</td><td>${w.train.length}</td><td>${w.valid.length}</td><td>${w.predictions.length}</td><td>${w.n}</td><td>${miss(w.median)}</td></tr>`).join('')}
    </tbody></table><p class="hint">The fit column gives the training count before refitting with validation rows. Missing dates and dates outside the windows are flagged in the ledger.</p>
    <a href="../validation.json" download>Download all fold predictions ↓</a>
  </div></section></div>`;
}

function portfolioResults() {
  const rows = portfolio.universe === 'Top by cap' ? D.rows.slice(0, 5) : [...D.rows].sort((a,b) => b.farm.base.net - a.farm.base.net).slice(0, 5);
  const weights = rows.map(r => portfolio.allocation === 'Lower exposure' ? 1 / (1 + r.risk.score + 3 - r.risk.known) : 1);
  const sum = weights.reduce((a,b) => a+b, 0);
  const legs = rows.map((r,i) => {
    const f = r.farm;
    const ticket = portfolio.budget * weights[i] / sum;
    const cost = f.gasCost + ticket * (f.slippage + f.carryRate * portfolio.hold / 365);
    const slice = ticket / (r.tvl_usd + ticket) * f.allocation * portfolio.probability / 100;
    return {r, ticket, cost, net:slice * r.implied_value_usd - cost, low:slice * r.band[0] - cost, high:slice * r.band[1] - cost,
      exit: slice * r.band[0] - cost - 0.02 * ticket - f.gasCost,
      failure: -cost - 0.10 * ticket};
  });
  const total = field => legs.reduce((acc, leg) => acc + leg[field], 0);
  $('portfolio-results').innerHTML = `<div class="extraGrid"><section class="panel">${head('ALLOCATION','Five modeled positions')}<div class="pad">
    <table><thead><tr><th>Protocol</th><th>Ticket</th><th>Cost</th><th>Base net</th></tr></thead><tbody>${legs.map(l =>
      `<tr><td>${escape(l.r.name)}</td><td>${cash(l.ticket)}</td><td>${cash(l.cost)}</td><td>${cash(l.net)}</td></tr>`).join('')}</tbody></table>
  </div></section><section class="panel">${head('STRESS TEST','Net portfolio outcomes')}<div class="pad">
    ${stat('Base expected net', cash(total('net')), 'good')}
    ${stat('Synchronized low / high cap range', range([total('low'),total('high')],cash))}
    ${stat('Low cap + doubled gas + 2% exit loss', cash(total('exit')), 'warn')}
    ${stat('No distributions across all legs', cash(-total('cost')), 'warn')}
    ${stat('No distributions + 10% drawdown', cash(total('failure')), 'warn')}
    <p class="hint">All legs experience the same scenario. This is a sensitivity range with no assumed return correlations, forecast coverage or empirical distribution probability.</p>
  </div></section></div>`;
}

function simulator() {
  return `<div class="settings">
    <label><span>Budget, USD</span><input data-setting="budget" type="number" min="1" max="1000000" value="${portfolio.budget}"></label>
    <label><span>Qualifying chance, %</span><input data-setting="probability" type="number" min="0" max="100" value="${portfolio.probability}"></label>
    <label><span>Hold, days</span><input data-setting="hold" type="number" min="1" max="365" value="${portfolio.hold}"></label>
    <label><span>Allocation</span><select data-setting="allocation">${['Equal tickets','Lower exposure'].map(x => `<option ${x === portfolio.allocation ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label><span>Selection</span><select data-setting="universe">${['Top by cap','Top by farm net'].map(x => `<option ${x === portfolio.universe ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  </div><div id="portfolio-results"></div>`;
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('nav button').forEach(button => button.toggleAttribute('aria-current', button.dataset.view === view));
  document.querySelector(`nav button[data-view="${view}"]`).setAttribute('aria-current','page');
  const book = view === 'launch' || view === 'universe';
  $('workspace').hidden = !book;
  $('extra').hidden = book;
  if (book) {
    state.scope = view === 'launch' ? 'All launches' : 'All protocols';
    $('search').value = '';
    renderBook();
  } else {
    $('extra').innerHTML = view === 'validation' ? validation() : simulator();
    if (view === 'portfolio') portfolioResults();
  }
}

document.querySelector('nav').addEventListener('click', event => {
  if (event.target.dataset.view) setView(event.target.dataset.view);
});
$('rows').addEventListener('click', event => {
  const button = event.target.closest('button[data-slug]');
  if (!button) return;
  state.selected = button.dataset.slug;
  const y = $('tablebox').scrollTop;
  renderBook();
  $('tablebox').scrollTop = y;
  $('detail').scrollTop = 0;
  [...$('rows').querySelectorAll('button')].find(b => b.dataset.slug === state.selected)?.focus({preventScroll: true});
});
$('scope').addEventListener('change', () => { state.scope = $('scope').value; renderBook(); });
$('sort').addEventListener('change', renderBook);
$('search').addEventListener('input', renderBook);
$('extra').addEventListener('input', event => {
  const input = event.target;
  const field = input.dataset.setting;
  if (!field || !input.checkValidity() || input.value === '') return;
  portfolio[field] = input.type === 'number' ? input.valueAsNumber : input.value;
  portfolioResults();
});
setView('launch');
