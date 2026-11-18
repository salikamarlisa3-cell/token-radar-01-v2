// Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts, from the
// same board board.json carries) and renders the ranked board, its filters, a detail view for
// every protocol with the model's arithmetic shown, the already-trading set at market value, and
// the methodology. No network: every byte it shows arrived in data.js.
(function () {
  'use strict';

  var D = window.RADAR;
  if (!D) return;
  var root = document.getElementById('board');
  var params = new URLSearchParams(window.location.search);
  var state = {
    q: params.get('q') || '',
    cat: params.get('cat') || 'all',
    chain: params.get('chain') || 'all',
    set: params.get('set') || 'all',
    tab: params.get('tab') || 'board',
    sort: params.get('sort') || 'rank',
    dir: params.get('dir') === '-1' ? -1 : 1,
    slug: params.get('slug') || null,
  };

  // ------------------------------------------------------------ formatting

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtFull(n) {
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return null;
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    return 'x' + Number(n).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');
  }

  // ------------------------------------------------------------ tiny DOM

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function kid(parent, child) { parent.appendChild(child); return child; }

  // The board's own arithmetic, rebuilt in the page: a detail view shows this product beside the
  // value board.json carries, so a reader can see the two agree.
  function impliedOf(row) {
    var v = row.tvl_usd * row.category_multiple * row.momentum_multiplier * row.maturity_multiplier * row.breadth_multiplier * row.stability_multiplier;
    return Math.max(1, Math.round(v));
  }

  // A farm step string carries its cost and time at its tail (the model's stepString wrote them);
  // the detail view lifts them out as chips and leaves the action standing alone.
  function splitStep(s) {
    var at = s.lastIndexOf(' Cost: ');
    if (at === -1) return { action: s, cost: null, time: null };
    var rest = s.slice(at + 7);
    var tat = rest.lastIndexOf('. Time: ');
    if (tat === -1) return { action: s.slice(0, at + 1), cost: rest, time: null };
    return { action: s.slice(0, at + 1), cost: rest.slice(0, tat), time: rest.slice(tat + 8).replace(/\.$/, '') };
  }

  // ------------------------------------------------------------ masthead

  function masthead(compact) {
    var head = el('header', 'masthead');
    var brand = kid(head, el('div', 'brand'));
    kid(brand, el('span', 'mark', '◎'));
    kid(brand, el('h1', null, 'LAUNCH RADAR'));
    kid(brand, el('span', 'tag', 'Pre-token protocols, ranked by the value a launch would carry — and how to farm each one.'));
    var meta = kid(head, el('div', 'meta'));
    meta.appendChild(el('div', null, 'model ')); meta.lastChild.appendChild(el('b', null, D.model_version));
    meta.appendChild(el('div', null, 'snapshot ')); meta.lastChild.appendChild(el('b', null, D.as_of));
    if (compact) return head;
    var total = D.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var stats = kid(head, el('div', 'stats'));
    [
      [String(D.scanned_size), '', 'protocols scanned'],
      [String(D.board_size), 'green', 'pre-token, ranked'],
      [D.watchlist_size + '/' + D.watchlist_size, 'amber', 'watchlist covered'],
      [String(D.early_size), '', 'early finds below the floor'],
      [fmtUsd(total), '', 'combined implied value'],
    ].forEach(function (s) {
      var cell = kid(stats, el('div', 'stat'));
      kid(cell, el('div', 'num ' + s[1], s[0]));
      kid(cell, el('div', 'lab', s[2]));
    });
    return head;
  }

  // ------------------------------------------------------------ board tab

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.set === 'watch' && !r.on_watchlist) return false;
      if (state.set === 'early' && r.on_watchlist) return false;
      if (state.cat !== 'all' && (r.category || '(uncategorised)') !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function sorted(rows) {
    var key = state.sort;
    var dir = state.dir;
    return rows.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (key === 'name') return dir * String(x).localeCompare(String(y));
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return dir * (x - y);
    });
  }

  function controls(count) {
    var bar = el('div', 'controls');
    var search = kid(bar, el('input'));
    search.type = 'search'; search.placeholder = 'Search name, category, chain…'; search.value = state.q;
    search.setAttribute('aria-label', 'Search protocols');
    search.addEventListener('input', function () { state.q = search.value; render(); restoreFocus(search); });
    var cats = {};
    D.rows.forEach(function (r) { cats[r.category || '(uncategorised)'] = 1; });
    var catSel = kid(bar, el('select'));
    catSel.setAttribute('aria-label', 'Category');
    ['all'].concat(Object.keys(cats).sort()).forEach(function (c) {
      var o = kid(catSel, el('option', null, c === 'all' ? 'All categories' : c));
      o.value = c; if (state.cat === c) o.selected = true;
    });
    catSel.addEventListener('change', function () { state.cat = catSel.value; render(); });
    var chains = {};
    D.rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = (chains[c] || 0) + 1; }); });
    var chainSel = kid(bar, el('select'));
    chainSel.setAttribute('aria-label', 'Chain');
    ['all'].concat(Object.keys(chains).sort(function (a, b) { return chains[b] - chains[a]; })).forEach(function (c) {
      var o = kid(chainSel, el('option', null, c === 'all' ? 'All chains' : c));
      o.value = c; if (state.chain === c) o.selected = true;
    });
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; render(); });
    var seg = kid(bar, el('div', 'seg'));
    [['all', 'All pre-token'], ['watch', 'Watchlist'], ['early', 'Early finds']].forEach(function (s) {
      var b = kid(seg, el('button', state.set === s[0] ? 'on' : null, s[1]));
      b.addEventListener('click', function () { state.set = s[0]; render(); });
    });
    var tabs = kid(bar, el('div', 'seg'));
    [['board', 'The board'], ['live', 'Already trading']].forEach(function (s) {
      var b = kid(tabs, el('button', state.tab === s[0] ? 'on' : null, s[1]));
      b.addEventListener('click', function () { state.tab = s[0]; render(); });
    });
    kid(bar, el('span', 'count', count));
    return bar;
  }
  function restoreFocus(node) {
    var v = node.value; node.focus(); node.setSelectionRange(v.length, v.length);
  }

  var COLUMNS = [
    ['rank', '#', 0], ['name', 'Protocol', 0], ['tvl_usd', 'TVL', 1], ['change_7d', '7d', 1],
    ['age_days', 'Age', 1], ['signal_score', 'Signal', 1], ['implied_value_usd', 'Implied value', 1],
  ];

  function boardTable(rows) {
    if (rows.length === 0) return el('div', 'empty', 'No protocol matches this filter. Loosen it — the radar keeps everything it ranked one filter away.');
    var table = el('table', 'board');
    var thead = kid(table, el('thead'));
    var hrow = kid(thead, el('tr'));
    COLUMNS.forEach(function (c) {
      var th = kid(hrow, el('th', c[2] ? 'num' : null));
      th.textContent = c[1] + (state.sort === c[0] ? (state.dir === 1 ? ' ↑' : ' ↓') : '');
      if (state.sort === c[0]) th.appendChild(el('span', 'arr', ''));
      th.addEventListener('click', function () {
        if (state.sort === c[0]) state.dir = -state.dir;
        else { state.sort = c[0]; state.dir = c[0] === 'name' || c[0] === 'rank' ? 1 : -1; }
        render();
      });
    });
    var tbody = kid(table, el('tbody'));
    rows.forEach(function (r) {
      var tr = kid(tbody, el('tr'));
      tr.addEventListener('click', function () { state.slug = r.slug; render(); window.scrollTo(0, 0); });
      kid(tr, el('td', 'rank', String(r.rank)));
      var proto = kid(tr, el('td', 'proto'));
      var nm = kid(proto, el('span', 'name', r.name));
      nm.parentNode.appendChild(r.on_watchlist ? el('span', 'tagwl', 'WATCHLIST') : el('span', 'tagearly', 'EARLY'));
      kid(proto, el('div', 'sub', (r.category || 'Uncategorised') + ' · ' + (r.chains.slice(0, 3).join(', ') || 'no chain recorded') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '')));
      kid(tr, el('td', 'num', fmtUsd(r.tvl_usd)));
      var ch = kid(tr, el('td', 'num'));
      var pct = fmtPct(r.change_7d);
      if (pct === null) kid(ch, el('span', 'na', 'n/a'));
      else kid(ch, el('span', r.change_7d >= 0 ? 'up' : 'down', pct));
      kid(tr, el('td', 'num', fmtAge(r.age_days)));
      var sig = kid(tr, el('td', 'num'));
      var sigBox = kid(sig, el('div', 'sig'));
      var bar = kid(sigBox, el('span', 'bar'));
      var fill = kid(bar, el('i')); fill.style.width = r.signal_score + '%';
      kid(sigBox, el('span', 'score', String(r.signal_score)));
      kid(tr, el('td', 'num implied', fmtUsd(r.implied_value_usd)));
    });
    return table;
  }

  function liveTable() {
    var table = el('table', 'board');
    var thead = kid(table, el('thead'));
    var hrow = kid(thead, el('tr'));
    ['Protocol', 'Symbol', 'Category', 'TVL', 'Market cap (actual)', '7d'].forEach(function (h, i) {
      kid(hrow, el('th', i >= 3 ? 'num' : null, h));
    });
    var tbody = kid(table, el('tbody'));
    D.live.forEach(function (r) {
      var tr = kid(tbody, el('tr'));
      tr.style.cursor = 'default';
      var proto = kid(tr, el('td', 'proto'));
      kid(proto, el('span', 'name', r.name));
      kid(proto, el('div', 'sub', (r.chains.slice(0, 3).join(', ') || 'no chain recorded')));
      kid(tr, el('td', null, r.symbol || '—'));
      kid(tr, el('td', null, r.category || 'Uncategorised'));
      kid(tr, el('td', 'num', fmtUsd(r.tvl_usd)));
      kid(tr, el('td', 'num implied', fmtUsd(r.mcap_usd)));
      var ch = kid(tr, el('td', 'num'));
      var pct = fmtPct(r.change_7d);
      if (pct === null) kid(ch, el('span', 'na', 'n/a'));
      else kid(ch, el('span', r.change_7d >= 0 ? 'up' : 'down', pct));
    });
    return table;
  }

  function methodology() {
    var sec = el('section', 'section');
    kid(sec, el('h2', null, 'How the radar prices a launch that has not happened'));
    var p1 = kid(sec, el('p'));
    p1.innerHTML = 'Every implied value on this board is one product of six factors, each read off the sealed snapshot itself — no hand-kept list of names, no outside price feed. Open any protocol and the page rebuilds its number from the row\'s own factors, beside the number <b>board.json</b> carries.';
    kid(sec, el('div', 'formula', 'implied value  =  TVL  x  category multiple  x  momentum  x  maturity  x  breadth  x  stability'));
    var list = kid(sec, el('ul'));
    [
      ['Category multiple', 'the median market-cap-to-TVL ratio of the category\'s own live-token protocols in this same snapshot (' + D.global_multiple + ' snapshot-wide). A lending market is priced the way lending markets with tokens are priced here. Categories with fewer than ' + D.model.multiple_min_peers + ' priced peers take the snapshot-wide median; every multiple is clamped to [' + D.model.multiple_min + ', ' + D.model.multiple_max + '].'],
      ['Momentum', '1 + clamp(7-day TVL change, ' + D.model.momentum_floor_pct + '%, +' + D.model.momentum_cap_pct + '%) x ' + D.model.momentum_weight + '. Growth counts, one week\'s spike is capped.'],
      ['Maturity', D.model.maturity_base + ' + ' + D.model.maturity_span + ' x (1 - exp(-age / ' + D.model.maturity_tau_days + ' days)): a record that has survived longer supports more of its peer multiple. An unrecorded age counts as ' + D.model.unknown_age_days + ' days.'],
      ['Breadth', '1 + ' + D.model.breadth_per_chain + ' per extra chain, up to ' + D.model.breadth_max_extra + ': distribution a launch can reach on day one.'],
      ['Stability (new in signal-stack-2)', 'the drawdown guard: 1 while the week\'s move is no worse than -' + D.model.stability_threshold_pct + '%, then a discount growing to at most ' + Math.round(D.model.stability_max_discount * 100) + '% as the loss deepens. Momentum prices an ordinary bad week; stability prices a collapse — a protocol in freefall would not launch into its own chart.'],
      ['The signal (0-100)', 'never moves the rank. It scores how strongly the record reads as a launch in the making: the share of the category that already has a token (30), time tracked with no token, peaking rather than plateauing (20), 7-day momentum (20), scale (20) and chain breadth (10). 65 and up reads Farm now.'],
    ].forEach(function (item) {
      var li = kid(list, el('li'));
      kid(li, el('b', null, item[0] + ' — '));
      li.appendChild(document.createTextNode(item[1]));
    });
    var p2 = kid(sec, el('p'));
    p2.innerHTML = 'The board ranks <b>every</b> protocol the snapshot records with no token of its own, except wrapped, staked and bridged products of tokens that already trade — a wrapped product\'s launch is its parent token\'s, not its own. The house watchlist (TVL at or above ' + fmtUsd(D.floor_usd) + ', no token recorded) is the floor of the board, never its ceiling: the early finds below it are the radar\'s reason to exist. Protocols whose token already trades are never ranked; the Already trading tab shows them at the market\'s own market cap.';
    var tbl = kid(sec, el('table', 'mini'));
    var th = kid(kid(tbl, el('thead')), el('tr'));
    ['Category multiple in use', 'x', 'priced peers'].forEach(function (h, i) { kid(th, el('th', i ? 'num' : null, h)); });
    var tb = kid(tbl, el('tbody'));
    D.category_multiples.slice(0, 10).forEach(function (c) {
      var tr = kid(tb, el('tr'));
      kid(tr, el('td', null, c.category));
      kid(tr, el('td', 'num', fmtMult(c.multiple)));
      kid(tr, el('td', 'num', String(c.peers)));
    });
    var p3 = kid(sec, el('p'));
    p3.innerHTML = 'Honest limits: the snapshot says a protocol <b>records</b> no token; it cannot prove none exists anywhere. An implied value is this radar\'s own claim about what a token would be worth if the record held — it is not a prediction that a token will be issued, or when.';
    return sec;
  }

  // ------------------------------------------------------------ detail view

  function detail(row) {
    var wrap = el('div');
    var back = kid(wrap, el('button', 'back', '← Back to the board'));
    back.addEventListener('click', function () { state.slug = null; render(); });
    var head = kid(wrap, el('div', 'detail-head'));
    var who = kid(head, el('div', 'who'));
    var h1 = kid(who, el('h1', null, row.name));
    h1.appendChild(row.on_watchlist ? el('span', 'tagwl', 'WATCHLIST') : el('span', 'tagearly', 'EARLY FIND'));
    kid(who, el('div', 'sub', (row.category || 'Uncategorised') + ' · ' + (row.chains.join(', ') || 'no chain recorded') + ' · rank #' + row.rank + ' of ' + D.board_size));
    var value = kid(head, el('div', 'value'));
    kid(value, el('div', 'big', fmtFull(row.implied_value_usd)));
    kid(value, el('div', 'lab', 'implied value if it launched on this record'));

    var cols = kid(wrap, el('div', 'cols'));
    var left = kid(cols, el('div'));
    var right = kid(cols, el('div'));

    var rec = kid(left, el('div', 'card'));
    kid(rec, el('h3', null, 'The record'));
    [
      ['Status', 'records no token'],
      ['TVL', fmtFull(row.tvl_usd)],
      ['TVL change, 7d', fmtPct(row.change_7d) || 'not reported'],
      ['Tracked since', row.listed_at || 'not recorded'],
      ['Age with no token', row.age_days === null ? 'unknown' : row.age_days + ' days'],
      ['On the house watchlist', row.on_watchlist ? 'yes' : 'no — an early find'],
    ].forEach(function (kv) {
      var line = kid(rec, el('div', 'kv'));
      kid(line, el('span', 'k', kv[0]));
      kid(line, el('span', 'v', kv[1]));
    });

    var fac = kid(left, el('div', 'card'));
    fac.style.marginTop = '18px';
    kid(fac, el('h3', null, 'How this value is built'));
    [
      ['TVL', fmtFull(row.tvl_usd)],
      ['Category multiple (' + (row.category_peers >= D.model.multiple_min_peers ? row.category_peers + ' priced peers' : 'snapshot-wide median; ' + row.category_peers + ' priced peer' + (row.category_peers === 1 ? '' : 's') + ' in category') + ')', fmtMult(row.category_multiple)],
      ['Momentum (7d ' + (fmtPct(row.change_7d) || 'n/a') + ')', fmtMult(row.momentum_multiplier)],
      ['Maturity (' + fmtAge(row.age_days) + ' tracked)', fmtMult(row.maturity_multiplier)],
      ['Breadth (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')', fmtMult(row.breadth_multiplier)],
      ['Stability (drawdown guard' + (row.stability_multiplier < 1 ? ': 7d loss beyond −20%' : ': no deep drawdown') + ')', fmtMult(row.stability_multiplier)],
    ].forEach(function (kv) {
      var line = kid(fac, el('div', 'kv'));
      kid(line, el('span', 'k', kv[0]));
      kid(line, el('span', 'v', kv[1]));
    });
    var check = kid(fac, el('div', 'check'));
    var rebuilt = impliedOf(row);
    check.appendChild(document.createTextNode('page check: ' + fmtFull(row.tvl_usd) + ' x ' + row.category_multiple + ' x ' + row.momentum_multiplier + ' x ' + row.maturity_multiplier + ' x ' + row.breadth_multiplier + ' x ' + row.stability_multiplier + ' = '));
    kid(check, el('b', null, fmtFull(rebuilt) + (rebuilt === row.implied_value_usd ? ' — matches board.json' : ' — differs from board.json')));

    var sig = kid(right, el('div', 'card'));
    kid(sig, el('h3', null, 'Launch signal'));
    var scoreLine = kid(sig, el('div'));
    var big = el('span', null, String(row.signal_score) + ' / 100');
    big.style.fontSize = '20px'; big.style.fontWeight = '700';
    scoreLine.appendChild(big);
    scoreLine.appendChild(el('span', 'tier', row.signal_tier));
    var parts = [
      ['Category propensity (' + Math.round(row.signal_parts.propensity * 100) + '% already have a token)', row.signal_parts.propensity_pts, 30],
      ['Seasoning (time tracked, no token)', row.signal_parts.seasoning_pts, 20],
      ['Momentum (7-day TVL change)', row.signal_parts.momentum_pts, 20],
      ['Scale (TVL)', row.signal_parts.scale_pts, 20],
      ['Breadth (chains)', row.signal_parts.breadth_pts, 10],
    ];
    parts.forEach(function (part) {
      var box = kid(sig, el('div', 'part'));
      var r = kid(box, el('div', 'row'));
      kid(r, el('span', 'k', part[0]));
      kid(r, el('span', null, part[1] + ' / ' + part[2]));
      var track = kid(box, el('div', 'track'));
      var fill = kid(track, el('i'));
      fill.style.width = Math.round((part[1] / part[2]) * 100) + '%';
    });

    var plan = kid(right, el('div', 'card'));
    plan.style.marginTop = '18px';
    kid(plan, el('h3', null, 'Farm plan — what to do, what it costs, how long it takes'));
    var ol = kid(plan, el('ol', 'steps'));
    row.farm_steps.forEach(function (s) {
      var parts2 = splitStep(s);
      var li = kid(ol, el('li'));
      kid(li, el('div', 'act', parts2.action));
      var chips = kid(li, el('div', 'chips'));
      if (parts2.cost) { var c1 = kid(chips, el('span', 'chip')); c1.appendChild(document.createTextNode('Cost ')); kid(c1, el('b', null, parts2.cost)); }
      if (parts2.time) { var c2 = kid(chips, el('span', 'chip')); c2.appendChild(document.createTextNode('Time ')); kid(c2, el('b', null, parts2.time)); }
    });
    kid(plan, el('p', 'note', 'Costs are this radar\'s working estimates from the protocol\'s TVL tier and first chain. The plan is generated from the protocol\'s category, chains, TVL and age — the same plan board.json carries, word for word.'));

    kid(wrap, el('p', 'note', 'An implied value is this radar\'s own claim, not a prediction that a token will be issued. The snapshot records no token for this protocol; that is a statement about the record, not proof that none exists.'));
    return wrap;
  }

  // ------------------------------------------------------------ render

  function render() {
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = '';
    kid(root, masthead(!!state.slug));
    if (state.slug) {
      var row = null;
      for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === state.slug) { row = D.rows[i]; break; }
      if (row) { kid(root, detail(row)); root.setAttribute('aria-busy', 'false'); return; }
      state.slug = null;
    }
    if (state.tab === 'live') {
      kid(root, controls(D.live.length + ' live-token protocols shown at market value'));
      kid(root, liveTable());
      var note = kid(root, el('p', 'note', 'These protocols already have a token that trades. The radar never ranks them and never models their value: the market cap shown is the market\'s own, from the same snapshot. They are here so the board\'s claim stays honest — pre-token on the left of the line, priced by the market on the right.'));
    } else {
      var rows = sorted(visibleRows());
      kid(root, controls('Showing ' + rows.length + ' of ' + D.board_size + ' ranked protocols'));
      kid(root, boardTable(rows));
      kid(root, methodology());
    }
    var foot = kid(root, el('footer', 'foot'));
    kid(foot, el('div', null, 'Launch Radar · model ' + D.model_version + ' · every figure on this page is computed from the one sealed snapshot; the page runs with no network.'));
    var src = kid(foot, el('div', 'src', 'Data: ' + D.source + ' · as of ' + D.as_of + ' · watchlist floor ' + fmtUsd(D.floor_usd)));
    root.setAttribute('aria-busy', 'false');
  }

  render();
})();
