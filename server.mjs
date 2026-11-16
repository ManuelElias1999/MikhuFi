import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
    let filePath = join(root, safePath);
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
  }
}).listen(port, () => {
  console.log(`MikhuFi disponible en http://localhost:${port}`);
});
