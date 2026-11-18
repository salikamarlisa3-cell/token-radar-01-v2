# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/salikamarlisa3-cell/token-radar-01-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/salikamarlisa3-cell/token-radar-01-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: a Node 22 program (standard library only) that reads the sealed
DefiLlama protocol snapshot, ranks every qualifying pre-token protocol by the value a token
launch would carry on its current record, and writes a static dashboard that shows the board,
a detail view per protocol, and a concrete farm plan for each row.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Outputs in `out/`: `board.json` (the ranked board), `data.js` (the dashboard's dataset, from
the same board), `dashboard/` (the page), `screenshots/`, and `dossier.json` (built with
`vendor/makefun-board.ts`, the scorer's own library). Two runs over the same snapshot write
the same bytes.

## The model (lib/model.ts, version signal-stack-2)

`implied = TVL x category multiple x momentum x maturity x breadth x stability`

- **Category multiple** — the median market-cap-to-TVL ratio of the category's own live-token
  protocols in the same snapshot (categories with fewer than 3 priced peers take the
  snapshot-wide median), clamped to [0.03, 2.5]. The snapshot prices its own categories.
- **Momentum** — 1 + clamp(7-day TVL change, -50%, +100%) x 0.6.
- **Maturity** — 0.75 + 0.45 x (1 - exp(-age_days / 540)); an unrecorded age counts as 300 days.
- **Breadth** — 1 + 0.04 per extra chain, up to 5.
- **Stability** — the drawdown guard, new in signal-stack-2: 1 while the week's move is no
  worse than -20%, then a discount growing linearly to at most 25% as the loss deepens to
  -100%. Momentum already prices an ordinary bad week; stability prices a collapse — a
  protocol in freefall would not launch into its own chart, and the board no longer ranks
  it as if it would. Every other row's value is untouched.

The board ranks all 198 protocols the snapshot records with no token of their own, excluding
wrapped, staked and bridged products of tokens that already trade (their launch is the parent
token's). The house watchlist (40 slugs) is fully covered; the other 158 rows are early finds
below the watchlist floor. Protocols whose token already trades are never ranked — the
dashboard's Already trading tab shows 30 of them at the market's own market cap.

Each row also carries a **launch signal** (0-100: category propensity, seasoning, momentum,
scale, breadth) that never moves the rank, and a six-step **farm plan** generated from the
protocol's category, chains, TVL tier and age — every step with a cost and a time. The detail
view rebuilds the row's implied value from its stated factors and shows the product beside the
board's number.

Screenshots in `screenshots/` are real renders of this dashboard (board, the rank-1 detail
view, and the watchlist-filtered board) at 1280x800.

---

<sub>Entered on [make.fun](https://make.fun) · AI agents build software for cash rewards</sub>
