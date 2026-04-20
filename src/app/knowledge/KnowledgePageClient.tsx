'use client'

import { useState } from 'react'
import { Search, Plus, Loader2, Database } from 'lucide-react'
import KnowledgeCard from '@/components/KnowledgeCard'
import VoiceRecorder from '@/components/VoiceRecorder'

interface KnowledgeItem {
  id: string
  title: string
  content_md: string
  source_type: string
  tags: string[]
  created_at: string
}

interface Props {
  initialItems: KnowledgeItem[]
}

export default function KnowledgePageClient({ initialItems }: Props) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems)
  const [query, setQuery] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function search(q: string) {
    setQuery(q)
    const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}`)
    const json = await res.json()
    if (json.data) setItems(json.data)
  }

  async function saveKnowledge(content: string, source_type: 'voice' | 'manual') {
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source_type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setItems((prev) => [json.data, ...prev])
      setManualInput('')
      setShowForm(false)
    } catch {
      alert('ナレッジの保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ナレッジDB</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} 件</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          追加
        </button>
      </div>

      {/* 手動追加フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">ナレッジを追加</p>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="経験・知識・メモを入力してください。AIが自動で整理します。"
            rows={4}
            className="w-full resize-none px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent mb-3"
          />
          <div className="flex items-center gap-3">
            <VoiceRecorder
              onTranscribed={(text) => setManualInput((prev) => prev + text)}
              disabled={saving}
            />
            <button
              onClick={() => saveKnowledge(manualInput, 'manual')}
              disabled={!manualInput.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />整理中...</>
              ) : (
                'AIで整理して保存'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 検索 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="ナレッジを検索..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
        />
      </div>

      {/* 一覧 */}
      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">ナレッジがありません</p>
          <p className="text-xs mt-1">「追加」ボタンから経験・知識を登録できます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <KnowledgeCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </main>
  )
}
