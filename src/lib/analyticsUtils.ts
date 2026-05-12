import Papa from 'papaparse'

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

// PapaParse が返すページ行（列名はヘッダーマッピング後）
export type CsvRow = Record<string, string>

export interface AnalyticsRow {
  page_url: string
  page_title: string
  sessions: number
  avg_engagement_sec: number
  bounce_rate: number
  read_rate: number
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
  catch_score: number
  resonance_score: number
  drop_point: number
}

// ────────────────────────────────────────────
// GA4 ヘッダー名マッピング
// （日本語 / 英語 / 探索レポート表記）
// ────────────────────────────────────────────

const HEADER_MAP: Record<string, string> = {
  // ページURL
  'ページのパスとスクリーンクラス': 'page_url',
  'ページパスとスクリーンクラス': 'page_url',
  'ページのパス': 'page_url',
  'page path': 'page_url',
  'page_path': 'page_url',
  'page path + query string': 'page_url',
  'landing page': 'page_url',
  // ページタイトル
  'ページタイトル': 'page_title',
  'ページタイトルとスクリーン名': 'page_title',
  'page title': 'page_title',
  'page title and screen name': 'page_title',
  // セッション
  'セッション': 'sessions',
  'sessions': 'sessions',
  'session': 'sessions',
  // エンゲージセッション
  'エンゲージのあるセッション数': 'engaged_sessions',
  'エンゲージのあるセッション': 'engaged_sessions',
  'engaged sessions': 'engaged_sessions',
  'engaged_sessions': 'engaged_sessions',
  // 平均エンゲージメント時間
  '平均エンゲージメント時間': 'avg_engagement_time',
  'average engagement time': 'avg_engagement_time',
  'avg. session duration': 'avg_engagement_time',
  // 直帰率
  '直帰率': 'bounce_rate',
  'bounce rate': 'bounce_rate',
  'bounced sessions': 'bounce_rate',
}

function mapHeader(raw: string): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  // 完全一致（日本語優先）
  if (HEADER_MAP[trimmed]) return HEADER_MAP[trimmed]
  if (HEADER_MAP[lower]) return HEADER_MAP[lower]
  // スネークケース化してそのまま返す（scroll_10 など）
  return lower
    .replace(/[%（）()]/g, '')
    .replace(/[\s\-・/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

// ────────────────────────────────────────────
// URL正規化
// ────────────────────────────────────────────

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '').split('?')[0].toLowerCase()
}

// ────────────────────────────────────────────
// 数値パーサー群
// ────────────────────────────────────────────

// "1:25" → 85, "0:01:25" → 85, "90" → 90
function parseEngagementTime(value: string): number {
  if (!value) return 0
  const v = value.trim()
  const parts = v.split(':')
  if (parts.length === 2) {
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0)
  }
  if (parts.length === 3) {
    return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0)
  }
  return Math.round(parseFloat(v)) || 0
}

// "25.8%" → 25.8, "0.258" → 25.8, "25.8" → 25.8
function parsePct(value: string): number {
  if (!value) return 0
  const v = value.trim().replace('%', '')
  const n = parseFloat(v)
  if (isNaN(n)) return 0
  // 0〜1 の小数で % 記号なし → ×100
  if (n > 0 && n < 1 && !value.includes('%')) return Math.round(n * 1000) / 10
  return Math.round(n * 10) / 10
}

function toInt(value: string | undefined): number {
  return Math.max(0, parseInt(value ?? '0', 10) || 0)
}

function rate(count: number, sessions: number): number {
  if (sessions === 0) return 0
  return Math.round((count / sessions) * 1000) / 10
}

function findDropPoint(scrollRates: Record<number, number>): number {
  let maxDrop = -1
  let dropPoint = 10
  for (let i = 10; i <= 90; i += 10) {
    const drop = (scrollRates[i] ?? 0) - (scrollRates[i + 10] ?? 0)
    if (drop > maxDrop) { maxDrop = drop; dropPoint = i }
  }
  return dropPoint
}

// ────────────────────────────────────────────
// CSVパース（ページ行形式）
// ────────────────────────────────────────────

export function parseCsv(text: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: mapHeader,
  })
  return result.data.filter((r) => r.page_url && r.sessions)
}

// ────────────────────────────────────────────
// 指標計算（ページ行形式 → AnalyticsRow[]）
// ────────────────────────────────────────────

const SCROLL_DEPTHS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function calculateMetrics(rows: CsvRow[]): AnalyticsRow[] {
  const partials = rows.map((row): Omit<AnalyticsRow, 'catch_score' | 'resonance_score'> => {
    const sessions = toInt(row.sessions)
    const engagedSessions = toInt(row.engaged_sessions)
    const avgEngagementSec = parseEngagementTime(row.avg_engagement_time ?? '')

    // bounce_rate: CSV値を使用、なければ engaged_sessions から算出
    const bounceRate = row.bounce_rate
      ? parsePct(row.bounce_rate)
      : rate(Math.max(0, sessions - engagedSessions), sessions)

    const readRate = rate(engagedSessions, sessions)

    const scrollRates: Record<number, number> = {}
    for (const d of SCROLL_DEPTHS) {
      const rawCount = toInt(row[`scroll_${d}`])
      scrollRates[d] = rate(rawCount, sessions)
    }

    return {
      page_url: normalizeUrl(row.page_url),
      page_title: row.page_title ?? '',
      sessions,
      avg_engagement_sec: avgEngagementSec,
      bounce_rate: bounceRate,
      read_rate: readRate,
      scroll_10: scrollRates[10],
      scroll_20: scrollRates[20],
      scroll_30: scrollRates[30],
      scroll_40: scrollRates[40],
      scroll_50: scrollRates[50],
      scroll_60: scrollRates[60],
      scroll_70: scrollRates[70],
      scroll_80: scrollRates[80],
      scroll_90: scrollRates[90],
      scroll_100: scrollRates[100],
      drop_point: findDropPoint(scrollRates),
    }
  })

  // 全記事平均を基準にした相対スコア（基準100）
  const avg10 = partials.reduce((s, r) => s + r.scroll_10, 0) / (partials.length || 1)
  const avg80 = partials.reduce((s, r) => s + r.scroll_80, 0) / (partials.length || 1)

  return partials.map((row) => ({
    ...row,
    catch_score: avg10 > 0 ? Math.round((row.scroll_10 / avg10) * 100) : 100,
    resonance_score: avg80 > 0 ? Math.round((row.scroll_80 / avg80) * 100) : 100,
  }))
}
