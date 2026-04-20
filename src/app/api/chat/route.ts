import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL, SYSTEM_PROMPTS } from '@/lib/claude'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const messages: Message[] = body.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 })
    }

    const stream = claude.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPTS.chat,
      messages,
    })

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text))
            }
          }
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  } catch (error) {
    console.error('[chat error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
