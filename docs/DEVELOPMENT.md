# Development guide

## Project shape

This repository is a static browser application. It has no package manifest, build configuration, or server-side application in the current checkout.

- Root-level `.html` files are individual pages.
- `css/common.css` and `css/pages.css` provide shared styles for the smaller pages; some larger pages contain their own inline styles and scripts.
- `js/` contains page modules and browser helpers.
- `room.js` supports the room/connection demo.

The dashboard in `index.html` and the agent manager in `agent.html` contain substantial inline JavaScript in addition to the smaller modules under `js/`.

## Local development

Serve the repository root over HTTP, for example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/> and use the browser developer tools to inspect console messages, network requests, and local storage. There is no automated test command configured in the repository at present.

## Browser persistence

Pages share selected browser-local keys. Notable examples include:

- `last_strategy` — saved strategy JSON.
- `trader_settings` — settings form values, including the entered API key.
- `nexus_ultimate_state` — persisted dashboard state.

Treat local storage as accessible to scripts running in the same site origin. Never store real exchange credentials, wallet secrets, or other sensitive material in this demo.

## External services and simulation boundaries

The dashboard requests market data from public APIs and loads third-party CDN resources. Those dependencies can change, fail, impose rate limits, or be blocked by browser/network policies.

The separate Backtest and Live pages use generated random prices. The Trader page only writes simulated activity to the DOM. Agent replies, RSS scraper content, peer connections, and DEX/flash-loan features are demonstration or simulated behavior in the current implementation. Documentation or UI labels should not imply that these parts submit orders, access real DEX liquidity, or provide verified trading signals.

## Contribution notes

- Keep documentation aligned with the actual page/module behavior.
- Avoid introducing real trading or credential handling without a security review and explicit exchange integration design.
- When adding a build or test tool, document its prerequisites and commands here and in the root README.
