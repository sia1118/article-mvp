'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import VoiceRecorder from '@/components/VoiceRecorder'

export default function VoiceTestPage() {
  const [transcripts, setTranscripts] = useState<string[]>([])

  function handleTranscribed(text: string) {
    setTranscripts((prev) => [text, ...prev])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">音声入力テスト</h1>
        <p className="text-sm text-gray-500 mb-8">録音して文字起こしを確認します</p>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <VoiceRecorder onTranscribed={handleTranscribed} />
        </div>

        {transcripts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700">文字起こし結果</h2>
            {transcripts.map((text, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800">
                {text}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
