import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL, SYSTEM_PROMPTS } from '@/lib/claude'
import type { Message } from '@/app/api/chat/route'

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

    const conversation = messages
      .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
      .join('\n\n')

    // ユーザーのナレッジを最新20件取得して記事生成に活用
    const { data: knowledgeItems } = await supabase
      .from('knowledge_items')
      .select('title, content_md')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const knowledge = knowledgeItems
      ? knowledgeItems.map((k) => `### ${k.title}\n${k.content_md}`).join('\n\n')
      : ''

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: SYSTEM_PROMPTS.articleGenerate(conversation, knowledge),
        },
      ],
    })

    const contentMd =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // タイトルを1行目（# ...）から抽出
    const titleMatch = contentMd.match(/^#\s+(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : '無題の記事'

    // Supabase に保存
    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        user_id: user.id,
        title,
        content_md: contentMd,
        status: 'draft',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data: article })
  } catch (error) {
    console.error('[articles/generate error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
