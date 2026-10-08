# 배포와 실제 연결

구성은 **Vercel + Supabase**, 장소는 OpenStreetMap, 도로 경로는 openrouteservice, 대중교통은 Google Routes, 환율은 Frankfurter입니다. Docker로 자체 서버에도 배포할 수 있습니다. 현재 운영 계정·인증값이 없어 공개 배포는 완료되지 않았습니다. 코드 검증 결과와 외부 연결 조건은 [출시 준비 기록](RELEASE_READINESS.md)에 구분했습니다.

## Supabase와 계정

1. 운영 프로젝트를 생성하고 마이그레이션을 **001 → 003 → 005 → 006 → 007 → 008 → 009 → 010 → 011** 순서로 한 번씩 적용합니다. 기존 001/002/003/004 프로젝트에는 아직 적용하지 않은 005~011을 순서대로 적용합니다. 002/004의 정리 일정은 008이 대체합니다. 새 프로젝트에는 002/004를 추가 실행할 필요가 없습니다. 최종 상태는 스키마 11입니다. 과거 함수 정의로 되돌리는 003만 단독 재실행하지 마세요.
2. `pg_cron`을 허용합니다. 008은 이름 `bopok-retention`의 **매시간** 정리 작업을 등록합니다. `select public.bopok_health(11);`과 `cron.job_run_details`에서 최신 성공을 확인합니다. 만료 여행·복구 키·캐시·요청량 이력·집계 지표를 정리합니다.
3. `BOPok_SUPABASE_URL`, 서버 전용 service role `BOPok_SUPABASE_KEY`, 로그인용 공개 anon `BOPok_SUPABASE_ANON_KEY`를 설정합니다. service role은 브라우저에 전달하지 않습니다. private 테이블은 RLS로 보호하고 RPC 권한을 제한합니다.
4. Supabase Auth에서 이메일 OTP를 켜고 메일 템플릿에 **`{{ .Token }}`**을 넣습니다. UI는 이메일로 받은 코드를 입력하는 방식입니다. 실제 발송·SMTP·메일 요청 한도·수신함 도착을 운영 계정에서 확인합니다.
5. 다른 계정의 UUID를 쉼표로 연결해 `BOPok_REVIEWER_IDS`, `BOPok_OPERATOR_IDS`를 설정합니다. 검토자는 자기 기록을 승인할 수 없습니다. 서버가 Supabase `/user`로 확인한 계정만 역할을 부여합니다.
6. Cloudflare Turnstile 사이트와 허용 호스트를 만들고 site key/secret을 설정합니다. `BOPok_REQUIRE_AUTH=true`, `BOPok_REQUIRE_BOT=true`를 유지합니다. secret은 Siteverify POST 본문용 실제 비밀 환경값입니다.

`BOPok_SESSION_SECRET`은 32자 이상 난수이며 HMAC·시설 검토 서명에 쓰입니다. 모든 앱 인스턴스에서 동일한 값을 사용합니다. 교체하면 기존 인증·시설 서명이 무효가 되므로 재로그인·재검토 절차가 필요합니다. 프록시 자리표시자를 사용하지 않습니다.

## Vercel과 배포 검사

1. `feat/bopok-mvp` 브랜치를 Vercel 프로젝트에 연결합니다. Node 24, Next.js, 빌드 `npm run build`를 선택합니다. 미리보기와 운영 계정·DB·키를 분리합니다.
2. `.env.example`의 변수와 아래 연결을 배포 설정에 입력합니다. `BOPok_APP_URL`에는 정확한 HTTPS origin을 사용합니다. Vercel 미리보기에서는 신뢰할 수 있는 `VERCEL_URL`을 사용합니다.
3. GitHub의 preview/production 환경에 `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`를 등록합니다. `.github/workflows/deploy.yml`은 타입·단위·4개 브라우저 검사 후 미리보기를 배포합니다. `/api/health`와 규칙 추출 검사가 통과해야 선택한 운영 배포를 진행합니다. 보호된 미리보기는 점검 가능한 접근 정책이 필요합니다.
4. 운영 기본 `BOPok_REQUIRED_FEATURES=storage,auth,routing,ai,bot,maintenance,reviews,alerts,backup`을 유지합니다. `/api/health`는 누락 시 503, `?level=live`는 프로세스 생존만 200을 반환합니다. 단순 DB 접속이나 configured 플래그는 실제 공급자 호출 성공을 증명하지 않습니다.

```sh
BOPok_DEPLOY_URL=https://your-app.example node scripts/probe-deployment.mjs
```

점검은 저장·공유 링크를 만들지 않습니다. `--demo`는 가상 시연 검사에만 사용하며 운영 준비 검사를 대신하지 않습니다. 첫 미리보기는 backup 게이트 때문에 준비 점검이 실패할 수 있지만 배포 주소는 Vercel에 생성됩니다. 그 주소의 DB를 아래 절차로 백업/격리 복원한 후 같은 주소에 성공을 기록하고 배포 검사를 다시 실행합니다. 운영 DB가 미리보기와 다르면 운영 DB에도 별도 첫 복원 검증이 필요합니다.

