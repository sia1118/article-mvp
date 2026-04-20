'use client'

import { useRouter } from 'next/navigation'
import InterviewBot from '@/components/InterviewBot'

export default function InterviewPageClient() {
  const router = useRouter()

  return (
    <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto">
      <div className="px-4 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">AIインタビュー</h1>
        <p className="text-xs text-gray-500 mt-0.5">5〜8問のインタビューが完了すると記事を生成できます</p>
      </div>
      <InterviewBot onArticleGenerated={(id) => router.push(`/articles/${id}`)} />
    </div>
  )
}
