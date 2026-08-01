#!/usr/bin/env node
/**
 * XYTEEE Nexus – development reverse proxy (port 5000)
 *
 *  /api/*  →  FastAPI backend  (localhost:8000)
 *  /*      →  Expo web dev server (localhost:5001)
 *
 * Handles both HTTP and WebSocket upgrades so that realtime (/api/ws)
 * and Expo's HMR websocket both work through the single public port.
 */

const http = require("http");
const net  = require("net");

const BACKEND_PORT = 8000;
const EXPO_PORT    = 5001;
const PROXY_PORT   = 5000;

// ── HTTP proxy ────────────────────────────────────────────────────────────────
function proxyHTTP(req, res, targetPort) {
  // strip hop-by-hop headers that cannot be forwarded
  const headers = Object.assign({}, req.headers);
  delete headers["proxy-connection"];

  const opts = {
    hostname : "localhost",
    port     : targetPort,
    path     : req.url,
    method   : req.method,
    headers,
  };

  const upstream = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res, { end: true });
  });

  upstream.on("error", (err) => {
    console.error(`[proxy] HTTP error → :${targetPort} ${req.url}:`, err.message);
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(upstream, { end: true });
}

const server = http.createServer((req, res) => {
  const target = req.url.startsWith("/api") ? BACKEND_PORT : EXPO_PORT;
  proxyHTTP(req, res, target);
});

// ── WebSocket proxy ───────────────────────────────────────────────────────────
server.on("upgrade", (req, clientSocket, head) => {
  const targetPort = req.url.startsWith("/api") ? BACKEND_PORT : EXPO_PORT;

  const upstream = net.createConnection(targetPort, "localhost");

  upstream.on("connect", () => {
    // Replay the HTTP Upgrade handshake to the target
    const headerLines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      headerLines.push(`${k}: ${v}`);
    }
    upstream.write(headerLines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) upstream.write(head);

    clientSocket.pipe(upstream);
    upstream.pipe(clientSocket);
  });

  upstream.on("error", (err) => {
    console.error(`[proxy] WS error → :${targetPort} ${req.url}:`, err.message);
    clientSocket.destroy();
  });

  clientSocket.on("error", () => upstream.destroy());
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[proxy] listening on :${PROXY_PORT}`);
  console.log(`[proxy]   /api/*  → localhost:${BACKEND_PORT}`);
  console.log(`[proxy]   /*      → localhost:${EXPO_PORT}`);
});
