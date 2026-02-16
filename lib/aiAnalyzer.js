/**
 * AI Analyzer — OpenAI Integration
 * Uses GPT-4o-mini to intelligently analyze email finding results.
 */

/**
 * Analyze collected data with OpenAI and return best email prediction.
 * @param {Object} params
 * @returns {Promise<{bestEmail: string|null, reasoning: string, confidence: number}>}
 */
async function analyzeWithAI(params) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { bestEmail: null, reasoning: 'No OpenAI key configured.', confidence: 0 };

    const { firstName, lastName, domain, provider, detectedPattern, smtpResults, websiteEmails, isCatchAll } = params;

    const prompt = `You are an expert at finding business email addresses. Given the following data about a person, determine their most likely email address.

Person: ${firstName} ${lastName}
Company domain: ${domain}
Email provider: ${provider || 'Unknown'}
Website pattern detected: ${detectedPattern || 'None'}
Catch-all domain: ${isCatchAll ? 'Yes' : 'No'}

SMTP verification results:
${smtpResults?.map(r => `  ${r.email}: ${r.status}`).join('\n') || 'None'}

Emails found on company website:
${websiteEmails?.join(', ') || 'None'}

Based on ALL this data, return ONLY a JSON object (no markdown):
{"bestEmail": "most_likely@email.com", "reasoning": "brief explanation", "confidence": 85}

The confidence should be 0-100. If catch-all is true and SMTP shows valid for all, lower your confidence. If SMTP shows only specific emails as valid, those are very reliable. If the website pattern matches a result, boost confidence.`;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 200,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return { bestEmail: null, reasoning: 'OpenAI request failed.', confidence: 0 };

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return { bestEmail: null, reasoning: 'Empty response.', confidence: 0 };

        // Parse JSON from response (handle potential markdown wrapping)
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
