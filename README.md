# dsh-opencode-go-usage-dock

[![npm version](https://img.shields.io/npm/v/dsh-opencode-go-usage-dock)](https://www.npmjs.com/package/dsh-opencode-go-usage-dock)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web-GUI plugin that shows your **OpenCode Go** plan usage in a compact readout docked **under the composer**, aligned with the input bar's width — the same seat the shipped stats line lives in. No settings page, no sidebar entries, nothing to click through: the three usage windows (5-hour rolling / weekly / monthly) are always visible while you chat.

![OpenCode Go usage dock](docs/screenshot-dock.png)

## Features

- **Composer dock readout** — one compact line under the input bar, perfectly aligned with it (`conversation.composer.dock`, order 10, beside the shipped stats line)
- **Three usage windows** — 5-hour rolling / weekly / monthly, with percent used and reset time
- **Health-colored dots** — green < 60%, amber 60–85%, red ≥ 85%
- **Hover for details** — tooltip shows window name, spend limit and reset time
- **Manual refresh** — a small refresh button re-queries the official endpoint on demand
- **Silent fallback** — when opencode-go is not configured, the dock renders *nothing*: no error noise, no placeholder; only real failures (network / HTTP / parse) surface an error line with retry
- **i18n** — Chinese and English dictionaries

## Prerequisites

- Node.js + [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) with the standard `dsh web` profile (the `api-gateway` client Remote and the `conversation.composer.dock` slot are part of the default composition)
- An **OpenCode Go** subscription, with the `opencode-go` model configured in **Settings → Models**
- An OpenCode Go **API key** (`sk-opencode-…`) — see [API key configuration](#api-key-configuration)

## Install

### Via GitHub

```sh
dsh plugin --profile web add github:<your-github>/dsh-opencode-go-usage-dock
```

### Via npm

```sh
dsh plugin --profile web add npm:dsh-opencode-go-usage-dock
```

### Register the plugin row

Add the plugin row to your profile's patch layer (`$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: opencode-go-usage-dock
      name: 'dsh-opencode-go-usage-dock'
```

Restart `dsh web` so the host half and the served client bundle pick up the plugin.

## Configuration

Host-side tunables live on the plugin row in `cordis.yml`:

```yaml
- id: opencode-go-usage-dock
  name: dsh-opencode-go-usage-dock
  config:
    baseUrl: https://opencode.ai/zen/go/v1/usage   # default
    timeoutMs: 15000                               # default
```

| Key | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | `https://opencode.ai/zen/go/v1/usage` | The usage endpoint. |
| `timeoutMs` | `15000` | Fetch timeout in milliseconds. |

### API key configuration

The plugin resolves the key in this order:

1. **DSH credentials seam / environment** — `OPENCODE_GO_API_KEY` in `$DSH_HOME/.credentials.yaml` (or as an environment variable). This is the recommended way.
2. **OpenCode CLI** — `~/.local/share/opencode/auth.json` → the `opencode-go` entry (fallback `opencode`) with `type: "api"`.

On Windows, use `OPENCODE_GO_API_KEY` for best results; an `auth.json` in the same relative location is also read.

## Behavior

| State | Dock renders |
| --- | --- |
| opencode-go **not in** Settings → Models | nothing (silent) |
| No API key found | nothing (silent) |
| Request failed (network / HTTP / parse) | red error line + retry button |
| Success | `OpenCode Go ● 滚动 1% ● 本周 20% ● 本月 11% [刷新]` |

## How it works

A dual-face plugin. The Host publishes the `opencodeUsage` Typert Remote service; the Client mounts it, registers the `conversation.composer.dock` slot, and renders the readout. Communication rides the harness `/api` RPC carrier.

| File | Role |
| --- | --- |
| `index.js` | Host half — `OpencodeUsageGateway` (`TypertRemoteService`, service key `opencodeUsage`) |
| `typert.host.js` | Hand-written Typert host manifest, registered via `exports["./typert"]` |
| `client.js` | Browser bundle in `window.__ModuleLoader__.load` format — mounts the Remote, registers the dock slot, renders the readout |
| `package.json` | Dual-face declaration: `main` + `exports["./client"]` + `exports["./typert"]` + `dsh.client` |

### The usage endpoint

```http
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <API_KEY>
```

Returns (community-verified shape; **not yet in OpenCode's public docs**, so parsing is defensive):

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 9,  "resetsAt": "2026-08-14T07:20:04.810Z" },
    "weekly":  { "status": "ok", "percent": 12, "resetsAt": "2026-08-17T00:00:00.810Z" },
    "monthly": { "status": "ok", "percent": 6,  "resetsAt": "2026-09-09T00:41:03.810Z" }
  }
}
```

`percent` is 0–100; `resetsAt` is ISO-8601.

## FAQ

**The dock does not appear.** The slot is session-scoped: open any conversation. Then check, in order: (1) `opencode-go` is present in Settings → Models; (2) an API key resolves (see above); (3) the plugin row is in the profile patch layer and `dsh web` was restarted.

**I see "API Key 无效或已过期 (401)".** Your key is wrong or expired — re-issue it in the OpenCode dashboard and update the credentials seam.

**Quota limits shown in tooltips ($12/$30/$60) drift.** They follow the OpenCode Go plan and are displayed for context only; the endpoint response does not include them.

## License

MIT
