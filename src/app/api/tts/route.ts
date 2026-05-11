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
    const { text } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const { speed = 1.0 } = body
    const clampedSpeed = Math.max(0.25, Math.min(4.0, Number(speed)))

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'shimmer',
      input: text.slice(0, 4096),
      speed: clampedSpeed,
    })

    return new Response(mp3.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[tts error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
