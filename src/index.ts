import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { db } from "./lib/db";
import { redis } from "./lib/redis";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import sessionRoutes from "./routes/sessions";

const app = Fastify({ logger: { level: "info" } });

async function bootstrap() {
  // Plugins
  await app.register(fastifyHelmet);
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (req) => req.ip,
  });

  // Routes
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(sessionRoutes, { prefix: "/auth/sessions" });

  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  const PORT = parseInt(process.env.PORT ?? "4000");
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 AuthVault running on port ${PORT}`);
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  await app.close();
  await db.$disconnect();
  await redis.quit();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
