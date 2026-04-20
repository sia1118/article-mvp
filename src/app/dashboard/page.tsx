import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import { MessageSquare, Mic, Database, FileText, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: articleCount },
    { count: knowledgeCount },
    { data: recentArticles },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('knowledge_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('articles')
      .select('id, title, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const stats = [
    { label: '生成記事数', value: articleCount ?? 0, href: '/articles' },
    { label: 'ナレッジ数', value: knowledgeCount ?? 0, href: '/knowledge' },
  ]

  const menuItems = [
    { href: '/chat', icon: MessageSquare, label: 'チャット記事生成', description: '会話しながら記事を作成' },
    { href: '/interview', icon: Mic, label: 'AIインタビュー', description: 'Botがあなたの経験を引き出す' },
    { href: '/knowledge', icon: Database, label: 'ナレッジDB', description: '知識・経験を蓄積・管理' },
    { href: '/articles', icon: FileText, label: '記事一覧', description: '生成した記事を確認・編集' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* ユーザー情報 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {stats.map(({ label, value, href }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-2xl border border-gray-200 px-6 py-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </Link>
          ))}
        </div>

        {/* 最近の記事 */}
        {recentArticles && recentArticles.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">最近の記事</h2>
              <Link href="/articles" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                すべて見る <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.id}`}
                  className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-900 truncate">{article.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      article.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {article.status === 'published' ? '公開済み' : '下書き'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(article.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* メニュー */}
        <h2 className="text-sm font-semibold text-gray-700 mb-3">機能一覧</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{label}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
