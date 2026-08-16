// Client half of the dsh-opencode-go-usage-dock plugin.
//
// Hand-written browser bundle in the lazy-CJS format the client module loader
// expects: it only REGISTERS the factory; the body runs at materialization.
// It mounts the opencodeUsage Remote and registers a `conversation.composer.dock`
// entry (the band under the composer card, inside the bar's width column —
// the same seat as the shipped stats line), rendering a compact usage readout
// that stays aligned with the input bar.
//
// Silent-fallback rules (no noise when the feature is not configured):
//   - provider missing from Settings -> Models, or no API key
//     -> renders nothing (returns null)
//   - configured but the request fails (network / HTTP / parse)
//     -> renders an error line with a retry button
window.__ModuleLoader__.load({
  id: "dsh-opencode-go-usage-dock",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const NS = "settings.opencodeGoUsageDock";
    const inject = ["slots", "locale", "remote"];

    const zh = {
      nav: "OpenCode Go",
      title: "OpenCode Go 用量",
      network: "网络请求失败，请稍后重试。",
      unauthorized: "API Key 无效或已过期（401）。",
      httpError: "接口返回 HTTP {status}。",
      badJson: "接口响应解析失败。",
      unknown: "接口响应异常。",
      refresh: "刷新",
      rolling: "滚动",
      weekly: "本周",
      monthly: "本月",
    };
    const en = {
      nav: "OpenCode Go",
      title: "OpenCode Go usage",
      network: "Network request failed, try again later.",
      unauthorized: "API key is invalid or expired (401).",
      httpError: "HTTP {status} from the usage endpoint.",
      badJson: "Failed to parse the usage response.",
      unknown: "Unexpected usage response.",
      refresh: "Refresh",
      rolling: "Rolling",
      weekly: "Weekly",
      monthly: "Monthly",
    };

    // Client-side Remote contribution. The result codec is a pass-through
    // parser: the Host already validates the business result against its own
    // zod schema before it crosses the wire, and this side only needs the
    // descriptor's strict shape to mount and call.
    const TYPERT_REMOTE = {
      package: "dsh-opencode-go-usage-dock",
      descriptors: [
        {
          id: "dsh-opencode-go-usage-dock#opencodeUsage/usage",
          service: "opencodeUsage",
          namespace: "opencodeUsage",
          method: "usage",
          invocation: { kind: "direct" },
          parameters: [],
          result: {
            mode: "strict",
            typeSymbol: "dsh-opencode-go-usage-dock#OpencodeUsageResult",
            schema: { parse(value) { return value; } },
          },
        },
      ],
    };

    const styles = {
      dock: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--dsw-alias-label-secondary)",
        padding: "4px 2px",
      },
      label: { fontWeight: 600, color: "var(--dsw-alias-label-primary)", margin: 0 },
      chip: { display: "inline-flex", alignItems: "center", gap: 5, cursor: "default" },
      dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block", flex: "none" },
      error: { color: "var(--dsw-alias-state-error-primary)", margin: 0 },
      button: {
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "var(--dsw-alias-bg-layer-1)",
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        fontSize: 11,
        padding: "1px 8px",
        borderRadius: 6,
        font: "inherit",
      },
    };

    const LIMITS = { rolling: "$12", weekly: "$30", monthly: "$60" };

    function dotColor(percent) {
      if (percent >= 85) return "var(--dsw-alias-state-error-primary)";
      if (percent >= 60) return "var(--dsw-alias-state-warn-primary)";
      return "var(--dsw-alias-state-success-primary)";
    }

    function fmtReset(resetsAt, t) {
      if (!resetsAt) return t("unknown");
      const d = new Date(resetsAt);
      if (Number.isNaN(d.getTime())) return t("unknown");
      return d.toLocaleString();
    }

    function UsageDock(props) {
      const { query, t } = props;
      const [state, setState] = React.useState({ kind: "loading" });

      const load = React.useCallback(() => {
        setState({ kind: "loading" });
        Promise.resolve()
          .then(() => query())
          .then((result) => {
            if (!result || result.ok === false) {
              setState({ kind: "failure", message: (result && result.error && result.error.message) || "remote failed" });
              return;
            }
            setState({ kind: "done", value: result.value });
          })
          .catch((e) => setState({ kind: "failure", message: String((e && e.message) || e) }));
      }, [query]);

      React.useEffect(() => { load(); }, [load]);

      // While loading, render nothing: a configured feature resolves in
      // milliseconds; an unconfigured one must never flash a placeholder.
      if (state.kind === "loading") return null;

      if (state.kind === "failure") {
        return React.createElement("div", { style: styles.dock },
          React.createElement("span", { style: styles.error }, "OpenCode Go: " + state.message),
          React.createElement("button", { style: styles.button, onClick: load }, t("refresh"))
        );
      }

      const value = state.value || {};

      // Not configured (provider missing or no API key): stay completely silent.
      if (value.configured !== true) return null;

      if (value.error) {
        let msg = value.error;
        if (value.error === "unauthorized") msg = t("unauthorized");
        else if (value.error === "network") msg = t("network");
        else if (value.error === "bad-json") msg = t("badJson");
        else if (value.error.startsWith("http-")) msg = t("httpError").replace("{status}", value.error.slice(5));
        return React.createElement("div", { style: styles.dock },
          React.createElement("span", { style: styles.error }, "OpenCode Go: " + msg),
          React.createElement("button", { style: styles.button, onClick: load }, t("refresh"))
        );
      }

      const usage = value.usage || {};
      const windows = [
        { key: "rolling", label: t("rolling"), limit: LIMITS.rolling, data: usage.rolling },
        { key: "weekly", label: t("weekly"), limit: LIMITS.weekly, data: usage.weekly },
        { key: "monthly", label: t("monthly"), limit: LIMITS.monthly, data: usage.monthly },
      ];
      const chips = windows.map((win) => {
        const percent = win.data && typeof win.data.percent === "number" ? win.data.percent : null;
        if (percent === null) return null;
        const pct = Math.max(0, Math.min(100, Math.round(percent)));
        return React.createElement("span", {
          key: win.key,
          style: styles.chip,
          title: win.label + " · " + win.limit + " · " + t("refresh") + ": " + fmtReset(win.data && win.data.resetsAt, t),
        },
          React.createElement("span", { style: { ...styles.dot, background: dotColor(pct) } }),
          win.label + " " + pct + "%"
        );
      });
      return React.createElement("div", { style: styles.dock },
        React.createElement("span", { style: styles.label }, "OpenCode Go"),
        ...chips,
        React.createElement("button", { style: styles.button, onClick: load }, t("refresh"))
      );
    }

    function apply(ctx) {
      const mountReady = ctx.remote.$mount(TYPERT_REMOTE);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "opencode-go-usage-dock: dictionaries");
      const t = ctx.locale.bind(NS);

      const query = async () => {
        await mountReady;
        const api = ctx.get("remote.opencodeUsage");
        if (!api) throw new Error("opencodeUsage remote is unavailable");
        return api.usage();
      };
      const injected = () => ({ query, t });

      // conversation.composer.dock: the band under the composer card, inside
      // the bar's width column — same seat as the shipped stats line.
      ctx.slots.inject("conversation.composer.dock", () =>
        ctx.slots.register(
          {
            name: "conversation.composer.dock",
            id: "opencode-go-usage-dock",
            order: 10,
            label: () => t("nav"),
            locale: NS,
            inject: injected,
          },
          UsageDock
        )
      );
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
