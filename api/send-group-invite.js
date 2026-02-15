module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { emails, groupName, inviteUrl } = req.body || {};
    const toEmails = Array.isArray(emails)
      ? emails.map((e) => String(e || '').trim()).filter(Boolean)
      : [];

    if (!toEmails.length || !groupName || !inviteUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const resendApiKey = process.env.RESEND_API_KEY || '';
    const fromEmail = process.env.INVITE_FROM_EMAIL || '';
    if (!resendApiKey || !fromEmail) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Set RESEND_API_KEY and INVITE_FROM_EMAIL in environment variables',
      });
    }

    const failed = [];
    for (const email of toEmails) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `Join ${groupName} on CTRL-ALT-FIT`,
          text: `Hi,\n\nYou've been invited to join "${groupName}" on CTRL-ALT-FIT.\n\nJoin link: ${inviteUrl}\n\nAdmin approval may be required before entering the group.\n`,
        }),
      });

      if (!response.ok) {
        const msg = await response.text();
        failed.push({ email, error: msg.slice(0, 200) });
      }
    }

    if (failed.length) {
      return res.status(207).json({
        sent: toEmails.length - failed.length,
        failed,
      });
    }

    return res.status(200).json({ sent: toEmails.length });
  } catch (error) {
    console.error('Invite send error:', error);
    return res.status(500).json({ error: 'Failed to send invites', message: error.message });
  }
};
