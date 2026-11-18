// Launch Radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// What the board is. Every protocol the snapshot records with no token of its own, minus the
// wrapped, staked and bridged products of tokens that already trade (a wrapped product's launch
// happened when its parent token launched), ranked by the value a token would carry if the
// protocol's record stayed as it is. The snapshot's watchlist is a floor: all 40 of its slugs are
// on the board, and so is every other qualifying protocol the snapshot carries, down to its
// $5,000,000 TVL edge. Protocols whose token already trades are never ranked; they are listed
// apart, at the market's own market cap.
//
// The implied value is one product of six factors, every one of them read off the snapshot:
//
//   implied = tvl_usd x category_multiple x momentum x maturity x breadth x stability
//
//   category_multiple  the median market-cap-to-TVL ratio of the category's own live-token
//                      protocols in this same snapshot (a category with fewer than three such
//                      peers takes the snapshot-wide median), clamped to [0.03, 2.5]. A lending
//                      market is priced the way lending markets with tokens are priced here,
//                      not by a number chosen at a desk.
//   momentum           1 + clamp(change_7d, -50, 100) / 100 x 0.6: a protocol adding TVL is
//                      worth more than one bleeding it, and one week's move is capped so a
//                      single spike cannot carry a row.
//   maturity           0.75 + 0.45 x (1 - exp(-age_days / 540)): a record that has survived
//                      longer supports a larger share of its peer multiple; an unlisted age
//                      counts as 300 days.
//   breadth            1 + 0.04 x min(chains - 1, 5): each extra chain is distribution a launch
//                      can reach, worth a little, never a lot.
//   stability          the drawdown guard, new in signal-stack-2: 1 while the week's move is
//                      no worse than -20%, then a discount growing linearly to at most 25%
//                      as the loss deepens to -100%. Momentum already prices an ordinary bad
//                      week; stability prices a collapse — a protocol in freefall would not
//                      launch into its own chart, and a board that ranks it as if it would
//                      is ranking a fiction. Only deep drawdowns are touched: a -19% week
//                      and a +40% week both carry a stability of exactly 1.
//
// The components a row carries are rounded to 4 decimals and the implied value is the product
// of the rounded components, so the dashboard can rebuild the number from the row alone and
// show its work. No protocol's name is ever special-cased: one function scores every row.
//
// Beside the value, each row carries a launch signal, 0 to 100: how strongly the record reads
// as a protocol heading for a token. It never moves the rank; it tells the farmer where to
// spend the week. Its parts are stated on the dashboard: category propensity (the share of the
// category's protocols that already have a token), seasoning (time tracked with no token, with
// a peak, not a plateau: very new and very old both read weaker), momentum, scale and breadth.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated on the dashboard and carried in data.js. */
export interface ModelConstants {
  momentum_floor_pct: number;
  momentum_cap_pct: number;
  momentum_weight: number;
  maturity_base: number;
  maturity_span: number;
  maturity_tau_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  stability_threshold_pct: number;
  stability_span_pct: number;
  stability_max_discount: number;
  multiple_min: number;
  multiple_max: number;
  multiple_min_peers: number;
}

export const MODEL: ModelConstants = {
  momentum_floor_pct: -50,
  momentum_cap_pct: 100,
  momentum_weight: 0.6,
  maturity_base: 0.75,
  maturity_span: 0.45,
  maturity_tau_days: 540,
  unknown_age_days: 300,
  breadth_per_chain: 0.04,
  breadth_max_extra: 5,
  stability_threshold_pct: 20,
  stability_span_pct: 80,
  stability_max_discount: 0.25,
  multiple_min: 0.03,
  multiple_max: 2.5,
  multiple_min_peers: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'signal-stack-2';

/** How many live-token protocols the dashboard's Already trading view carries, by market cap. */
export const LIVE_ROWS = 30;

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_peers: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    stability_multiplier: number;
  };
  signal: {
    score: number;
    tier: string;
    propensity: number;
    propensity_pts: number;
    seasoning_pts: number;
    momentum_pts: number;
    scale_pts: number;
    breadth_pts: number;
  };
  farm_steps: string[];
}

