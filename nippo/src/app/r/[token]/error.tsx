'use client'

export default function RError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-4xl">⚠️</div>
        <p className="mt-4 text-lg font-semibold text-slate-900">画面を表示できませんでした</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          電波の良い場所でもう一度お試しください。
        </p>
        <button
          onClick={reset}
          className="mt-5 h-12 w-full rounded-lg bg-sky-600 font-medium text-white"
        >
          再読み込み
        </button>
      </div>
    </main>
  )
}
