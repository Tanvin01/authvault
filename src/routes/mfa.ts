import { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { generateTotpSecret, generateQRCode, verifyTotp } from "../lib/totp";
import { createAuditLog } from "../lib/audit";
const mfaRoutes: FastifyPluginAsync = async (app) => {
  app.post("/setup", async (req: any, reply) => {
    const user = await db.user.findUnique({ where: { id: req.userId } });
    if (!user) return reply.status(404).send({ error: "User not found" });
    const secret = generateTotpSecret();
    const qrCode = await generateQRCode(user.email, secret);
    await redis.set(`authvault:mfa_setup:${req.userId}`, secret, { EX: 600 });
    return reply.send({ secret, qrCode });
  });
  app.post("/verify", async (req: any, reply) => {
    const { code } = req.body as { code: string };
    const secret = await redis.get(`authvault:mfa_setup:${req.userId}`);
    if (!secret) return reply.status(400).send({ error: "Setup session expired" });
    if (!verifyTotp(secret, code)) return reply.status(400).send({ error: "Invalid code" });
    await db.user.update({ where: { id: req.userId }, data: { mfaEnabled: true, mfaSecret: secret } });
    await redis.del(`authvault:mfa_setup:${req.userId}`);
    await createAuditLog({ userId: req.userId, action: "MFA_ENABLED", ip: req.ip });
    return reply.send({ message: "MFA enabled successfully" });
  });
  app.post("/disable", async (req: any, reply) => {
    await db.user.update({ where: { id: req.userId }, data: { mfaEnabled: false, mfaSecret: null } });
    await createAuditLog({ userId: req.userId, action: "MFA_DISABLED", ip: req.ip });
    return reply.send({ message: "MFA disabled" });
  });
};
export default mfaRoutes;
