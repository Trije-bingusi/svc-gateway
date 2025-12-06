import express from "express";
import client from "prom-client";
import pinoHttp from "pino-http";
import YAML from "yamljs";
import { apiReference } from "@scalar/express-api-reference";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requireAuth, requireRoleForWrite } from "./auth.js";

function env(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    if (fallback === undefined) throw new Error(`Missing env: ${name}`);
    return fallback;
  }
  return raw;
}

const PORT = Number(env("PORT", "3000"));

const COURSES_URL = env("COURSES_URL");
const NOTES_URL = env("NOTES_URL");
const USERS_URL = env("USERS_URL");

// ---- App ----
const app = express();
app.use(pinoHttp());

// ---- OpenAPI + docs ----
const openapi = YAML.load("./openapi.yaml");
app.get("/openapi.json", (_req, res) => res.json(openapi));
app.use(
  "/docs",
  apiReference({
    spec: { url: "/openapi.json" },
    theme: "default",
    darkMode: true
  })
);

// ---- Prometheus ----
client.collectDefaultMetrics();

const proxiedCounter = new client.Counter({
  name: "svc_gateway_proxied_requests_total",
  help: "Total proxied requests",
  labelNames: ["service", "method"]
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// ---- Health ----
app.get("/healthz", (_req, res) => res.send("OK"));
app.get("/readyz", (_req, res) => res.send("READY"));

// ---- Proxies ----

function makeProxy(target, serviceName) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    logLevel: "silent",

    pathRewrite: (path, req) => `${req.baseUrl}${path}`,

    on: {
      proxyReq: (proxyReq, req) => {
        proxiedCounter.inc({ service: serviceName, method: req.method });
        if (req.user?.sub) {
          proxyReq.setHeader("x-user-sub", String(req.user.sub));
        }
      }
    }
  });
}

// Courses proxy
const coursesProxy = makeProxy(COURSES_URL, "courses");

// Notes proxy
const notesProxy = makeProxy(NOTES_URL, "notes");

// Users proxy
const usersProxy = makeProxy(USERS_URL, "users");

/**
 * Auth + Authorization rules
 * - All routes require auth
 * - Writes to courses/lectures require "professor" role
 */

// Courses + lectures
app.use(
  "/api/courses",
  requireAuth(),
  requireRoleForWrite("professor"),
  coursesProxy
);

// Notes are at /api/lectures/.../notes in svc-notes
app.use("/api/lectures", requireAuth(), notesProxy);

// Users profile endpoints
app.use("/api/users", requireAuth(), usersProxy);

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log("Gateway listening on port", PORT);
  console.log("Upstreams:", { COURSES_URL, NOTES_URL, USERS_URL });
});
