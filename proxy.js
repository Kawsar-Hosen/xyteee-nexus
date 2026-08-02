const http = require("http");

const server = http.createServer((req, res) => {
  const isApi = req.url.startsWith("/api/");
  const target = isApi ? "localhost:8000" : "localhost:5001";

  const proxyReq = http.request(
    { hostname: target.split(":")[0], port: parseInt(target.split(":")[1]), path: req.url, method: req.method, headers: { ...req.headers, host: target } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Bad Gateway", target }));
  });

  req.pipe(proxyReq);
});

server.listen(5000, () => console.log("Proxy :5000 → /api/* :8000, /* :5001"));
