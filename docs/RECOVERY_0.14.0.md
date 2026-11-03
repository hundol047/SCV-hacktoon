# 여행잇 0.14.0 복구 미리보기

기준: `hundol047/SCV-hacktoon`의 `feat/bopok-mvp`,
`725bdbbdb1ed1b56f203870af964caab524df700`.
별도 `/workspace/SCV-hacktoon-recovery`에서 작업했습니다.
원래 `/workspace/SCV-hacktoon`의 파일과 Git 상태는 변경하지 않았습니다.
이전 환경의 미커밋 수정은 발견하지 못했으며 아래 변경은 원격 기준 재구현입니다.

## 반영

- 기본 일정 입력 5개: 지역, 출발일, 기간, 이동 수단, 취향.
  지역 검색부터 AI 코스 생성·검증·일정 저장까지 연결합니다.
  모든 날짜의 생성·검증이 끝난 뒤 저장하므로 오류가 나면 기존 일정이 유지됩니다.
  상세 입력은 접힌 메뉴로 보존합니다. 미등록 통계와 잘못 표시되던 가상 자료 안내를 제거했습니다.
- 코스, 대체 관광지, 홍보, 조건 추출, 검토 설명을 Bedrock Converse로 통일합니다.
  모델 `global.openai.gpt-6-sol`은 고정이며 리전은 서버의
  `AWS_REGION` / `AWS_DEFAULT_REGION`만 사용합니다.
- 명시적 IMDSv2 자격증명 공급자만 사용합니다. 기본 자격증명 체인,
  환경 변수 AWS 키, 프로파일 및 Android 개인 API 키를 사용하지 않습니다.
  응답 스키마·후보 ID·기존 규칙·출처 검사·사용량 관리·오류 처리를 유지합니다.
  1600 출력 토큰 요청을 포괄하도록 기존 예산 예약 상한도 1600으로 맞췄습니다.
- Android는 `http://52.65.9.104:8000`의 지정 AI API를 Java 브리지로 호출합니다.
  네트워크 보안 예외는 해당 호스트에만 제한합니다. HTTP는 암호화되지 않습니다.
  새 APK는 새 미리보기 키로 서명되어 이전 APK와 업데이트 서명 호환성을 보장하지 않습니다.
- PowerShell ZIP은 서버의 `/etc/yeohaengit/server.env`를 읽으며 덮어쓰지 않습니다.
  새 Docker 이미지 내부에서 역할 인증·짧은 Converse 요청을 검증한 다음 기존 컨테이너를 교체합니다.
  기존 Supabase/세션/가격/예산 설정도 여전히 필요하며, 없으면 AI를 호출하지 않습니다.

## 사진 요구사항: 미완료

한국 관광지 실제 사진은 **0장**입니다. 365장 요구사항을 충족하지 못했습니다.
Wikimedia API·이미지와 실제 서버 IP가 실행 환경 프록시의 403 정책에 차단됐습니다.
사용자의 네트워크 접근 허용 의사는 확인했으나 프록시 정책의 실제 허용으로 이어지지 않았습니다.
외국 사진이나 생성 이미지, 중복 이미지로 수량을 대신 채우지 않았습니다.
첫 화면은 준비 중 상태입니다. 사진 다운로드 버튼은 없습니다.

구현한 수집/표시 경로:

1. `npm run photos:collect`: Wikimedia Commons의 한국 관광지 카테고리에서
   JPEG 원본 정보와 명시된 CC 사용 허가·촬영자를 확인하고 축소 사진 및 증거 JSON을 저장합니다.
   기존 이미지 파일은 exclusive create로 보존하며 해시가 다르면 중단합니다.
2. `npm run photos:verify`: 365장 이상, 중복 ID/해시, 실제 파일,
   출처·라이선스 증거 일치를 확인합니다. 현재는 0장으로 실패합니다.
3. 웹·APK·ZIP 재빌드. 한국 시간 자정 순환·같은 날 고정은 단위 테스트로 확인했습니다.

## 검증 구분

로컬 검증 결과는 아래 명령으로 재현할 수 있습니다.

- `npm run typecheck`
- `npm test -- --maxWorkers=2`
- `npm run build`
- `npm run build:android` (Android 35 SDK, build-tools 35.0.0, Java 또는 ECJ 필요)
- `npx playwright test tests/e2e/recovery.spec.ts tests/e2e/android-recovery.spec.ts tests/e2e/photo-library.spec.ts tests/e2e/simple-travel.spec.ts --project=desktop --project=mobile`
- `scripts/test-docker-imds.ts`를 esbuild로 CJS 번들링하여 Node 24 Docker에서 실행:
  모의 IMDSv2 토큰/역할 조회, SigV4 Converse, 환경 키 배제, IMDSv2 거부 시 실패를 검증합니다.
  이 스크립트의 자격증명과 엔드포인트는 모두 합성 데이터입니다.
- Docker 웹 이미지 빌드·컨테이너 내부 HTTP 응답 점검.
- `python3 scripts/package-powershell.py`, ZIP/내부 tar·APK 내장 자산·서명 검사.

실제 EC2의 IAM 역할, Docker metadata hop limit, 모델 접근 권한,
Bedrock Converse 응답, 원격 웹·Android→원격 서버 연결, Windows PowerShell 실행,
실물 Android의 파일 선택기와 설치/업데이트는 검증하지 못했습니다.
실제 서버 접속 자체가 프록시 403으로 차단됐으며 서버 SSH 키도 이 환경에 주입되지 않았습니다.
Docker 합성 테스트나 브라우저의 모의 AI 응답을 실제 서버 성공으로 간주하지 않습니다.

### 이번 실행 결과

- 타입 검사 및 단위 테스트 **193/193 통과**.
- 데스크톱/모바일 브라우저 **10/10 통과**. 마지막 조건 보존 수정 후 관련 **6/6 재검증 통과**.
- 최적화 웹 빌드와 Android 빌드 통과. APK v2/v3 서명 검증 통과.
- APK 웹 자산의 내장 관광 검색·서버 브리지 흐름은 브라우저에서 합성 서버 응답으로 검증했습니다.
- Docker 합성 IMDSv2·SigV4·환경 키 배제·인증 실패 처리 통과.
- 한국 관광지 사진 365장 검증은 **0장으로 실패**하며 릴리스 완료로 간주하지 않습니다.
