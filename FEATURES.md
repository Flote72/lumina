# Lumina 기능 체크리스트

범례: ✅ 완료 · 🔨 진행 중 · ⬜ 예정 · ❌ 미구현(+이유)

## Phase 0 — 세팅 / 디자인 시스템 / 셸
- ✅ Vite + React 19 + TS strict + Tailwind v4 + Zustand + Vitest
- ✅ 디자인 토큰(무채색 다크 + 앰버 포인트), Pretendard/Inter 셀프호스팅
- ✅ Slider: 드래그, 숫자 직접 입력, 방향키(Shift ×10, PageUp/Down, Home/End), 라벨 더블클릭 리셋, 변경 표시, 기본값 눈금, 그라디언트 트랙
- ✅ 접이식 Section(상태 저장), 크기 조절 가능한 패널(더블클릭 리셋, 키보드), 패널 표시/숨김(Tab)
- ✅ 모듈 탭(Library/Develop/Export), 좌/우 패널, 필름스트립 셸
- ✅ i18n(한/영), 빈·로딩·에러 상태 UI, 에러 바운더리, 미지원 브라우저 감지 배너
- ✅ 단축키: G/E(Library), D(Develop), Tab(패널 토글)
- ✅ 기능 감지(WebGL2, float 렌더타깃, OffscreenCanvas, FS Access, OPFS, P3)

