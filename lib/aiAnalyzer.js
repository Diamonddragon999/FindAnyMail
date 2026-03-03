/**
 * AI Analyzer — OpenRouter Integration.
 */

async function analyzeWithAI(params) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { bestEmail: null, reasoning: 'No OpenRouter key configured.', confidence: 0 };

    const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
    const { firstName, lastName, domain, provider, detectedPattern, smtpResults, websiteEmails, isCatchAll } = params;

    const prompt = `You are an expert at finding business email addresses. Given the following data about a person, determine their most likely email address.

Person: ${firstName} ${lastName}
Company domain: ${domain}
Email provider: ${provider || 'Unknown'}
Website pattern detected: ${detectedPattern || 'None'}
Catch-all domain: ${isCatchAll ? 'Yes' : 'No'}

SMTP verification results:
${smtpResults?.map(r => `  ${r.email}: ${r.status} (${r.category || 'n/a'})`).join('\n') || 'None'}

Emails found on company website:
${websiteEmails?.join(', ') || 'None'}

Based on ALL this data, return ONLY a JSON object (no markdown):
{"bestEmail": "most_likely@email.com", "reasoning": "brief explanation", "confidence": 85}

The confidence should be 0-100. If catch-all is true and SMTP shows valid for all, lower your confidence. If SMTP shows only specific emails as valid, those are very reliable. If the website pattern matches a result, boost confidence.`;

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://findanymail.local',
                'X-Title': 'FindAnyMail',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 220,
            }),
            signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
            const reason = await res.text();
            return { bestEmail: null, reasoning: `OpenRouter request failed: ${reason.slice(0, 200)}`, confidence: 0 };
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return { bestEmail: null, reasoning: 'Empty response.', confidence: 0 };

        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        return {
            bestEmail: parsed.bestEmail || null,
            reasoning: parsed.reasoning || '',
            confidence: parsed.confidence || 0,
        };
    } catch (err) {
        return { bestEmail: null, reasoning: `AI analysis failed: ${err.message}`, confidence: 0 };
    }
}

module.exports = { analyzeWithAI };
