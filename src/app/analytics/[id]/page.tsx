import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AnalyticsDetailClient from './AnalyticsDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AnalyticsDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: row }, { data: allRows }] = await Promise.all([
    supabase
      .from('article_analytics')
      .select('*, articles(title, content_md)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('article_analytics')
      .select('scroll_10,scroll_20,scroll_30,scroll_40,scroll_50,scroll_60,scroll_70,scroll_80,scroll_90,scroll_100')
      .eq('user_id', user.id),
  ])

  if (!row) notFound()

  // 全記事の各スクロール深度の平均を算出
  const depths = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const averages: Record<number, number> = {}
  if (allRows && allRows.length > 0) {
    for (const d of depths) {
      const key = `scroll_${d}` as keyof typeof allRows[0]
      const sum = allRows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
      averages[d] = Math.round((sum / allRows.length) * 10) / 10
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <AnalyticsDetailClient row={row} averages={averages} />
    </div>
  )
}
