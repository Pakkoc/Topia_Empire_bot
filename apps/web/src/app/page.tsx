"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { DiscordIcon } from "@/components/icons/discord-icon";

const features = [
  {
    icon: "solar:bolt-linear",
    title: "XP 시스템",
    description: "텍스트/음성 활동에 따른 경험치 부여로 서버 활성화",
    color: "from-yellow-500 to-amber-600",
  },
  {
    icon: "solar:cup-star-linear",
    title: "레벨 보상",
    description: "레벨업 시 자동 역할 부여 및 해금 콘텐츠 제공",
    color: "from-purple-500 to-indigo-600",
  },
  {
    icon: "solar:chart-2-linear",
    title: "실시간 통계",
    description: "멤버 활동, XP 획득량, 레벨 분포 한눈에 확인",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: "solar:settings-linear",
    title: "웹 대시보드",
    description: "모든 설정을 웹에서 쉽게 관리, 실시간 반영",
    color: "from-green-500 to-emerald-600",
  },
];

const stats = [
  { value: "실시간", label: "설정 반영" },
  { value: "무제한", label: "서버 지원" },
  { value: "24/7", label: "안정적 운영" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black overflow-hidden">
      {/* Aurora Background Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/3 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 top-0 h-[600px] w-[600px] opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.4) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-[400px] w-[500px] opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at bottom, rgba(59, 130, 246, 0.3) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="Nexus" width={140} height={48} className="h-12 w-auto" />
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-full transition-all hover:shadow-lg hover:shadow-indigo-500/25"
          >
            시작하기
            <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-white/70">올인원 커뮤니티 봇</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
              서버 관리의
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                새로운 기준
              </span>
            </h1>

            <p className="mt-8 text-lg text-white/60 max-w-md leading-relaxed">
              XP 시스템, 레벨 보상, 실시간 통계까지.
              <br />
              웹 대시보드에서 모든 것을 관리하세요.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-full transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                <DiscordIcon className="w-5 h-5" />
                Discord로 시작하기
                <Icon icon="solar:arrow-right-linear" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full border border-white/10 transition-all"
              >
                기능 살펴보기
              </a>
            </div>

            {/* Stats */}
            <div className="mt-16 flex gap-12">
              {stats.map((stat, index) => (
                <div key={index} className="animate-fade-up" style={{ animationDelay: `${200 + index * 100}ms` }}>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-white/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Visual */}
          <div className="relative animate-fade-up animate-delay-200">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl rounded-full" />

              {/* Dashboard Preview Card */}
              <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Icon icon="solar:gamepad-bold" className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Gaming Server</p>
                    <p className="text-white/50 text-sm">1,234 멤버</p>
                  </div>
                  <span className="ml-auto px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                    활성
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-white/50 text-sm">오늘 활동</p>
                    <p className="text-2xl font-bold text-white mt-1">847</p>
                    <p className="text-green-400 text-xs mt-1">+12% ↑</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-white/50 text-sm">총 XP</p>
                    <p className="text-2xl font-bold text-white mt-1">2.4M</p>
                    <p className="text-indigo-400 text-xs mt-1">+5.2K 오늘</p>
                  </div>
                </div>

                {/* Leaderboard Preview */}
                <div className="space-y-3">
                  {[
                    { rank: 1, name: "Player_One", level: 42, color: "from-yellow-500 to-amber-500" },
                    { rank: 2, name: "GamerKing", level: 38, color: "from-slate-400 to-slate-500" },
                    { rank: 3, name: "ProUser", level: 35, color: "from-amber-600 to-orange-600" },
                  ].map((user) => (
                    <div key={user.rank} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${user.color} flex items-center justify-center text-white text-sm font-bold`}>
                        {user.rank}
                      </div>
                      <span className="text-white font-medium flex-1">{user.name}</span>
                      <span className="text-white/50 text-sm">Lv.{user.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="text-center mb-16 animate-fade-up">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            강력한 기능, 간편한 설정
          </h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto">
            다양한 기능을 웹 대시보드에서 직관적으로 관리하세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon icon={feature.icon} className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-sm rounded-3xl border border-white/10 p-12 md:p-16 text-center">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10" />

          <div className="relative animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-white/60 max-w-xl mx-auto mb-8">
              Discord 계정으로 로그인하고 서버를 선택하면
              <br />
              바로 모든 기능을 사용할 수 있습니다.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 font-medium rounded-full hover:bg-white/90 transition-all shadow-xl"
            >
              <DiscordIcon className="w-5 h-5" />
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src="/logo.png" alt="Nexus" width={100} height={32} className="h-8 w-auto" />
            <p className="text-white/40 text-sm">
              © 2025 Nexus. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
