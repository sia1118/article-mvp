import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCsv, calculateMetrics, normalizeUrl } from '@/lib/analyticsUtils'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ────── ファイル受信 ──────
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || (file.type !== 'text/csv' && !file.name.endsWith('.csv'))) {
      return NextResponse.json({ error: 'CSVファイルを選択してください' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 })
    }

    const csvText = await file.text()

    // ────── CSVパース ──────
    // ページ行形式: 1行 = 1ページ（sessions, engaged_sessions, avg_engagement_time, scroll_10〜100 等）
    const rows = parseCsv(csvText)
    if (rows.length === 0) {
      return NextResponse.json({
        error: 'CSVが空またはフォーマットが正しくありません。page_url と sessions 列が必要です。',
      }, { status: 400 })
    }

    // ────── 指標計算 ──────
    const analytics = calculateMetrics(rows)
    if (analytics.length === 0) {
      return NextResponse.json({ error: 'セッション数が0のページのみです' }, { status: 400 })
    }

    // ────── csv_uploads に記録 ──────
    const { data: upload, error: uploadError } = await supabase
      .from('csv_uploads')
      .insert({
        user_id: user.id,
        filename: file.name,
        row_count: rows.length,
        status: 'processing',
      })
      .select('id')
      .single()

    if (uploadError) throw uploadError

    // ────── articles.published_url との照合 ──────
    const { data: articles } = await supabase
      .from('articles')
      .select('id, published_url')
      .eq('user_id', user.id)
      .not('published_url', 'is', null)

    const articleMap = new Map<string, string>()
    for (const a of articles ?? []) {
      if (a.published_url) {
        articleMap.set(normalizeUrl(a.published_url), a.id)
      }
    }

    // ────── 既存レコードを page_url で取得（上書き判定用）──────
    const { data: existingRecords } = await supabase
      .from('article_analytics')
      .select('id, page_url')
      .eq('user_id', user.id)

    const existingMap = new Map<string, string>() // page_url → id
    for (const r of existingRecords ?? []) {
      existingMap.set(r.page_url, r.id)
    }

    // ────── article_analytics に保存（URL一致は UPDATE、新規は INSERT）──────
    const analyticsRows = analytics.map((a) => ({
      user_id: user.id,
      upload_id: upload.id,
      article_id: articleMap.get(a.page_url) ?? null,
      page_url: a.page_url,
      page_title: a.page_title || null,
      sessions: a.sessions,
      avg_engagement_sec: a.avg_engagement_sec,
      bounce_rate: a.bounce_rate,
      read_rate: a.read_rate,
      scroll_10: a.scroll_10,
      scroll_20: a.scroll_20,
      scroll_30: a.scroll_30,
      scroll_40: a.scroll_40,
      scroll_50: a.scroll_50,
      scroll_60: a.scroll_60,
      scroll_70: a.scroll_70,
      scroll_80: a.scroll_80,
      scroll_90: a.scroll_90,
      scroll_100: a.scroll_100,
      catch_score: a.catch_score,
      resonance_score: a.resonance_score,
      drop_point: a.drop_point,
    }))

    const toUpdate = analyticsRows.filter((r) => existingMap.has(r.page_url))
    const toInsert = analyticsRows.filter((r) => !existingMap.has(r.page_url))

    // 既存レコードを上書き（article_insights のリンクを保持するため id は変えない）
    await Promise.all(
      toUpdate.map((r) =>
        supabase
          .from('article_analytics')
          .update(r)
          .eq('id', existingMap.get(r.page_url)!)
      )
    )

    // 新規レコードを挿入
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('article_analytics')
        .insert(toInsert)
      if (insertError) throw insertError
    }

    await supabase
      .from('csv_uploads')
      .update({ status: 'done' })
      .eq('id', upload.id)

    const matched = analyticsRows.filter((r) => r.article_id !== null).length

    return NextResponse.json({
      data: {
        upload_id: upload.id,
        pages_processed: analytics.length,
        pages_updated: toUpdate.length,
        pages_inserted: toInsert.length,
        articles_matched: matched,
        rows_parsed: rows.length,
      },
    })
  } catch (error) {
    console.error('[analytics/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
