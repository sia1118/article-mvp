'use client'

import { useRouter } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'

export default function ChatPageClient() {
  const router = useRouter()

  function handleArticleGenerated(articleId: string) {
    router.push(`/articles/${articleId}`)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto">
      <div className="px-4 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">チャット記事生成</h1>
        <p className="text-xs text-gray-500 mt-0.5">会話を重ねると「記事を生成する」ボタンが表示されます</p>
      </div>
      <ChatInterface onArticleGenerated={handleArticleGenerated} />
    </div>
  )
}
