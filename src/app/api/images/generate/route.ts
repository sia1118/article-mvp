import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { prompt } = body
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // DALL-E 3 で画像生成
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json',
    })

    const b64 = response.data?.[0]?.b64_json
    if (!b64) throw new Error('No image data returned')

    // Supabase Storage に保存
    const filename = `${user.id}/${Date.now()}.png`
    const buffer = Buffer.from(b64, 'base64')

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(filename, buffer, { contentType: 'image/png', upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(filename)

    return NextResponse.json({ data: { url: publicUrl } })
  } catch (error) {
    console.error('[images/generate error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
