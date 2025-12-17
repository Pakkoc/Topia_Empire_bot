"use client";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-24">
        <h1 className="text-5xl font-bold tracking-tight">Topia Empire</h1>
        <p className="text-lg text-slate-300">
          디스코드 서버 관리 봇 + 웹 대시보드
        </p>
        <div className="flex gap-4">
          <a
            href="/login"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-medium transition hover:bg-indigo-500"
          >
            Discord로 로그인
          </a>
        </div>
      </div>
    </main>
  );
}
