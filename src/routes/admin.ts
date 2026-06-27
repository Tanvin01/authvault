import { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return reply.status(401).send({ error: "Unauthorized" });
  });
  app.get("/users", async (req, reply) => {
    const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, verified: true, mfaEnabled: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
    return users;
  });
  app.get("/audit-log", async (req, reply) => {
    const logs = await (db as any).auditLog.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    return logs;
  });
};
export default adminRoutes;
