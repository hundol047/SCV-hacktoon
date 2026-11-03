# 기본 Supabase 이메일로 로그인

Supabase Authentication → URL Configuration의 Site URL을 앱 주소
`http://52.65.9.104:8000`으로 저장합니다. 별도 콜백 경로를 사용하지 않아
Redirect URL 추가나 이메일 템플릿/SMTP 변경은 필요하지 않습니다.

최신 웹 배포 후 브라우저를 새로고침하고 계정 로그인에서 이메일 로그인 링크를
요청합니다. 새 이메일의 Sign in 링크를 요청했던 같은 브라우저에서 10분 안에
엽니다. 이전 버전에서 요청한 링크는 새 방식으로 로그인되지 않습니다.
기존 OTP 템플릿을 사용하는 프로젝트에서는 인증번호 로그인도 유지합니다.

요청 시 PKCE S256 challenge를 Supabase에 보내고 verifier를 HttpOnly 쿠키로
10분간 보관합니다. 리디렉션의 code는 URL에서 즉시 제거한 뒤 같은 출처의 서버
API에 전달합니다. 서버는 verifier로 코드를 교환하고 Supabase user API로 계정
신원을 확인한 후 기존 HttpOnly 계정/refresh 쿠키를 발급합니다. 새 브라우저,
누락된 verifier, 잘못된 출처 및 만료 코드는 로그인되지 않습니다.

테스트: 인증 단위 테스트 8개, 웹 빌드, 데스크톱/모바일 Chromium 콜백 UI 검사.
Supabase 실제 이메일 발송/수신과 사용자 서버에서의 새 버전 실행은 별도 확인이
필요합니다. 기본 메일 발송 서비스의 수신자 제한과 발송 한도는 그대로 적용됩니다.
이번 변경은 웹 로그인용이며 Android 계정 연결은 아직 미완료입니다.
