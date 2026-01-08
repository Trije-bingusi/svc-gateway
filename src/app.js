import express from "express";
import client from "prom-client";
import pinoHttp from "pino-http";
import YAML from "yamljs";
import cors from "cors";
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
const VIDEO_UPLOAD_URL = env("VIDEO_UPLOAD_URL");
const TRANSCRIPTION_URL = env("TRANSCRIPTION_URL");

// ---- App ----
const app = express();
app.use(pinoHttp());

// ---- CORS ----
const CORS_ORIGINS = (process.env.CORS_ORIGINS ||
  "http://localhost:3003,http://localhost:3000").split(",");

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: false
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions))

// ---- OpenAPI + docs ----
const openapi = YAML.load("./openapi.yaml");
app.get("/docs/gateway/openapi.json", (_req, res) => res.json(openapi));

app.use(
  "/docs/gateway",
  apiReference({
    spec: { url: "/docs/gateway/openapi.json" },
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
    on: {
      proxyReq: (proxyReq, req) => {
        proxiedCounter.inc({ service: serviceName, method: req.method });
        if (req.user?.sub) proxyReq.setHeader("x-user-sub", String(req.user.sub));
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

// Video upload proxy
const videoUploadProxy = makeProxy(VIDEO_UPLOAD_URL, "video-upload");

// Transcription proxy
const transcriptionProxy = makeProxy(TRANSCRIPTION_URL, "transcription");

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

// Lecture-specific routes - check path to determine which service
app.use("/api/lectures", requireAuth(), (req, res, next) => {
  if (req.path.includes('/upload')) {
    return videoUploadProxy(req, res, next);
  }
  if (req.path.includes('/notes')) {
    return notesProxy(req, res, next);
  }
  if (req.path.includes('/transcribe')) {
    return transcriptionProxy(req, res, next);
  }
  return coursesProxy(req, res, next);
});

// Video uploads
app.use("/api/uploads", requireAuth(), videoUploadProxy);

// Transcriptions
app.use("/api/transcriptions", requireAuth(), transcriptionProxy);

// Users profile endpoints
app.use("/api/users", requireAuth(), usersProxy);

// Video streaming (no auth required for video playback)
app.use("/api/videos", videoUploadProxy);

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log("Gateway listening on port", PORT);
  console.log("Upstreams:", { COURSES_URL, NOTES_URL, USERS_URL, VIDEO_UPLOAD_URL, TRANSCRIPTION_URL });
});
