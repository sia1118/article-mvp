import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import InterviewPageClient from './InterviewPageClient'

export default async function InterviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <InterviewPageClient />
    </div>
  )
}
