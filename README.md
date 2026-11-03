# Traderbot

Traderbot is a browser-based cryptocurrency trading assistant and simulation demo. It is built from static HTML, CSS, and JavaScript; there is no build step or backend required for the basic pages.

> **Important:** This project is for experimentation and education, not financial advice. The strategy, backtest, live, and trader pages described below simulate activity and do not place exchange orders. The dashboard combines public market data with simulated features. Do not rely on its output to make financial decisions.

## Run locally

Use a local web server so browser modules and local storage work consistently. From the repository root, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Stop the server with `Ctrl+C`.

The app also uses external services and CDN assets in some views, so those features require an internet connection. Browser extensions, network restrictions, or API rate limits may affect them.

## Pages

- **Home (`index.html`)** — overview and the Nexus AI dashboard. The dashboard fetches public cryptocurrency prices from external providers, rotates providers on fetch failures, and includes analysis, portfolio, backtest, DEX-arbitrage, flash-loan, and CSV interfaces. Several of these features are simulations, not integrations with exchanges or decentralized exchanges.
- **Strategy (`strategy.html`)** — create and export a strategy JSON object.
- **Backtest (`backtest.html`)** — run a simple EMA-crossover backtest against a randomly generated price series.
- **Live (`live.html`)** — view a simulated random-walk price stream and EMA-crossover paper position.
- **Trader (`trader.html`)** — append simulated buy/sell messages to a local page log; it does not submit orders.
- **Agent (`agent.html`)** — explore the agent-manager demo, including keyword-based routing, a built-in knowledge base, simulated RSS items, and CSV tools. “Agent” responses are simulated in the current implementation.
- **Connection (`connection.html`)** — local simulated agent/connection interface.
- **Agent Manager (`agent_manager.html`)** — agent, knowledge-base, cache, scraper, CSV, and deployment-demo UI.
- **Settings (`settings.html`)** — save local demo settings.

For user instructions and limitations, see [the user guide](docs/USER_GUIDE.md). For repository structure and development notes, see [the development guide](docs/DEVELOPMENT.md).

## Data and privacy

Most app state is held in the browser's `localStorage`; it is not a server-side account or database. The dashboard can request market data from public third-party APIs. The settings page stores its API key in browser local storage, which is not secure secret storage. **Do not enter a real exchange credential or any key that grants access to funds.**

## License

No license file is currently included. Contact the repository owner before redistributing or reusing this project.
