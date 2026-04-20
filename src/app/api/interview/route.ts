import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL } from '@/lib/claude'
import type { Message } from '@/app/api/chat/route'

const INTERVIEW_SYSTEM = `あなたは経験豊富なライター兼インタビュアーです。
ユーザーから記事に使える「一次情報（経験・知識・意見）」を引き出すことがミッションです。

ルール:
1. 一度に1つだけ質問する
2. ユーザーの回答に対して「なぜ？」「具体的には？」「その時どう感じた？」で深掘りする
3. 5〜8問でインタビューを完結させる
4. 最後に「ありがとうございました。記事を生成する準備ができました。」と伝える
5. 日本語で話す

最初の質問から始めてください。`

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const messages: Message[] = body.messages ?? []

    const stream = claude.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: INTERVIEW_SYSTEM,
      messages: messages.length === 0
        ? [{ role: 'user', content: 'インタビューを開始してください。' }]
        : messages,
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
    console.error('[interview error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
