import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';
import { allocateReferralCode } from '../lib/referrals';
import { sendWelcomeEmail } from '../lib/email';

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
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
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

export default router;
