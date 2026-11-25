// POST { subject, text }  -> sends a Gmail message to ALERT_EMAIL (defaults to GMAIL_USER).
// Uses Gmail SMTP over TLS (port 465) with an App Password. No dependencies.
const tls = require('tls');
const authorised = require('./_auth');

function smtpSend({ user, pass, to, subject, text }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
    socket.setEncoding('utf8');
    socket.setTimeout(15000, () => { socket.destroy(); reject(new Error('SMTP timeout')); });

    let buf = '';
    let waiter = null;
    socket.on('data', (d) => {
      buf += d;
      // A reply is complete when its last line is "NNN text" (space, not dash).
      const lines = buf.split('\r\n');
      const complete = lines.filter(Boolean);
      const last = complete[complete.length - 1];
      if (buf.endsWith('\r\n') && last && /^\d{3} /.test(last) && waiter) {
        const w = waiter; waiter = null; const reply = buf; buf = '';
        w(reply);
      }
    });
    socket.on('error', reject);

    const read = () => new Promise((r) => { waiter = r; });
    const send = async (line, expect) => {
      socket.write(line + '\r\n');
      const reply = await read();
      if (!reply.startsWith(String(expect))) throw new Error('SMTP ' + reply.trim());
    };

    (async () => {
      const greet = await read();
      if (!greet.startsWith('220')) throw new Error('SMTP ' + greet.trim());
      await send('EHLO expense-tracker', 250);
      await send('AUTH PLAIN ' + Buffer.from('\0' + user + '\0' + pass).toString('base64'), 235);
      await send('MAIL FROM:<' + user + '>', 250);
      await send('RCPT TO:<' + to + '>', 250);
      await send('DATA', 354);
      const safeSubject = '=?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=';
      const body = String(text).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      const msg =
        'From: Expense Tracker <' + user + '>\r\n' +
        'To: ' + to + '\r\n' +
        'Subject: ' + safeSubject + '\r\n' +
        'MIME-Version: 1.0\r\n' +
        'Content-Type: text/plain; charset=UTF-8\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        Buffer.from(body).toString('base64').replace(/(.{76})/g, '$1\r\n') + '\r\n.';
      await send(msg, 250);
      socket.write('QUIT\r\n');
      socket.end();
    })().then(resolve, (e) => { socket.destroy(); reject(e); });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!authorised(req)) return res.status(401).json({ error: 'Wrong passcode' });

  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) return res.status(500).json({ error: 'GMAIL_USER / GMAIL_APP_PASSWORD are not set on the server' });

  const { subject, text } = req.body || {};
  if (!subject || !text) return res.status(400).json({ error: 'subject and text required' });

  try {
    await smtpSend({
      user, pass,
      to: process.env.ALERT_EMAIL || user,
      subject: String(subject).slice(0, 150),
      text: String(text).slice(0, 5000),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
