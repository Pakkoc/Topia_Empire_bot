"use client";

interface WelfareGrade {
  grade: string;
  label: string;
  description: string;
}

interface WelfareHealthChartProps {
  welfareHealthIndex: number;
  welfareScale: number;
  welfareGrade: WelfareGrade;
  redistributionAmount: number;
  emissionAmount: number;
  totalWelfareAmount: number;
  isLoading?: boolean;
}

export function WelfareHealthChart({
  welfareHealthIndex,
  welfareScale,
  welfareGrade,
  redistributionAmount,
  emissionAmount,
  totalWelfareAmount,
  isLoading,
}: WelfareHealthChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  // 복지 지출이 없는 경우
  if (totalWelfareAmount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <span className="text-3xl">📊</span>
        </div>
        <p className="text-white/70 font-medium mb-1">복지 지출 내역이 없습니다</p>
        <p className="text-sm text-white/40">
          관리자 지급 기능을 통해 유저에게 화폐를 지급하면<br />
          복지 건전성 지수가 계산됩니다.
        </p>
      </div>
    );
  }

  // 등급별 색상
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "S":
        return { bg: "from-emerald-500 to-green-500", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400" };
      case "A":
        return { bg: "from-blue-500 to-cyan-500", text: "text-blue-400", badge: "bg-blue-500/20 text-blue-400" };
      case "B":
        return { bg: "from-yellow-500 to-amber-500", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-400" };
      default:
        return { bg: "from-red-500 to-rose-500", text: "text-red-400", badge: "bg-red-500/20 text-red-400" };
    }
  };

  const gradeColor = getGradeColor(welfareGrade.grade);

  // 재분배 비율 계산
  const redistributionPercent = totalWelfareAmount > 0 ? Math.round((redistributionAmount / totalWelfareAmount) * 100) : 100;
  const emissionPercent = totalWelfareAmount > 0 ? Math.round((emissionAmount / totalWelfareAmount) * 100) : 0;

  // 전문가 코멘트
  const getExpertComment = (healthIndex: number) => {
    if (healthIndex >= 90) {
      return "현재 우리 서버는 유저들이 낸 수수료를 다시 혜택으로 돌려주는 선순환 경제를 달성했습니다. 화폐 가치가 안정적입니다.";
    }
    if (healthIndex >= 75) {
      return "현재 우리 서버는 안정적 복지 체계를 유지하고 있습니다. 재분배와 통화 발행이 적절히 조화를 이루고 있습니다.";
    }
    if (healthIndex >= 50) {
      return "최근 신규 통화 발행을 통한 복지 비중이 증가하고 있습니다. 장기적으로는 물가 상승(인플레이션)의 원인이 될 수 있습니다.";
    }
    return "국고 수입보다 지출이 많은 재정 적자 상태입니다. 이는 단기적 부양책이며, 화폐 가치 하락 위험이 있습니다.";
  };

  return (
    <div className="space-y-4">
      {/* 핵심 지표 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white/70">서버 복지 건전성</h4>
          <p className="text-xs text-white/40">Welfare Health Index</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-3xl font-bold ${gradeColor.text}`}>{welfareHealthIndex}%</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeColor.badge}`}>
            {welfareGrade.grade} ({welfareGrade.label})
          </span>
        </div>
      </div>

      {/* 건전성 게이지 바 */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/40">
          <span>위험</span>
          <span>주의</span>
          <span>양호</span>
          <span>최상</span>
        </div>
        <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
          {/* 배경 그라데이션 */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30" />
          {/* 현재 값 표시 */}
          <div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${gradeColor.bg} rounded-full transition-all duration-500`}
            style={{ width: `${welfareHealthIndex}%` }}
          />
          {/* 기준점 마커 */}
          <div className="absolute top-0 left-[50%] w-0.5 h-full bg-white/30" />
          <div className="absolute top-0 left-[75%] w-0.5 h-full bg-white/30" />
          <div className="absolute top-0 left-[90%] w-0.5 h-full bg-white/30" />
        </div>
      </div>

      {/* 복지 구성 비율 */}
      <div className="bg-white/5 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">복지 세부 구성</span>
          <span className="text-white/40 text-xs">
            총 {totalWelfareAmount.toLocaleString()} 토피
          </span>
        </div>

        {/* 구성 바 */}
        <div className="h-4 bg-white/10 rounded-full overflow-hidden flex">
          {redistributionPercent > 0 && (
            <div
              className="bg-gradient-to-r from-emerald-500 to-green-500 h-full transition-all duration-500"
              style={{ width: `${redistributionPercent}%` }}
            />
          )}
          {emissionPercent > 0 && (
            <div
              className="bg-gradient-to-r from-red-500 to-rose-500 h-full transition-all duration-500"
              style={{ width: `${emissionPercent}%` }}
            />
          )}
        </div>

        {/* 범례 */}
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
            <div>
              <span className="text-white/70">재분배 복지 (재정 환원)</span>
              <span className="text-emerald-400 font-medium ml-2">{redistributionPercent}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500" />
            <div>
              <span className="text-white/70">직접 발행 (통화 팽창)</span>
              <span className="text-red-400 font-medium ml-2">{emissionPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 전문가 코멘트 */}
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">📝</span>
          <div>
            <p className="text-xs text-white/40 mb-1">경제 총평</p>
            <p className="text-sm text-white/70 leading-relaxed">
              {getExpertComment(welfareHealthIndex)}
            </p>
          </div>
        </div>
      </div>

      {/* 복지 규모 (부가 정보) */}
      {welfareScale > 0 && (
        <div className="flex items-center justify-between text-xs text-white/40 px-1">
          <span>전체 복지 규모</span>
          <span>
            국고 수입 대비{" "}
            <span className={welfareScale > 100 ? "text-red-400" : "text-white/60"}>
              {welfareScale}%
            </span>
            {welfareScale > 100 && " (재정 적자)"}
          </span>
        </div>
      )}
    </div>
  );
}
