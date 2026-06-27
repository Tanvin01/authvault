import { FastifyPluginAsync } from "fastify";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";
export const authPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req: any, reply) => {
    const skipPaths = ["/auth/login","/auth/register","/auth/refresh","/health"];
    if (skipPaths.some(p => req.url.startsWith(p))) return;
    const token = req.headers.authorization?.replace("Bearer ","");
    if (!token) return reply.status(401).send({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: string; role: string };
      req.userId = payload.userId; req.userRole = payload.role;
      const user = await db.user.findUnique({ where: { id: payload.userId }, select: { id: true, email: true, role: true } });
      if (!user) return reply.status(401).send({ error: "User not found" });
      req.user = user;
    } catch { return reply.status(401).send({ error: "Invalid token" }); }
  });
};
