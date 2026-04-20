import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL } from '@/lib/claude'

const ORGANIZE_SYSTEM = `以下のテキストをナレッジとして整理してMarkdown形式にしてください。

フォーマット:
# [タイトル（20字以内）]

## 要点
- [箇条書きで3〜5点]

## 詳細
[本文]

## タグ
[カンマ区切りのタグ: 例) マーケティング, SEO, 経験談]

タイトルとタグは必ず含めてください。`

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { content, source_type } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }
    if (!['voice', 'chat', 'manual'].includes(source_type)) {
      return NextResponse.json({ error: 'invalid source_type' }, { status: 400 })
    }

    // Claude でナレッジを整形
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: `${ORGANIZE_SYSTEM}\n\n---\n${content}` }],
    })

    const contentMd =
      response.content[0].type === 'text' ? response.content[0].text : content

    // タイトル抽出（# ... の1行目）
    const titleMatch = contentMd.match(/^#\s+(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : 'ナレッジ'

    // タグ抽出（## タグ の次の行）
    const tagsMatch = contentMd.match(/##\s*タグ\s*\n([^\n]+)/)
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const { data, error } = await supabase
      .from('knowledge_items')
      .insert({ user_id: user.id, title, content_md: contentMd, source_type, tags })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[knowledge/save error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
