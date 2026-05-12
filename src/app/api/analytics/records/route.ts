import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 全解析レコードを一括削除
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // article_insights → article_analytics → csv_uploads の順に削除
    // （外部キー制約があるため）
    const { data: analyticsIds } = await supabase
      .from('article_analytics')
      .select('id')
      .eq('user_id', user.id)

    const ids = (analyticsIds ?? []).map((r) => r.id)

    if (ids.length > 0) {
      await supabase
        .from('article_insights')
        .delete()
        .in('analytics_id', ids)
    }

    const { error: analyticsError } = await supabase
      .from('article_analytics')
      .delete()
      .eq('user_id', user.id)

    if (analyticsError) throw analyticsError

    await supabase
      .from('csv_uploads')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ data: { deleted: ids.length } })
  } catch (error) {
    console.error('[analytics/records delete]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
