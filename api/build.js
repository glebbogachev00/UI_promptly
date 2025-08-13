// api/build.js  (Vercel serverless)
// Requires: set OPENAI_API_KEY in your Vercel Project Settings → Environment Variables.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { dataUrl, instructions } = req.body || {};
    if (!dataUrl) return res.status(400).json({ error: 'Missing dataUrl (base64 image)' });

    // Split the long prompt into system + user parts (optional; safe if you pass full as user)
    const [sysTag, ...rest] = (instructions || '').split('\nUser');
    const systemPrompt = sysTag.replace(/^System\s*/,'').trim();
    const userPrompt = ('User' + rest.join('\nUser')).replace(/^User\s*/,'').trim() || 'Convert the attached screenshot into HTML.';

    // OpenAI Chat Completions
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',         // inexpensive, vision-capable
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: dataUrl } } // data: URL from the browser
            ]
          }
        ],
        max_tokens: 6000
      })
    });

    const json = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: json?.error?.message || 'OpenAI error' });
    }

    // Extract HTML, strip code fences if present
    let html = json?.choices?.[0]?.message?.content || '';
    html = html.replace(/```html\s*([\s\S]*?)\s*```/i, '$1').trim();
    return res.status(200).json({ html });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
