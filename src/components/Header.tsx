'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, FileText, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function Header() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-900 font-bold text-lg">
          <FileText className="w-5 h-5 text-blue-600" />
          article-mvp
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/chat" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            チャット
          </Link>
          <Link href="/interview" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            インタビュー
          </Link>
          <Link href="/knowledge" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            ナレッジ
          </Link>
          <Link href="/articles" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            記事一覧
          </Link>
          <Link href="/analytics" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <BarChart3 className="w-3.5 h-3.5" />
            解析
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  )
}