/** The dashboard's view of one board row: everything the page renders, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  category_multiple: number;
  category_peers: number;
  momentum_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  stability_multiplier: number;
  signal_score: number;
  signal_tier: string;
  signal_parts: { propensity: number; propensity_pts: number; seasoning_pts: number; momentum_pts: number; scale_pts: number; breadth_pts: number };
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the page shows the market's value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  category_multiples: { category: string; multiple: number; peers: number }[];
  scanned_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether the snapshot records no token for a protocol: no market cap, no Gecko id, no symbol. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whole words that mark a wrapped or staked product of a token that already trades. */
const PRODUCT_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories that are products of another protocol's token, or an exchange's own venue. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that begin with an exchange's name are that exchange's products. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Whether a protocol is a wrapped, staked or bridged product of a token that already trades, a
 * versioned pool of another protocol, or an exchange product: its launch, if any, is not its own.
 * Read from the snapshot's fields alone (category and name); the same rule the house's watchlist
 * states, applied to the whole board.
 */
export function isProductOfAnother(p: SnapshotProtocol): boolean {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return true;
  if (PRODUCT_WORD.test(p.name)) return true;
  if (VERSIONED.test(p.name)) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x));
}

/** Whether a protocol may be ranked: it records no token and it is not a product of another's. */
export function isRankable(p: SnapshotProtocol): boolean {
  return recordsNoToken(p) && !isProductOfAnother(p);
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The category multiples, derived from the snapshot itself: for each category, the median
 * market-cap-to-TVL ratio of its live-token protocols with both figures; a category with fewer
 * than the model's minimum peers takes the snapshot-wide median. Multiples are clamped to the
 * model's band and rounded to 4 decimals, the figures the rows then carry.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { table: Map<string, { multiple: number; peers: number }>; global: number } {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? '(uncategorised)';
    const list = ratios.get(key);
    if (list === undefined) ratios.set(key, [ratio]);
    else list.push(ratio);
  }
  const global = round4(clamp(median(all), model.multiple_min, model.multiple_max));
  const table = new Map<string, { multiple: number; peers: number }>();
  for (const [category, list] of ratios) {
    if (list.length >= model.multiple_min_peers) {
      table.set(category, { multiple: round4(clamp(median(list), model.multiple_min, model.multiple_max)), peers: list.length });
    } else {
      table.set(category, { multiple: global, peers: list.length });
    }
  }
  return { table, global };
}

/** The share of a category's protocols that already have a token: its launch propensity, 0 to 1. */
export function categoryPropensity(snapshot: Snapshot, category: string | null): number {
  let total = 0;
  let live = 0;
  for (const p of snapshot.protocols) {
    if (p.category !== category) continue;
    total++;
    if (!recordsNoToken(p)) live++;
  }
  return total === 0 ? 0 : round4(live / total);
}

/** The five factors of one protocol's implied value, the components rounded as the row states them. */
export function valueFactors(
  p: SnapshotProtocol,
  asOf: string,
  multiples: Map<string, { multiple: number; peers: number }>,
  globalMultiple: number,
  model: ModelConstants = MODEL,
): { implied: number; categoryMultiple: number; categoryPeers: number; momentumMult: number; maturityMult: number; breadthMult: number; stabilityMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const entry = multiples.get(p.category ?? '(uncategorised)');
  const categoryMultiple = entry === undefined ? globalMultiple : entry.multiple;
  const categoryPeers = entry === undefined ? 0 : entry.peers;
  const growth = clamp(p.change_7d ?? 0, model.momentum_floor_pct, model.momentum_cap_pct);
  const momentumMult = round4(1 + (growth / 100) * model.momentum_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = round4(model.maturity_base + model.maturity_span * (1 - Math.exp(-Math.max(ageForModel, 0) / model.maturity_tau_days)));
  const breadthMult = round4(1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra));
  const drawdown = clamp((-(p.change_7d ?? 0) - model.stability_threshold_pct) / model.stability_span_pct, 0, 1);
  const stabilityMult = round4(1 - model.stability_max_discount * drawdown);
  const implied = Math.max(1, Math.round(p.tvl_usd * categoryMultiple * momentumMult * maturityMult * breadthMult * stabilityMult));
  return { implied, categoryMultiple, categoryPeers, momentumMult, maturityMult, breadthMult, stabilityMult, age };
}

