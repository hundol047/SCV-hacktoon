# 보폭 안드로이드 설치형 미리보기

앱 ID `kr.bopok.offline`, 버전 `0.6.1-offline`, Android 8.0(API 26) 이상. 최신 Android System WebView를 사용하세요. 인터넷·위치·연락처·공용 저장소 권한 없이 실행하며 사용자가 선택한 문서에만 파일을 저장합니다.

APK를 휴대폰으로 다운로드한 뒤 열어 설치합니다. Android가 요청하면 해당 다운로드 앱의 ‘알 수 없는 앱 설치’를 허용하세요. Play 스토어 출시본이 아닌 로컬 서명 미리보기입니다.

포함 기능: 전국 OSM 수집 자료 166,427건 검색과 후보 연결, 여행 일정 작성, 택시 방문 순서·복귀·사용자 요금 가정, 로컬 보관, JSON 파일 가져오기·내보내기, Android 인쇄/PDF 저장. 수집 자료의 출처·라이선스와 미확인 시설 안내를 유지합니다. 앱 삭제 시 로컬 일정도 삭제되므로 JSON으로 먼저 보관하세요.

공개 서버는 연결되지 않았습니다. 로그인·서버 공유·실시간 국내/해외 도시 검색·경로 조회·AI는 사용할 수 없습니다. 화면에 오프라인 버전임을 표시하며 서버 기능을 요청하면 안내합니다. 내장 자료는 실시간으로 갱신되지 않습니다. 외부 출처 링크는 휴대폰 브라우저에서 엽니다.

## 다시 빌드

Node 24, Java JDK, Android SDK `platforms;android-35`, `build-tools;35.0.0`, zip이 필요합니다.

```sh
npm ci
ANDROID_SDK_ROOT=/path/to/android-sdk npm run build:android
node scripts/test-mobile.mjs
```

JRE만 있는 환경은 Eclipse ECJ 3.40.0 컴파일러 JAR 경로를 `ANDROID_ECJ_JAR`로 지정할 수 있습니다. SDK/ECJ 도구는 저장소에 포함하지 않습니다. 결과는 `android/build/bopok-android.apk`입니다. `.android-signing/preview.jks`는 로컬 미리보기 서명키이며 Git에 올리지 않습니다. 같은 설치본을 업데이트하려면 해당 키를 보관하고 `versionCode`를 증가시켜야 합니다. 키가 바뀌면 기존 앱을 삭제해야 하므로 JSON 백업 후 진행하세요. 정식 배포에는 관리되는 릴리스 서명과 별도 배포 검토가 필요합니다.

## 검증 범위

APK v2/v3 서명과 manifest/API 범위 검사, 모바일 크기의 Chromium에서 **실제 APK 웹 자산과 내장 관광 자료**로 검색·택시 일정 생성·로컬 저장/복원·JSON 내보내기를 확인했습니다. 외부 관광 API 모의 응답을 사용하지 않았습니다. 타입 검사와 서버·관광 자료·택시 단위 검사 24개 통과. 실제 Android 기기 설치, 네이티브 파일 선택·인쇄 UI는 이 환경에서 검증하지 못했습니다.
