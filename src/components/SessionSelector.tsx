'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, RotateCcw } from 'lucide-react'

export interface Session {
  id: string
  mode: string
  title: string | null
  status: string
  created_at: string
}

interface Props {
  mode: 'chat' | 'interview'
  onNew: () => void
  onResume: (session: Session) => void
}

export default function SessionSelector({ mode, onNew, onResume }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/conversations?mode=${mode}`)
      .then((r) => r.json())
      .then((json) => setSessions(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mode])

  const emoji = mode === 'chat' ? '💬' : '🎙️'
  const label = mode === 'chat' ? 'チャット' : 'インタビュー'

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">{emoji}</div>
          <h2 className="text-xl font-bold text-gray-900">AI{label}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'chat'
              ? '会話しながら記事の素材を作ります'
              : 'Botがあなたの経験を引き出します'}
          </p>
        </div>

        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新しい{label}を始める
        </button>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
          </div>
        ) : sessions.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs text-gray-400 text-center mb-3">前回の続きから再開</p>
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onResume(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm text-left transition-all group"
                >
                  <RotateCcw className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.title ?? '（タイトルなし）'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('ja-JP', {
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-xs text-blue-500 shrink-0">再開 →</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
