'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, BarChart3, ChevronRight, Trash2 } from 'lucide-react'

interface CsvUpload {
  id: string
  filename: string
  row_count: number
  status: string
  created_at: string
}

interface AnalyticsRow {
  id: string
  page_url: string
  page_title: string | null
  purpose: string | null
  sessions: number
  avg_engagement_sec: number
  bounce_rate: number
  read_rate: number
  catch_score: number
  resonance_score: number
  drop_point: number
  analyzed_at: string
  article_id: string | null
  articles: { title: string } | { title: string }[] | null
}

interface UploadResult {
  upload_id: string
  pages_processed: number
  articles_matched: number
  rows_parsed: number
}

interface Props {
  initialUploads: CsvUpload[]
  initialAnalytics: AnalyticsRow[]
}

const PURPOSE_OPTIONS = [
  { value: '', label: '未設定' },
  { value: 'engagement', label: 'エンゲージ' },
  { value: 'cv', label: 'CV獲得' },
  { value: 'circulation', label: '拡散' },
]

function ScoreBadge({ score }: { score: number }) {
  if (score < 80) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">🔴 {score}</span>
  if (score <= 120) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">🟡 {score}</span>
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">🟢 {score}</span>
}

// ────────────────────────────────────────────
// 4象限マップ
// ────────────────────────────────────────────

interface ScatterPoint {
  x: number   // エンゲージメントスコア（catch+resonance平均）
  y: number   // セッション数
  id: string
  title: string
  catch_score: number
  resonance_score: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: ScatterPoint = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-gray-900 mb-1 leading-snug">{d.title}</p>
      <p className="text-gray-500">セッション: <span className="text-gray-900 font-medium">{d.y.toLocaleString()}</span></p>
      <p className="text-gray-500">キャッチ強度: <span className="text-gray-900 font-medium">{Math.round(d.catch_score)}</span></p>
      <p className="text-gray-500">本文共鳴度: <span className="text-gray-900 font-medium">{Math.round(d.resonance_score)}</span></p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload, onClick } = props
  return (
    <circle
      cx={cx} cy={cy} r={6}
      fill="#3b82f6" fillOpacity={0.8}
      stroke="#fff" strokeWidth={1.5}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick?.(payload)}
    />
  )
}

