import { prisma } from '@crm/db/client';
import { decrypt } from './crypto.js';

interface NotifyUser {
  id: string;
  name: string | null;
  email: string;
}

async function getOutlookToken(): Promise<string | null> {
  try {
    const integration = await prisma.integration.findUnique({
      where: { provider: 'outlook' },
    });
    if (!integration?.apiKey) return null;
    return decrypt(integration.apiKey);
  } catch {
    return null;
  }
}

async function sendViaMsGraph(token: string, to: string, subject: string, body: string): Promise<void> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  if (!res.ok) throw new Error(`Graph sendMail failed: ${res.status}`);
}

export async function sendInviteEmail(
  user: NotifyUser,
  inviteUrl: string
): Promise<{ sent: boolean; inviteUrl: string }> {
  const token = await getOutlookToken();
  if (!token) return { sent: false, inviteUrl };
  try {
    await sendViaMsGraph(
      token,
      user.email,
      'You have been invited to TischlerCRM',
      `<p>Hello ${user.name ?? user.email},</p>
       <p>You have been added to TischlerCRM. Click the link below to set your password and log in.</p>
       <p><a href="${inviteUrl}">${inviteUrl}</a></p>
       <p>This link expires in 7 days.</p>`
    );
    return { sent: true, inviteUrl };
  } catch {
    return { sent: false, inviteUrl };
  }
}

export async function sendPasswordResetEmail(
  user: NotifyUser,
  resetUrl: string
): Promise<{ sent: boolean; resetUrl: string }> {
  const token = await getOutlookToken();
  if (!token) return { sent: false, resetUrl };
  try {
    await sendViaMsGraph(
      token,
      user.email,
      'Reset your TischlerCRM password',
      `<p>Hello ${user.name ?? user.email},</p>
       <p>A password reset was requested for your account. Click the link below to set a new password.</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`
    );
    return { sent: true, resetUrl };
  } catch {
    return { sent: false, resetUrl };
  }
}
