'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Copy, Check } from 'lucide-react'

interface Article {
  id: string
  title: string
  content_md: string
  status: string
  created_at: string
}

interface Props {
  article: Article
}

export default function ArticleDetail({ article }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(article.content_md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/articles"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          記事一覧へ
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'コピー済み' : 'MDをコピー'}
          </button>
          <Link
            href="/chat"
            className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            新しい記事を作成
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100">
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

        <div className="prose prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content_md}
          </ReactMarkdown>
        </div>
      </div>
    </main>
  )
}
