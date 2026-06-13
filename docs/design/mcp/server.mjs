/**
 * Saku Paper Design — MCP Server
 *
 * Tools exposed to Claude:
 *   open_design        → open HTML in default browser via local HTTP server
 *   list_screens       → list all 5 design screens with descriptions
 *   get_design_tokens  → return Saku color/elevation/subscription tokens
 *   serve_design       → start HTTP server at localhost:4040, return URL
 *   stop_design_server → stop the HTTP server
 *
 * Resource:
 *   design://subscription-ui → full HTML source of the mockup
 *
 * Registered in .claude/settings.local.json under mcpServers.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFile, spawn } from "child_process";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESIGN_HTML = join(__dirname, "..", "subscription-paper-design.html");
const HTTP_PORT = 4040;

let httpServer = null;

// ─── Screen registry ───────────────────────────────────────────────────────
const SCREENS = [
  {
    id: "pricing",
    label: "① Pricing Page",
    description: "Free vs Pro plan cards with Monthly/Annual toggle and 14-day trial CTA",
    component: "app/(tabs)/settings/billing.tsx (pricing view)",
  },
  {
    id: "trial-banner",
    label: "② Trial Banner Variants",
    description: "4 variants: Full banner (countdown), Slim bar (urgent ≤3 days), Progress bar, Expired state",
    component: "src/components/TrialBanner.tsx",
  },
  {
    id: "pro-gate",
    label: "③ ProGate Lock",
    description: "Full-screen gate overlay + inline locked rows for Free users hitting Pro features",
    component: "src/components/ProGate.tsx",
  },
  {
    id: "billing",
    label: "④ Billing Settings",
    description: "Subscription status card, payment methods, invoice history, cancel button",
    component: "app/(tabs)/settings/billing.tsx",
  },
  {
    id: "checkout",
    label: "⑤ Checkout / Payment",
    description: "Order summary, period toggle (monthly/annual), payment tiles (VA/QRIS/GoPay/OVO)",
    component: "app/(tabs)/settings/checkout.tsx",
  },
];

// ─── Design tokens ─────────────────────────────────────────────────────────
const DESIGN_TOKENS = {
  colors: {
    primary:       { value: "#6B8E6B", usage: "Income, active tab, primary button" },
    primaryDark:   { value: "#41594F", usage: "Hero gradient end, pressed state" },
    primarySoft:   { value: "#DEE8D7", usage: "Income badge bg, icon bg" },
    accent:        { value: "#C97B5C", usage: "Expense, destructive actions" },
    accentSoft:    { value: "#F4DDD0", usage: "Expense badge bg" },
    canvas:        { value: "#FAF7F2", usage: "Screen background" },
    canvasSunken:  { value: "#F4EEE3", usage: "Input field bg, sunken areas" },
    surface:       { value: "#FFFFFF", usage: "Card background" },
    mustard:       { value: "#D9A441", usage: "Trial banner, warnings" },
    mustardSoft:   { value: "#FBEFD2", usage: "Trial badge bg" },
    proPurple:     { value: "#7C3AED", usage: "PRO badge text on locked features" },
    proPurpleSoft: { value: "#EDE9FE", usage: "PRO badge background" },
    fg1: { value: "#2D2A26", usage: "Primary heading text" },
    fg2: { value: "#55504A", usage: "Body text" },
    fg3: { value: "#8E887F", usage: "Hint, metadata" },
    fg4: { value: "#A8A39B", usage: "Placeholder, inactive" },
    border:  { value: "#E0DBD2", usage: "Card border" },
    divider: { value: "#ECE4D3", usage: "List separator, tab bar border" },
  },
  elevation: {
    elev1: "0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.08)",
    elev2: "0 3px 6px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.08)",
    elev3: "0 8px 16px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.08)",
    elev4: "0 16px 32px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.08)",
  },
  typography: {
    fontFamily: "Nunito",
    weights: { regular: 400, medium: 500, semiBold: 600, bold: 700, extraBold: 800, black: 900 },
  },
  subscription: {
    tiers: ["free", "pro"],
    pricing: {
      monthly: { amount: 49000, currency: "IDR", display: "Rp 49.000/bulan" },
      annual:  { amount: 490000, currency: "IDR", display: "Rp 490.000/tahun", savingPct: 17 },
    },
    trialDays: 14,
    gracePeriodDays: 3,
    proFeatures: [
      "Auto-import Gmail & IMAP",
      "Workspace (maks 5 anggota)",
      "AI kategorisasi merchant",
      "Custom parser rules bank",
    ],
    paymentMethods: [
      "BCA Virtual Account", "BNI Virtual Account", "BRI Virtual Account",
      "Mandiri Virtual Account", "GoPay", "OVO", "ShopeePay", "QRIS", "Kartu Kredit",
    ],
    statusEnum: ["trialing", "active", "past_due", "canceled", "free"],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function openInBrowser(url) {
  if (process.platform === "win32") {
    // start is a shell built-in, must go through cmd.exe — args are fixed, no user input
    spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    execFile("open", [url]);
  } else {
    execFile("xdg-open", [url]);
  }
}

function startHttpServer() {
  if (httpServer) return `http://localhost:${HTTP_PORT}`;
  if (!existsSync(DESIGN_HTML)) throw new Error(`Design file not found: ${DESIGN_HTML}`);

  const html = readFileSync(DESIGN_HTML, "utf-8");
  httpServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  httpServer.listen(HTTP_PORT);
  return `http://localhost:${HTTP_PORT}`;
}

// ─── MCP Server ────────────────────────────────────────────────────────────
const server = new McpServer({ name: "saku-design", version: "1.0.0" });

// Resource: expose full HTML to Claude
server.resource(
  "subscription-ui",
  "design://subscription-ui",
  async () => {
    const text = existsSync(DESIGN_HTML)
      ? readFileSync(DESIGN_HTML, "utf-8")
      : "Design file not found.";
    return { contents: [{ uri: "design://subscription-ui", mimeType: "text/html", text }] };
  }
);

// Tool: open_design
server.tool(
  "open_design",
  "Open the Saku subscription Paper Design mockup in the default browser (starts local server if needed).",
  {},
  async () => {
    const url = startHttpServer();
    openInBrowser(url);
    return {
      content: [{
        type: "text",
        text: [
          `✅ Design opened at ${url}`,
          "",
          "Screens available (click tabs in browser):",
          ...SCREENS.map((s) => `  • ${s.label} — ${s.description}`),
        ].join("\n"),
      }],
    };
  }
);

// Tool: list_screens
server.tool(
  "list_screens",
  "List all 5 design screens with descriptions and target React Native component paths.",
  {},
  async () => ({
    content: [{
      type: "text",
      text: SCREENS.map(
        (s) => `${s.label}\n  ${s.description}\n  → ${s.component}`
      ).join("\n\n"),
    }],
  })
);

// Tool: get_design_tokens
server.tool(
  "get_design_tokens",
  "Return Saku design tokens (colors, elevation, typography, subscription config) as JSON.",
  {
    category: z
      .enum(["all", "colors", "elevation", "typography", "subscription"])
      .optional()
      .describe("Token category to return. Defaults to 'all'."),
  },
  async ({ category = "all" }) => ({
    content: [{
      type: "text",
      text: JSON.stringify(category === "all" ? DESIGN_TOKENS : DESIGN_TOKENS[category], null, 2),
    }],
  })
);

// Tool: serve_design
server.tool(
  "serve_design",
  "Start the local HTTP server at localhost:4040 to serve the Paper Design HTML. Returns the URL.",
  {},
  async () => {
    const url = startHttpServer();
    return {
      content: [{
        type: "text",
        text: `🌐 Design server running at: ${url}\n\nOpen in browser to view the 5 interactive screens.`,
      }],
    };
  }
);

// Tool: stop_design_server
server.tool(
  "stop_design_server",
  "Stop the local HTTP design server.",
  {},
  async () => {
    if (!httpServer) {
      return { content: [{ type: "text", text: "ℹ️ No design server is currently running." }] };
    }
    await new Promise((resolve) => httpServer.close(resolve));
    httpServer = null;
    return { content: [{ type: "text", text: "🛑 Design server stopped." }] };
  }
);

// ─── Connect via stdio ─────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
