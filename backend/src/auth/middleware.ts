import { NextFunction, Request, Response } from 'express';
import { verifyToken } from './jwt';
import { prisma } from '../db';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isBanned: true }
    });
    if (!user || user.isBanned) {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }
    req.userId = payload.sub;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// Re-checks isAdmin against the database rather than trusting the JWT claim.
// JWTs are signed at login time and embed isAdmin then — so a user promoted
// (or demoted) after their last login would otherwise carry a stale claim
// until they re-authenticate. Admin endpoints are low-volume, so the extra
// query is a worthwhile tradeoff for role changes taking effect immediately.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      res.status(403).json({ error: 'admin only' });
      return;
    }
    req.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
}