## 경로·AI·환율

| 설정 | 용도 |
| --- | --- |
| `BOPok_ROUTE_KEY` | openrouteservice 도로 경로 |
| `BOPok_GOOGLE_MAPS_KEY` | Google Routes 대중교통, 사용 API/서버 제한 설정 |
| `BOPok_AI_KEY`, `BOPok_AI_MODEL` | 사용 가능한 OpenAI Responses 모델 |
| `BOPok_AI_INPUT_USD_PER_MILLION`, `BOPok_AI_OUTPUT_USD_PER_MILLION` | 선택 모델의 현재 공식 단가 |
| `BOPok_AI_DAILY_USD_LIMIT` | 기본 1 USD, 보수적 예약액 상한 |
| `BOPok_AI_DAILY_TOKEN_LIMIT`, `BOPok_AI_DAILY_REQUEST_LIMIT` | 기본 200,000토큰/30요청 |

AI는 로그인·전송 동의·DB 원자적 예약 후 호출합니다. 실키가 준비되면 최소 요청으로 모델 지원과 한도 차감을 확인합니다. 도로·대중교통도 실제 공급자 응답으로 시간·거리를 확인합니다. Google 경로의 계단·내부 보행·운임은 모르는 상태로 유지합니다.

필요한 HTTPS 호스트: `nominatim.openstreetmap.org`, `overpass-api.de`, `api.frankfurter.dev`, `api.openrouteservice.org`, `routes.googleapis.com`, `api.openai.com`, `challenges.cloudflare.com`, 정확한 Supabase 프로젝트 호스트. 기기 검사는 `hub.browserstack.com`을 추가합니다. Supabase/알림 호스트는 계정 선택 후 정확한 호스트를 등록합니다.

Nominatim은 앱 주소를 넣은 식별 User-Agent, 공유 DB 캐시와 최소 2초 간격을 사용합니다. Overpass는 최소 10초 간격·1일 캐시입니다. 공용 서비스의 혼잡·장애 시 오류를 표시하며 운영 규모에 맞는 공급자 용량을 확보해야 합니다. Frankfurter에서 지원하지 않거나 7일 지난 환율은 환산하지 않습니다.

