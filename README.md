[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/RenaldiRenaldi/token-radar-01-r7/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/RenaldiRenaldi/token-radar-01-r7/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Launch Terminal R7

## Why radar-7 beats radar-6

The terminal ranks 198 records, keeps complete protocol accounting, and exposes rank stability and costed deposit routes alongside held-out tests.

Radar-7 kept the B3 fit and made its evidence readable: LOO median ×2.869 (60/119), walk-forward ×2.495 (36/66), inner five-fold ×3.515 and temporal ten-fold ×3.585. It showed token odds per ranked row, costed farm verdicts (125 FARM, 23 THIN, 50 SKIP), and recomputed the board and ledger in the browser.

The portfolio simulator and liquidity exposure score add decisions the top ten titles do not advertise. The first tests budget allocation under correlated failures and exit shocks. The second reports drawdown, chain concentration and small TVL with explicit missingness. There are no contract controls, holder data, launch dates, social metrics or measured gas quotes in the snapshot.

## Validation

| Comparable test | Median miss | Within 3× |
| --- | ---: | ---: |
| Leave-one-out | ×2.869 | 60/119 |
| Inner 5-fold | ×3.515 | measured held-out split |
| Temporal 10-fold | ×3.585 | measured held-out split |
| Walk-forward cohort replay | ×2.495 | 36/66 |

The test uses the sealed snapshot and the same 119 positive-cap, positive-TVL, non-CEX comparables. Each protocol is removed once. Five inner folds group by CoinGecko ID and select a feature set using capped absolute log error.

The production model uses the positive-cap records with a CoinGecko ID. All 119 comparables satisfy this extra screen here. Market depth and executable prices are unobserved. Ridge penalties shrink correlated sector and category effects and limit exposure to weak growth and age signals. Huber weights douse extreme residuals. The terminal independently reconstructs each fitted cap by summing its log contributions and exponentiating.

| Listing cohort | Train / validation | Protocols in test | Median cap miss | Within 3× |
| --- | ---: | ---: | ---: | ---: |
| 2023 | transfer cohort | 18 | ×3.119 | 9/18 |
| 2024 | transfer cohort | 18 | ×1.995 | 12/18 |
| 2025 | transfer cohort | 21 | ×2.441 | 12/21 |
| 2026 | transfer-test | 9 | ×6.350 | 3/9 |

This is a listing-cohort transfer test on current caps and current features. A 30-day gap precedes each validation and test boundary. Training excludes validation token IDs, and both earlier sets exclude test token IDs. For the sparse 2023 training window, a pooled size fit is preselected, then refitted after pooling training and validation. There are 558 cohort predictions, with 66 observed anchor caps for error scoring. The ledger records 113 missing listing dates and 87 dates outside the test windows. Historical observations would be required to measure real walk-forward forecast error.

The model runs 256 fixed-seed token-block bootstrap refits of the selected specification. Sentora Curator spans ranks 1–23 with central 80% ranks 1–7. Steakhouse Financial spans ranks 1–21 with central ranks 1–8. Veda spans ranks 1–33 with central ranks 1–6. Gauntlet spans ranks 3–53 with central ranks 3–20. Bootstrap ranges measure model stability. Separate signed residual bands show the central 80% of held-out log errors around each point estimate.

Stability belongs to ranks among today's 198 launch candidates. In a bootstrap draw, comparable tokens are resampled as blocks and candidate ordering is recalculated. It is not a posterior probability that a rank is correct.

## Coverage and farm math

The board ranks 198 launch candidates with all 40 watchlist rows. The universe ledger gives fitted diagnostics, provenance and a cost curve to all 758 protocols, including 119 anchors and 441 quarantined records. Those 560 rows have a skip route and no modeled pre-launch proceeds.

The default scenario uses each protocol's peer-derived qualifying odds and a hypothetical 10% pro rata depositor allocation. The assumed share is ticket divided by TVL plus ticket. Subtract four chain-priced transactions, 0.30% total slippage and 4% annual carry. The least expensive listed chain is selected under assumed fees of $0.05 per transaction on Solana, $0.30 on the listed lower-cost networks, $12 on Ethereum and $1 elsewhere. Verify deployment and supported assets before using a route. Model costs exclude asset losses, bridge fees and product charges. The portfolio view keeps its user-adjustable probability control and adds shared no-distribution, exit-cost and principal-loss scenarios.

Run with Node 22 and the sealed input directory:

```sh
node main.ts --input /path/to/kit/input --output /tmp/soundings
```

Open `/tmp/soundings/dashboard/index.html` offline. The ranked book, full ledger and fold log are downloadable from the page. Board and validation captures are committed assets under `captures/`, and the graded entry reads them directly. This R7 artifact records the final measured diagnostics in `validation.json`.
