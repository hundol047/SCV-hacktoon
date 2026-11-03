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
