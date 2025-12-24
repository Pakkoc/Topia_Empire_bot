import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { join } from 'path';

// 폰트 등록
const fontsDir = join(__dirname, 'fonts');
GlobalFonts.registerFromPath(join(fontsDir, 'Pretendard-Regular.otf'), 'Pretendard');
GlobalFonts.registerFromPath(join(fontsDir, 'Pretendard-Bold.otf'), 'Pretendard Bold');

const FONT_REGULAR = 'Pretendard';
const FONT_BOLD = 'Pretendard Bold';

// 템플릿 경로
const TEMPLATE_PATH = join(__dirname, 'template.png');

export interface ProfileCardData {
  avatarUrl: string;
  displayName: string;
  joinedAt: Date;
  attendanceCount: number;
  statusMessage?: string;
  voiceLevel: number;
  chatLevel: number;
  isPremium: boolean;
  topyBalance: bigint;
  rubyBalance: bigint;
  topyName: string;
  rubyName: string;
  clanName?: string;
  warningCount: number;
  warningRemovalCount: number;
  colorTicketCount: number;
}

// 제국 테마 색상 팔레트
const COLORS = {
  gold: '#C9A227',           // 황금색
  darkGold: '#8B6914',       // 진한 골드
  bronze: '#CD7F32',         // 브론즈
  cream: '#F5E6C8',          // 크림
  darkBrown: '#3D2914',      // 다크 브라운 (주요 텍스트)
  mediumBrown: '#6B4423',    // 미디엄 브라운 (보조 텍스트)
  lightBrown: '#8B7355',     // 라이트 브라운
  royalPurple: '#4A1C6B',    // 로얄 퍼플
  imperialRed: '#8B0000',    // 임페리얼 레드
  emerald: '#1B5E20',        // 에메랄드 그린
};

