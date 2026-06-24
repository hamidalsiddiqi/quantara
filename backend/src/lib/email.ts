import nodemailer from 'nodemailer';
import { env } from '../env';

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'localhost',
    port: env.SMTP_PORT || 1025,
    secure: env.SMTP_PORT === 465,
    auth: (env.SMTP_USER && env.SMTP_PASS) ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    } : undefined,
    tls: {
        rejectUnauthorized: false // Helps bypass issues with self-signed SSL on shared hosts / cPanel
    },
    logger: true,
    debug: true,
    connectionTimeout: 15000 // 15 seconds timeout
});

export async function sendWelcomeEmail(to: string, username: string) {
    const html = `
    <h1>Welcome to Quantalix!</h1>
    <p>Hi ${username},</p>
    <p>Thank you for registering. We are thrilled to have you on board!</p>
    <br>
    <p>Best Regards,</p>
    <p>The Quantalix Team</p>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM,
            to,
            subject: 'Welcome to Quantalix!',
            html,
        });
    } catch (err) {
        console.error('[email] failed to send welcome email', err);
    }
}

export async function sendPasswordResetEmail(to: string, username: string, resetUrl: string) {
    const html = `
    <h2>Reset your Quantalix password</h2>
    <p>Hi ${username},</p>
    <p>We received a request to reset your password. Click the link below to choose a new one:</p>
    <p><a href="${resetUrl}">Reset my password</a></p>
    <p>This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email — your password will stay the same.</p>
    <br>
    <p>The Quantalix Team</p>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM,
            to,
            subject: 'Reset your Quantalix password',
            html,
        });
    } catch (err) {
        console.error('[email] failed to send password reset email', err);
    }
}

export async function sendReferralSignupEmail(to: string, referrerUsername: string, newUsername: string) {
    const html = `
    <h2>You've got a new team member!</h2>
    <p>Hi ${referrerUsername},</p>
    <p>Great news — <strong>${newUsername}</strong> just joined Quantalix using your referral code.</p>
    <p>When your referrals invest, you earn commissions across multiple levels. Keep sharing your link to grow your team!</p>
    <br>
    <p>The Quantalix Team</p>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM,
            to,
            subject: "You've got a new team member! - Quantalix",
            html,
        });
    } catch (err) {
        console.error('[email] failed to send referral signup email', err);
    }
}

export async function sendDepositNotificationEmail(to: string, amount: string, txHash: string) {
    const html = `
    <h2>Deposit Confirmed</h2>
    <p>Your deposit of <strong>${amount} USDT</strong> has been successfully processed.</p>
    <p>Transaction Hash: <small>${txHash}</small></p>
    <br>
    <p>Thank you for investing with us!</p>
    <p>The Quantalix Team</p>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM,
            to,
            subject: 'Deposit Confirmation - Quantalix',
            html,
        });
    } catch (err) {
        console.error('[email] failed to send deposit email', err);
    }
}

export async function sendWithdrawalNotificationEmail(to: string, amount: string, netAmount: string, txHash: string) {
    const html = `
    <h2>Withdrawal Sent!</h2>
    <p>Your withdrawal has been successfully broadcast to the network.</p>
    <ul>
      <li>Requested Amount: <strong>${amount} USDT</strong></li>
      <li>Net Received (after fee): <strong>${netAmount} USDT</strong></li>
      <li>Transaction Hash: <small>${txHash}</small></li>
    </ul>
    <br>
    <p>The Quantalix Team</p>
  `;
    try {
        await transporter.sendMail({
            from: env.SMTP_FROM,
            to,
            subject: 'Withdrawal Confirmation - Quantalix',
            html,
        });
    } catch (err) {
        console.error('[email] failed to send withdrawal email', err);
    }
}
