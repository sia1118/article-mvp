'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Volume2, VolumeX, FileText, Pause, Play, Square, Mic } from 'lucide-react'
import VoiceRecorder from '@/components/VoiceRecorder'
import type { Message } from '@/app/api/chat/route'

interface Props {
  onArticleGenerated?: (articleId: string) => void
  conversationId?: string | null
  initialMessages?: Message[]
  initialFinished?: boolean
  seedMessage?: string
}

const FINISH_KEYWORD = '記事を生成する準備ができました'
const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5] as const

type AudioState = 'idle' | 'loading' | 'playing' | 'paused'
type HFPhase = 'waiting' | 'listening' | 'transcribing'

// ────────────────────────────────────────────
// ハンズフリー録音コンポーネント
// ────────────────────────────────────────────

function getAudioMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
  for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t
  return ''
}

interface HandsFreeRecorderProps {
  active: boolean
  disabled: boolean
  onTranscribed: (text: string) => void
}

function HandsFreeRecorder({ active, disabled, onTranscribed }: HandsFreeRecorderProps) {
  const [phase, setPhase] = useState<HFPhase>('waiting')
  const [audioLevel, setAudioLevel] = useState(0)
  const [silenceProgress, setSilenceProgress] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)
  const hasSpokenRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const phaseRef = useRef<HFPhase>('waiting')

  const SILENCE_THRESHOLD = 12   // RMS値（0-255）これ以下を無音とみなす
  const SILENCE_DURATION = 1800  // ms: 発話後この時間無音が続いたら自動停止
  const MIN_BEFORE_VAD = 800     // ms: 録音開始後この時間はVADを無効にする

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => () => cleanupMedia(), [])

  useEffect(() => {
    if (active && !disabled && phaseRef.current === 'waiting') {
      startListening()
    } else if (!active && phaseRef.current === 'listening') {
      cancelListening()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, disabled])

  function cleanupMedia() {
    if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current = null
    audioCtxRef.current = null
    hasSpokenRef.current = false
    silenceStartRef.current = null
    setAudioLevel(0)
    setSilenceProgress(0)
  }

  function cancelListening() {
    cleanupMedia()
    recorderRef.current = null
    chunksRef.current = []
    setPhase('waiting')
  }

  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)

      const mimeType = getAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        audioCtxRef.current?.close().catch(() => {})
        transcribeAudio(new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }))
      }

      recorder.start(100)
      recorderRef.current = recorder
      startTimeRef.current = Date.now()
      hasSpokenRef.current = false
      silenceStartRef.current = null
      setPhase('listening')

      const data = new Uint8Array(analyser.frequencyBinCount)
      const detectVAD = () => {
        analyser.getByteFrequencyData(data)
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
        setAudioLevel(Math.min(100, (rms / 60) * 100))

        const elapsed = Date.now() - startTimeRef.current

        if (rms > SILENCE_THRESHOLD) {
          hasSpokenRef.current = true
          silenceStartRef.current = null
          setSilenceProgress(0)
        } else if (hasSpokenRef.current && elapsed > MIN_BEFORE_VAD) {
          if (!silenceStartRef.current) silenceStartRef.current = Date.now()
          const prog = Math.min(1, (Date.now() - silenceStartRef.current) / SILENCE_DURATION)
          setSilenceProgress(prog)
          if (prog >= 1) {
            frameRef.current = null
            setPhase('transcribing')
            recorderRef.current?.stop()
            return
          }
        }
        frameRef.current = requestAnimationFrame(detectVAD)
      }
      frameRef.current = requestAnimationFrame(detectVAD)
    } catch {
      setPhase('waiting')
    }
  }

  async function transcribeAudio(blob: Blob) {
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
      const json = await res.json()
      onTranscribed(res.ok ? (json.data.text ?? '') : '')
    } catch {
      onTranscribed('')
    } finally {
      setPhase('waiting')
    }
  }

  const RADIUS = 38
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="relative flex items-center justify-center">
        <svg className="absolute w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="3" />
          {phase === 'listening' && silenceProgress > 0 && (
            <circle
              cx="48" cy="48" r={RADIUS}
              fill="none" stroke="#3b82f6" strokeWidth="3"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - silenceProgress)}
              strokeLinecap="round"
              opacity={0.7}
            />
          )}
        </svg>
        <div
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-200 ${
            phase === 'listening'
              ? 'border-blue-500 bg-blue-50'
              : phase === 'transcribing'
              ? 'border-yellow-400 bg-yellow-50'
              : 'border-gray-200 bg-gray-50'
          }`}
          style={{
            boxShadow:
              phase === 'listening' && audioLevel > 15
                ? `0 0 ${Math.round(audioLevel * 0.4)}px ${Math.round(audioLevel * 0.15)}px rgba(59,130,246,0.4)`
                : 'none',
          }}
        >
          {phase === 'transcribing' ? (
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
          ) : (
            <Mic className={`w-8 h-8 ${phase === 'listening' ? 'text-blue-500' : 'text-gray-300'}`} />
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 min-h-[1rem]">
        {phase === 'waiting'
          ? 'Botの返答を待っています...'
          : phase === 'transcribing'
          ? '文字起こし中...'
          : hasSpokenRef.current
          ? '沈黙検出中...'
          : '話しかけてください'}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────

export default function InterviewBot({
  onArticleGenerated,
  conversationId,
  initialMessages,
  initialFinished = false,
  seedMessage,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [started, setStarted] = useState((initialMessages ?? []).length > 0)
  const [finished, setFinished] = useState(initialFinished)
  const [handsFreeMode, setHandsFreeMode] = useState(false)
  const [autoListening, setAutoListening] = useState(false)
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [playbackRate, setPlaybackRate] = useState(1.0)

  const isFirstMessageRef = useRef((initialMessages ?? []).length === 0)
  const seedSentRef = useRef(false)
  const prevAudioStateRef = useRef<AudioState>('idle')
  const handsFreeRef = useRef(false)
  const ttsEnabledRef = useRef(true)
  const finishedRef = useRef(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const playbackRateRef = useRef(1.0)

  useEffect(() => { handsFreeRef.current = handsFreeMode }, [handsFreeMode])
  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])
  useEffect(() => { finishedRef.current = finished }, [finished])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    playbackRateRef.current = playbackRate
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    return () => stopAudio()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // TTS終了 → ハンズフリーのマイクON
  useEffect(() => {
    const prev = prevAudioStateRef.current
    prevAudioStateRef.current = audioState
    if (
      handsFreeRef.current &&
      !finishedRef.current &&
      prev === 'playing' &&
      audioState === 'idle'
    ) {
      const t = setTimeout(() => setAutoListening(true), 600)
      return () => clearTimeout(t)
    }
  }, [audioState])

  // ストリーミング開始時はマイクOFF
  useEffect(() => {
    if (streaming) setAutoListening(false)
  }, [streaming])

  // seedメッセージの自動送信
  useEffect(() => {
    if (seedMessage && !seedSentRef.current && conversationId && !started) {
      seedSentRef.current = true
      setInput(seedMessage)
      setTimeout(() => setStarted(true), 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedMessage, conversationId])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      try { mediaSourceRef.current.endOfStream() } catch { /* ignore */ }
    }
    mediaSourceRef.current = null
    setAudioState('idle')
  }, [])

  const togglePause = useCallback(() => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.play()
      setAudioState('playing')
    } else {
      audioRef.current.pause()
      setAudioState('paused')
    }
  }, [])

  const playTts = useCallback(async (text: string) => {
    if (!ttsEnabled) return
    stopAudio()
    setAudioState('loading')
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speed: playbackRateRef.current }),
      })
      if (!res.ok || !res.body) { setAudioState('idle'); return }
      const supportsMediaSource = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')
      if (supportsMediaSource) await playWithMediaSource(res)
      else await playWithBlob(res)
    } catch {
      setAudioState('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsEnabled, stopAudio])

  async function playWithMediaSource(res: Response) {
    const mediaSource = new MediaSource()
    mediaSourceRef.current = mediaSource
    const url = URL.createObjectURL(mediaSource)

    const audio = new Audio(url)
    audio.playbackRate = playbackRateRef.current
    audioRef.current = audio

    audio.addEventListener('play', () => setAudioState('playing'))
    audio.addEventListener('pause', () => setAudioState((s) => s === 'playing' ? 'paused' : s))
    audio.addEventListener('ended', () => { setAudioState('idle'); URL.revokeObjectURL(url) })

    const reader = res.body!.getReader()

    mediaSource.addEventListener('sourceopen', async () => {
      let sourceBuffer: SourceBuffer
      try {
        sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
      } catch {
        mediaSource.endOfStream()
        return
      }

      const enqueue = (chunk: Uint8Array) =>
        new Promise<void>((resolve) => {
          const doAppend = () => {
            if (sourceBuffer.updating) {
              sourceBuffer.addEventListener('updateend', doAppend, { once: true })
              return
            }
            sourceBuffer.appendBuffer(chunk.slice())
            sourceBuffer.addEventListener('updateend', () => resolve(), { once: true })
          }
          doAppend()
        })

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            const finish = () => {
              if (mediaSource.readyState === 'open') {
                try { mediaSource.endOfStream() } catch { /* ignore */ }
              }
            }
            if (sourceBuffer.updating) {
              sourceBuffer.addEventListener('updateend', finish, { once: true })
            } else {
              finish()
            }
            break
          }
          await enqueue(value)
          if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && audio.paused && audioState !== 'paused') {
            audio.play().catch(() => {})
          }
        }
      } catch { /* stream abort */ }
    }, { once: true })

    audio.play().catch(() => {})
  }

  async function playWithBlob(res: Response) {
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.playbackRate = playbackRateRef.current
    audioRef.current = audio
    audio.addEventListener('play', () => setAudioState('playing'))
    audio.addEventListener('pause', () => setAudioState((s) => s === 'playing' ? 'paused' : s))
    audio.addEventListener('ended', () => { setAudioState('idle'); URL.revokeObjectURL(url) })
    audio.play().catch(() => setAudioState('idle'))
  }

  async function askBot(history: Message[]) {
    setStreaming(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantText },
        ])
      }

      const isFinishing = assistantText.includes(FINISH_KEYWORD)
      if (isFinishing) setFinished(true)

      if (conversationId) {
        const messagesToSave: { role: string; content: string }[] = []
        if (history.length > 0) {
          const lastUser = history[history.length - 1]
          const isFirst = isFirstMessageRef.current
          isFirstMessageRef.current = false
          messagesToSave.push({ role: lastUser.role, content: lastUser.content })
          if (isFirst) {
            await fetch(`/api/conversations/${conversationId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: lastUser.content.slice(0, 25) }),
            })
          }
        }
        messagesToSave.push({ role: 'assistant', content: assistantText })
        await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesToSave }),
        })
      }

      playTts(assistantText)

      // TTS無効時はストリーミング完了直後にマイクON
      if (handsFreeRef.current && !ttsEnabledRef.current && !isFinishing) {
        setTimeout(() => setAutoListening(true), 600)
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  async function startInterview() {
    setStarted(true)
    await askBot([])
  }

  async function sendAnswer(content: string) {
    if (!content.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: content.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await askBot(nextMessages)
  }

  function handleHandsFreeTranscribed(text: string) {
    setAutoListening(false)
    if (text.trim()) {
      sendAnswer(text)
    }
    // 空文字の場合はBotの次の返答後に再度リスニングを試みる
  }

  function toggleHandsFreeMode() {
    const next = !handsFreeMode
    setHandsFreeMode(next)
    if (!next) {
      setAutoListening(false)
    } else if (audioState === 'idle' && !streaming && started && !finished) {
      // ハンズフリーON時にBotがすでに待機中なら即座にマイクON
      setTimeout(() => setAutoListening(true), 400)
    }
  }

  async function generateArticle() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (conversationId) {
        await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'exported' }),
        })
      }
      onArticleGenerated?.(json.data.id)
    } catch {
      alert('記事の生成に失敗しました。')
    } finally {
      setGenerating(false)
    }
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="text-5xl mb-6">🎙️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">AIインタビューBot</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-sm">
          Botがあなたの経験・知識をインタビュー形式で引き出し、記事の素材を作ります。
          音声で答えることもできます。
        </p>
        <button
          onClick={startInterview}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          インタビューを開始する
        </button>
      </div>
    )
  }

  const isAudioActive = audioState === 'playing' || audioState === 'paused' || audioState === 'loading'

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                🤖
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content || (
                <span className="flex gap-1 items-center text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  考え中...
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 記事生成ボタン */}
      {finished && (
        <div className="px-4 pb-2">
          <button
            onClick={generateArticle}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />記事を生成中...</>
            ) : (
              <><FileText className="w-4 h-4" />インタビューから記事を生成する</>
            )}
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-gray-200 bg-white px-4 pt-2 pb-3 space-y-2">
        {/* コントロール行 */}
        <div className="flex items-center gap-2">
          {/* TTS ON/OFF */}
          <button
            onClick={() => { setTtsEnabled((v) => !v); if (!ttsEnabled) stopAudio() }}
            className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            title={ttsEnabled ? '音声をオフ' : '音声をオン'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* 再生コントロール */}
          {ttsEnabled && isAudioActive && (
            <>
              <button
                onClick={togglePause}
                disabled={audioState === 'loading'}
                className="p-1.5 text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors"
                title={audioState === 'paused' ? '再開' : '一時停止'}
              >
                {audioState === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : audioState === 'paused' ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={stopAudio}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="停止"
              >
                <Square className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400 mr-1">
                {audioState === 'loading' ? '生成中...' : audioState === 'paused' ? '一時停止中' : '再生中'}
              </span>
            </>
          )}

          {/* ハンズフリートグル */}
          <button
            onClick={toggleHandsFreeMode}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
              handsFreeMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600'
            }`}
            title="ハンズフリーモード：BotのTTS終了後に自動でマイクON→沈黙検出で自動送信"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ハンズフリー</span>
          </button>

          {/* 再生速度 */}
          {ttsEnabled && (
            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
              <span className="text-xs text-gray-400 mr-0.5 hidden sm:inline">速度</span>
              {SPEED_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-1.5 sm:px-2 py-0.5 text-xs rounded-md transition-colors ${
                    playbackRate === rate
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ハンズフリーモード：大きなマイクUI */}
        {handsFreeMode ? (
          <HandsFreeRecorder
            active={autoListening && !streaming}
            disabled={streaming || finished}
            onTranscribed={handleHandsFreeTranscribed}
          />
        ) : (
          /* 通常モード：テキスト入力 */
          <div className="flex items-end gap-2">
            <VoiceRecorder
              onTranscribed={(text) => setInput((prev) => prev + text)}
              disabled={streaming}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendAnswer(input)
                }
              }}
              disabled={streaming}
              placeholder="回答を入力（Shift+Enterで改行）"
              rows={1}
              className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendAnswer(input)}
              disabled={!input.trim() || streaming}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
