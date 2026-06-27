import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL,
} from "../lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/mailer";
import { checkBreachedPassword } from "../lib/hibp";
import { createAuditLog } from "../lib/audit";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().optional(),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/register
  app.post("/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);

    // Check for breached password
    const breached = await checkBreachedPassword(body.password);
    if (breached) {
      return reply.status(400).send({
        error: "This password has appeared in a data breach. Please choose a different one.",
      });
    }

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const hashedPassword = await argon2.hash(body.password, { type: argon2.argon2id });
    const user = await db.user.create({
      data: { name: body.name, email: body.email, password: hashedPassword, role: body.role },
    });

    await sendVerificationEmail(user.email, user.id);
    await createAuditLog({ userId: user.id, action: "REGISTER", ip: req.ip });

    return reply.status(201).send({ message: "Registration successful. Please verify your email." });
  });

  // POST /auth/login
  app.post("/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);

    // Rate-limit login attempts per email
    const attemptKey = `authvault:attempts:${body.email}`;
    const attempts = parseInt((await redis.get(attemptKey)) ?? "0");
    if (attempts >= 5) {
      return reply.status(429).send({ error: "Too many login attempts. Try again in 15 minutes." });
    }

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || !user.password) {
      await redis.setEx(attemptKey, 900, String(attempts + 1));
      await createAuditLog({ userId: user?.id, action: "LOGIN_FAILED", ip: req.ip, meta: { email: body.email } });
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await argon2.verify(user.password, body.password);
    if (!valid) {
      await redis.setEx(attemptKey, 900, String(attempts + 1));
      await createAuditLog({ userId: user.id, action: "LOGIN_FAILED", ip: req.ip });
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    // MFA check
    if (user.mfaEnabled) {
      if (!body.mfaCode) {
        return reply.status(200).send({ requiresMfa: true });
      }
      const { verifyTotp } = await import("../lib/totp");
      const mfaValid = verifyTotp(user.mfaSecret!, body.mfaCode);
      if (!mfaValid) {
        await createAuditLog({ userId: user.id, action: "MFA_FAILED", ip: req.ip });
        return reply.status(401).send({ error: "Invalid MFA code" });
      }
    }

    // Clear failed attempts
    await redis.del(attemptKey);

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers["user-agent"] ?? "");

    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_TTL,
      path: "/auth/refresh",
    });

    await createAuditLog({ userId: user.id, action: "LOGIN_SUCCESS", ip: req.ip });

    return reply.send({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // POST /auth/logout
  app.post("/logout", async (req, reply) => {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      // Revoke token in Redis
      await redis.del(`authvault:refresh:${refreshToken}`);
    }
    reply.clearCookie("refresh_token", { path: "/auth/refresh" });
    return reply.send({ message: "Logged out successfully" });
  });

  // GET /auth/refresh
  app.get("/refresh", async (req, reply) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return reply.status(401).send({ error: "No refresh token" });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) return reply.status(401).send({ error: "User not found" });

    // Rotate refresh token
    await redis.del(`authvault:refresh:${refreshToken}`);
    const newRefreshToken = await generateRefreshToken(user.id, req.ip, req.headers["user-agent"] ?? "");
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });

    reply.setCookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_TTL,
      path: "/auth/refresh",
    });

    return reply.send({ accessToken });
  });
};

export default authRoutes;
