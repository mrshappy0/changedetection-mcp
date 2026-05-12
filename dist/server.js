#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const BASE_URL = (process.env.CHANGEDETECTION_URL ?? "http://localhost:5000").replace(/\/$/, "");
const API_KEY = process.env.CHANGEDETECTION_API_KEY ?? "";
const server = new McpServer({
    name: "changedetection",
    version: "0.1.0",
});
// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function headers(extra = {}) {
    return { "x-api-key": API_KEY, "Content-Type": "application/json", ...extra };
}
async function api(method, path, opts = {}) {
    const url = new URL(`${BASE_URL}/api/v1${path}`);
    if (opts.params) {
        for (const [k, v] of Object.entries(opts.params))
            url.searchParams.set(k, v);
    }
    const h = headers(opts.contentType ? { "Content-Type": opts.contentType } : {});
    const res = await fetch(url.toString(), {
        method,
        headers: h,
        body: opts.body !== undefined
            ? opts.contentType === "text/plain"
                ? String(opts.body)
                : JSON.stringify(opts.body)
            : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`changedetection.io ${method} ${path} → ${res.status}: ${text}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
}
const get = (path, params) => api("GET", path, { params });
const post = (path, body, contentType) => api("POST", path, { body, contentType });
const put = (path, body) => api("PUT", path, { body });
const del = (path, body) => api("DELETE", path, { body });
function ok(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
server.tool("get_system_info", "Return changedetection.io system status: watch count, tag count, uptime, version.", {}, async () => ok(await get("/systeminfo")));
// ---------------------------------------------------------------------------
// Watch management
// ---------------------------------------------------------------------------
server.tool("list_watches", "List all watches (page monitors), optionally filtered by tag.", {
    tag: z.string().optional().describe("Filter by tag name"),
    recheck_all: z.boolean().optional().describe("Force-recheck all watches before returning"),
}, async ({ tag, recheck_all }) => {
    const params = {};
    if (tag)
        params.tag = tag;
    if (recheck_all)
        params.recheck_all = "1";
    return ok(await get("/watch", params));
});
const WatchFields = {
    url: z.string().describe("URL to monitor"),
    title: z.string().optional().describe("Human-friendly label"),
    fetch_backend: z
        .enum(["html_requests", "html_webdriver", "system"])
        .optional()
        .describe("html_requests = fast/no JS; html_webdriver = Selenium (default); system = system default"),
    processor: z
        .enum(["text_json_diff", "restock_diff"])
        .optional()
        .describe("text_json_diff = general diff; restock_diff = price/stock tracking"),
    include_filters: z
        .array(z.string())
        .optional()
        .describe("CSS or XPath selectors to extract, e.g. ['#price', '.product-title']"),
    subtractive_selectors: z
        .array(z.string())
        .optional()
        .describe("CSS/XPath selectors to strip before diffing"),
    trigger_text: z
        .array(z.string())
        .optional()
        .describe("Regex/text patterns — only fire notification when one matches"),
    ignore_text: z.array(z.string()).optional().describe("Patterns to ignore in diffs"),
    conditions: z
        .array(z.record(z.unknown()))
        .optional()
        .describe("Advanced condition rule objects"),
    conditions_match_logic: z
        .enum(["ALL", "ANY"])
        .optional()
        .describe("How conditions combine (default ALL)"),
    notification_urls: z
        .array(z.string())
        .optional()
        .describe("Apprise notification URLs, e.g. ['discord://token/channel']"),
    notification_title: z
        .string()
        .optional()
        .describe("Custom notification title (supports template vars like {{watch_url}})"),
    notification_body: z
        .string()
        .optional()
        .describe("Custom notification body (supports {{current_snapshot}}, {{diff}}, etc.)"),
    time_between_check: z
        .record(z.number())
        .optional()
        .describe("Dict like {hours: 1} or {minutes: 30}"),
    webdriver_delay: z
        .number()
        .optional()
        .describe("Seconds to wait after page load before capture"),
    webdriver_js_execute_code: z
        .string()
        .optional()
        .describe("JavaScript to execute in the browser before capture"),
    browser_steps: z
        .array(z.record(z.unknown()))
        .optional()
        .describe("Playwright-style automation steps array"),
    tags: z.array(z.string()).optional().describe("Tag UUIDs to assign"),
    paused: z.boolean().optional().describe("Start the watch paused"),
    track_ldjson_price_data: z.boolean().optional().describe("Enable JSON-LD price extraction"),
    llm_intent: z
        .string()
        .optional()
        .describe("Plain-English description of what changes should trigger an alert (AI filtering)"),
    price_change_min: z
        .number()
        .optional()
        .describe("(restock_diff) Trigger notification when price drops BELOW this value"),
    price_change_max: z
        .number()
        .optional()
        .describe("(restock_diff) Trigger notification when price rises ABOVE this value"),
    price_change_threshold_percent: z
        .number()
        .optional()
        .describe("(restock_diff) Minimum % change from original price required to trigger a notification — filters out small noise"),
};
server.tool("create_watch", "Create a new page monitor (watch). Use processor='restock_diff' for price/stock tracking.", WatchFields, async (args) => {
    const payload = { url: args.url };
    const optionals = [
        "title", "fetch_backend", "processor", "include_filters", "subtractive_selectors",
        "trigger_text", "ignore_text", "conditions", "conditions_match_logic",
        "notification_urls", "notification_title", "notification_body",
        "webdriver_delay", "webdriver_js_execute_code", "browser_steps",
        "tags", "paused", "track_ldjson_price_data", "llm_intent",
    ];
    for (const key of optionals) {
        if (args[key] !== undefined)
            payload[key] = args[key];
    }
    if (args.time_between_check) {
        payload.time_between_check = args.time_between_check;
        payload.time_between_check_use_default = false;
    }
    const restockConfig = {};
    if (args.price_change_min !== undefined)
        restockConfig.price_change_min = args.price_change_min;
    if (args.price_change_max !== undefined)
        restockConfig.price_change_max = args.price_change_max;
    if (args.price_change_threshold_percent !== undefined)
        restockConfig.price_change_threshold_percent = args.price_change_threshold_percent;
    if (Object.keys(restockConfig).length > 0)
        payload.processor_config_restock_diff = restockConfig;
    return ok(await post("/watch", payload));
});
server.tool("get_watch", "Get full details for a single watch including last_error, last_checked, current snapshot content.", {
    uuid: z.string().describe("Watch UUID"),
    recheck: z.boolean().optional().describe("Queue an immediate recheck"),
}, async ({ uuid, recheck }) => {
    const params = {};
    if (recheck)
        params.recheck = "1";
    return ok(await get(`/watch/${uuid}`, params));
});
server.tool("update_watch", "Update an existing watch. Only provided fields are changed.", {
    uuid: z.string().describe("Watch UUID to update"),
    ...Object.fromEntries(Object.entries(WatchFields)
        .filter(([k]) => k !== "url")
        .map(([k, v]) => [k, v.optional()])),
    url: z.string().optional().describe("New URL"),
    notification_muted: z.boolean().optional().describe("Mute notifications for this watch"),
}, async ({ uuid, ...args }) => {
    const payload = {};
    const restockOnlyFields = new Set(["price_change_min", "price_change_max", "price_change_threshold_percent"]);
    for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && !restockOnlyFields.has(k))
            payload[k] = v;
    }
    if (payload.time_between_check)
        payload.time_between_check_use_default = false;
    const restockConfig = {};
    if (args.price_change_min !== undefined)
        restockConfig.price_change_min = args.price_change_min;
    if (args.price_change_max !== undefined)
        restockConfig.price_change_max = args.price_change_max;
    if (args.price_change_threshold_percent !== undefined)
        restockConfig.price_change_threshold_percent = args.price_change_threshold_percent;
    if (Object.keys(restockConfig).length > 0)
        payload.processor_config_restock_diff = restockConfig;
    return ok(await put(`/watch/${uuid}`, payload));
});
server.tool("delete_watch", "Delete a watch and all its history.", { uuid: z.string().describe("Watch UUID") }, async ({ uuid }) => ok(await del(`/watch/${uuid}`)));
server.tool("set_watch_state", "Pause/unpause or mute/unmute a watch.", {
    uuid: z.string().describe("Watch UUID"),
    paused: z.boolean().optional().describe("true = pause, false = unpause"),
    muted: z.boolean().optional().describe("true = mute notifications, false = unmute"),
}, async ({ uuid, paused, muted }) => {
    const params = {};
    if (paused === true)
        params.paused = "paused";
    else if (paused === false)
        params.paused = "unpaused";
    if (muted === true)
        params.muted = "muted";
    else if (muted === false)
        params.muted = "unmuted";
    return ok(await get(`/watch/${uuid}`, params));
});
// ---------------------------------------------------------------------------
// History & diffs
// ---------------------------------------------------------------------------
server.tool("get_watch_history", "List all historical snapshots for a watch. Returns {unix_timestamp: path} dict.", { uuid: z.string().describe("Watch UUID") }, async ({ uuid }) => ok(await get(`/watch/${uuid}/history`)));
server.tool("get_watch_snapshot", "Get the text content of a snapshot. Use timestamp='latest' for the most recent.", {
    uuid: z.string().describe("Watch UUID"),
    timestamp: z.string().default("latest").describe("Unix timestamp or 'latest'"),
    html: z.boolean().optional().describe("Return raw HTML instead of extracted text"),
}, async ({ uuid, timestamp, html }) => {
    const url = new URL(`${BASE_URL}/api/v1/watch/${uuid}/history/${timestamp}`);
    if (html)
        url.searchParams.set("html", "1");
    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok)
        throw new Error(`${res.status}: ${await res.text()}`);
    return { content: [{ type: "text", text: await res.text() }] };
});
server.tool("get_watch_diff", "Get the diff between two snapshots of a watch.", {
    uuid: z.string().describe("Watch UUID"),
    from_timestamp: z.string().default("previous").describe("Start snapshot — 'previous' or Unix timestamp"),
    to_timestamp: z.string().default("latest").describe("End snapshot — 'latest' or Unix timestamp"),
    format: z
        .enum(["text", "html", "htmlcolor", "markdown"])
        .default("markdown")
        .describe("Output format"),
    word_diff: z.boolean().optional().describe("Highlight word-level changes instead of line-level"),
}, async ({ uuid, from_timestamp, to_timestamp, format, word_diff }) => {
    const url = new URL(`${BASE_URL}/api/v1/watch/${uuid}/difference/${from_timestamp}/${to_timestamp}`);
    url.searchParams.set("format", format);
    if (word_diff)
        url.searchParams.set("word_diff", "true");
    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok)
        throw new Error(`${res.status}: ${await res.text()}`);
    return { content: [{ type: "text", text: await res.text() }] };
});
// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
server.tool("search_watches", "Search watches by URL or title.", {
    query: z.string().describe("Search string"),
    tag: z.string().optional().describe("Restrict to this tag name"),
}, async ({ query, tag }) => {
    const params = { q: query };
    if (tag)
        params.tag = tag;
    return ok(await get("/search", params));
});
// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
server.tool("list_tags", "List all tags/groups with UUIDs and settings.", {}, async () => ok(await get("/tags")));
server.tool("create_tag", "Create a tag/group for organizing watches. Can auto-apply to URLs matching a glob pattern.", {
    title: z.string().describe("Tag name"),
    notification_urls: z.array(z.string()).optional().describe("Notification URLs for all watches in this tag"),
    url_match_pattern: z.string().optional().describe("Glob pattern to auto-apply tag, e.g. '*.amazon.com/*'"),
    overrides_watch: z.boolean().optional().describe("Tag settings override per-watch settings"),
}, async ({ title, notification_urls, url_match_pattern, overrides_watch }) => {
    const payload = { title };
    if (notification_urls)
        payload.notification_urls = notification_urls;
    if (url_match_pattern)
        payload.url_match_pattern = url_match_pattern;
    if (overrides_watch !== undefined)
        payload.overrides_watch = overrides_watch;
    return ok(await post("/tag", payload));
});
server.tool("update_tag", "Update a tag.", {
    uuid: z.string().describe("Tag UUID"),
    title: z.string().optional(),
    notification_urls: z.array(z.string()).optional(),
    url_match_pattern: z.string().optional(),
    overrides_watch: z.boolean().optional(),
}, async ({ uuid, ...args }) => {
    const payload = {};
    for (const [k, v] of Object.entries(args))
        if (v !== undefined)
            payload[k] = v;
    return ok(await put(`/tag/${uuid}`, payload));
});
server.tool("delete_tag", "Delete a tag (removes it from all watches).", { uuid: z.string().describe("Tag UUID") }, async ({ uuid }) => ok(await del(`/tag/${uuid}`)));
// ---------------------------------------------------------------------------
// Global notifications
// ---------------------------------------------------------------------------
server.tool("get_notifications", "Get the global notification URL list (applies to all watches by default).", {}, async () => ok(await get("/notifications")));
server.tool("add_notifications", "Append notification URLs to the global list.", { notification_urls: z.array(z.string()).describe("Apprise URLs to add, e.g. ['discord://token/channel']") }, async ({ notification_urls }) => ok(await post("/notifications", { notification_urls })));
server.tool("replace_notifications", "Replace the entire global notification URL list. Pass [] to clear all.", { notification_urls: z.array(z.string()) }, async ({ notification_urls }) => ok(await put("/notifications", { notification_urls })));
// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------
server.tool("import_watches", "Bulk-import a list of URLs as new watches.", {
    urls: z.array(z.string()).describe("URLs to monitor"),
    tag: z.string().optional().describe("Tag name to apply to all"),
    fetch_backend: z.enum(["html_requests", "html_webdriver"]).optional(),
    processor: z.enum(["text_json_diff", "restock_diff"]).optional(),
    dedupe: z.boolean().default(true).describe("Skip URLs already being monitored"),
}, async ({ urls, tag, fetch_backend, processor, dedupe }) => {
    const url = new URL(`${BASE_URL}/api/v1/import`);
    url.searchParams.set("dedupe", dedupe ? "true" : "false");
    if (tag)
        url.searchParams.set("tag", tag);
    if (fetch_backend)
        url.searchParams.set("fetch_backend", fetch_backend);
    if (processor)
        url.searchParams.set("processor", processor);
    const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "x-api-key": API_KEY, "Content-Type": "text/plain" },
        body: urls.join("\n"),
    });
    if (!res.ok)
        throw new Error(`${res.status}: ${await res.text()}`);
    return ok(await res.json());
});
// ---------------------------------------------------------------------------
// Test notification (UI route — requires CSRF token + session cookie)
// ---------------------------------------------------------------------------
/** Fetch a CSRF token + session cookie from the changedetection.io UI. */
async function fetchCsrfToken() {
    const res = await fetch(`${BASE_URL}/`, { headers: { "x-api-key": API_KEY } });
    if (!res.ok)
        throw new Error(`Failed to load changedetection.io home (${res.status})`);
    const html = await res.text();
    const match = html.match(/<input[^>]+name="csrf_token"[^>]+value="([^"]+)"/);
    if (!match)
        throw new Error("Could not extract CSRF token from changedetection.io UI");
    const setCookie = res.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0]; // e.g. "session=eyJ..."
    return { csrf: match[1], cookie };
}
server.tool("send_test_notification", "Fire a test notification through changedetection.io to verify your Apprise URL config. " +
    "Supply at least one notification_url (or omit to use the watch/global default). " +
    "Returns 'OK - Sent test notifications' on success.", {
    uuid: z.string().optional().describe("Watch UUID to use for context (snapshot, URL). Omit to pick a random watch."),
    notification_urls: z
        .array(z.string())
        .optional()
        .describe("Apprise URLs to test, e.g. ['discord://webhook-id/token']. Omit to use the watch or global default."),
    notification_title: z.string().optional().describe("Override notification title"),
    notification_body: z.string().optional().describe("Override notification body"),
    notification_format: z
        .enum(["text", "markdown", "html"])
        .optional()
        .describe("Notification format (default: system setting)"),
    window_url: z.string().optional().describe("Watch URL to embed in the notification. Defaults to changedetection.io homepage."),
}, async ({ uuid, notification_urls, notification_title, notification_body, notification_format, window_url }) => {
    const { csrf, cookie } = await fetchCsrfToken();
    const route = uuid
        ? `/notification/send-test/${uuid}`
        : `/notification/send-test`;
    const form = new URLSearchParams();
    form.set("csrf_token", csrf);
    if (notification_urls?.length)
        form.set("notification_urls", notification_urls.join("\n"));
    if (notification_title)
        form.set("notification_title", notification_title);
    if (notification_body)
        form.set("notification_body", notification_body);
    if (notification_format)
        form.set("notification_format", notification_format);
    if (window_url)
        form.set("window_url", window_url);
    const res = await fetch(`${BASE_URL}${route}`, {
        method: "POST",
        headers: {
            "x-api-key": API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie,
        },
        body: form.toString(),
    });
    const text = await res.text();
    if (!res.ok)
        throw new Error(`changedetection.io test notification failed (${res.status}): ${text}`);
    return { content: [{ type: "text", text }] };
});
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
