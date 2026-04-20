import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('knowledge_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ data: { id } })
  } catch (error) {
    console.error('[knowledge/delete error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
