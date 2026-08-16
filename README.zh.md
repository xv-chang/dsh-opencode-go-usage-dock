# dsh-opencode-go-usage-dock

[![npm version](https://img.shields.io/npm/v/dsh-opencode-go-usage-dock)](https://www.npmjs.com/package/dsh-opencode-go-usage-dock)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 插件：在**输入框下方**（与输入栏同宽、出厂"统计"行同一读数带）常驻显示你的 **OpenCode Go** 套餐用量。不需要设置页、不需要侧边栏入口——聊天时三个用量窗口（5 小时滚动 / 每周 / 每月）始终可见。

![OpenCode Go 用量条](docs/screenshot-dock.png)

## 功能

- **输入框下方常驻用量条** — 注册在 `conversation.composer.dock`（order 10，与出厂统计行并列），宽度与输入框严格对齐
- **三个用量窗口** — 滚动(5h) / 每周 / 每月，显示已用百分比与重置时间
- **健康度彩点** — 绿 <60%、黄 60–85%、红 ≥85%
- **悬停详情** — tooltip 显示窗口名、限额与重置时间
- **手动刷新** — 小刷新按钮随时重新请求官方端点
- **静默回退** — 未配置 opencode-go 时整条**完全不渲染**：没有报错噪音、没有占位；只有真实故障（网络 / HTTP / 解析）才显示错误行 + 重试
- **i18n** — 中英双语

## 前置条件

- Node.js + [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，使用标准 `dsh web` profile（默认组合已包含 `api-gateway` 客户端 Remote 与 `conversation.composer.dock` 槽位）
- 已订阅 **OpenCode Go**，并在 **设置 → 模型** 中添加 `opencode-go` 提供商
- 有效的 OpenCode Go **API Key**（`sk-opencode-…`）— 见 [API Key 配置](#api-key-配置)

## 安装

### GitHub 源

```sh
dsh plugin --profile web add github:xv-chang/dsh-opencode-go-usage-dock
```

### npm 源

```sh
dsh plugin --profile web add npm:dsh-opencode-go-usage-dock
```

### Profile 激活

**0.1.2 起**本包声明了 `dsh.bundle` profile 补丁，`dsh plugin add` 会**自动**把它注册为 profile layer——无需手动编辑 `cordis.patch.yml`。

然后重启 `dsh web`，让 Host 半与服务端 client bundle 生效。

> 如果安装的是 0.1.2 之前的版本，需要手动在 `$DSH_HOME/profiles/web/cordis.patch.yml` 添加插件行：
>
> ```yaml
> - insert:
>     - id: opencode-go-usage-dock
>       name: 'dsh-opencode-go-usage-dock'
> ```

重启 `dsh web`，让 Host 半与服务端 client bundle 生效。

## 配置

插件行 `config` 可调项：

```yaml
- id: opencode-go-usage-dock
  name: dsh-opencode-go-usage-dock
  config:
    baseUrl: https://opencode.ai/zen/go/v1/usage   # 默认
    timeoutMs: 15000                               # 默认
```

| Key | 默认值 | 含义 |
| --- | --- | --- |
| `baseUrl` | `https://opencode.ai/zen/go/v1/usage` | 用量接口地址 |
| `timeoutMs` | `15000` | 请求超时（毫秒） |

### API Key 配置

仅从 **DSH 凭据库** 解析：

- `$DSH_HOME/.credentials.yaml` 中的 `OPENCODE_GO_API_KEY`（或环境变量）。

不读取任何 OpenCode CLI 文件——本插件是 DSH 特性，不依赖 opencode 安装。

## 行为语义

| 状态 | 用量条渲染 |
| --- | --- |
| 设置 → 模型**没有** opencode-go | 不显示（静默） |
| 未找到 API Key | 不显示（静默） |
| 请求失败（网络 / HTTP / 解析） | 红色错误行 + 重试按钮 |
| 正常 | `OpenCode Go ● 滚动 1% ● 本周 20% ● 本月 11% [刷新]` |

## 工作原理

双端插件。Host 发布 `opencodeUsage` Typert Remote 服务；Client 挂载它、注册 `conversation.composer.dock` 槽位并渲染读数条。通信走 harness 的 `/api` RPC 通道。

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 半 — `OpencodeUsageGateway`（`TypertRemoteService`，服务键 `opencodeUsage`） |
| `typert.host.js` | 手写 Typert host manifest，通过 `exports["./typert"]` 注册 |
| `client.js` | `window.__ModuleLoader__.load` 格式浏览器 bundle — 挂载 Remote、注册 dock 槽位、渲染读数条 |
| `package.json` | 双面声明：`main` + `exports["./client"]` + `exports["./typert"]` + `dsh.client` |

### 用量接口

```http
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <API_KEY>
```

返回（社区实测格式；**尚未进入 OpenCode 公开文档**，因此解析是防御式的）：

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 9,  "resetsAt": "2026-08-14T07:20:04.810Z" },
    "weekly":  { "status": "ok", "percent": 12, "resetsAt": "2026-08-17T00:00:00.810Z" },
    "monthly": { "status": "ok", "percent": 6,  "resetsAt": "2026-09-09T00:41:03.810Z" }
  }
}
```

`percent` 为 0–100；`resetsAt` 为 ISO-8601。

## 常见问题

**用量条不出现。** 该槽位是会话作用域：先打开任意一个会话。然后依次排查：(1) 设置 → 模型中有 `opencode-go`；(2) API Key 能解析（见上文）；(3) 插件行已写入 profile 补丁层且 `dsh web` 已重启。

**提示 "API Key 无效或已过期 (401)"。** Key 错误或过期——去 OpenCode 后台重新签发并更新凭据。

**tooltip 里的限额（$12/$30/$60）会有漂移。** 限额跟随 OpenCode Go 套餐，仅作展示参考；接口响应本身不包含限额。

## License

MIT
