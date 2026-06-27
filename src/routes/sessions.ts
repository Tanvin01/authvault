import { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req: any) => {
    return db.session.findMany({ where: { userId: req.userId }, orderBy: { lastUsed: "desc" } });
  });
  app.delete("/:id", async (req: any) => {
    await db.session.deleteMany({ where: { id: (req.params as any).id, userId: req.userId } });
    return { message: "Session revoked" };
  });
};
export default sessionRoutes;
