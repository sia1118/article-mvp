import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 自分の会話かを確認
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conv) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const { messages } = body
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 })
    }

    const rows = messages.map(({ role, content }: { role: string; content: string }) => ({
      conversation_id: id,
      role,
      content,
    }))

    const { data, error } = await supabase
      .from('messages')
      .insert(rows)
      .select('id, role, content, created_at')

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[messages POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
