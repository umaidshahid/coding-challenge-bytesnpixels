export async function summarizeText(prompt: string): Promise<string> {
  if (process.env.FAKE_LLM === 'true') {
    return 'The customer shared feedback about their recent experience and is waiting on follow-up from the support team.'
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  // Bound the request so a hung upstream can't pin the connection open.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`)
  }

  const data: any = await response.json()
  const summary = data?.choices?.[0]?.message?.content
  if (typeof summary !== 'string') {
    throw new Error('LLM response was missing a summary')
  }
  return summary
}
