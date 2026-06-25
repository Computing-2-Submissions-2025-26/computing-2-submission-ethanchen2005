/*jslint node, long, white*/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const repoRoot = process.cwd();
const appRoot = normalize(join(repoRoot, "web-app"));
const docsRoot = normalize(join(repoRoot, "docs"));
const port = Number(process.env.PORT || 5173);

const contentTypes = Object.freeze({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".eot": "application/vnd.ms-fontobject",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
});

const indexPathname = function (pathname) {
    if (pathname === "/") {
        return "/index.html";
    }

    if (pathname === "/docs") {
        return "/docs/index.html";
    }

    if (pathname.endsWith("/")) {
        return `${pathname}index.html`;
    }

    return pathname;
};

const safePath = function (requestUrl) {
    const url = new URL(requestUrl, `http://localhost:${port}`);
    let candidate;
    let pathname;

    try {
        pathname = indexPathname(decodeURIComponent(url.pathname));
    } catch (ignore) {
        return null;
    }

    if (pathname.startsWith("/docs/")) {
        candidate = normalize(join(repoRoot, pathname));

        if (!candidate.startsWith(docsRoot)) {
            return null;
        }

        return candidate;
    }

    candidate = normalize(join(appRoot, pathname));

    if (!candidate.startsWith(appRoot)) {
        return null;
    }

    return candidate;
};

const sendNotFound = function (response) {
    response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
};

const sendFile = function (path, response) {
    let contentType = contentTypes[extname(path)];

    if (contentType === undefined) {
        contentType = "application/octet-stream";
    }

    readFile(path).then(function (data) {
        response.writeHead(200, {
            "Content-Type": contentType
        });
        response.end(data);
    }).catch(function () {
        sendNotFound(response);
    });
};

const server = createServer(function (request, response) {
    const path = safePath(request.url);

    if (path === null) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    sendFile(path, response);
});

server.listen(port, function () {
    console.log(`Slime Reaction running at http://localhost:${port}`);
});
