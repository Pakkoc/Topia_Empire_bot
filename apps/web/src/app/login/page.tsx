"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";

const benefits = [
  { icon: "solar:bolt-linear", text: "XP 시스템으로 서버 활성화" },
  { icon: "solar:cup-star-linear", text: "레벨업 보상 자동 지급" },
  { icon: "solar:chart-2-linear", text: "실시간 통계 확인" },
  { icon: "solar:settings-linear", text: "웹에서 모든 설정 관리" },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-black overflow-hidden">
      {/* Aurora Background Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="Nexus" width={140} height={48} className="h-12 w-auto" />
        </Link>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl animate-fade-up">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-xl rounded-3xl" />

            <div className="relative">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:crown-bold" className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">시작하기</h1>
                <p className="text-white/60 text-sm">
                  Discord 계정으로 로그인하여
                  <br />
                  서버를 관리하세요
                </p>
              </div>

              {/* Discord Login Button */}
              <button
                onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
                className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#5865F2]/25 hover:shadow-[#5865F2]/40"
              >
                <Icon icon="ic:baseline-discord" className="w-6 h-6" />
                <span>Discord로 계속하기</span>
                <Icon
                  icon="solar:arrow-right-linear"
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-xs">가입하면 이런 혜택을</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <Icon icon={benefit.icon} className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-white/70 text-sm">{benefit.text}</span>
                  </div>
                ))}
              </div>

              {/* Terms */}
              <p className="mt-8 text-center text-white/40 text-xs leading-relaxed">
                로그인하면{" "}
                <a href="#" className="text-indigo-400 hover:underline">
                  서비스 약관
                </a>
                과{" "}
                <a href="#" className="text-indigo-400 hover:underline">
                  개인정보 처리방침
                </a>
                에 동의하는 것으로 간주됩니다.
              </p>
            </div>
          </div>

          {/* Back Link */}
          <div className="text-center mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
