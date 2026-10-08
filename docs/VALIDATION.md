# 실행 검증 결과

2026-10-08, Bopok **0.4.0**, Node 24.19.0, npm 11.9.0. 앱 검사는 Linux 프로덕션 standalone 빌드를 사용했습니다. 외부 운영 계정은 사용하지 않았습니다.

| 검사 | 결과와 범위 |
| --- | --- |
| TypeScript + 프로덕션 빌드 | 통과. 다도시 재방문·이동일·공급자 준비 게이트·운영 화면/API 포함 |
| npm test | **13개 파일·121개 통과** |
| Playwright | **92개 통과**, 데스크톱 Chromium·모바일 Chromium·Firefox·WebKit 각 23개 |
| 접근성 자동 검사 | axe WCAG 2 A/AA·2.1 AA. 홈·조건·결과·큰 글씨 부모님·검토·운영·이동일 부모님 화면 통과 |
| 가족 공유·계정·독립 검토 | 격리 Auth/SQL로 이메일 코드·익명 여행 이전·계정 복원·권한·충돌·링크 폐기·독립 승인·서명 유지 확인 |
| 실제 PostgreSQL 17 + pg_cron | 스키마 **12**, 예약 정리 작업 실행·성공 기록 확인 |
| public·auth 백업/복원 | AES-256-GCM 백업/별도 새 PostgreSQL 서버 복원. 누락된 NOLOGIN 역할 재생성, 합성 계정 ID·비밀번호 해시·여행·RLS 유지. 기존 객체·잘못된 키·변조 거부 |
| 배포 복구·외부 감시 | 모의 Vercel/API로 미준비 후보 전환 거부, 전환 후 실패 시 이전 배포 복구, 앱 다운 외부 알림·실행 간 중복 억제·비밀값 비노출 |
| 공급자 검사·지표 | 설정 fingerprint 변경/24시간 만료/인증 실패를 미준비로 처리. AI 예약 거부 시 유료 요청 0회. 15분 오류·지연 경고, DB 연결 실패 집계와 정상 권한 거부 구별 |
| 최신 Docker runtime | 새 0.4 standalone 이미지 빌드, UID 1000 실행, 홈 200·규칙 추출·liveness 200·미구성 readiness 503 |
| npm run test:storage-load | 격리 앱/DB에서 **20명·240요청·p95 222ms**, 합성 여행 생성→수정→공유 읽기→의견→권한 거부→버전 충돌→링크 폐기→삭제. 유료 요청 0회, 자신의 검사 여행 삭제 |

반복 도시 전환은 A→B→A→B에서 이전 이동을 잘못 고르지 않는지 확인했습니다. 실제 이동과 방문의 겹침, 38시간 이동으로 빈 하루가 생기는 경우, 근거 없는 이동일 지정과 날짜 변경선의 현지 시작일을 검사했습니다. 브라우저는 이동 시각·출처와 부모님 이동일 표시를 확인합니다.

브라우저 검사의 DB는 격리 PGlite이며 Auth·경로·AI·도시 응답은 모의 공급자입니다. 실제 이메일 발송이나 유료 API 성공을 뜻하지 않습니다. 작성·수정·비교·부모님 의견·복원·삭제·인쇄 흐름을 확인했습니다. Chromium은 PDF를 생성했고 다른 엔진은 인쇄 CSS/이벤트를 확인했습니다.

PostgreSQL 검사는 임시 Docker DB에서 수행했습니다. Auth 계정은 직접 만든 합성 auth.users 데이터이며 실제 관리형 Supabase Auth 서비스의 재개통을 검증한 것은 아닙니다. pg_cron 주기는 검사 중 1초, 운영 마이그레이션은 매시간입니다. 알림은 모의 endpoint로 검사했고 실제 수신자에게 보내지 않았습니다. 부하 결과는 이 클라우드의 격리 DB/앱 측정이며 운영 SLO가 아닙니다.

## 외부 관측과 미검증 범위

- Frankfurter: **실제 HTTP 200**, KRW를 포함한 날짜 있는 환율 응답 확인.
- Overpass: 이번 서울 대표 장소 질의에서 **HTTP 504**. 이전 0.2에서는 HTTP 200으로 30개 후보를 만들었으나 현재 가용성을 보장하지 않습니다.
- Nominatim: 이전 서울·파리·뉴욕 실제 검색은 HTTP 200과 좌표/국가 검증에 성공했습니다.
- Vercel CLI **63.1.0**: --skip-domain/promote 옵션 확인. deploy --temporary --yes는 임시 배포 불가·로그인 필요 오류로 종료. 공개 주소 없음.
- OpenAI·openrouteservice·Google Routes, 운영 Vercel/Supabase, SMTP·실제 Turnstile 챌린지·알림 수신·운영 DB 복원은 자격 증명 없이 미실행입니다.
- 실제 iOS/Android·VoiceOver/TalkBack·물리 프린터, 전 세계 시설의 독립 검토와 새 클라우드 복원은 미검증입니다. [수동 점검표](ACCESSIBILITY.md)에 수행 기준을 남겼습니다.

클라우드 브라우저 라이브러리는 /workspace/browser-deps/runtime에 서명/체크섬 검증한 Debian 패키지를 추출했습니다. Playwright 브라우저는 /workspace/.cache/ms-playwright입니다. WebKit 실제 실행을 확인한 뒤 이 환경의 호스트 자동 탐지 제약만 우회했습니다. Firefox는 프로필 접근 제약 때문에 승인된 별도 실행 권한으로 검사했습니다. CI는 playwright install --with-deps를 사용하며 TLS 검증은 유지합니다.

전체 소스 Docker 이미지는 이전 0.2에서 빌드했고 이번에는 최신 **0.4 runtime**을 새로 빌드·검증했습니다. [배포 절차](DEPLOYMENT.md)와 [7개 항목 처리 결과](RELEASE_READINESS.md)를 함께 확인하세요.
