// Vercel/Edge API route for Claude proxy
// Deploy to Vercel or use as a Supabase Edge Function

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { system, messages } = await req.json() as {
    system: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages,
  })

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  return new Response(JSON.stringify({ content }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
