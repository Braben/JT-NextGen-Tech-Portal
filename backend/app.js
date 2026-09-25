/**
 * Express Application — builds and exports the app without starting
 * the HTTP server. This separation allows integration tests to import
 * the app and drive it with supertest, without binding to a port.
 *
 * server.js imports this module and calls app.listen().
 */

require("dotenv").config();

const { validateRuntimeEnv } = require("./lib/env");

try {
  validateRuntimeEnv();
} catch (err) {
  console.error(
    `[security] ${err.message}. Generate JWT_SECRET with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  );
  if (process.env.NODE_ENV === "production") process.exit(1);
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const securityHeaders = require("./lib/securityHeaders");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

const db = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");

/* ---- Route modules ---- */
const authRoutes = require("./routes/auth");
const assignmentRoutes = require("./routes/assignments");
const submissionRoutes = require("./routes/submissions");
const gradingRoutes = require("./routes/grading");
const gradebookRoutes = require("./routes/gradebook");
const notificationRoutes = require("./routes/notifications");
const onboardingAssessmentRoutes = require("./routes/onboardingAssessments");
const chatbotRoutes = require("./routes/chatbot");
const programRoutes = require("./routes/programs");
const programClassRoutes = require("./routes/programClasses");
const enrollmentRoutes = require("./routes/enrollments");
const adminRoutes = require("./routes/admin");
const messageRoutes = require("./routes/messages");
const forumRoutes = require("./routes/forums");
const attendanceRoutes = require("./routes/attendance");
const notificationSettingsRoutes = require("./routes/notificationSettings");
const materialRoutes = require("./routes/materials");
const eventRoutes = require("./routes/events");
const quizRoutes = require("./routes/quizzes");
const paymentRoutes = require("./routes/payments");
const blogRoutes = require("./routes/blogs");
const testimonialRoutes = require("./routes/testimonials");
const certificateRoutes = require("./routes/certificates");
const fileRoutes = require("./routes/files");

const app = express();
// Trust only the configured number of ingress hops, never arbitrary forwarded
// headers. Render normally needs one; verify this if the hosting path changes.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || (process.env.RENDER ? 1 : 0));
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error('Invalid TRUST_PROXY_HOPS');
app.set('trust proxy', proxyHops);
const limits = require('./lib/rateLimits');

/* ------------------------------------------------------------------ */
/*  1. Security middleware (applied first, in order)                  */
/* ------------------------------------------------------------------ */

app.use(securityHeaders());

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-socket-id", "X-Portal-CSRF"],
    exposedHeaders: ["Retry-After"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);
app.use('/api/auth', limits.authBurst());
app.use('/api/auth/login', limits.login());
app.use('/api/auth/register', limits.register());
app.use('/api/auth/forgot-password', limits.forgot());
app.use('/api/auth/reset-password', limits.reset());
app.use('/api/auth/refresh', limits.refresh());
app.use(
  "/api/chatbot",
  limits.scoped(20),
);
app.use(
  "/api/admin/contacts",
  limits.scoped(10),
);
app.use(
  "/api/certificates/verify",
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many certificate checks" },
  }),
);
app.use(
  "/api/files",
  limits.scoped(60),
);

// Static assets and health probes must not spend the dashboard API allowance.
app.use('/api', limits.general());

/* ------------------------------------------------------------------ */
/*  2. API routes                                                     */
/* ------------------------------------------------------------------ */

app.use("/api/auth", authRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/grading", gradingRoutes);
app.use("/api/gradebook", gradebookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/onboarding-assessments", onboardingAssessmentRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/program-classes", programClassRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/forums", forumRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/notification-settings", notificationSettingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/social-links", require('./routes/socialLinks'));
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/files", fileRoutes);

try {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
} catch {}

// Uploaded files are served through /api/files/* so each download can run
// through the same ownership checks as the API resource it belongs to.

/* ------------------------------------------------------------------ */
/*  2b. Static frontend (production)                                   */
/* ------------------------------------------------------------------ */

// Serve the built React frontend from ../frontend/dist so the whole app
// runs on a single origin (no CORS, no separate host needed).
// In development the Vite dev server (port 3000) proxies /api & /socket.io.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "..", "frontend", "dist");
  const fs = require("fs");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA fallback — let React Router handle non-API routes
    app.get("*", (req, res, next) => {
      if (
        req.path.startsWith("/api") ||
        req.path.startsWith("/uploads") ||
        req.path.startsWith("/socket.io")
      )
        return next();
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    console.warn(
      "[deploy] frontend/dist not found — run `npm run build` in frontend/",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  3. Health check                                                   */
/* ------------------------------------------------------------------ */

app.get("/api/health", async (req, res) => {
  const dbHealth = await db.health();
  const started = Number(process.uptime().toFixed(1));
  // Uploads dir writability check
  const uploadsDir = path.join(__dirname, "uploads");
  let uploads = { status: "ok", path: uploadsDir };
  try {
    const fs = require("fs");
    fs.accessSync(uploadsDir, fs.constants.W_OK);
  } catch (e) {
    uploads = { status: "error", path: uploadsDir, message: e.message };
  }
  const healthy = dbHealth.status === "ok" && uploads.status === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    database: dbHealth,
    uploads,
    uptimeSeconds: started,
    timestamp: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/*  4. Centralised error handler (must be last)                       */
/* ------------------------------------------------------------------ */

app.use(errorHandler);

module.exports = app;
