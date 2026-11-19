# 🔮 사주 AI — 만세력 · 인생 선택 시뮬레이터

생년월일시로 **만세력(사주 원국)** 을 세우고, 명리학 6단계 통변으로 상담하며,
인생의 갈림길 **A vs B** 두 갈래 미래를 나란히 비교하는 모바일 우선 웹앱입니다.

- 라이브: https://littleyeona7.github.io/saju-ai-app/
- 스택: Vite · React 18 · TypeScript · Tailwind CSS v4
- 만세력 엔진: [`lunar-javascript`](https://github.com/6tail/lunar-javascript) (절기·음양력·대운 계산)

## 기능

| 영역 | 내용 |
| --- | --- |
| 사주 입력 | 양력/음력(윤달 포함), 성별, 태어난 시간 모름 옵션 |
| 사주 원국 | 시·일·월·년 4기둥 × 천간/지지 8칸 그리드, 오행 색상, 일간 하이라이트 |
| 오행·십신 | 오행 개수 요약, 지장간, 십신 배치, 월령 조후, 신강·신약 간이 지표 |
| 대운·세운 | 10년 대운 9주기와 올해 전후 세운(십신 포함) |
| 프로필 | 최대 10개 저장·전환·삭제 (localStorage, 기기 저장) |
| 결혼·배우자 | 미혼/기혼, 혼인일, 배우자 사주 연결(저장 프로필 또는 직접 입력) |
| AI 상담 | Gemini 스트리밍 상담, 6단계 통변 프롬프트, 꼬리질문 |
| A vs B | 갈림길·A안·B안·목표 시점 입력 → 좌우 비교 카드(오행·십신·합충, 1·3·5년, 얻는 것/리스크, 종합 조언) + 이어서 질문 |
| 음성 | 한국어 음성 입력(Web Speech API), 답변 읽어 주기(Speech Synthesis) |

## 시작하기

```bash
npm install
npm run dev      # 로컬 개발
npm run verify   # 만세력 엔진 검증 (44개 항목)
npm run smoke    # 화면 렌더링 스모크 테스트 (24개 항목)
npm run build    # 프로덕션 빌드 (dist/)
```

## Gemini API 키

AI 상담과 A vs B 비교는 Gemini API를 브라우저에서 직접 호출합니다.
키는 두 방법으로 넣을 수 있습니다.

1. 앱 우측 상단 **⚙ 설정 → Gemini API 키** 에 붙여넣기 (localStorage에만 저장)
2. 빌드 시 환경변수: `VITE_GEMINI_API_KEY=...` (GitHub Actions에서는 `secrets.VITE_GEMINI_API_KEY`)

키는 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료로 만들 수 있습니다.
기본 모델은 `gemini-3.8-flash`이며, 모델이 단종되었거나 찾지 못하면 대체 모델(`gemini-3.6-flash` → `gemini-3.5-flash-lite`)로 자동 재시도하고, 그래도 안 되면 ListModels로 지금 쓸 수 있는 모델을 찾아 시도합니다. 예전 버전에서 저장한 `gemini-2.5-flash` 설정은 불러올 때 자동으로 새 모델로 옮겨집니다.

## 만세력 검증

`npm run verify` 는 다음을 확인합니다.

- 양력 1985-07-19 19:35 (여) → **乙丑 癸未 己未 甲戌**, 오행 **목2·화0·토5·금0·수1**
- 음력 1985-06-02 입력 시 동일 원국, 음력→양력 변환
- 태어난 시간 모름 → 시주 비움
- 윤달(2020 윤4월 1일 → 양력 2020-05-23)
- 줄리안데이 기준 60갑자와 임의 300일 대조, 입춘·오호둔 월건 규칙
- 십신·지장간·합충, 대운 순역과 현재 대운

## 배포

이 저장소의 GitHub Pages는 **`gh-pages` 브랜치(레거시 빌드)** 를 소스로 사용합니다.
빌드 결과물을 `gh-pages` 브랜치에 올리면 Pages가 그대로 서빙합니다.

```bash
./deploy/deploy.sh     # 검증 → 빌드 → gh-pages 강제 푸시
```

`vite.config.ts` 의 `base` 는 저장소 이름과 동일한 `/saju-ai-app/` 입니다.

> `.github/workflows/deploy.yml` 방식의 CI 배포를 쓰고 싶다면 `deploy/github-pages-deploy.yml` 을
> `.github/workflows/` 로 복사해 두면 됩니다. (연결된 GitHub App에는 `workflows` 권한이 없어
> 에이전트가 워크플로 파일을 직접 푸시할 수는 없습니다.)

## 데이터

입력한 사주 프로필과 설정은 브라우저 localStorage에만 저장되고 서버로 전송되지 않습니다.
AI 상담 시에만 계산된 사주 데이터가 Gemini API로 전송됩니다.

> 사주는 정해진 운명이 아니라 지금의 기운을 읽는 지도입니다. 의료·법률·투자 판단의 근거로 쓰지 마세요.
