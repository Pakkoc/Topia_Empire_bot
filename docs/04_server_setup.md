# 서버 실행 가이드

개발 환경에서 필요한 서비스들을 실행하는 방법입니다.

## 필수 서비스 목록

| 서비스 | 포트 | 설명 |
|--------|------|------|
| MySQL | 3306 | 메인 데이터베이스 (Windows 서비스) |
| Redis | 6379 | 캐시 및 세션 저장소 (Docker) |
| Adminer | 8080 | MySQL 웹 관리 도구 (Docker) |
| Next.js 웹 | 3000 | 프론트엔드 대시보드 |
| Discord 봇 | 3001 | 봇 API 서버 |

---

## 1. MySQL 실행

MySQL은 Windows에 직접 설치되어 있습니다.

### 서비스 시작
```powershell
# PowerShell (관리자 권한)
net start mysql
```

### 서비스 중지
```powershell
net stop mysql
```

### 상태 확인
```powershell
# 포트 3306 확인
netstat -ano | findstr :3306
```

---

## 2. Redis 실행 (Docker)

### 최초 실행 (컨테이너 생성)
```bash
docker run -d --name topia-redis -p 6379:6379 redis:alpine
```

### 이후 실행 (컨테이너 시작)
```bash
docker start topia-redis
```

### 중지
```bash
docker stop topia-redis
```

---

## 3. Adminer 실행 (Docker)

MySQL 웹 관리 도구입니다.

### 최초 실행 (컨테이너 생성)
```bash
docker run -d --name adminer -p 8080:8080 adminer
```

### 이후 실행 (컨테이너 시작)
```bash
docker start adminer
```

### 중지
```bash
docker stop adminer
```

### 접속 정보
- URL: http://localhost:8080
- 서버: `host.docker.internal` (Docker에서 호스트 MySQL 접속 시)
- 사용자명: `root`
- 데이터베이스: `topia_empire`

---

## 4. 봇 + 웹 개발 서버 실행

프로젝트 루트에서 실행합니다.

### 개발 서버 시작 (봇 + 웹 동시 실행)
```bash
npm run dev
```

이 명령어로 다음이 동시에 실행됩니다:
- `@topia/web` - Next.js 웹 서버 (http://localhost:3000)
- `@topia/bot` - Discord 봇 서버 (http://localhost:3001)

### 개별 실행
```bash
# 웹만 실행
npm run dev --filter=@topia/web

# 봇만 실행
npm run dev --filter=@topia/bot
```

---

## 빠른 시작 (전체 서비스)

모든 서비스를 한 번에 시작하는 순서:

```bash
# 1. Docker 서비스 시작
docker start topia-redis adminer

# 2. MySQL 확인 (Windows 서비스 - 보통 자동 시작됨)
# 필요시: net start mysql (관리자 권한 PowerShell)

# 3. 개발 서버 시작
npm run dev
```

---

## 서비스 상태 확인

### Docker 컨테이너 상태
```bash
docker ps
```

### 포트 사용 확인
```bash
# MySQL
netstat -ano | findstr :3306

# Redis
netstat -ano | findstr :6379

# 웹/봇
netstat -ano | findstr :3000
netstat -ano | findstr :3001
```
