'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Sparkles, Loader2, MessageSquare, Mic } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

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
  scroll_10: number; scroll_20: number; scroll_30: number; scroll_40: number
  scroll_50: number; scroll_60: number; scroll_70: number; scroll_80: number
  scroll_90: number; scroll_100: number
  analyzed_at: string
  articles: { title: string; content_md: string } | { title: string; content_md: string }[] | null
}

interface Proposal {
  title: string
  theme: string
  target: string
  structure: string
  mode: 'interview' | 'chat'
  seed: string
}

interface Insight {
  id: string
  insight_md: string
  proposals_json: Proposal[]
  created_at: string
}

interface Props {
  row: AnalyticsRow
  averages: Record<number, number>
  existingInsight: Insight | null
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score < 80 ? 'red' : score <= 120 ? 'yellow' : 'green'
  const emoji = score < 80 ? '🔴' : score <= 120 ? '🟡' : '🟢'
  const bg = color === 'red' ? 'bg-red-50 border-red-200' : color === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
  const text = color === 'red' ? 'text-red-700' : color === 'yellow' ? 'text-yellow-700' : 'text-green-700'
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{emoji} {Math.round(score)}</p>
      <p className="text-xs text-gray-400 mt-1">{score < 80 ? '要改善' : score <= 120 ? '平均的' : '良好'}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default function AnalyticsDetailClient({ row, averages, existingInsight }: Props) {
  const router = useRouter()
  const [insight, setInsight] = useState<Insight | null>(existingInsight)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const depths = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const chartData = depths.map((d) => {
    const key = `scroll_${d}` as keyof AnalyticsRow
    return {
      depth: `${d}%`,
      rate: Number(row[key]) || 0,
      avg: averages[d] ?? 0,
      isDropPoint: d === row.drop_point,
    }
  })

  const articlesData = Array.isArray(row.articles) ? row.articles[0] : row.articles
  const displayTitle = articlesData?.title ?? row.page_title ?? row.page_url

  const formatTime = (sec: number) =>
    sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`

  async function handleAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics_id: row.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '分析に失敗しました')
      setInsight({
        id: json.data.id,
        insight_md: json.data.insight_md,
        proposals_json: json.data.proposals_json,
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleStartWriting(proposal: Proposal) {
    sessionStorage.setItem('proposal_seed', JSON.stringify({
      seed: proposal.seed,
      title: proposal.title,
      mode: proposal.mode,
    }))
    router.push(proposal.mode === 'interview' ? '/interview' : '/chat')
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/analytics" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        解析一覧へ
      </Link>

      <h1 className="text-lg font-bold text-gray-900 mb-1 truncate">{displayTitle}</h1>
      <p className="text-xs text-gray-400 mb-8 truncate">{row.page_url}</p>

      {/* スコアカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <ScoreBadge score={row.catch_score} label="キャッチ強度" />
        <ScoreBadge score={row.resonance_score} label="本文共鳴度" />
        <MetricCard label="セッション数" value={row.sessions.toLocaleString()} />
        <MetricCard label="平均滞在時間" value={formatTime(row.avg_engagement_sec)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <MetricCard label="直帰率" value={`${row.bounce_rate}%`} />
        <MetricCard label="読了率" value={`${row.read_rate}%`} />
        <MetricCard label="最大離脱区間" value={`${row.drop_point}%付近`} />
      </div>

      {/* スクロールウォーターフォール */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">スクロール到達率</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> この記事</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> 最大離脱区間</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="depth" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(value, name) => [`${value}%`, name === 'rate' ? 'この記事' : '全記事平均']} />
            <Bar dataKey="rate" name="rate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isDropPoint ? '#f87171' : '#3b82f6'} fillOpacity={entry.isDropPoint ? 1 : 0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-2">
          {chartData.map((entry) => {
            const diff = entry.rate - entry.avg
            return (
              <div key={entry.depth} className={`text-xs px-2 py-1 rounded-lg border ${
                entry.isDropPoint ? 'border-red-300 bg-red-50 text-red-700'
                  : diff >= 0 ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-orange-200 bg-orange-50 text-orange-700'
              }`}>
                {entry.depth}: {entry.rate}%
                <span className="ml-1 opacity-70">({diff >= 0 ? '+' : ''}{diff.toFixed(1)} vs 平均{entry.avg}%)</span>
                {entry.isDropPoint && ' ← 最大離脱'}
              </div>
            )
          })}
        </div>
      </div>

      {/* AIインサイト分析 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">AIインサイト分析</h2>
            {insight && (
              <span className="text-xs text-gray-400">
                ({new Date(insight.created_at).toLocaleDateString('ja-JP')})
              </span>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyzing ? '分析中...' : insight ? '再分析' : '分析する'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {analyzing && (
          <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Claudeが解析データを分析しています...</span>
          </div>
        )}

        {!analyzing && insight && (
          <div className="prose prose-sm prose-gray max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.insight_md}</ReactMarkdown>
          </div>
        )}

        {!analyzing && !insight && (
          <p className="text-sm text-gray-400 text-center py-6">
            「分析する」ボタンを押すと、Claudeが解析データを元に改善提案を生成します
          </p>
        )}
      </div>

      {/* 企画カード */}
      {insight && insight.proposals_json && insight.proposals_json.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            次の記事企画案
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {insight.proposals_json.map((proposal, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    proposal.mode === 'interview'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {proposal.mode === 'interview' ? 'インタビュー' : 'チャット'}
                  </span>
                  <span className="text-xs text-gray-400">案 {i + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{proposal.title}</h3>
                <p className="text-xs text-gray-600 mb-2 leading-relaxed flex-1">{proposal.theme}</p>
                <div className="space-y-1.5 mb-4">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">対象: </span>{proposal.target}
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">構成: </span>{proposal.structure}
                  </div>
                </div>
                <button
                  onClick={() => handleStartWriting(proposal)}
                  className={`flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-white rounded-lg transition-colors ${
                    proposal.mode === 'interview'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {proposal.mode === 'interview'
                    ? <><Mic className="w-3.5 h-3.5" /> インタビューで執筆開始</>
                    : <><MessageSquare className="w-3.5 h-3.5" /> チャットで執筆開始</>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        解析日時: {new Date(row.analyzed_at).toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </p>
    </main>
  )
}
