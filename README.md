# Lumina

브라우저에서 로컬로 동작하는 사진 관리 + 비파괴 보정 웹 앱. 사진은 외부로 업로드되지 않으며, 원본은 수정하지 않고 편집값만 JSON 파라미터로 저장합니다.

> 독자 브랜딩 프로젝트입니다. 특정 상용 소프트웨어의 로고·아이콘·문구를 사용하지 않습니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 단위 테스트 (Vitest)
npm run lint
npm run build      # 타입체크 + 프로덕션 빌드
```

Node 20+ 필요. Chrome/Edge 최신 버전 권장. 디자인 시스템 확인 페이지: `http://localhost:5173/#/design` (dev 전용 링크 "DS").

## 구조

```
src/
  app/            엔트리, 에러 바운더리, 전역 단축키, 미지원 브라우저 배너, 디자인 갤러리
  platform/       브라우저 전용 API 추상화 (Tauri 교체 지점). 현재: capabilities
  design-system/  Slider, Section, Button, Resizer, 상태 UI(빈/로딩/에러), 아이콘
  layout/         Shell, TopBar, SidePanel, Filmstrip, CenterStage, 섹션 정의
  i18n/           ko/en 딕셔너리와 useT()
  store/          Zustand 스토어 (ui: 모듈·패널 크기·접힘·언어, localStorage 저장)
  core/           React/DOM 무의존 순수 로직 (params, curve, color, histogram, geometry, presets/xmp, library/filter, export; 단위 테스트 대상)
  render/         WebGL2 파이프라인: Renderer(패스), host(Worker/메인 공용), client(메인 측 핸들), shaders/*.glsl
  workers/        썸네일 디코드 워커 풀
  develop/        Develop 캔버스(줌/팬/크롭/비교), 보정 패널, 히스토그램, Navigator
  develop/local/  마스킹·스팟·적목: 오버레이(핸들/브러시), 패널, 조작 함수
  catalog/        Dexie 스키마, EXIF 읽기
  raw/            RAW 현상(libraw-wasm) + 내장 JPEG 프리뷰 폴백
  ai/             AI 피사체 분할 Worker(onnxruntime-web, U²-Net-P) + 하늘 휴리스틱
  library/        그리드/비교/서베이, 필터 툴바, 컬렉션·메타데이터 패널, 가져오기 라우팅
  export/         내보내기 엔진(Worker, 타일 렌더링), 설정 UI, 배치 실행(ZIP)
```

이후 Phase에서 `render/`, `workers/`, `catalog/`, `library/`, `develop/`, `presets/`, `export/` 등이 추가됩니다. 진행 현황은 [FEATURES.md](FEATURES.md) 참고.

## 디자인 원칙

무채색 다크 테마 + 포인트 컬러 하나(앰버 `#e8a33d`). 토큰은 `src/index.css`의 `@theme`에 정의. 패널 구분은 색이 아닌 간격과 얇은 구분선. 폰트는 Pretendard + Inter(셀프호스팅).

## 배포 / 오프라인

`npm run build` 결과(`dist/`)는 정적 파일이라 GitHub Pages 등 어디든 올릴 수 있습니다(`vite.config.ts`의 `base`를 맞추세요). 서비스 워커(`public/sw.js`)가 앱을 오프라인에서 열 수 있게 하고, 브라우저의 "설치"로 독립 창 앱처럼 쓸 수 있습니다.
RAW/AI 기능은 처음 사용할 때 WASM(각각 약 1.4MB / 14MB)과 모델(4.5MB)을 내려받습니다. 라이선스는 `THIRD_PARTY.md`를 참고하세요.

## EXIF 프레임의 카메라 브랜드 로고 (선택, 로컬 전용)

Export의 "EXIF Frame" 패널에서 로고를 켜면 21개 브랜드(Canon, Nikon, Sony, Fujifilm 등)의 업로드 칸이 그리드로 뜹니다. 브랜드를 클릭해 이미지를 올리면, 그 브랜드로 인식된 사진의 캡션에 자동으로 표시됩니다.

업로드한 이미지는 **이 브라우저의 localStorage에만** 저장됩니다 — 파일로 저장되지도, 저장소에 커밋되지도, 배포되지도 않습니다. Canon·Nikon·Sony 같은 로고는 각 제조사의 등록 상표라 공개 저장소·사이트에는 절대 포함하지 않는다는 원칙을 지키기 위한 구조입니다. 브라우저 데이터를 지우면 업로드한 로고도 함께 사라집니다.

브랜드 키 목록과 EXIF 문자열 매칭 규칙은 `src/core/export/brandLogos.ts`에 있습니다.

캡션 글꼴은 [Alumni Sans Pinstripe](https://github.com/googlefonts/alumni-sans-pinstripe)로 고정되어 있습니다(`public/fonts/`, SIL OFL 1.1 — 재배포를 명시적으로 허용하는 라이선스라 로고와 달리 저장소에 실제로 커밋되어 있습니다). 사용자가 직접 고를 수 있는 옵션은 아니며, 설정 패널 미리보기와 실제 내보낸 파일 모두 이 폰트로 렌더링됩니다. 라이선스 전문은 `public/fonts/alumni-sans-pinstripe/OFL.txt`, 출처 표기는 `THIRD_PARTY.md`에 있습니다.
