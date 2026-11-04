# Traderbot Wiki

## Overview

Traderbot is a browser-based crypto trading simulator and research dashboard. It is designed for experimenting with trading strategies, running simulated backtests, observing generated market activity, and exploring a lightweight agent/demo interface.

This project is intentionally a front-end demo. It does not connect to a live brokerage, exchange, or wallet for real order execution.

## Features

- Strategy builder and JSON export
- EMA-based backtest simulation
- Live price simulation
- Simulated trade logging
- Agent manager and knowledge-base demo UI
- Local settings storage in the browser
- Multi-source market dashboard mockups and simulated analysis panels

## Run locally

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Important notes

- The app uses browser local storage for demo data.
- External APIs and CDN assets may be unavailable or rate-limited.
- The project is educational and simulation-focused; it is not financial advice.

## Pages

- `index.html` — home/dashboard overview
- `strategy.html` — strategy definition editor
- `backtest.html` — random walk backtester
- `live.html` — live paper-trading simulation
- `trader.html` — simulated order log
- `agent.html` — agent manager prototype
- `connection.html` — local peer/connection mockup
- `settings.html` — browser settings

## Repository description suggestion

`Browser-based crypto trading simulator and strategy demo for experiments, backtests, and agent UI mockups.`

## Related docs

- [README](../README.md)
- [User guide](USER_GUIDE.md)
- [Development guide](DEVELOPMENT.md)
