import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import ArticleDetail from './ArticleDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <ArticleDetail article={article} />
    </div>
  )
}
