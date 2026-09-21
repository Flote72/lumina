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

## Phase 3 — Library / 프리셋 / 저장 / Export (✅ 브라우저에서 동작 확인)

### 저장 (카탈로그)
- ✅ IndexedDB(Dexie): 사진 메타·편집값·히스토리·스냅샷·프리셋·컬렉션 저장, **자동 저장**(편집 400ms 디바운스), 새로고침 후 마지막 사진·편집 복원
- ✅ 원본은 브라우저 전용 저장소(OPFS, 없으면 IndexedDB)에 **읽기 전용 사본**으로 보관. 원본 파일은 수정하지 않음
- ❌ **원본 폴더 참조(File System Access API)**: 미구현 — 권한 재요청 UX가 번거롭고 브라우저별 편차가 커서 사본 저장으로 통일. 그 대신 사진 용량만큼 브라우저 저장소를 사용함

### Library
- ✅ 가상화 썸네일 그리드(@tanstack/react-virtual), 썸네일 크기 슬라이더, 클릭/Ctrl·Cmd/Shift 다중 선택, 방향키 이동
- ✅ 별점(0~5), 플래그(Pick/Reject/해제), 컬러 라벨(6~9), 키워드(추가/삭제, 다중 선택 일괄)
- ✅ 수동 컬렉션(생성/이름 변경/삭제/사진 추가·빼기), 스마트 필터(별점·플래그·라벨·카메라·렌즈·ISO·날짜·키워드·편집 여부), 정렬(촬영일/파일명/별점/가져온 순), 텍스트 검색
- ✅ EXIF 메타데이터 패널(exifr), 보기: 그리드(G) / 루페(E, 편집 반영) / 비교(C) / 서베이(N)
- ⚠ 비교·서베이는 **편집이 적용되지 않은 원본**을 보여줌(렌더러 인스턴스가 1개라서). 루페와 Develop은 편집 반영
- ❌ 썸네일을 컬렉션으로 드래그: 미구현(컬렉션 옆 + 버튼 사용). 저장된 스마트 컬렉션(필터 저장): 미구현
- ⚠ 필름스트립은 아직 가상화되지 않음(수천 장에서는 느릴 수 있음)

### 프리셋 / 히스토리 / 동기화
- ✅ 프리셋 24개 기본 제공(흑백·필름·시네마틱·인물·풍경 등), 폴더별 분류, 저장(포함할 설정 그룹 선택), 삭제, **호버 미리보기**, JSON 가져오기/내보내기
- ✅ **Lightroom `.xmp` 프리셋 가져오기**: 창에 끌어다 놓거나 가져오기 버튼 → 프리셋 등록 + 현재 사진에 자동 적용. 이름/폴더(`crs:Name`/`crs:Group`) 사용, 미적용 항목 안내
  - 변환: Basic(상대 WB `IncrementalTemperature/Tint` 포함), 톤 커브(RGB/R/G/B, 시작점이 0이 아니어도 OK), Parametric, HSL 24값, Color Grading(`ColorGrade*`와 옛 `SplitToning*`), 흑백/GrayMixer, Sharpen/NR, Lens, Perspective, Vignette, Grain
  - ❌ 미적용: 절대 색온도(Kelvin), 카메라 프로파일/LUT(Look), 마스크, 렌즈 프로파일, 캘리브레이션(RedHue 등), Perspective Rotate. `.lrtemplate`(구버전 포맷): 미지원
- ✅ History 패널(단계 이동, 저장은 최근 50단계), Snapshots(이름 저장/적용/삭제)
- ✅ 설정 복사/붙여넣기(Ctrl/Cmd+Shift+C/V, 그룹 선택), 여러 사진에 동기화, 이전 사진 설정 적용, 여러 장 선택 후 프리셋 적용

### Export
- ✅ JPEG/PNG/WebP/AVIF(브라우저가 인코딩 지원할 때만 선택 가능), 품질, 색공간 sRGB / Display P3(지원 시)
- ✅ 리사이즈: 원본 / 긴 변 / 퍼센트 / 지정 크기(비율 유지), 확대 방지 옵션, 출력 샤프닝(화면/인쇄 × 약/보통/강)
- ✅ **타일 렌더링**(2048px 타일 + 128px 겹침, GPU 최대 텍스처 크기 기준): 24MP 원본 해상도에서 이음새 없음 확인
- ✅ 메타데이터: JPEG 원본→JPEG는 EXIF 유지(Orientation 초기화)/제거, 저작권·작성자 문구(JPEG는 XMP, PNG는 tEXt)
- ✅ 워터마크(텍스트/이미지, 9방향 위치·크기·투명도·여백), 파일명 템플릿 `{name} {seq} {seq3} {date} …`(한글 별칭 지원), 여러 장은 ZIP 하나로 저장, 진행률/취소
- ⚠ Display P3는 P3 프로파일을 붙여 저장하지만 **원본 색이 sRGB 범위로 처리**되므로 색역이 넓어지지는 않음
- ⚠ WebP/AVIF에는 EXIF/저작권 문구가 들어가지 않음. 원본이 최대 텍스처 크기보다 크면 그 크기로 축소해 사용
- ⚠ 내보내기는 Worker(OffscreenCanvas)가 필요함 — 미지원 브라우저에서는 안내 문구 표시

## Phase 4 — ⬜ 마스킹, Spot Removal, Red-eye
## Phase 5 — ⬜ RAW(libraw-wasm 실측 후 결정, 불안정 시 내장 JPEG 프리뷰 추출), 선택: AI 마스크, 성능 최적화, PWA/Tauri

## 미구현 / 제한 사항
현재 없음 (Phase 0 범위 내 스텁 없음. 패널 섹션은 "Phase N에서 구현 예정" 표시만 함).
