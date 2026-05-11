import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')

    let query = supabase
      .from('conversations')
      .select('id, mode, title, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)

    if (mode) query = query.eq('mode', mode)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[conversations GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { mode } = body
    if (!mode || !['chat', 'interview'].includes(mode)) {
      return NextResponse.json({ error: 'mode is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, mode, status: 'active' })
      .select('id, mode, title, status, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[conversations POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
