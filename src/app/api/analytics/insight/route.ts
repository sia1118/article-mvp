import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claude, CLAUDE_MODEL } from '@/lib/claude'
import { normalizeUrl } from '@/lib/analyticsUtils'

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
      .select('*')
      .eq('id', analytics_id)
      .eq('user_id', user.id)
      .single()

    if (rowError || !row) {
      return NextResponse.json({ error: 'Analytics record not found' }, { status: 404 })
    }

    // ── 紐づき記事を取得（article_idがあればそのまま、なければURLで再照合）──
    let article: { id: string; title: string; content_md: string } | null = null

    if (row.article_id) {
      const { data } = await supabase
        .from('articles')
        .select('id, title, content_md')
        .eq('id', row.article_id)
        .eq('user_id', user.id)
        .single()
      article = data
    } else {
      // CSVアップロード後にURLを登録したケース: published_url で再照合
      const { data: allArticles } = await supabase
        .from('articles')
        .select('id, title, content_md, published_url')
        .eq('user_id', user.id)
        .not('published_url', 'is', null)

      const normalizedPageUrl = normalizeUrl(row.page_url)
      const matched = (allArticles ?? []).find(
        (a) => a.published_url && normalizeUrl(a.published_url) === normalizedPageUrl
      )
      if (matched) {
        article = matched
        // article_analytics の article_id を更新しておく
        await supabase
          .from('article_analytics')
          .update({ article_id: matched.id })
          .eq('id', analytics_id)
      }
    }

    if (!article) {
      return NextResponse.json(
        { error: '合致する記事がありません。記事詳細ページで公開URLを登録してください。' },
        { status: 422 }
      )
    }

    // ── 全記事の平均スコアを取得 ──
    const { data: allRows } = await supabase
      .from('article_analytics')
      .select('catch_score,resonance_score')
      .eq('user_id', user.id)

    const avgCatch = allRows && allRows.length > 0
      ? Math.round(allRows.reduce((s, r) => s + (r.catch_score ?? 0), 0) / allRows.length)
      : 100
    const avgResonance = allRows && allRows.length > 0
      ? Math.round(allRows.reduce((s, r) => s + (r.resonance_score ?? 0), 0) / allRows.length)
      : 100

    // ウォーターフォールテキスト生成
    const depths = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const waterfallText = depths.map((d) => {
      const key = `scroll_${d}` as keyof typeof row
      const val = Number(row[key]) || 0
      const marker = d === row.drop_point ? ' ← 最大離脱' : ''
      return `${d}%到達: ${val}%${marker}`
    }).join('\n')

    // 記事全文（上限4000文字）
    const articleContent = article.content_md.length > 4000
      ? article.content_md.slice(0, 4000) + '\n\n（以下省略）'
      : article.content_md

    const prompt = `あなたはコンテンツマーケティングの専門家です。
以下の記事本文と、その記事のアクセス解析データをもとに深く分析してください。
記事の構成・見出し・内容と、スクロール離脱データを照合して具体的な改善提案を行ってください。

【記事本文】
タイトル: ${article.title}
URL: ${row.page_url}

${articleContent}

【アクセス解析データ】
セッション数: ${row.sessions}
平均エンゲージメント時間: ${row.avg_engagement_sec}秒
直帰率: ${row.bounce_rate}%
読了率: ${row.read_rate}%
キャッチ強度（10%スクロール相対スコア）: ${Math.round(row.catch_score)}（全記事平均: ${avgCatch}）
本文共鳴度（80%スクロール相対スコア）: ${Math.round(row.resonance_score)}（全記事平均: ${avgResonance}）
最大離脱区間: ${row.drop_point}%付近

【スクロールウォーターフォール（10%刻み到達率）】
${waterfallText}

以下の形式で回答してください。記事本文を実際に読んだうえで、どの見出し・どのセクションが離脱区間に対応するかを特定して分析してください。

<insight>
## 現状分析
（スクロールデータと記事構成を照合して読み取れること。どのセクションで離脱が起きているか具体的に）

## 改善仮説
（なぜこの結果になったか。記事の実際の内容・構成面から考察。具体的な見出しや文章に触れながら）

## 記事生成フローへの示唆
（次回の執筆でどこを変えるべきか。インタビューで深掘りすべき観点、記事構成の改善点を具体的に）
</insight>

<proposals>
[
  {
    "title": "企画タイトル案1（この記事の改善版または派生テーマ）",
    "theme": "テーマの要約（1〜2文。元記事の弱点を補う方向性）",
    "target": "ターゲット読者",
    "structure": "構成案（例: リード → 課題提起 → 解決策A → 解決策B → まとめ）",
    "mode": "interview",
    "seed": "このテーマで記事を書きたいです。[具体的なテーマと背景を1〜2文で]"
  },
  {
    "title": "企画タイトル案2",
    "theme": "テーマの要約（1〜2文）",
    "target": "ターゲット読者",
    "structure": "構成案",
    "mode": "chat",
    "seed": "このテーマで記事を書きたいです。[具体的なテーマと背景を1〜2文で]"
  },
  {
    "title": "企画タイトル案3",
    "theme": "テーマの要約（1〜2文）",
    "target": "ターゲット読者",
    "structure": "構成案",
    "mode": "interview",
    "seed": "このテーマで記事を書きたいです。[具体的なテーマと背景を1〜2文で]"
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
      .insert({ analytics_id, insight_md, proposals_json })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ data: { insight_md, proposals_json, id: insight.id } })
  } catch (error) {
    console.error('[analytics/insight error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