참고: [Nominatim 정책](https://operations.osmfoundation.org/policies/nominatim/), [OSM 저작권](https://www.openstreetmap.org/copyright), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [openrouteservice](https://openrouteservice.org/), [OpenAI 가격](https://openai.com/api/pricing/).

## 모니터링·알림·백업

`/ops`는 지정 운영 계정으로 접속합니다. 자동 작업은 32자 이상 `BOPok_OPS_SECRET`으로 인증합니다. 요청수·거부/오류 코드·소요 시간만 집계하며 여행 조건·의견·쿠키·링크 키·IP를 수집하지 않습니다. `BOPok_ALERTS_ENABLED=true`와 HTTPS `BOPok_ALERT_WEBHOOK_URL`을 설정하면 이상 상태를 30분 간격으로 중복 억제합니다. 실제 알림 수신은 담당자와 별도로 확인합니다.

백업은 PostgreSQL 17 `pg_dump`의 public 스키마를 AES-256-GCM으로 암호화합니다. Auth 계정과 공급자 관리 스키마 전체를 보관하는 백업은 Supabase의 별도 재해 복구 정책이 필요합니다. 대상 복원 DB는 새 격리 DB만 사용하며 public 객체가 있으면 거부합니다. 키는 암호화 파일과 다른 비밀 저장소에 보관합니다.

```sh
# 실제 값은 환경 비밀 설정에서 주입
node scripts/backup.mjs backup database.enc
node scripts/backup.mjs restore database.enc
# 성공한 격리 복원 후에만 기록
node scripts/record-backup.mjs
```

변수는 `BOPok_DATABASE_URL`, `BOPok_RESTORE_DATABASE_URL`, 64자리 hex `BOPok_BACKUP_KEY`, 기록용 `BOPok_DEPLOY_URL`/`BOPok_OPS_SECRET`입니다. 원격 DB TLS는 기본 `verify-full`이며 신뢰 CA를 유지합니다. 직접 PostgreSQL 연결에는 공급자의 CA/네트워크·IPv4 연결 지원을 확인합니다.

`.github/workflows/operations.yml`은 GitHub 변수 `BOPok_OPERATIONS_ENABLED=true`일 때만 실행합니다. `BOPok_DEPLOY_URL` 변수와 위 비밀을 등록합니다. 매시간 상태 점검, 매일 **18:31 UTC** 암호화 백업·격리 복원 후 성공 기록, 7일 암호화 artifact 보관을 제공합니다. 복원 확인이 7일 지나면 준비 상태가 실패합니다. 장기 보관·다른 저장소 보관과 키 복구는 운영 정책에 맞게 추가 설정합니다.

격리 DB/정리 검증은 실제 운영 값을 읽지 않습니다:

```sh
docker build -f infra/postgres-test.Dockerfile -t bopok:postgres-cron-test .
BOPok_PG_TEST_IMAGE=bopok:postgres-cron-test BOPok_TEST_CRON=true npm run test:postgres
```

이 클라우드에서는 컨테이너 DNS 제한 때문에 APT 서명/체크섬 검증한 Debian pg_cron 패키지를 `/workspace/postgres-deps/extracted`에 추출하고 오프라인 컨텍스트로 같은 PostgreSQL 17 검사를 실행했습니다:

```sh
docker --config /tmp/bopok-docker-config build -f infra/postgres-offline-test.Dockerfile --build-context cron=/workspace/postgres-deps/extracted -t bopok:postgres-cron-test .
```

## 한도와 자료 검토

| 제한 | 기본값 |
| --- | --- |
| 이메일/인증 요청 | 전체 60회/분, 500회/일 |
| 서버 변경 저장 | 소유자/편집 권한별 10회/분, 전체 1,000회/일 |
| 신규 익명 세션 | 허용한 환경에서 전체 60회/분, 1,000회/일 |
| 시설 검토·도로 경로·자료 새로고침 | 각각 1,000·1,000·100회/일 |
| 서버 여행 | 소유자 20개, 전체 2,000개 |
| 여행 JSON | 개별 8 MiB, 전체 250 MiB |
| 도시 캐시 | 2,000개/100 MiB, 개별 512 KiB, 1일 유효 |

일일 제한은 Asia/Seoul 기준으로 DB에서 원자적으로 예약합니다. `.env.example`의 quota 변수로 요청 상한을 조절하고, `bopok_limits`의 `trips_per_owner`·`trip_count`·`storage_bytes`로 저장 용량을 조절합니다. 최대 허용치는 SQL에 제한되어 있습니다. JSON 상한은 디스크·인덱스·WAL·백업 비용 전체의 상한이 아닙니다.

실제 여행은 최대 30일·10개 도시입니다. 시설 기록에는 HTTPS 출처와 확인 날짜가 필요하며 `/review`에서 다른 지정 검토자가 승인합니다. 서명·내용·최근 날짜를 확인한 경우에만 독립 검토를 신뢰합니다. 전 세계 시설 사실을 자동으로 검증한 데이터베이스는 없으므로 실제 사용 지역에 필요한 기록을 확보해야 합니다.

## 최종 사용자 검증

새 여행 서버 저장 → 이메일 로그인 후 기존 여행 이전 → 다른 기기 계정 복원 → 부모님 링크/의견 → 편집 권한·버전 충돌 → 링크 폐기 → JSON 복원 → 서버 삭제를 확인합니다. 세계 도시 검색, 날짜별 시간대·현지 통화·도시 간 이동, 실제 경로·AI 요청, 검토 승인과 변조 거부, 알림 수신·정리·운영 백업을 확인합니다.

`BOPok_DEPLOY_URL`, `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`를 설정한 `npm run test:devices`는 실제 iPhone/Android 클라우드 기기에 접속합니다. 계정이 없어 아직 실행되지 않았습니다. Playwright WebKit은 실제 iOS 기기를 대신하지 않습니다. VoiceOver/TalkBack·물리 프린터는 실제 기기로 별도 점검합니다. `BOPok_LOAD_URL`을 격리된 앱에 설정한 `npm run test:load`는 비용 없는 상태/규칙 API 부하를 확인하며 운영 규모의 성능 보증이 아닙니다.

## Docker와 클라우드 환경

```sh
docker build -t bopok .
docker run --rm -p 3000:3000 --env-file .env.production bopok
# Linux CI에서 이미 빌드했다면
npm ci
npm run build
docker build -f Dockerfile.runtime -t bopok .
```

standalone은 비루트 Node 사용자로 실행합니다. HTTPS 앞단과 같은 환경 설정이 필요합니다. runtime 경로는 CPU 아키텍처·Node·Linux libc가 호환되는 Linux 빌드 결과만 사용합니다.

이 클라우드의 소스 빌드는 기존 프록시 호스트의 해석 주소를 `--add-host`로 전달하고 `--network host`, `--build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY`, 신뢰 CA `--secret id=proxy-ca,src=CA_파일`을 사용해 검증했습니다. 프록시 주소·인증값을 고정하거나 TLS 검증을 끄지 않습니다. 최종 이미지에는 프록시 CA를 복사하지 않습니다.

설치/시작 지침과 필요한 도메인·변수 요구사항은 클라우드 설정 초안으로 저장합니다. 초안 저장은 실제 적용·게시·앱 배포가 아닙니다. 환경 설정에서 값을 입력하고 검토·저장한 뒤 환경을 게시해야 다음 환경에 적용됩니다.
