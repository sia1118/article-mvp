import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: uploads }, { data: analyticsRows }] = await Promise.all([
    supabase
      .from('csv_uploads')
      .select('id, filename, row_count, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('article_analytics')
      .select('id, page_url, page_title, purpose, sessions, avg_engagement_sec, bounce_rate, read_rate, catch_score, resonance_score, drop_point, analyzed_at, article_id, articles(title)')
      .eq('user_id', user.id)
      .order('analyzed_at', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <AnalyticsClient
        initialUploads={uploads ?? []}
        initialAnalytics={analyticsRows ?? []}
      />
    </div>
  )
}
