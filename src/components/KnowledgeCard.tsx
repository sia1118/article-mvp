'use client'

import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp, Mic, MessageSquare, PenLine } from 'lucide-react'

interface KnowledgeItem {
  id: string
  title: string
  content_md: string
  source_type: string
  tags: string[]
  created_at: string
}

interface Props {
  item: KnowledgeItem
  onDelete: (id: string) => void
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  voice: <Mic className="w-3 h-3" />,
  chat: <MessageSquare className="w-3 h-3" />,
  manual: <PenLine className="w-3 h-3" />,
}

export default function KnowledgeCard({ item, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`「${item.title}」を削除しますか？`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/knowledge/${item.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(item.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                {SOURCE_ICONS[item.source_type]}
                {item.source_type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(item.created_at).toLocaleDateString('ja-JP')}
              </span>
            </div>
            <h3 className="font-medium text-gray-900 text-sm">{item.title}</h3>
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {item.content_md}
          </pre>
        </div>
      )}
    </div>
  )
}
