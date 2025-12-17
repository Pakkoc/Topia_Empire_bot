# Topia Empire - 프로젝트 배경

## 개요

ProBot 스타일의 디스코드 서버 관리 봇 + 웹 대시보드 시스템

웹 대시보드에서 디스코드 봇의 모든 설정을 관리할 수 있도록 하는 것이 목표

---

## 목표

- 디스코드 서버 관리자가 웹에서 봇 설정을 쉽게 관리
- Discord OAuth2 로그인 후 관리 중인 서버 선택
- 서버별로 독립적인 설정 저장 및 관리
- ProBot 수준의 다양한 기능 제공

---

## 시스템 구조

```
[Discord 서버] <---> [Discord Bot]
                          |
                    (Redis Subscribe)
                          |
[웹 대시보드] --저장--> [MySQL DB]
      |
      +--publish--> [Redis Pub/Sub] --notify--> [Discord Bot]

[서버 관리자] --Discord OAuth2--> [웹 대시보드]
```

### 실시간 설정 반영 흐름

1. 서버 관리자가 웹 대시보드에서 설정 변경
2. MySQL DB에 설정 저장
3. Redis에 변경 이벤트 publish
4. Discord Bot이 Redis subscribe로 변경 감지
5. 봇 메모리 캐시 갱신 → 즉시 반영

---

## 참고

- ProBot: https://probot.io
- 기본 설정값은 ProBot 기준치 참고
