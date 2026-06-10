import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 5173);

const contentTypes = Object.freeze({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
});

const safePath = function (requestUrl) {
    const url = new URL(requestUrl, `http://localhost:${port}`);
    let pathname;

    try {
        pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    } catch {
        return null;
    }

    const candidate = normalize(join(root, pathname));

    if (!candidate.startsWith(root)) {
        return null;
    }

    return candidate;
};

const server = createServer(async function (request, response) {
    const path = safePath(request.url);

    if (path === null) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    try {
        const data = await readFile(path);
        response.writeHead(200, {
            "Content-Type": contentTypes[extname(path)] ?? "application/octet-stream"
        });
        response.end(data);
    } catch {
        response.writeHead(404, {
            "Content-Type": "text/plain; charset=utf-8"
        });
        response.end("Not found");
    }
});

server.listen(port, function () {
    console.log(`Slime Reaction running at http://localhost:${port}`);
});