function QuadrantChart({ analytics }: { analytics: AnalyticsRow[] }) {
  const router = useRouter()

  const points: ScatterPoint[] = analytics.map((row) => {
    const articlesData = Array.isArray(row.articles) ? row.articles[0] : row.articles
    return {
      x: Math.round((row.catch_score + row.resonance_score) / 2),
      y: row.sessions,
      id: row.id,
      title: articlesData?.title ?? row.page_title ?? row.page_url,
      catch_score: row.catch_score,
      resonance_score: row.resonance_score,
    }
  })

  const avgX = Math.round(points.reduce((s, p) => s + p.x, 0) / (points.length || 1))
  const avgY = Math.round(points.reduce((s, p) => s + p.y, 0) / (points.length || 1))

  const xMax = Math.max(200, ...points.map((p) => p.x)) * 1.1
  const yMax = Math.max(10, ...points.map((p) => p.y)) * 1.15

  const LABELS = [
    { x: avgX / 2,           y: yMax * 0.88, text: '⚠️ 集客OK・改善余地あり', color: '#b45309' },
    { x: (avgX + xMax) / 2,  y: yMax * 0.88, text: '🌟 人気×共鳴 (スター)',   color: '#15803d' },
    { x: avgX / 2,           y: yMax * 0.08, text: '🔴 要強化',               color: '#b91c1c' },
    { x: (avgX + xMax) / 2,  y: yMax * 0.08, text: '💎 隠れた良記事',         color: '#1d4ed8' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">記事マッピング</h2>
      <p className="text-xs text-gray-400 mb-4">
        横軸: エンゲージメント（キャッチ強度・本文共鳴度の平均）　縦軸: セッション数
        <span className="text-gray-500">分割線 = 平均値</span>
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          {/* 象限の背景色 */}
          <ReferenceArea x1={0}    x2={avgX} y1={avgY} y2={yMax} fill="#fef3c7" fillOpacity={0.5} />
          <ReferenceArea x1={avgX} x2={xMax} y1={avgY} y2={yMax} fill="#dcfce7" fillOpacity={0.5} />
          <ReferenceArea x1={0}    x2={avgX} y1={0}    y2={avgY} fill="#fee2e2" fillOpacity={0.4} />
          <ReferenceArea x1={avgX} x2={xMax} y1={0}    y2={avgY} fill="#dbeafe" fillOpacity={0.4} />

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number" dataKey="x"
            domain={[0, xMax]}
            label={{ value: 'エンゲージメントスコア', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#6b7280' }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y"
            domain={[0, yMax]}
            label={{ value: 'セッション数', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#6b7280' }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* 分割線（平均値） */}
          <ReferenceLine x={avgX} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `avg ${avgX}`, fontSize: 10, fill: '#94a3b8' }} />
          <ReferenceLine y={avgY} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `avg ${avgY.toLocaleString()}`, fontSize: 10, fill: '#94a3b8', position: 'insideTopRight' }} />

          {/* 象限ラベル */}
          {LABELS.map((l, i) => (
            <ReferenceLine key={i} x={l.x} stroke="transparent"
              label={{ value: l.text, position: 'center', fontSize: 10, fill: l.color, fontWeight: 600 }}
            />
          ))}

          <Scatter
            data={points}
            shape={(props: object) => (
              <CustomDot {...props} onClick={(p: ScatterPoint) => router.push(`/analytics/${p.id}`)} />
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────

export default function AnalyticsClient({ initialUploads, initialAnalytics }: Props) {
  const [uploads, setUploads] = useState<CsvUpload[]>(initialUploads)
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>(initialAnalytics)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    setResult(null)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/analytics/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'アップロードに失敗しました')
      setResult(json.data)
      setUploads((prev) => [{ id: json.data.upload_id, filename: file.name, row_count: json.data.rows_parsed, status: 'done', created_at: new Date().toISOString() }, ...prev])
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
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

  async function handleDeleteAll() {
    if (!confirm('全ての解析レコード（アップロード履歴・インサイト含む）を削除しますか？この操作は取り消せません。')) return
    setDeleting(true)
    try {
      const res = await fetch('/api/analytics/records', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAnalytics([])
      setUploads([])
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePurposeChange(id: string, purpose: string) {
    setAnalytics((prev) => prev.map((r) => r.id === id ? { ...r, purpose } : r))
    await fetch(`/api/analytics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose }),
    })
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">アクセス解析</h1>
        </div>
        <div className="flex items-center gap-2">
          {analytics.length > 0 && (
            <button onClick={handleDeleteAll} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              全件削除
            </button>
          )}
          <button onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Upload className="w-4 h-4" />
            CSVをアップロード
          </button>
        </div>
      </div>

      {/* アップロードパネル */}
      {showUpload && (
        <div className="mb-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-600">アップロード・処理中...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">CSVをドラッグ＆ドロップ、またはクリックして選択</p>
                <p className="text-xs text-gray-400">GA4エクスポートCSV（最大10MB）</p>
              </div>
            )}
          </div>
          {result && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800 font-semibold">完了 — {result.rows_parsed.toLocaleString()} 行 / {result.pages_processed} ページ / 記事照合 {result.articles_matched} 件</p>
            </div>
          )}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {uploads.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">アップロード履歴</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 truncate max-w-[300px]">{u.filename}</span>
                      <span className="text-xs text-gray-400">{u.row_count.toLocaleString()} 行</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {u.status === 'done' ? '完了' : '処理中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {analytics.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">CSVをアップロードすると解析結果が表示されます</p>
        </div>
      ) : (
        <>
          {/* 4象限マップ */}
          <QuadrantChart analytics={analytics} />

          {/* 解析結果テーブル */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[180px]">ページ</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">セッション</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">キャッチ強度</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">本文共鳴度</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">読了率</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">離脱ポイント</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600">目的</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.map((row) => {
                    const articlesData = Array.isArray(row.articles) ? row.articles[0] : row.articles
                    const displayTitle = articlesData?.title ?? row.page_title ?? row.page_url
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]" title={displayTitle}>{displayTitle}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]" title={row.page_url}>{row.page_url}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-700 font-medium">{row.sessions.toLocaleString()}</td>
                        <td className="px-3 py-3 text-center"><ScoreBadge score={Math.round(row.catch_score)} /></td>
                        <td className="px-3 py-3 text-center"><ScoreBadge score={Math.round(row.resonance_score)} /></td>
                        <td className="px-3 py-3 text-center text-gray-700">{row.read_rate}%</td>
                        <td className="px-3 py-3 text-center text-gray-700">{row.drop_point}%区間</td>
                        <td className="px-3 py-3 text-center">
                          <select
                            value={row.purpose ?? ''}
                            onChange={(e) => handlePurposeChange(row.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {PURPOSE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/analytics/${row.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                            詳細 <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
