'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Copy, Check, Pencil, Trash2, Save, X, ImagePlus, Loader2, Link2 } from 'lucide-react'

interface Article {
  id: string
  title: string
  content_md: string
  status: string
  created_at: string
  published_url?: string | null
}

interface Props {
  article: Article
}

export default function ArticleDetail({ article }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(article.title)
  const [contentMd, setContentMd] = useState(article.content_md)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState(article.published_url ?? '')
  const [savingUrl, setSavingUrl] = useState(false)
  const [urlSaved, setUrlSaved] = useState(false)

  // 画像生成
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [showImagePanel, setShowImagePanel] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content_md: contentMd }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
      router.refresh()
    } catch {
      alert('保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/articles/${article.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push('/articles')
    } catch {
      alert('削除に失敗しました。')
      setDeleting(false)
    }
  }

  async function handleSaveUrl() {
    setSavingUrl(true)
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content_md: contentMd, published_url: publishedUrl }),
      })
      if (!res.ok) throw new Error()
      setUrlSaved(true)
      setTimeout(() => setUrlSaved(false), 2000)
    } catch {
      alert('URLの保存に失敗しました。')
    } finally {
      setSavingUrl(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(contentMd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) return
    setGeneratingImage(true)
    setGeneratedImageUrl(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setGeneratedImageUrl(json.data.url)
    } catch (e) {
      alert(`画像の生成に失敗しました。\n${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGeneratingImage(false)
    }
  }

  function insertImageToContent() {
    if (!generatedImageUrl) return
    const mdImage = `\n![${imagePrompt}](${generatedImageUrl})\n`
    setContentMd((prev) => prev + mdImage)
    setShowImagePanel(false)
    setImagePrompt('')
    setGeneratedImageUrl(null)
    if (!editing) setEditing(true)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/articles"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          記事一覧へ
        </Link>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setTitle(article.title); setContentMd(article.content_md) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4" />キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowImagePanel((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                画像生成
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'コピー済み' : 'MDをコピー'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />編集
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                削除
              </button>
            </>
          )}
        </div>
      </div>

      {/* 画像生成パネル */}
      {showImagePanel && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">画像を生成して記事に挿入</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateImage()}
              placeholder="例: SEOを表すシンプルなアイキャッチ画像、青色基調"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || generatingImage}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {generatingImage ? '生成中...' : '生成'}
            </button>
          </div>
          {generatedImageUrl && (
            <div className="space-y-3">
              <img src={generatedImageUrl} alt={imagePrompt} className="w-full rounded-xl border border-gray-200" />
              <button
                onClick={insertImageToContent}
                className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                この画像を記事に挿入する
              </button>
            </div>
          )}
        </div>
      )}

      {/* 公開URL登録 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">公開URL（アクセス解析の照合用）</span>
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={publishedUrl}
            onChange={(e) => setPublishedUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
            placeholder="https://example.com/article/..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          <button
            onClick={handleSaveUrl}
            disabled={savingUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {savingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : urlSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {urlSaved ? '保存済み' : '保存'}
          </button>
        </div>
      </div>

      {/* 記事本体 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            article.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {article.status === 'published' ? '公開済み' : '下書き'}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(article.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>

        {editing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-lg font-bold rounded-lg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <textarea
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              rows={30}
              className="w-full resize-none px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        ) : (
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentMd}</ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  )
}
