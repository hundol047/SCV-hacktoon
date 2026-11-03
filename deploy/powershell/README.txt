여행잇 0.15.0 관광 앱 미리보기 — 사진 365장 요구사항은 미완료입니다.

배포:
1. ZIP 전체를 풀고 server.env.example을 참고해 EC2의
   /etc/yeohaengit/server.env를 준비하세요. 기존 파일을 덮어쓰지 마세요.
2. PowerShell에서 실행:
   powershell -ExecutionPolicy Bypass -File .\Deploy-Yeohaengit.ps1 -KeyPath C:\path\key.pem
3. http://52.65.9.104:8000/ 에서 확인하세요. 포트 22/8000 접근이 필요합니다.

서버 설정:
- AWS_REGION 또는 AWS_DEFAULT_REGION은 기존 서버 리전으로 지정합니다.
- 모델은 global.openai.gpt-6-sol로 고정합니다. Bedrock InvokeModel 및
  cross-region inference 대상 모델에 대한 IAM 권한/모델 접근 권한이 필요합니다.
- EC2 인스턴스 프로파일, IMDSv2, Docker bridge용 HttpPutResponseHopLimit=2가 필요합니다.
- AWS 키/API 키/AWS_PROFILE/메타데이터 엔드포인트 override는 지원하지 않습니다.
- 기존 Supabase RPC·세션·토큰 단가/예산 설정이 없으면 AI 요청을 거절합니다.
- 현재 HTTP 주소는 BOPok_APP_URL=http://52.65.9.104:8000 과
  BOPok_ALLOW_HTTP_PREVIEW=true 로 명시하세요. HTTP는 전송을 암호화하지 않습니다.
- 설치 스크립트는 기존 설정을 읽고, 기존 컨테이너를 중단하기 전에 새 Docker 안에서
  IMDSv2 역할 인증과 짧은 Bedrock Converse 유료 요청 1회를 검증합니다.

APK:
- 지정 서버의 AI API만 호출하며 AWS/API 키를 받거나 저장하지 않습니다.
- HTTP 예외는 52.65.9.104에만 허용합니다.
- 이전 서명키는 복구되지 않아 새 미리보기 서명키를 사용했습니다. 이전 앱 덮어쓰기
  설치가 거절될 수 있습니다. 기존 앱을 제거하기 전에 일정·사진을 백업하세요.

검증 한계:
- 실제 EC2 IAM/Bedrock·Windows PowerShell·실물 Android는 확인하지 못했습니다.
- Docker 모의 IMDSv2/SigV4 검증과 실제 서버 검증은 다릅니다.
- Wikimedia 네트워크 정책 403으로 한국 관광지 사진은 현재 0장입니다.
- scripts/collect-korea-photos.mjs 수집 후 scripts/verify-photos.mjs로
  365장/출처/라이선스/해시를 검증하고 웹/APK/ZIP을 다시 빌드해야 합니다.

0.15.0 화면 변경:
- 모든 새 여행 시작: 지역, 날짜, 기간, 이동 수단, 취향 총 5개 입력.
- 걷기/휴식 단계 및 상세 조건 입력 제거.
- 해운대/불국사/성산일출봉 온라인 사진 3장 추가(인터넷 필요).
- 사진 365장 오프라인 내장은 아직 미완료입니다.
- 기존 배포 실패의 서버 원인은 확인되지 않았습니다. 이 ZIP이 서버 설정 오류를 자동으로 해결하지는 않습니다.

로그인 없는 AI 실험(명시적으로 선택):
서버에서 소스 압축을 푼 뒤 bash deploy-server.sh 8000 --anonymous-ai 를 실행합니다.
기존 설정은 비공개 백업을 만들고 AI 실험 옵션만 추가합니다.
서버 전체의 요청/토큰/비용 제한과 저장/공유의 계정 권한은 유지됩니다.
