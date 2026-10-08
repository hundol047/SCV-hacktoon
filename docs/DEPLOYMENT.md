# 배포와 실제 연결

권장 구성은 **Vercel + Supabase**, 장소 자료는 OpenStreetMap, 실제 도로 경로는 openrouteservice입니다. 기존 인프라가 없다는 요청에 따라 선택했습니다. Docker로 다른 서버에도 배포할 수 있습니다. 현재 저장소에 운영 계정이나 API 인증값이 없으므로 공개 배포 완료 상태는 아닙니다.

## Supabase

1. 운영용 Supabase 프로젝트를 생성하고 SQL Editor에서 `supabase/migrations/001_bopok.sql`을 실행합니다.
2. `002_retention.sql`을 실행합니다. pg_cron 활성화 권한이 필요합니다. `cron.job`과 `cron.job_run_details`에서 매일 18:00 UTC 삭제 작업의 성공을 확인합니다. 로컬 PGlite에는 pg_cron이 없어 이 운영 작업은 별도 검증 대상입니다.
3. 서버 환경 설정에 프로젝트 URL과 service role 키를 넣습니다. 브라우저에 service role 키를 보내지 않습니다. 테이블은 RLS를 활성화하고 서버 역할만 RPC를 실행할 수 있도록 구성했습니다.
4. DB 백업/복원은 Supabase 요금제의 기능과 보관 기간을 확인해 설정합니다. 앱의 JSON 파일 내보내기와 서버 여행 보관은 운영 DB 재해 복구 백업을 대신하지 않습니다. 복원 연습과 만료 삭제 성공을 운영에서 확인합니다.

## Vercel

1. GitHub 저장소를 Vercel 계정에 연결합니다. 검증한 브랜치 `feat/bopok-mvp`를 미리보기 배포 대상으로 선택합니다. 프레임워크 Next.js, 빌드 `npm run build`, Node 24를 사용합니다.
2. `.env.example`에 나열한 서버 환경 변수를 설정합니다. 미리보기와 운영 DB/키는 분리합니다. 앱 주소는 해당 배포의 정확한 origin을 사용합니다. 가족 링크와 CSRF 검사에 사용하므로 임의 Host 헤더로 대체하지 않습니다.
3. 먼저 미리보기에서 아래 기능 검증을 수행한 후 운영 배포합니다. 계정 연결·환경 값 입력은 Vercel/Supabase의 보안 설정에서 진행하며 비밀값을 채팅이나 Git에 넣지 않습니다.

| 서버 환경 변수 | 용도 |
| --- | --- |
| `BOPok_APP_URL` | 실제 공개 HTTPS 앱 origin |
| `BOPok_SUPABASE_URL` | 정확한 프로젝트 HTTPS URL |
| `BOPok_SUPABASE_KEY` | 서버 전용 service role 키 |
| `BOPok_SESSION_SECRET` | 32자 이상 암호학적 난수. 서버 프로세스가 읽을 실제 서명 비밀값 |
| `BOPok_ROUTE_KEY` | 선택: openrouteservice 인증키 |
| `BOPok_AI_KEY`, `BOPok_AI_MODEL` | 선택: OpenAI 인증키와 계정에서 사용 가능한 Responses 모델 |
| `BOPok_AI_INPUT_USD_PER_MILLION`, `BOPok_AI_OUTPUT_USD_PER_MILLION` | 선택 모델의 현재 입력·출력 토큰 단가. 공식 가격표에서 확인 |
| `BOPok_AI_DAILY_USD_LIMIT` | 일일 비용 예약 한도, 기본 1 USD |
| `BOPok_AI_DAILY_TOKEN_LIMIT`, `BOPok_AI_DAILY_REQUEST_LIMIT` | 일일 토큰/요청 한도, 기본 200000/30 |

호스트 허용 목록: `nominatim.openstreetmap.org`, `overpass-api.de`, `api.openrouteservice.org`, `api.openai.com`, 정확한 Supabase 프로젝트 호스트. 클라우드 프록시 비밀키는 지정한 HTTPS 목적지에서 치환됩니다. HMAC용 `BOPok_SESSION_SECRET`은 프록시 자리표시자가 아니라 서버가 직접 읽는 비밀값이어야 합니다.

