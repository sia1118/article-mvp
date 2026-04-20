'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Volume2, VolumeX, FileText } from 'lucide-react'
import VoiceRecorder from '@/components/VoiceRecorder'
import type { Message } from '@/app/api/chat/route'

interface Props {
  onArticleGenerated?: (articleId: string) => void
}

const FINISH_KEYWORD = '記事を生成する準備ができました'

export default function InterviewBot({ onArticleGenerated }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const playTts = useCallback(async (text: string) => {
    if (!ttsEnabled) return
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.play()
    } catch {
      // TTS 失敗は無視してテキストだけ表示
    }
  }, [ttsEnabled])

  async function askBot(history: Message[]) {
    setStreaming(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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

      if (assistantText.includes(FINISH_KEYWORD)) setFinished(true)
      playTts(assistantText)
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  async function startInterview() {
    setStarted(true)
    await askBot([])
  }

  async function sendAnswer(content: string) {
    if (!content.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: content.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await askBot(nextMessages)
  }

  async function generateArticle() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onArticleGenerated?.(json.data.id)
    } catch {
      alert('記事の生成に失敗しました。')
    } finally {
      setGenerating(false)
    }
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="text-5xl mb-6">🎙️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">AIインタビューBot</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-sm">
          Botがあなたの経験・知識をインタビュー形式で引き出し、記事の素材を作ります。
          音声で答えることもできます。
        </p>
        <button
          onClick={startInterview}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          インタビューを開始する
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                🤖
              </div>
            )}
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

      {/* 記事生成ボタン（インタビュー完了後） */}
      {finished && (
        <div className="px-4 pb-2">
          <button
            onClick={generateArticle}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />記事を生成中...</>
            ) : (
              <><FileText className="w-4 h-4" />インタビューから記事を生成する</>
            )}
          </button>
        </div>
      )}

      {/* 入力エリア */}
      {!finished && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <button
              onClick={() => setTtsEnabled((v) => !v)}
              className="p-2.5 text-gray-400 hover:text-gray-700 transition-colors"
              title={ttsEnabled ? '音声をオフ' : '音声をオン'}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <VoiceRecorder
              onTranscribed={(text) => setInput((prev) => prev + text)}
              disabled={streaming}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendAnswer(input)
                }
              }}
              disabled={streaming}
              placeholder="回答を入力（Shift+Enterで改行）"
              rows={1}
              className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendAnswer(input)}
              disabled={!input.trim() || streaming}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
