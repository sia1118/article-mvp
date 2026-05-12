'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, BarChart3 } from 'lucide-react'

interface CsvUpload {
  id: string
  filename: string
  row_count: number
  status: string
  created_at: string
}

interface UploadResult {
  upload_id: string
  pages_processed: number
  articles_matched: number
  rows_parsed: number
}

interface Props {
  initialUploads: CsvUpload[]
}

export default function AnalyticsClient({ initialUploads }: Props) {
  const [uploads, setUploads] = useState<CsvUpload[]>(initialUploads)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/analytics/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'アップロードに失敗しました')

      setResult(json.data)
      setUploads((prev) => [
        {
          id: json.data.upload_id,
          filename: file.name,
          row_count: json.data.rows_parsed,
          status: 'done',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">アクセス解析</h1>
      </div>

      {/* アップロードエリア */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">アップロード中...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              CSVをドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-gray-400">GA4エクスポートCSV（最大10MB）</p>
          </div>
        )}
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800 space-y-0.5">
            <p className="font-semibold">アップロード完了</p>
            <p>解析行数: {result.rows_parsed.toLocaleString()} 行</p>
            <p>ページ数: {result.pages_processed} ページ</p>
            <p>記事と照合済み: {result.articles_matched} 件</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* アップロード履歴 */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">アップロード履歴</h2>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[280px]">{u.filename}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {' · '}
                      {u.row_count.toLocaleString()} 行
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : u.status === 'processing'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {u.status === 'done' ? '完了' : u.status === 'processing' ? '処理中' : 'エラー'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
