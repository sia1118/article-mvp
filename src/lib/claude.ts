import Anthropic from '@anthropic-ai/sdk'

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

export const SYSTEM_PROMPTS = {
  chat: `あなたは記事執筆のサポートをするAIアシスタントです。
ユーザーが話したこと・書いたことをもとに、読者に価値のある記事を作ることをゴールにしてください。
会話を通じて内容を深掘りし、記事の方向性を一緒に作っていきます。
日本語で回答してください。`,

  articleGenerate: (conversation: string, knowledge: string) => `以下の会話内容とナレッジをもとに、ブログ記事をMarkdown形式で書いてください。

条件:
- 文字数: 2000〜4000字
- 読者: Webマーケター・ブロガー
- トーン: 親しみやすく、具体的で実践的
- 構成: タイトル / リード文 / 見出し2〜4個 / まとめ
- ユーザーの一次情報・経験を必ず記事の核心に据える
- AIが書いた感が出ないよう、具体的なエピソードや数字を使う

--- 会話内容 ---
${conversation}

--- 参照ナレッジ ---
${knowledge || 'なし'}`,
}
