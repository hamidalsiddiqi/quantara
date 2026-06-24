import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../db';
import { env } from '../env';
import { hashPassword, verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';
import { allocateReferralCode } from '../lib/referrals';
import { sendWelcomeEmail, sendPasswordResetEmail, sendReferralSignupEmail } from '../lib/email';

/// Hash a raw reset token for storage/lookup. We only ever persist the hash so a
/// leaked database row cannot be used to reset an account.
function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const router = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  referralCode: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[A-Za-z0-9]+$/)
    .transform((s) => s.toUpperCase())
    .optional(),
});

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, username, password, referralCode } = parsed.data;

  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (exists) {
    res.status(409).json({ error: 'email or username already in use' });
    return;
  }

  let referrerId: string | null = null;
  let referrer: { id: string; email: string; username: string } | null = null;
  if (referralCode) {
    referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true, email: true, username: true },
    });
    if (!referrer) {
      res.status(400).json({ error: 'invalid referral code' });
      return;
    }
    referrerId = referrer.id;
  }

  const passwordHash = await hashPassword(password);
  const myReferralCode = await allocateReferralCode();
  const user = await prisma.user.create({
    data: { email, username, passwordHash, referrerId, referralCode: myReferralCode },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      referralCode: true,
      referrerId: true,
    },
  });

  const token = signToken({ sub: user.id, isAdmin: user.isAdmin });

  // Send welcome email asynchronously
  sendWelcomeEmail(user.email, user.username).catch(() => { });

  // Notify the sponsor that a new member joined their team.
  if (referrer) {
    sendReferralSignupEmail(referrer.email, referrer.username, user.username).catch(() => { });
  }

  res.status(201).json({ user, token });
});

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }
  // Backfill a referral code for legacy users who don't have one yet.
  let referralCode = user.referralCode;
  if (!referralCode) {
    referralCode = await allocateReferralCode();
    await prisma.user.update({ where: { id: user.id }, data: { referralCode } });
  }
  const token = signToken({ sub: user.id, isAdmin: user.isAdmin });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      referralCode,
      referrerId: user.referrerId,
    },
    token,
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      bscDepositAddress: true,
      bscWithdrawAddress: true,
      referralCode: true,
      referrerId: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json({ user });
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
});

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post('/forgot-password', authLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, username: true } });
  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${rawToken}`;
    sendPasswordResetEmail(user.email, user.username, resetUrl).catch(() => { });
  }

  // Always respond the same way to avoid leaking which emails are registered.
  res.json({ ok: true });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashResetToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    res.status(400).json({ error: 'invalid or expired token' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding reset tokens for this user.
    prisma.passwordReset.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});

export default router;
