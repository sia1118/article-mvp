import Papa from 'papaparse'

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export interface CsvRow {
  page_url: string
  page_title?: string
  event_name: string
  percent_scrolled?: string
  count?: string
  avg_engagement_sec?: string
}

export interface PageAggregated {
  page_url: string
  page_title: string
  sessions: number
  engagement_events: number
  total_engagement_sec: number
  scroll_counts: Record<number, number>
}

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
// URL正規化
// ────────────────────────────────────────────

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '').split('?')[0].toLowerCase()
}

// ────────────────────────────────────────────
// CSVパース
// ────────────────────────────────────────────

export function parseCsv(text: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) =>
      h.trim().toLowerCase().replace(/[\s\-]/g, '_'),
  })
  return result.data
}

// ────────────────────────────────────────────
// ページ別集計
// ────────────────────────────────────────────

const SCROLL_DEPTHS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function aggregateByPage(rows: CsvRow[]): PageAggregated[] {
  const map = new Map<string, PageAggregated>()

  for (const row of rows) {
    if (!row.page_url || !row.event_name) continue

    const url = normalizeUrl(row.page_url)
    if (!map.has(url)) {
      map.set(url, {
        page_url: url,
        page_title: row.page_title ?? '',
        sessions: 0,
        engagement_events: 0,
        total_engagement_sec: 0,
        scroll_counts: {},
      })
    }

    const page = map.get(url)!
    const count = Math.max(0, parseInt(row.count ?? '0', 10) || 0)
    const name = row.event_name.trim().toLowerCase()

    if (name === 'session_start') {
      page.sessions += count
    } else if (name === 'user_engagement') {
      page.engagement_events += count
      const sec = parseFloat(row.avg_engagement_sec ?? '0') || 0
      page.total_engagement_sec += sec * count
    } else if (name === 'scroll') {
      const pct = parseInt(row.percent_scrolled ?? '0', 10)
      if (SCROLL_DEPTHS.includes(pct)) {
        page.scroll_counts[pct] = (page.scroll_counts[pct] ?? 0) + count
      }
    }
  }

  return Array.from(map.values()).filter((p) => p.sessions > 0)
}

// ────────────────────────────────────────────
// 指標計算
// ────────────────────────────────────────────

function rate(count: number, sessions: number): number {
  if (sessions === 0) return 0
  return Math.round((count / sessions) * 1000) / 10  // 小数1桁の%
}

function findDropPoint(scrollRates: Record<number, number>): number {
  let maxDrop = -1
  let dropPoint = 10
  for (let i = 10; i <= 90; i += 10) {
    const drop = (scrollRates[i] ?? 0) - (scrollRates[i + 10] ?? 0)
    if (drop > maxDrop) {
      maxDrop = drop
      dropPoint = i
    }
  }
  return dropPoint
}

export function calculateMetrics(pages: PageAggregated[]): AnalyticsRow[] {
  // スクロール到達率の計算
  const rows = pages.map((page): Omit<AnalyticsRow, 'catch_score' | 'resonance_score'> => {
    const { sessions, engagement_events, total_engagement_sec, scroll_counts } = page

    const scrollRates: Record<number, number> = {}
    for (const d of SCROLL_DEPTHS) {
      scrollRates[d] = rate(scroll_counts[d] ?? 0, sessions)
    }

    const avg_engagement_sec =
      engagement_events > 0
        ? Math.round(total_engagement_sec / engagement_events)
        : 0

    const bounce_rate = rate(sessions - Math.min(scroll_counts[10] ?? 0, sessions), sessions)
    const read_rate = rate(engagement_events, sessions)

    return {
      page_url: page.page_url,
      page_title: page.page_title,
      sessions,
      avg_engagement_sec,
      bounce_rate,
      read_rate,
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

  // 相対スコア計算（全記事平均を基準100）
  const avg10 = rows.reduce((s, r) => s + r.scroll_10, 0) / (rows.length || 1)
  const avg80 = rows.reduce((s, r) => s + r.scroll_80, 0) / (rows.length || 1)

  return rows.map((row) => ({
    ...row,
    catch_score: avg10 > 0 ? Math.round((row.scroll_10 / avg10) * 100) : 100,
    resonance_score: avg80 > 0 ? Math.round((row.scroll_80 / avg80) * 100) : 100,
  }))
}
