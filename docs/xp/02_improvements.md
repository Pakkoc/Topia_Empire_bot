# XP 시스템 개선사항

## 1. 레벨업 알림 Discord Embed 적용

### 현재 상태
- 단순 텍스트 메시지로 레벨업 알림 전송
- `xp.handler.ts:174`에서 `channel.send(formattedMessage)` 사용

### 개선 제안
Discord Embed를 사용하여 더 시각적으로 풍부한 레벨업 알림 제공

### 예시 코드
```typescript
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  .setColor(0xFFD700) // 골드 색상
  .setTitle('🎉 레벨 업!')
  .setDescription(`${user}님이 **레벨 ${level}**에 도달했습니다!`)
  .addFields(
    { name: '현재 XP', value: xp.toLocaleString(), inline: true },
    { name: '다음 레벨까지', value: `${nextLevelXp - xp} XP`, inline: true }
  )
  .setThumbnail(user.displayAvatarURL())
  .setTimestamp()
  .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined });

await channel.send({ embeds: [embed] });
```

### 추가 고려사항
- 레벨 보상 역할이 있는 경우 Embed에 표시
- 해금된 채널이 있는 경우 Embed에 표시
- 커스텀 색상 설정 옵션 (웹 대시보드)
- 커스텀 썸네일/이미지 설정 옵션

### 우선순위
낮음 (현재 기능은 정상 작동, UX 개선 목적)
