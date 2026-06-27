import jwt from "jsonwebtoken";
import { redis } from "./redis";
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7;
export const generateAccessToken = (payload: { userId: string; role: string }) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: "15m" });
export const generateRefreshToken = async (userId: string, ip: string, ua: string): Promise<string> => {
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d" });
  await redis.set(`authvault:refresh:${token}`, JSON.stringify({ userId, ip, ua }), { EX: REFRESH_TOKEN_TTL });
  return token;
};
export const verifyRefreshToken = async (token: string) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const stored = await redis.get(`authvault:refresh:${token}`);
    if (!stored) return null;
    return payload;
  } catch { return null; }
};
