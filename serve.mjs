import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("./docs");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript",
  ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json",
  ".webp": "image/webp", ".xml": "application/xml", ".txt": "text/plain",
};

function tryFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) return false;
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
    return true;
  });
}

http.createServer((req, res) => {
  const rawPath = req.url.split("?")[0];
  const candidates = [rawPath, decodeURIComponent(rawPath)];
  const tryPaths = [];
  for (const p of candidates) {
    let fp = path.join(ROOT, p);
    if (p.endsWith("/")) fp = path.join(fp, "index.html");
    tryPaths.push(fp, fp + ".html", path.join(fp, "index.html"));
  }
  (function attempt(i) {
    if (i >= tryPaths.length) { res.writeHead(404); res.end("Not found: " + rawPath); return; }
    fs.readFile(tryPaths[i], (err, data) => {
      if (err) return attempt(i + 1);
      const ext = path.extname(tryPaths[i]);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })(0);
}).listen(4322, () => console.log("serving http://localhost:4321"));
