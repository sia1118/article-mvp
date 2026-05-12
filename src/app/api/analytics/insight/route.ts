import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL } from '@/lib/claude'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { analytics_id } = await req.json()
    if (!analytics_id) {
      return NextResponse.json({ error: 'analytics_id is required' }, { status: 400 })
    }

    // ── 解析データ取得 ──
    const { data: row, error: rowError } = await supabase
      .from('article_analytics')
      .select('*, articles(title, content_md)')
      .eq('id', analytics_id)
      .eq('user_id', user.id)
      .single()

    if (rowError || !row) {
      return NextResponse.json({ error: 'Analytics record not found' }, { status: 404 })
    }

    // 全記事の平均スコアを取得
    const { data: allRows } = await supabase
      .from('article_analytics')
      .select('catch_score,resonance_score,scroll_10,scroll_80')
      .eq('user_id', user.id)

    const avgCatch = allRows && allRows.length > 0
      ? Math.round(allRows.reduce((s, r) => s + (r.catch_score ?? 0), 0) / allRows.length)
      : 100
    const avgResonance = allRows && allRows.length > 0
      ? Math.round(allRows.reduce((s, r) => s + (r.resonance_score ?? 0), 0) / allRows.length)
      : 100

    const articlesData = Array.isArray(row.articles) ? row.articles[0] : row.articles
    const articleTitle = articlesData?.title ?? row.page_title ?? row.page_url
    const articleContent = articlesData?.content_md ? articlesData.content_md.slice(0, 800) + '...' : 'なし'

    // ウォーターフォールテキスト生成
    const depths = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const waterfallText = depths.map((d) => {
      const key = `scroll_${d}` as keyof typeof row
      const val = Number(row[key]) || 0
      const marker = d === row.drop_point ? ' ← 最大離脱' : ''
      return `${d}%到達: ${val}%${marker}`
    }).join('\n')

    const prompt = `あなたはコンテンツマーケティングの専門家です。以下の記事解析データを分析してください。

【記事情報】
タイトル: ${articleTitle}
URL: ${row.page_url}
記事冒頭（抜粋）:
${articleContent}

【解析データ】
セッション数: ${row.sessions}
平均エンゲージメント時間: ${row.avg_engagement_sec}秒
直帰率: ${row.bounce_rate}%
読了率（エンゲージ率）: ${row.read_rate}%
キャッチ強度（10%スクロール相対スコア）: ${Math.round(row.catch_score)}（全記事平均: ${avgCatch}）
本文共鳴度（80%スクロール相対スコア）: ${Math.round(row.resonance_score)}（全記事平均: ${avgResonance}）
最大離脱区間: ${row.drop_point}%付近

【スクロールウォーターフォール】
${waterfallText}

以下の形式で回答してください。

<insight>
## 現状分析
（数値から読み取れること。具体的に）

## 改善仮説
（なぜこの結果になったか。記事構成・内容面から考察）

## 記事生成フローへの示唆
（次回の執筆でどこを変えるべきか。インタビューで深掘りすべき点、記事構成の改善点を具体的に）
</insight>

<proposals>
[
  {
    "title": "企画タイトル案1",
    "theme": "テーマの要約（1〜2文）",
    "target": "ターゲット読者",
    "structure": "構成案（例: リード → 課題提起 → 解決策A → 解決策B → まとめ）",
    "mode": "interview",
    "seed": "インタビュー/チャット開始時の最初のメッセージ（このテーマで記事を書きたい旨を伝える文章）"
  },
  {
    "title": "企画タイトル案2",
    "theme": "テーマの要約（1〜2文）",
    "target": "ターゲット読者",
    "structure": "構成案",
    "mode": "chat",
    "seed": "チャット開始時の最初のメッセージ"
  },
  {
    "title": "企画タイトル案3",
    "theme": "テーマの要約（1〜2文）",
    "target": "ターゲット読者",
    "structure": "構成案",
    "mode": "interview",
    "seed": "インタビュー開始時の最初のメッセージ"
  }
]
</proposals>`

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // insight_md 抽出
    const insightMatch = text.match(/<insight>([\s\S]*?)<\/insight>/)
    const insight_md = insightMatch ? insightMatch[1].trim() : text

    // proposals JSON 抽出
    let proposals_json: object[] = []
    const proposalsMatch = text.match(/<proposals>([\s\S]*?)<\/proposals>/)
    if (proposalsMatch) {
      try {
        proposals_json = JSON.parse(proposalsMatch[1].trim())
      } catch {
        proposals_json = []
      }
    }

    // article_insights に保存
    const { data: insight, error: insertError } = await supabase
      .from('article_insights')
      .insert({
        analytics_id,
        insight_md,
        proposals_json,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ data: { insight_md, proposals_json, id: insight.id } })
  } catch (error) {
    console.error('[analytics/insight error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
