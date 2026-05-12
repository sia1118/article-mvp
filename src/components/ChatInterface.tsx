'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, FileText } from 'lucide-react'
import VoiceRecorder from '@/components/VoiceRecorder'
import type { Message } from '@/app/api/chat/route'

interface Props {
  onArticleGenerated?: (articleId: string) => void
  conversationId?: string | null
  initialMessages?: Message[]
  seedMessage?: string
}

async function saveMessages(conversationId: string, messages: { role: string; content: string }[]) {
  await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
}

async function updateTitle(conversationId: string, title: string) {
  await fetch(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

async function markExported(conversationId: string) {
  await fetch(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'exported' }),
  })
}

export default function ChatInterface({ onArticleGenerated, conversationId, initialMessages, seedMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isFirstMessageRef = useRef((initialMessages ?? []).length === 0)
  const seedSentRef = useRef(false)

  useEffect(() => {
    setMessages(initialMessages ?? [])
    isFirstMessageRef.current = (initialMessages ?? []).length === 0
  }, [initialMessages])

  // 企画提案からのseedを自動送信
  useEffect(() => {
    if (seedMessage && !seedSentRef.current && conversationId) {
      seedSentRef.current = true
      sendMessage(seedMessage)
    }
  }, [seedMessage, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content: string) {
    if (!content.trim() || streaming) return

    const userMessage: Message = { role: 'user', content: content.trim() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantText },
        ])
      }

      // DB に保存
      if (conversationId) {
        const isFirst = isFirstMessageRef.current
        isFirstMessageRef.current = false

        await saveMessages(conversationId, [
          { role: 'user', content: userMessage.content },
          { role: 'assistant', content: assistantText },
        ])

        if (isFirst) {
          await updateTitle(conversationId, userMessage.content.slice(0, 25))
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  async function generateArticle() {
    if (messages.length === 0 || generating) return
    setGenerating(true)

    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (conversationId) await markExported(conversationId)

      onArticleGenerated?.(json.data.id)
    } catch {
      alert('記事の生成に失敗しました。')
    } finally {
      setGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-16">
            <p className="text-2xl mb-3">💬</p>
            <p>話したいテーマや経験を入力してください。</p>
            <p>AIが記事の方向性を一緒に考えます。</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content || (
                <span className="flex gap-1 items-center text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  考え中...
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 記事生成ボタン */}
      {messages.length >= 4 && (
        <div className="px-4 pb-2">
          <button
            onClick={generateArticle}
            disabled={generating || streaming}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />記事を生成中...</>
            ) : (
              <><FileText className="w-4 h-4" />この会話から記事を生成する</>
            )}
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <VoiceRecorder
            onTranscribed={(text) => setInput((prev) => prev + text)}
            disabled={streaming}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="メッセージを入力（Shift+Enterで改行）"
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
