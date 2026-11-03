# User guide

Traderbot is a browser-based demo. These instructions describe the current implementation, not a connected trading service.

## Open the app

Run a local HTTP server from the repository root (for example, `python3 -m http.server 8000`) and visit <http://localhost:8000/>. The basic pages are static, but some dashboard features fetch external data and need an internet connection.

## Build and export a strategy

1. Open **Strategy**.
2. Enter a strategy name, optional symbol, timeframe, EMA lengths, and risk percentage.
3. Select **Save Strategy**. The resulting JSON appears on the page and is stored in this browser as `last_strategy`.
4. Select **Export JSON** to download `strategy.json`.

The current strategy builder stores configuration; it does not validate strategy profitability or execute orders. Its JSON has this general shape:

```json
{
  "name": "My EMA Crossover",
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "indicators": {
    "ema_fast": 12,
    "ema_slow": 26
  },
  "risk_pct": 1
}
```

## Run a backtest

On **Backtest**, paste strategy JSON or leave the field blank to use the last saved strategy. Choose a symbol and candle count, then select **Run Backtest**. The current page generates a random price walk and evaluates EMA crossovers; it does not load historical candles. Results from a random series are illustrative only and are not evidence of expected performance.

## Run a live simulation

On **Live**, optionally paste strategy JSON and select **Start Simulation**. If the field is empty, the page tries the saved strategy. The display updates with a generated price tick and EMA-crossover paper position. Select **Stop** to stop the timer. This is not a live market feed and does not place trades.

## Use the trader panel

The **Trader** page accepts a symbol, amount, and optional strategy JSON. **Simulate Buy** and **Simulate Sell** add text to the page log only. They do not execute or queue exchange orders.

## Dashboard

The Home dashboard includes a market-data view and several simulated tools. Public prices are fetched from CoinGecko, CoinCap, Binance, or CoinPaprika, with fallback between sources when requests fail. Availability, response data, CORS behavior, and rate limits are controlled by those providers.

Other dashboard displays, such as DEX prices/arbitrage, portfolio activity, and flash-loan estimates, should be treated as demonstration calculations. They are not verified executable opportunities, and the app does not connect to a DEX or execute flash loans.

## Agent pages

The **Agent** and **Agent Manager** pages demonstrate a set of named specialist agents and keyword-based routing. Current agent replies are generated locally as placeholder text. The scraper interface uses mock items; it does not fetch or verify current news. Deployment controls are instructional/demo UI and do not by themselves deploy an agent.

The **Connection** page shows simulated local peers, not a secure network connection to a remote trading agent.

## Settings and browser data

The Settings page saves provider, API key, and base-currency values in this browser's local storage under `trader_settings`. The key is masked in the confirmation display, but masking does not encrypt it. Do not enter a real exchange API key, password, seed phrase, or any secret that could authorize transactions.

The **Clear Local Data** button removes `trader_settings` and `trader_load`; it does not clear every key used by every page. The dashboard has separate persisted state, and strategy data uses `last_strategy`. Clearing site data in your browser removes all local app state for this site.

## Troubleshooting

- If a page is blank or scripts fail when opened as a file, serve the repository over HTTP as described above.
- If market prices do not load, check your connection and browser console; an external API may be unavailable, rate-limited, or blocked.
- If a strategy is not prefilled on another page, save it on the Strategy page first or paste its JSON directly.
- If data appears to reset, check whether browser storage is disabled or cleared. Local storage is scoped to the current browser and site.
