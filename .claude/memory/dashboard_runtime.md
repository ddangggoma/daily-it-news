---
name: Dashboard Runtime — 첫 사이클 학습
description: Daily News 정적 대시보드 JS 런타임 작성 사이클의 압축 학습. CE 메타-루프 적용 사례.
type: pattern
date: 2026-05-02
---

## 작업 요약

빈 디렉터리에서 출발해 [.claude/CLAUDE.md](../../CLAUDE.md)의 워크플로우 라우팅을 따라:
1. **Audit-first** — Explore agent가 기존 자산을 5분 안에 매핑 (HTML/CSS/data 90% 완성, JS 0%)
2. **Plan in plan-mode** — `/Users/ggoma/.claude/plans/daily-news-runtime.md`에 2개 파일 시그니처를 정확한 DOM/data 계약과 함께 고정
3. **Sequential build** — `insights.js` 먼저 (loaded first by HTML), 다음 `app.js`
4. **Verify via DOM eval** — Preview MCP 스크린샷이 동적 콘텐츠를 못 찍었지만 `preview_eval`로 8+9 회귀 테스트 모두 통과

## 압축 학습 5가지 (다음 사이클이 더 쉬워지도록)

### 1. 빈 칸이 아니라 GAP을 찾아라
사용자가 "셋업해준 환경 기반으로 구성해줘"라고 했을 때 즉답으로 "처음부터 설계할게요"가 아니라 **기존 자산 감사**를 먼저 했더니 90%가 이미 있었다. **2개 파일만 작성**해 끝남. 다음 사이클의 첫 행동은 항상 "있는 것을 보여줘".

### 2. DOM/Data 계약을 코드보다 먼저 종이에 못박는다
plan-mode에서 selector 표 + data shape를 정확히 기록한 덕에 코드 작성 단계에서 추측이 0이었다. 추측이 0이면 디버깅도 0. 다음에 정적 페이지 작성 시: `Read index.html → grep CSS classes → confirm data fields → THEN write code`.

### 3. 정적 사이트는 외부 라이브러리 없이도 충분하다
미니 마크다운 컨버터 60줄로 # ## ### / **bold** / *italic* / `code` / 리스트를 처리. marked.js (35KB+) 임포트 불필요. file:// 환경 + 외부 의존 0 = 최강 호환성.

### 4. 로드 순서가 함수 시그니처를 결정한다
HTML이 `insights.js → app.js` 순으로 로드하므로 insights.js는 함수 정의만, init은 app.js에서 호출. **다음 정적 페이지 작업 시 첫 질문**: HTML의 `<script>` 순서를 보고 어떤 모듈이 다른 모듈에 무엇을 노출해야 하는지 정한다.

### 5. Preview MCP 스크린샷은 동적 콘텐츠에 약하다
JS로 그려진 카드(빠르게 reflow됨)는 스크린샷에 흰색으로 잡히지만 `preview_eval`로 DOM/computedStyle 검증은 정확하다. **시각 회귀는 사용자가, 기능 회귀는 DOM eval로**. 다음에 동적 UI 검증할 때: 스크린샷에 의존하지 말고 `document.elementFromPoint`, `getBoundingClientRect`, `getComputedStyle`로 단언.

## 사용한 슬래시·에이전트

- Explore (Agent) — 기존 자산 감사
- Plan mode — 시그니처 종이에 고정 (slash command 아니지만 메타-루프의 계획 단계)
- Preview MCP — 정적 서버 + DOM eval 회귀
- 명시 슬래시는 사용 안 함 (skill 엔드포인트가 활성화된 새 세션에서 호출 가능)

## 데이터 정합성 메모

`window.__DAILY__.counts.news === 47` 이지만 `news[].length === 18`. 데이터 파일의 표시 카운트와 실제 어레이 길이가 불일치. **렌더 카운터는 항상 어레이 길이 기준** (`${list.length}건 / 전체 ${all.length}`). 탭 배지(`#count-news`)는 의도된 표시값이므로 `counts.news` 그대로 사용.

향후 데이터 파이프라인이 자동 채울 때 `counts === array.length`를 보장하는 검증 단계가 필요하다.
