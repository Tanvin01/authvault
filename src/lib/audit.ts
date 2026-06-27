import { db } from "./db";
interface AuditParams { userId?: string; action: string; ip?: string; meta?: Record<string, any>; }
export const createAuditLog = async ({ userId, action, ip, meta }: AuditParams) => {
  await (db as any).auditLog.create({ data: { userId, action, ip, meta: meta ? JSON.stringify(meta) : undefined } });
};
