'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

interface Props {
  onTranscribed: (text: string) => void
  disabled?: boolean
}

function getMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export default function VoiceRecorder({ onTranscribed, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        handleTranscribe(new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }))
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
      setRecording(true)
      setElapsed(0)

      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setError('マイクへのアクセスを許可してください')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setLoading(true)
  }

  async function handleTranscribe(blob: Blob) {
    try {
      const formData = new FormData()
      // Whisper は拡張子でフォーマットを判断するため .webm を付ける
      formData.append('audio', blob, 'recording.webm')

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error)
      onTranscribed(json.data.text)
    } catch {
      setError('音声の変換に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3">
      {recording ? (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <Square className="w-4 h-4 fill-white" />
          停止 {formatTime(elapsed)}
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        </button>
      ) : (
        <button
          onClick={startRecording}
          disabled={disabled || loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              変換中...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              音声入力
            </>
          )}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
