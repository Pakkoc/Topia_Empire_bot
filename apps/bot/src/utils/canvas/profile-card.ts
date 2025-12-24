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

// 색상 팔레트 (골드 테마)
const COLORS = {
  primary: '#8B7355',      // 골드 브라운
  secondary: '#A69076',    // 라이트 골드
  accent: '#C4A574',       // 밝은 골드
  textPrimary: '#4A3F35',  // 다크 브라운
  textSecondary: '#7A6B5A', // 미디엄 브라운
  topy: '#B8860B',         // 다크 골드
  ruby: '#8B0000',         // 다크 레드
};

// 출력 크기 (Discord 최적화)
const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 856; // 비율 유지 (1728:2464 = 600:856)

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  const canvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. 배경 템플릿 로드 및 그리기
  try {
    const template = await loadImage(TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  } catch (error) {
    // 템플릿 로드 실패 시 단색 배경
    ctx.fillStyle = '#F5F5DC';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  }

  // 2. 아바타 (액자 위치에 맞춤)
  // 원본 기준 액자: x=135~465, y=115~530 -> 축소 비율 적용
  const scale = OUTPUT_WIDTH / 1728;
  const frameX = 135 * scale;
  const frameY = 130 * scale;
  const frameWidth = 330 * scale;
  const frameHeight = 400 * scale;

  // 액자 내부 타원 영역
  const avatarCenterX = frameX + frameWidth / 2;
  const avatarCenterY = frameY + frameHeight / 2;
  const avatarRadiusX = (frameWidth / 2) * 0.75;
  const avatarRadiusY = (frameHeight / 2) * 0.7;

  try {
    const avatar = await loadImage(data.avatarUrl);

    // 타원형 클리핑
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(avatarCenterX, avatarCenterY, avatarRadiusX, avatarRadiusY, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 아바타 그리기 (타원에 맞춤)
    const avatarSize = Math.max(avatarRadiusX, avatarRadiusY) * 2.2;
    ctx.drawImage(
      avatar,
      avatarCenterX - avatarSize / 2,
      avatarCenterY - avatarSize / 2,
      avatarSize,
      avatarSize
    );
    ctx.restore();
  } catch {
    // 아바타 로드 실패 시 기본 타원
    ctx.fillStyle = COLORS.secondary;
    ctx.beginPath();
    ctx.ellipse(avatarCenterX, avatarCenterY, avatarRadiusX, avatarRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 닉네임 (오른쪽 상단)
  const textStartX = 250;
  const textStartY = 100;

  ctx.font = `bold 32px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(data.displayName, textStartX, textStartY);

  // 4. 가입일 & 출석
  ctx.font = `16px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.textSecondary;
  const joinDate = formatDate(data.joinedAt);
  ctx.fillText(`${joinDate} 가입`, textStartX, textStartY + 35);
  ctx.fillText(`출석 ${data.attendanceCount}회`, textStartX, textStartY + 58);

  // 5. 부스트 배지
  if (data.isPremium) {
    ctx.font = `bold 14px "${FONT_BOLD}"`;
    ctx.fillStyle = '#FF73FA';
    ctx.fillText('BOOST', textStartX + 200, textStartY);
  }

  // 6. 레벨 섹션 (오른쪽)
  const levelY = 220;

  // Voice 레벨
  drawLevelBox(ctx, textStartX, levelY, 'VOICE', data.voiceLevel, '#9B59B6');

  // Chat 레벨
  drawLevelBox(ctx, textStartX + 160, levelY, 'CHAT', data.chatLevel, '#3498DB');

  // 7. 구분선
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 340);
  ctx.lineTo(OUTPUT_WIDTH - 40, 340);
  ctx.stroke();

  // 8. 정보 섹션 (하단)
  const infoY = 380;
  const col1X = 60;
  const col2X = 320;

  // 섹션 타이틀
  ctx.font = `bold 20px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText('보유 자금', col1X, infoY);
  ctx.fillText('소속 클랜', col2X, infoY);

  // 토피
  ctx.font = `18px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.topy;
  ctx.fillText(data.topyName, col1X, infoY + 40);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(formatNumber(data.topyBalance), col1X + 80, infoY + 40);

  // 루비
  ctx.fillStyle = COLORS.ruby;
  ctx.fillText(data.rubyName, col1X, infoY + 70);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(formatNumber(data.rubyBalance), col1X + 80, infoY + 70);

  // 클랜
  ctx.font = `18px "${FONT_REGULAR}"`;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(data.clanName ?? '없음', col2X, infoY + 40);

  // 9. 구분선 2
  ctx.strokeStyle = COLORS.accent;
  ctx.beginPath();
  ctx.moveTo(40, 500);
  ctx.lineTo(OUTPUT_WIDTH - 40, 500);
  ctx.stroke();

  // 10. 상태 메시지
  if (data.statusMessage) {
    ctx.font = `14px "${FONT_REGULAR}"`;
    ctx.fillStyle = COLORS.textSecondary;
    const statusText = data.statusMessage.length > 40
      ? data.statusMessage.substring(0, 40) + '...'
      : data.statusMessage;
    ctx.fillText(`"${statusText}"`, col1X, 540);
  }

  // 11. 하단 아이템 배지들
  const badgeY = 600;
  let badgeX = 60;

  badgeX = drawBadge(ctx, badgeX, badgeY, '경고', data.warningCount.toString(), '#C0392B');
  badgeX = drawBadge(ctx, badgeX + 20, badgeY, '경고차감권', data.warningRemovalCount.toString(), '#27AE60');
  drawBadge(ctx, badgeX + 20, badgeY, '색상선택권', data.colorTicketCount.toString(), '#8E44AD');

  return canvas.toBuffer('image/png');
}

function drawLevelBox(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  level: number,
  color: string
) {
  const boxWidth = 140;
  const boxHeight = 60;

  // 배경 박스
  ctx.fillStyle = color + '20';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 10);
  ctx.fill();
  ctx.stroke();

  // 라벨
  ctx.font = `bold 12px "${FONT_BOLD}"`;
  ctx.fillStyle = color;
  ctx.fillText(label, x + 15, y + 22);

  // 레벨
  ctx.font = `bold 28px "${FONT_BOLD}"`;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`Lv ${level}`, x + 15, y + 50);
}

function drawBadge(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string
): number {
  const padding = 15;
  const text = `${label}: ${value}`;

  ctx.font = `14px "${FONT_REGULAR}"`;
  const metrics = ctx.measureText(text);
  const badgeWidth = metrics.width + padding * 2;
  const badgeHeight = 32;

  // 배경
  ctx.fillStyle = color + '25';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, badgeWidth, badgeHeight, 8);
  ctx.fill();
  ctx.stroke();

  // 텍스트
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(text, x + padding, y + 21);

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