// 출력 크기
const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 856;

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  const canvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. 배경 템플릿
  try {
    const template = await loadImage(TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  } catch {
    ctx.fillStyle = COLORS.cream;
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  }

  // 2. 아바타 (액자 내부 - 위치 조정)
  const scale = OUTPUT_WIDTH / 1728;
  const avatarCenterX = 104 * scale + 57;
  const avatarCenterY = 195 * scale + 85;
  const avatarRadiusX = 43;
  const avatarRadiusY = 52;

  try {
    const avatar = await loadImage(data.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(avatarCenterX, avatarCenterY, avatarRadiusX, avatarRadiusY, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const avatarSize = avatarRadiusY * 2.3;
    ctx.drawImage(
      avatar,
      avatarCenterX - avatarSize / 2,
      avatarCenterY - avatarSize / 2,
      avatarSize,
      avatarSize
    );
    ctx.restore();
  } catch {
    ctx.fillStyle = COLORS.lightBrown;
    ctx.beginPath();
    ctx.ellipse(avatarCenterX, avatarCenterY, avatarRadiusX, avatarRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // === 우측 상단 영역 (닉네임, 정보) ===
  const rightX = 185;
  let currentY = 75;

  // 닉네임
  ctx.font = `bold 28px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.darkBrown;
  ctx.fillText(data.displayName, rightX, currentY);

  // 부스트 배지
  if (data.isPremium) {
    const nameWidth = ctx.measureText(data.displayName).width;
    ctx.font = `bold 12px "${FONT_BOLD}"`;
    ctx.fillStyle = '#FF73FA';
    ctx.fillText('NITRO', rightX + nameWidth + 10, currentY - 8);
  }

  // 가입일
  currentY += 28;
  ctx.font = `14px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.mediumBrown;
  ctx.fillText(`${formatDate(data.joinedAt)} 가입`, rightX, currentY);

  // 출석
  currentY += 22;
  ctx.fillText(`출석 ${data.attendanceCount}회`, rightX, currentY);

  // === 레벨 박스 (우측) ===
  currentY = 165;
  drawImperialLevelBox(ctx, rightX, currentY, 'VOICE', data.voiceLevel, COLORS.royalPurple);
  drawImperialLevelBox(ctx, rightX + 145, currentY, 'CHAT', data.chatLevel, COLORS.darkGold);

  // === 중앙 구분선 (골드) ===
  currentY = 255;
  drawGoldDivider(ctx, 30, currentY, OUTPUT_WIDTH - 60);

  // === 보유 자금 섹션 ===
  currentY = 290;

  // 섹션 제목
  ctx.font = `bold 18px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.darkBrown;
  ctx.fillText('보유 자금', 50, currentY);

  // 토피
  currentY += 35;
  ctx.font = `16px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`${data.topyName}`, 50, currentY);
  ctx.fillStyle = COLORS.darkBrown;
  ctx.font = `bold 16px "${FONT_BOLD}"`;
  ctx.fillText(`${formatNumber(data.topyBalance)}`, 130, currentY);

  // 루비
  currentY += 28;
  ctx.font = `16px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.imperialRed;
  ctx.fillText(`${data.rubyName}`, 50, currentY);
  ctx.fillStyle = COLORS.darkBrown;
  ctx.font = `bold 16px "${FONT_BOLD}"`;
  ctx.fillText(`${formatNumber(data.rubyBalance)}`, 130, currentY);

  // === 소속 클랜 (우측) ===
  ctx.font = `bold 18px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.darkBrown;
  ctx.fillText('소속 클랜', 350, 290);

  ctx.font = `16px "${FONT_REGULAR}"`;
  ctx.fillStyle = data.clanName ? COLORS.darkBrown : COLORS.mediumBrown;
  ctx.fillText(data.clanName ?? '소속 없음', 350, 325);

  // === 구분선 2 ===
  drawGoldDivider(ctx, 30, 400, OUTPUT_WIDTH - 60);

  // === 상태 메시지 ===
  if (data.statusMessage) {
    ctx.font = `italic 14px "${FONT_REGULAR}"`;
    ctx.fillStyle = COLORS.mediumBrown;
    const statusText = data.statusMessage.length > 45
      ? data.statusMessage.substring(0, 45) + '...'
      : data.statusMessage;
    ctx.fillText(`"${statusText}"`, 50, 435);
  }

  // === 아이템 배지 ===
  const badgeY = 480;
  let badgeX = 50;

  badgeX = drawImperialBadge(ctx, badgeX, badgeY, '경고', data.warningCount, COLORS.imperialRed);
  badgeX = drawImperialBadge(ctx, badgeX + 15, badgeY, '경고차감권', data.warningRemovalCount, COLORS.emerald);
  drawImperialBadge(ctx, badgeX + 15, badgeY, '색상선택권', data.colorTicketCount, COLORS.royalPurple);

  return canvas.toBuffer('image/png');
}

// 제국 스타일 레벨 박스
function drawImperialLevelBox(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  level: number,
  color: string
) {
  const width = 130;
  const height = 55;

  // 배경 (살짝 투명)
  ctx.fillStyle = color + '15';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6);
  ctx.fill();

  // 테두리 (골드)
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 상단 라벨
  ctx.font = `bold 11px "${FONT_BOLD}"`;
  ctx.fillStyle = color;
  ctx.fillText(label, x + 12, y + 18);

  // 레벨
  ctx.font = `bold 24px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.darkBrown;
  ctx.fillText(`Lv ${level}`, x + 12, y + 45);
}

// 골드 구분선
function drawGoldDivider(ctx: SKRSContext2D, x: number, y: number, width: number) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.1, COLORS.gold);
  gradient.addColorStop(0.5, COLORS.darkGold);
  gradient.addColorStop(0.9, COLORS.gold);
  gradient.addColorStop(1, 'transparent');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

// 제국 스타일 배지
function drawImperialBadge(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  color: string
): number {
  const text = `${label}: ${value}`;
  ctx.font = `13px "${FONT_REGULAR}"`;
  const metrics = ctx.measureText(text);
  const padding = 12;
  const width = metrics.width + padding * 2;
  const height = 28;

  // 배경
  ctx.fillStyle = color + '18';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 텍스트
  ctx.fillStyle = COLORS.darkBrown;
  ctx.fillText(text, x + padding, y + 18);

  return x + width;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

function formatNumber(value: bigint): string {
  return value.toLocaleString();
}
