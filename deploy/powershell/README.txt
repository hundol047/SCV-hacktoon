여행잇 0.13.0 · Windows PowerShell → Ubuntu 서버 실행 패키지

1. ZIP 전체를 압축 해제합니다. APK는 서버에서 실행할 수 없습니다. 이 패키지는 같은 프로젝트의 웹 버전입니다.
2. PEM 키를 사용자 홈 폴더에 둡니다. 기본 경로: $HOME\hackathon-e5-t02.pem
3. 압축 해제한 폴더에서 PowerShell을 열고 실행합니다:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Yeohaengit.ps1

키 위치 또는 서버가 다르면 다음처럼 지정합니다:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Yeohaengit.ps1 -KeyPath "$HOME\Downloads\hackathon-e5-t02.pem" -Server "52.65.9.104" -Port 8000

4. 처음 SSH 연결 시 호스트 지문을 확인합니다. SSH 접속에는 실제 PEM 키가 필요합니다. 키는 이 패키지에 포함되지 않습니다.
5. 완료 후 브라우저에서 http://52.65.9.104:8000 을 엽니다.

서버 조건
- Ubuntu 24.04, ubuntu 사용자의 sudo 권한, 외부 apt/Docker Hub/npm 연결.
- Node 24 컨테이너에서 소스를 빌드합니다. 서버에 Python 또는 Node를 따로 설치하지 않아도 됩니다.
- 빌드용 메모리 4GB 이상, 여유 디스크 5GB 이상을 권장합니다. 작은 인스턴스는 메모리 부족으로 빌드가 종료될 수 있습니다.
- EC2 보안 그룹: SSH TCP 22와 웹 TCP 8000을 본인 접속 IP에 허용합니다. 이 스크립트는 보안 그룹/방화벽을 변경하지 않습니다. 서버 방화벽을 사용 중이면 해당 포트도 허용해야 합니다.
- 이미 다른 서비스가 8000을 사용하면 -Port 8001 등으로 바꿉니다.

실행 동작
- Docker가 없으면 Ubuntu의 docker.io 패키지를 설치합니다.
- 고유 업로드 폴더에 소스를 풀고 이미지를 빌드합니다. 서버의 다른 프로젝트 파일을 덮어쓰지 않습니다.
- yeohaengit-web 컨테이너로 실행합니다. 이 설치기로 만든 이전 컨테이너만 교체하며 새 서버 시작 실패 시 이전 컨테이너 복원을 시도합니다.
- 창을 닫거나 서버를 재부팅해도 재실행됩니다. 직접 stop한 컨테이너는 start해야 합니다.
- 반복 배포 시 업로드 폴더와 이전 Docker 이미지는 남습니다. 용량은 별도 관리하세요.

서버 관리(PowerShell에서 SSH 접속 후 실행)
ssh -i "$HOME\hackathon-e5-t02.pem" ubuntu@52.65.9.104
sudo docker logs --tail 100 yeohaengit-web
sudo docker stop yeohaengit-web
sudo docker start yeohaengit-web

포함/검증 범위
- 0.13.0 사진 보관함 및 실제 여행 사진 반영본.
- 전국 OSM 보관 자료, 지역 코스와 로컬 일정, 실제 여행 사진과 기기 내 사진 보관함 포함. 사진은 같은 브라우저/접속 주소에서 보관됩니다. IP·포트 변경 시 기존 사진이 보이지 않을 수 있습니다.
- AI 키, DB 계정, 로그인/공유 서버, HTTPS 도메인은 설정하지 않습니다. 관광 상세정보 부족 문제도 아직 수정 전입니다.
- 서버 시작 검사는 홈페이지 HTTP 응답만 확인합니다. /api/health는 미연결 운영 기능 때문에 503을 반환할 수 있습니다.
- 공개 정식 서비스용 구성이 아닙니다. HTTP 미리보기이며 실제 AI/지도/날씨 및 EC2에서의 실행 성공은 별도 확인이 필요합니다.
- 기존 웹 production 빌드는 통과했습니다. 배포 셸 구문과 ZIP/source 구성은 검사했지만 Windows PowerShell과 사용자의 서버에서 직접 실행하지는 않았습니다.

실행 정책 Bypass는 이 명령의 프로세스에만 적용하며 PC의 영구 실행 정책을 바꾸지 않습니다.

배포 패키지 수정 1: 기본 Docker 빌더 호환성을 위해 Dockerfile의 BuildKit 전용 --mount를 제거했습니다. 클라우드 개발 환경의 인증서 마운트는 일반 EC2 배포에 필요하지 않습니다.
