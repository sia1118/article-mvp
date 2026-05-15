'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, FileText, BarChart3, Menu, X, MessageSquare, Mic, BookOpen, List } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/chat',      label: 'チャット',       icon: MessageSquare },
  { href: '/interview', label: 'インタビュー',   icon: Mic },
  { href: '/knowledge', label: 'ナレッジ',       icon: BookOpen },
  { href: '/articles',  label: '記事一覧',       icon: List },
  { href: '/analytics', label: '解析',           icon: BarChart3 },
]

export default function Header() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-900 font-bold text-lg"
            onClick={() => setMenuOpen(false)}
          >
            <FileText className="w-5 h-5 text-blue-600" />
            article-mvp
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {href === '/analytics' && <Icon className="w-3.5 h-3.5" />}
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-1 text-gray-600 hover:text-gray-900 transition-colors rounded-lg"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/20"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer — positioned just below the header (52px = py-3 * 2 + text-lg line-height) */}
          <nav className="md:hidden fixed inset-x-0 top-[52px] z-40 bg-white border-b border-gray-200 shadow-lg">
            <ul className="px-3 py-2 space-y-0.5">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  ログアウト
                </button>
              </li>
            </ul>
          </nav>
        </>
      )}
    </>
  )
}
