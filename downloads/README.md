# 여행잇 0.15.0

[Android APK](bopok-android.apk?raw=true) · [PowerShell 배포 ZIP](yeohaengit-powershell.zip?raw=true)

- 여행 입력 전체를 지역·날짜·기간·이동 수단·취향의 5개로 통합했습니다.
- 기존 걷기·휴식 단계와 상세 조건 입력을 제거했습니다.
- 한국 관광지 실제 사진 3장을 촬영자·출처·라이선스와 함께 온라인 표시합니다.
- APK 버전 코드 16. 0.14.0과 같은 미리보기 서명입니다.
- AI는 지정 서버와 인터넷 연결이 필요합니다. AWS 키를 앱에 입력하지 않습니다.

365장 오프라인 사진, 실제 서버 배포·Bedrock 호출, 실물 Android 및 Windows 실행은 미검증/미완료입니다.
[상세 검증 범위](../docs/TOURISM_0.15.0.md)

## Supabase 최초 설치

[설치 SQL 원문](yeohaengit-supabase-first-install.sql?raw=true)을 전체 복사해
Supabase SQL Editor의 새 쿼리에서 한 번 실행합니다. 성공 결과는 true, true, 12입니다.
하나의 트랜잭션으로 설치하며 기존 public.bopok_* 테이블/함수가 있으면 중단합니다.
다른 앱의 테이블과 데이터는 수정하지 않습니다. 기존 여행잇 DB 업그레이드용이 아닙니다.
핵심 스키마와 AI 사용량 RPC를 포함하며 자동 보관기한 정리 작업(pg_cron)은 별도입니다.
DB 설치 후 서버의 Supabase·리전·세션·모델 단가 설정과 최신 앱 배포가 필요합니다.

생성: `node scripts/package-supabase.mjs`
격리 DB 검증: `node scripts/test-supabase-install.mjs`

최초 서버 설정은 `scripts/setup-server-ai.py`를 성공한 Bedrock Python 환경에서
ubuntu 사용자로 실행합니다. Supabase URL, legacy service_role/anon 키, 실제 모델의
백만 토큰당 USD 입력/출력 단가와 일일 한도를 대화식으로 입력합니다.
키는 화면에 표시하지 않으며 /etc/yeohaengit/server.env를 root 소유 0600으로
새로 만듭니다. 기존 파일은 덮어쓰지 않습니다. 서버 IAM 역할/리전과 DB 스키마를
검사하며 로그인·비용 한도는 유지합니다. Docker IAM 연결은 배포 단계에서 별도로
검증합니다. 웹은 이메일 로그인이 필요하고 Android의 로그인 연결은 미완료입니다.