/** The launch signal's five parts and its tier: stated on the dashboard, never a rank input. */
export function launchSignal(
  p: SnapshotProtocol,
  age: number | null,
  propensity: number,
): { score: number; tier: string; propensityPts: number; seasoningPts: number; momentumPts: number; scalePts: number; breadthPts: number } {
  const propensityPts = Math.round(30 * clamp(propensity, 0, 1));
  let seasoningPts: number;
  if (age === null) seasoningPts = 8;
  else if (age < 30) seasoningPts = 4;
  else if (age < 180) seasoningPts = 11;
  else if (age < 730) seasoningPts = 20;
  else if (age < 1825) seasoningPts = 16;
  else seasoningPts = 10;
  const momentumPts = Math.round((20 * (clamp(p.change_7d ?? 0, -20, 40) + 20)) / 60);
  const scalePts = Math.round(20 * clamp((Math.log10(Math.max(p.tvl_usd, 1)) - 6.7) / 3, 0, 1));
  const breadthPts = Math.round((10 * Math.min(p.chains.length, 6)) / 6);
  const score = propensityPts + seasoningPts + momentumPts + scalePts + breadthPts;
  const tier = score >= 65 ? 'Farm now' : score >= 45 ? 'Build a position' : score >= 25 ? 'Watch' : 'Skip for now';
  return { score, tier, propensityPts, seasoningPts, momentumPts, scalePts, breadthPts };
}

// ------------------------------------------------------------------ farm plans

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** One transaction's gas on a chain, in dollars: the majors priced plainly, the rest between. */
function gasFor(chain: string): number {
  if (chain === 'Ethereum') return 12;
  if (chain === 'Solana') return 1;
  if (['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Avalanche', 'BSC', 'Linea', 'Scroll', 'zkSync Era', 'Mantle', 'Sonic', 'Berachain'].includes(chain)) return 2;
  return 5;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A category's two core actions: what a farmer actually does there, in followable words. */
function coreActions(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      `Supply $${capital} of USDC to ${name} on ${chain} and leave the deposit open so it accrues a lending history.`,
      `Borrow about 30% of the deposit's value in a second asset, hold it one week, then repay in full to record a completed loan cycle.`,
    ];
  }
  if (c.includes('dex') || c.includes('derivative') || c.includes('perpetual')) {
    return [
      `Make 3 swaps of about $${Math.max(25, Math.round(capital / 3))} each on ${name} on ${chain}, on different days, rather than in one burst.`,
      `Add $${capital} of two-sided liquidity to ${name}'s busiest pool and keep the position open through the weekly rebalance.`,
    ];
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) {
    return [
      `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares in the same wallet.`,
      `Move about a quarter of the position into a second ${name} vault so the wallet shows use of more than one strategy.`,
    ];
  }
  if (c.includes('rwa') || c.includes('stable')) {
    return [
      `Mint or deposit $${capital} of the protocol's yield asset through ${name} on ${chain} and hold the asset, unhedged.`,
      `Make one further mint or top-up of about $${Math.max(25, Math.round(capital / 4))} at least two weeks after the first, so the holding is not a single-day position.`,
    ];
  }
  if (c.includes('basis') || c.includes('funding')) {
    return [
      `Open the protocol's standard basis position with $${capital} of margin on ${name} and let it run through a full funding cycle.`,
      `Roll or resize the position once after the first week so the account shows a managed position, not a parked one.`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the staking receipt in the wallet.`,
      `Claim and re-stake the first rewards payment instead of withdrawing it, so the position compounds on the record.`,
    ];
  }
  if (c.includes('chain') || c.includes('layer')) {
    return [
      `Bridge $${capital} of USDC to ${chain} and deploy it in ${name}'s own apps, so the wallet is active on the chain itself.`,
      `Use two different native apps on ${chain} in the same week: one swap and one deposit, each from the same wallet.`,
    ];
  }
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open past the first weekly snapshot.`,
    `Make one further qualifying action in ${name} (a top-up, a vote or a second product) at least a week after the deposit.`,
  ];
}

/** One farm step as a single string: the action, then its cost and time, held to 20..600 characters. */
function stepString(action: string, cost: string, time: string): string {
  let s = `${action} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position open and check the protocol's own page weekly.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) and never from a hand-written list of names.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  const [first, second] = coreActions(p, capital, chain);
  return [
    stepString(
      `Set up one fresh wallet for ${p.name} alone and fund it from your main wallet in a single transfer.`,
      `about $${gas} of gas on ${chain}`,
      '10 minutes',
    ),
    stepString(first, `$${capital} of capital and about $${gas} of gas`, '15 minutes to set up'),
    stepString(second, `about $${gas} of gas`, '10 minutes'),
    stepString(
      `Repeat one qualifying action in ${p.name} every week (a swap, a top-up, a vote or a claim) so the wallet's activity spans several snapshots.`,
      `about $${gas} of gas a week`,
      '10 minutes a week',
    ),
    stepString(
      `Hold the position for at least ${hold} days before withdrawing anything, so the activity is counted as farming and not as a drive-by.`,
      `the $${capital} stays in the position`,
      `${hold} days`,
    ),
    stepString(
      `Check ${p.name}'s own points or rewards page weekly, claim only from the link the protocol itself publishes, and log every transaction with its date.`,
      'nothing to check; never pay anyone to claim for you',
      '5 minutes a week',
    ),
  ];
}

