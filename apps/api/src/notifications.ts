import { getAppOnlyToken } from './routes/outlook.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface NotifyUser {
  id: string;
  name: string | null;
  email: string;
}

async function sendViaMsGraph(token: string, senderEmail: string, to: string, subject: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`, {
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
  const result = await getAppOnlyToken();
  if (!result) return { sent: false, inviteUrl };
  const displayName = escapeHtml(user.name ?? user.email);
  try {
    await sendViaMsGraph(
      result.token,
      result.senderEmail,
      user.email,
      'You have been invited to TischlerCRM',
      `<p>Hello ${displayName},</p>
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
  const result = await getAppOnlyToken();
  if (!result) return { sent: false, resetUrl };
  const displayName = escapeHtml(user.name ?? user.email);
  try {
    await sendViaMsGraph(
      result.token,
      result.senderEmail,
      user.email,
      'Reset your TischlerCRM password',
      `<p>Hello ${displayName},</p>
       <p>A password reset was requested for your account. Click the link below to set a new password.</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`
    );
    return { sent: true, resetUrl };
  } catch {
    return { sent: false, resetUrl };
  }
}

