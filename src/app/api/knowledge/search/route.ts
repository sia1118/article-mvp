import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') ?? ''

    let builder = supabase
      .from('knowledge_items')
      .select('id, title, content_md, source_type, tags, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (query) {
      builder = builder.ilike('content_md', `%${query}%`)
    }

    const { data, error } = await builder.limit(20)
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[knowledge/search error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