## Phase 1 — 불러오기 / 파이프라인 / Basic (✅ 브라우저에서 동작 확인)
- ✅ 가져오기: 드래그앤드롭(폴더 재귀 포함), 파일 선택, 폴더 선택(FS Access → input 폴백). JPEG/PNG/WebP/AVIF/HEIC는 브라우저 디코더 지원 범위
- ✅ 디코딩·썸네일: Web Worker 풀, 디코딩 즉시 ImageBitmap 해제
- ✅ WebGL2 파이프라인(Worker + OffscreenCanvas, 메인 스레드 폴백): 선형광 WB/노출 → 지각 도메인 톤/프레즌스 → sRGB 출력
- ✅ Basic: Temp/Tint, Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Texture, Clarity, Dehaze, Vibrance, Saturation
- ✅ WB 스포이트(선형광 5×5 평균에서 역산), As Shot, Basic 전체 초기화
- ✅ 히스토그램(RGB + 휘도), 클리핑 표시(J, 히스토그램 삼각형 클릭), 마우스 오버 RGB 값
- ✅ 줌/팬: Fit/Fill/100%/200%, 휠 줌(커서 기준), Space+드래그·중간버튼·줌 상태 드래그 팬, 부드러운 전환, Navigator
- ✅ Before/After: `\` 토글, 좌우/상하 분할(드래그 가능한 구분선)
- ✅ 크롭 & 회전(R): 비율 프리셋/자유/가로세로 전환, 각도 -45~45°, 이미지 밖으로 나가지 않게 자동 제한, 가이드(삼분할/황금비/격자/대각선, O 키), 취소(Esc)/완료(Enter)
- ✅ Undo/Redo(Ctrl/Cmd+Z, Shift+Z), 필름스트립 선택, ←/→ 사진 이동

### Phase 1 설계 메모 / 제한
- **2048px 프록시 대신** 원본 해상도 밉맵 텍스처 1장 + **뷰포트 해상도로 처리**하는 구조를 채택(처리 비용이 원본 크기와 무관, 100%에서도 원본 선명도). MAX_TEXTURE_SIZE 초과 시 다운스케일 업로드(원본 해상도 내보내기는 Phase 3의 타일 렌더로 처리 예정)
- Before는 “크롭 유지 + 보정만 기본값”, Texture/Clarity/Dehaze는 근사 구현(LR과 결과가 다름)
- 편집값·사진은 **현재 세션 메모리에만** 있음(새로고침 시 사라짐). IndexedDB 저장·자동 저장은 Phase 3
- ❌ 직선 그리기로 수평 맞추기(Straighten 툴): 미구현 — 각도 슬라이더로만 조정 (Phase 2에서 추가 검토)
- ❌ Auto WB/Auto Tone: 미구현
- ⬜ Library 그리드/루페는 Phase 3 (현재 Library 탭은 안내 화면, 사진은 필름스트립에서 선택)
- ⬜ 필름스트립 가상화는 Phase 3 (현재 전체 렌더)

## Phase 2 — 보정 패널 (✅ 브라우저에서 동작 확인)
- ✅ Tone Curve: Parametric(Highlights/Lights/Darks/Shadows + 분할점 3개) + Point Curve(RGB/R/G/B), 단조 3차 보간(Fritsch–Carlson, 오버슈트 없음), 점 추가/드래그/더블클릭·Delete 삭제/방향키 미세조정
- ✅ Color Mixer: HSL 8색(Red~Magenta) 색조/채도/광도, 인접 색 간 부드러운 보간, **타겟 툴**(패널 ⌖ 켜고 이미지 위에서 위/아래 드래그)
- ✅ Color Grading: Shadows/Midtones/Highlights/Global 컬러휠(드래그·방향키) + Hue/Sat/Lum, Blending, Balance
- ✅ Detail: Sharpening(Amount/Radius/Detail/Masking), Noise Reduction(Luminance/Color)
- ✅ Lens Corrections: Distortion, Vignetting 보정(Amount/Midpoint), Defringe
- ✅ Transform: Vertical/Horizontal(원근), Rotate(=크롭 각도와 동일 값), Scale, Aspect, X/Y Offset, **Auto Level**(에지 방향 분석으로 기울기 자동 보정)
- ✅ Effects: 포스트 크롭 비네팅(Amount/Midpoint/Roundness/Feather), Grain(Amount/Size/Roughness)
- ✅ 섹션별 초기화 버튼, 모든 슬라이더 히스토리(Undo/Redo) 연동
- ✅ 단위 테스트: 커브 보간(단조·무오버슈트·LUT), HSL/컬러 그레이딩, Auto Level

### Phase 2 제한 / 미구현
- ❌ Transform Auto의 **수직/수평 원근 자동 보정, Full/Guided**: 미구현(선 검출이 필요). Auto Level만 제공
- ❌ 색수차 수동 보정(Red/Cyan, Blue/Yellow 분리 조정): 미구현. Defringe(보라/초록 프린지 억제)만 제공
- ❌ Lens Profile 자동 보정: 미구현(렌즈 DB가 없음). 수동 왜곡/비네팅만
- ❌ Effects 비네팅의 Highlights 항목, Grain 시드 제어: 미구현
- ⚠ Transform/Lens로 가장자리가 비어도 크롭이 자동으로 제한되지 않음(빈 영역은 배경색). 크롭 제한은 각도 회전에만 적용
- ⚠ Before/After의 "Before"는 크롭·Transform·Lens 기하는 유지하고 톤/색/디테일/효과만 원본으로 되돌림
- ⚠ Noise Reduction·Defringe는 줌 35% 미만에서는 생략(축소 표시에서는 효과가 보이지 않음)
- ⚠ 커브·믹서·그레이딩·샤프닝은 LR과 수식이 달라 결과가 다름(근사 구현)

## Phase 3 — ⬜ Library(카탈로그·필터·별점/플래그·메타데이터·보기 모드), 프리셋(20+)/히스토리/스냅샷/복사·붙여넣기, Export(일괄 ZIP·워터마크·타일 렌더)
## Phase 4 — ⬜ 마스킹, Spot Removal, Red-eye
## Phase 5 — ⬜ RAW(libraw-wasm 실측 후 결정, 불안정 시 내장 JPEG 프리뷰 추출), 선택: AI 마스크, 성능 최적화, PWA/Tauri

## 미구현 / 제한 사항
현재 없음 (Phase 0 범위 내 스텁 없음. 패널 섹션은 "Phase N에서 구현 예정" 표시만 함).
