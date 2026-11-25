// POST { image: "data:image/jpeg;base64,...." }  ->  { date, amount, merchant, category, note }
const authorised = require('./_auth');

const CATEGORIES = ['Shopping', 'Grocery', 'Transport', 'Petrol', 'Food', 'Entertainment', 'Others'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!authorised(req)) return res.status(401).json({ error: 'Wrong passcode' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });

  const image = (req.body && req.body.image) || '';
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image);
  if (!m) return res.status(400).json({ error: 'Send a base64 image data URL' });

  const prompt =
    'You are reading a receipt or payment screenshot. Return ONLY a JSON object, no prose, with keys: ' +
    '"date" (YYYY-MM-DD, or null if not visible), "amount" (the final total paid as a number, no currency symbol), ' +
    '"merchant" (shop or payee name), "category" (exactly one of: ' + CATEGORIES.join(', ') + '), ' +
    '"note" (very short description of what was bought, or empty string). ' +
    'Category hints: supermarkets/FairPrice/Sheng Siong/Cold Storage = Grocery; restaurants, cafes, food delivery = Food; ' +
    'Grab/taxi/MRT/bus/EZ-Link = Transport; fuel stations = Petrol; cinema/games/streaming/concerts = Entertainment; ' +
    'retail/clothes/electronics/online shopping = Shopping; anything else = Others.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || 'AI request failed' });

    const text = (data.content || []).map((b) => b.text || '').join('');
    const j = /\{[\s\S]*\}/.exec(text);
    if (!j) return res.status(502).json({ error: 'Could not read the receipt' });
    const out = JSON.parse(j[0]);

    const amount = parseFloat(out.amount);
    res.status(200).json({
      date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || '') ? out.date : null,
      amount: Number.isFinite(amount) ? amount : null,
      merchant: String(out.merchant || '').slice(0, 80),
      category: CATEGORIES.includes(out.category) ? out.category : 'Others',
      note: String(out.note || '').slice(0, 120),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