## 공급자와 운영 규모

Nominatim은 앱 주소를 포함한 식별 User-Agent, 응답 캐시, 공유 DB 기반 최소 2초 간격을 사용합니다. 자동완성 호출은 하지 않습니다. Overpass에는 최소 10초 간격과 1일 캐시를 적용합니다. 공용 인스턴스는 가용성을 보장하지 않으므로 규모가 커지면 약관과 용량에 맞는 전용/유료 공급자로 전환합니다.

참고: [Nominatim 정책](https://operations.osmfoundation.org/policies/nominatim/), [OSM 저작권](https://www.openstreetmap.org/copyright), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [openrouteservice](https://openrouteservice.org/), [OpenAI 가격](https://openai.com/api/pricing/).

금액 표시/예산은 KRW이며 해외 환율·현지 입장료·택시 요금은 자동 계산하지 않습니다. 자료가 없으면 예산 충족을 주장하지 않습니다. 각 여행은 1~2일·한 도시 범위이며 다국가 장거리 이동·항공/숙박 예약 기능은 없습니다.

## 배포 후 확인

`BOPok_DEPLOY_URL=https://... node scripts/probe-deployment.mjs`로 공개 홈/구성 상태/무동의 규칙 추출을 확인합니다. 저장·공유 링크를 생성하지 않는 읽기 중심 점검입니다. 실제 AI 설정은 `/api/status`의 configured 값만으로 연결 성공을 뜻하지 않습니다.

새 여행 서버 저장 → 별도 기기 부모님 링크 → 의견 → 편집 권한/버전 충돌 → 링크 폐기 → JSON 복원 → 서버 삭제를 직접 확인합니다. 도시/국가 검색과 실제 경로 호출의 공급자 응답도 검증하고 미확인 시설이 충족으로 변하지 않는지 확인합니다. AI는 최소 요청으로 모델 지원과 한도 예약을 확인합니다. 실제 iOS Safari/Android, 키보드·스크린리더, 인쇄도 확인합니다.

## Docker

```sh
docker build -t bopok .
docker run --rm -p 3000:3000 --env-file .env.production bopok
```

Dockerfile은 standalone 빌드를 비루트 Node 사용자로 실행합니다. 앞단 HTTPS와 같은 서버 환경 설정이 필요합니다. 이 환경에서 Linux/Node 24로 빌드한 결과를 `Dockerfile.runtime`에 넣은 이미지의 실행은 검증했습니다. 전체 소스 Docker 빌드는 컨테이너 의존성 설치 연결을 별도로 확인해야 합니다. 자체 서버에서는 `npm run build && npm run start`로 같은 standalone 앱을 실행할 수 있습니다.

클라우드 환경 초안의 설치/시작 지침, 도메인, 누락 변수/키 요구사항은 저장했습니다. 설정에서 값을 입력하고 검토·저장한 뒤 환경을 게시해야 다음 환경에 적용됩니다. 초안 저장 자체는 실행 환경 변경이나 앱 배포가 아닙니다.

이미 빌드한 Linux standalone 결과를 사용하는 경로:

```sh
npm ci
npm run build
docker build -f Dockerfile.runtime -t bopok .
docker run --rm -p 3000:3000 --env-file .env.production bopok
```

이 경로는 빌드한 시스템과 컨테이너의 CPU 아키텍처·Node 버전·Linux libc가 호환되어야 합니다. Windows/macOS 빌드 결과 대신 Linux CI 결과를 사용하세요. 클라우드 프록시가 있는 소스 빌드는 Docker의 HTTP_PROXY/HTTPS_PROXY 전달과 신뢰할 수 있는 CA를 BuildKit `proxy-ca` secret으로 주입하는 방식을 지원합니다. TLS 검증을 끄지 않습니다. CA 파일은 최종 이미지에 복사하지 않습니다.
