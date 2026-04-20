import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 })
    }

    // 25MB 制限（OpenAI Whisper の上限）
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: '音声ファイルが25MBを超えています' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ja',
    })

    return NextResponse.json({ data: { text: transcription.text } })
  } catch (error) {
    console.error('[transcribe error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
