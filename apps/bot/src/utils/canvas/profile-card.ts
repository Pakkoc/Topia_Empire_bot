import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { join } from 'path';

// 폰트 등록
const fontsDir = join(__dirname, 'fonts');
GlobalFonts.registerFromPath(join(fontsDir, 'Pretendard-Regular.otf'), 'Pretendard');
GlobalFonts.registerFromPath(join(fontsDir, 'Pretendard-Bold.otf'), 'Pretendard Bold');

const FONT_REGULAR = 'Pretendard';
const FONT_BOLD = 'Pretendard Bold';

export interface ProfileCardData {
  // 기본 정보
  avatarUrl: string;
  displayName: string;
  joinedAt: Date;
  attendanceCount: number;
  statusMessage?: string;

  // 레벨
  voiceLevel: number;
  chatLevel: number;

  // 구독 정보
  isPremium: boolean;

  // 자산
  topyBalance: bigint;
  rubyBalance: bigint;
  topyName: string;
  rubyName: string;

  // 클랜 (추후 구현)
  clanName?: string;

  // 아이템 (추후 구현)
  warningCount: number;
  warningRemovalCount: number;
  colorTicketCount: number;
}

// 색상 팔레트
const COLORS = {
  background: '#1a1a2e',
  cardBg: '#16213e',
  primary: '#5865F2',
  secondary: '#3d5a80',
  accent: '#ffd700',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  divider: '#2d3748',
  topy: '#f59e0b',
  ruby: '#ef4444',
};

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  const width = 600;
  const height = 400;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 배경 그라데이션
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, COLORS.background);
  gradient.addColorStop(1, COLORS.cardBg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 테두리
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 3;
  ctx.roundRect(10, 10, width - 20, height - 20, 15);
  ctx.stroke();

  // 아바타 로드 및 그리기
  try {
    const avatar = await loadImage(data.avatarUrl);
    const avatarSize = 80;
    const avatarX = 40;
    const avatarY = 40;

    // 원형 클리핑
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // 아바타 테두리
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch {
    // 아바타 로드 실패 시 기본 원 그리기
    ctx.beginPath();
    ctx.arc(80, 80, 40, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.secondary;
    ctx.fill();
  }

  // 닉네임
  ctx.font = `bold 24px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(data.displayName, 140, 65);

  // 가입일 및 출석
  const joinDate = formatDate(data.joinedAt);
  ctx.font = `14px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(`${joinDate} 가입 | 출석 ${data.attendanceCount}회`, 140, 90);

  // 상태 메시지
  if (data.statusMessage) {
    ctx.font = `12px "${FONT_REGULAR}"`;
    ctx.fillStyle = COLORS.textSecondary;
    const statusText = data.statusMessage.length > 30
      ? data.statusMessage.substring(0, 30) + '...'
      : data.statusMessage;
    ctx.fillText(`상태: ${statusText}`, 140, 110);
  }

  // 구분선 1
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(width - 40, 140);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 레벨 섹션
  const levelY = 175;

  // Voice 레벨
  drawLevelBadge(ctx, 80, levelY, 'VOICE', data.voiceLevel, '#9b59b6');

  // Chat 레벨
  drawLevelBadge(ctx, 280, levelY, 'CHAT', data.chatLevel, '#3498db');

  // 프리미엄 배지
  if (data.isPremium) {
    ctx.font = `bold 12px "${FONT_BOLD}"`;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('BOOST', 480, levelY);
  }

  // 구분선 2
  ctx.beginPath();
  ctx.moveTo(40, 210);
  ctx.lineTo(width - 40, 210);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 보유 자금 섹션
  ctx.font = `bold 16px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText('보유 자금', 40, 245);

  ctx.font = `bold 16px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText('소속 클랜', 400, 245);

  // 토피
  ctx.font = `14px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.topy;
  ctx.fillText(`${data.topyName}`, 40, 275);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`${formatNumber(data.topyBalance)}`, 120, 275);

  // 루비
  ctx.fillStyle = COLORS.ruby;
  ctx.fillText(`${data.rubyName}`, 40, 300);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`${formatNumber(data.rubyBalance)}`, 120, 300);

  // 클랜
  ctx.font = `14px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(data.clanName ?? '없음', 400, 275);

  // 구분선 3
  ctx.beginPath();
  ctx.moveTo(40, 325);
  ctx.lineTo(width - 40, 325);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 하단 아이템 배지들
  const badgeY = 355;
  let badgeX = 40;

  badgeX = drawBadge(ctx, badgeX, badgeY, '경고', data.warningCount.toString(), '#e74c3c');
  badgeX = drawBadge(ctx, badgeX + 15, badgeY, '경고차감권', data.warningRemovalCount.toString(), '#2ecc71');
  drawBadge(ctx, badgeX + 15, badgeY, '색상선택권', data.colorTicketCount.toString(), '#9b59b6');

  return canvas.toBuffer('image/png');
}

function drawLevelBadge(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  level: number,
  color: string
) {
  // 배경
  ctx.fillStyle = color + '33'; // 20% opacity
  ctx.roundRect(x - 30, y - 20, 120, 35, 8);
  ctx.fill();

  // 라벨
  ctx.font = `bold 12px "${FONT_BOLD}"`;
  ctx.fillStyle = color;
  ctx.fillText(label, x - 20, y - 3);

  // 레벨
  ctx.font = `bold 18px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`Lv ${level}`, x + 30, y);
}

function drawBadge(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string
): number {
  const padding = 10;
  const text = `${label}: ${value}`;

  ctx.font = `12px "${FONT_REGULAR}"`;
  const metrics = ctx.measureText(text);
  const badgeWidth = metrics.width + padding * 2;

  // 배경
  ctx.fillStyle = color + '33';
  ctx.roundRect(x, y - 15, badgeWidth, 25, 5);
  ctx.fill();

  // 텍스트
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(text, x + padding, y + 2);

  return x + badgeWidth;
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
