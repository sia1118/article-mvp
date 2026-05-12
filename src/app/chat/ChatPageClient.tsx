'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'
import SessionSelector, { type Session } from '@/components/SessionSelector'
import type { Message } from '@/app/api/chat/route'

type ViewState = 'selector' | 'chat'

export default function ChatPageClient() {
  const router = useRouter()
  const [view, setView] = useState<ViewState>('selector')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<Message[]>([])
  const [seedMessage, setSeedMessage] = useState<string | undefined>(undefined)

  // 企画提案からの遷移時にseedを読み取る
  useEffect(() => {
    const raw = sessionStorage.getItem('proposal_seed')
    if (raw) {
      try {
        const { seed, mode } = JSON.parse(raw)
        if (mode === 'chat') {
          sessionStorage.removeItem('proposal_seed')
          handleNewWithSeed(seed)
        }
      } catch {
        sessionStorage.removeItem('proposal_seed')
      }
    }
  }, [])

  async function handleNewWithSeed(seed?: string) {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'chat' }),
    })
    const json = await res.json()
    setConversationId(json.data.id)
    setInitialMessages([])
    setSeedMessage(seed)
    setView('chat')
  }

  async function handleNew() {
    await handleNewWithSeed(undefined)
  }

  async function handleResume(session: Session) {
    const res = await fetch(`/api/conversations/${session.id}`)
    const json = await res.json()
    setConversationId(session.id)
    setInitialMessages(
      (json.data.messages ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    )
    setSeedMessage(undefined)
    setView('chat')
  }

  function handleSuspend() {
    setView('selector')
    setConversationId(null)
    setInitialMessages([])
    setSeedMessage(undefined)
  }

  if (view === 'selector') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto">
        <div className="px-4 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-lg font-bold text-gray-900">チャット記事生成</h1>
          <p className="text-xs text-gray-500 mt-0.5">会話を重ねると「記事を生成する」ボタンが表示されます</p>
        </div>
        <SessionSelector mode="chat" onNew={handleNew} onResume={handleResume} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto">
      <div className="px-4 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">チャット記事生成</h1>
          <p className="text-xs text-gray-500 mt-0.5">会話を重ねると「記事を生成する」ボタンが表示されます</p>
        </div>
        <button
          onClick={handleSuspend}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
        >
          中断する
        </button>
      </div>
      <ChatInterface
        onArticleGenerated={(id) => router.push(`/articles/${id}`)}
        conversationId={conversationId}
        initialMessages={initialMessages}
        seedMessage={seedMessage}
      />
    </div>
  )
}
