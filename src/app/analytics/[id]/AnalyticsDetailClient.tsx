'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
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
  scroll_10: number
  scroll_20: number
  scroll_30: number
  scroll_40: number
  scroll_50: number
  scroll_60: number
  scroll_70: number
  scroll_80: number
  scroll_90: number
  scroll_100: number
  analyzed_at: string
  articles: { title: string; content_md: string } | null
}

interface Props {
  row: AnalyticsRow
  averages: Record<number, number>
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
      <p className="text-xs text-gray-400 mt-1">
        {score < 80 ? '要改善' : score <= 120 ? '平均的' : '良好'}
      </p>
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

export default function AnalyticsDetailClient({ row, averages }: Props) {
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

  const displayTitle = row.articles?.title ?? row.page_title ?? row.page_url

  const formatTime = (sec: number) => {
    if (sec >= 60) return `${Math.floor(sec / 60)}分${sec % 60}秒`
    return `${sec}秒`
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* ナビ */}
      <Link href="/analytics" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        解析一覧へ
      </Link>

      <h1 className="text-lg font-bold text-gray-900 mb-1 truncate">{displayTitle}</h1>
      <p className="text-xs text-gray-400 mb-8 truncate">{row.page_url}</p>

      {/* スコアカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">スクロール到達率</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> この記事
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1 border-t-2 border-dashed border-gray-400 inline-block" /> 全記事平均
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> 最大離脱区間
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">各スクロール深度への到達率（%）</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="depth" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
            <Tooltip
              formatter={(value, name) => [
                `${value}%`,
                name === 'rate' ? 'この記事' : '全記事平均',
              ]}
            />
            <ReferenceLine
              y={0}
              stroke="transparent"
            />
            {chartData.map((entry, index) => (
              <ReferenceLine
                key={`avg-${index}`}
                x={entry.depth}
                stroke="transparent"
              />
            ))}
            <Bar dataKey="rate" name="rate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isDropPoint ? '#f87171' : '#3b82f6'}
                  fillOpacity={entry.isDropPoint ? 1 : 0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 平均ラインを別途 ReferenceLine で表現 */}
        <div className="mt-4 space-y-1">
          <p className="text-xs font-medium text-gray-600 mb-2">全記事平均との比較</p>
          <div className="flex flex-wrap gap-2">
            {chartData.map((entry) => {
              const diff = entry.rate - entry.avg
              const isAbove = diff >= 0
              return (
                <div
                  key={entry.depth}
                  className={`text-xs px-2 py-1 rounded-lg border ${
                    entry.isDropPoint
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : isAbove
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-orange-200 bg-orange-50 text-orange-700'
                  }`}
                >
                  {entry.depth}: {entry.rate}%
                  <span className="ml-1 opacity-70">
                    ({isAbove ? '+' : ''}{diff.toFixed(1)} vs 平均{entry.avg}%)
                  </span>
                  {entry.isDropPoint && ' ← 最大離脱'}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 解析日時 */}
      <p className="text-xs text-gray-400 text-right">
        解析日時: {new Date(row.analyzed_at).toLocaleDateString('ja-JP', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>
    </main>
  )
}