// ------------------------------------------------------------------ the board

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { table, global } = categoryMultiples(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter(isRankable);
  const scored = chosen.map((p) => {
    const f = valueFactors(p, snapshot.as_of, table, global, model);
    const propensity = categoryPropensity(snapshot, p.category);
    const signal = launchSignal(p, f.age, propensity);
    return { p, f, propensity, signal };
  });
  scored.sort((a, b) => b.f.implied - a.f.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    on_watchlist: watchlist.has(s.p.slug),
    age_days: s.f.age,
    implied_value_usd: s.f.implied,
    model: {
      category_multiple: s.f.categoryMultiple,
      category_peers: s.f.categoryPeers,
      momentum_multiplier: s.f.momentumMult,
      maturity_multiplier: s.f.maturityMult,
      breadth_multiplier: s.f.breadthMult,
      stability_multiplier: s.f.stabilityMult,
    },
    signal: {
      score: s.signal.score,
      tier: s.signal.tier,
      propensity: s.propensity,
      propensity_pts: s.signal.propensityPts,
      seasoning_pts: s.signal.seasoningPts,
      momentum_pts: s.signal.momentumPts,
      scale_pts: s.signal.scalePts,
      breadth_pts: s.signal.breadthPts,
    },
    farm_steps: farmPlan(s.p, s.f.age),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.mcap_usd !== null && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** A board row's form for data.js: everything the page renders. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    on_watchlist: row.on_watchlist,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_peers: row.model.category_peers,
    momentum_multiplier: row.model.momentum_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    stability_multiplier: row.model.stability_multiplier,
    signal_score: row.signal.score,
    signal_tier: row.signal.tier,
    signal_parts: {
      propensity: row.signal.propensity,
      propensity_pts: row.signal.propensity_pts,
      seasoning_pts: row.signal.seasoning_pts,
      momentum_pts: row.signal.momentum_pts,
      scale_pts: row.signal.scale_pts,
      breadth_pts: row.signal.breadth_pts,
    },
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { table, global } = categoryMultiples(snapshot, model);
  const category_multiples = [...table.entries()]
    .map(([category, v]) => ({ category, multiple: v.multiple, peers: v.peers }))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: global,
    category_multiples,
    scanned_size: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.on_watchlist).length,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'a slug appears on the board twice';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters once trimmed`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
