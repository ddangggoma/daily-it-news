---
name: Publish Channels — archive + RSS 사이클
description: 정적 사이트의 보조 출력 채널(archive.html, feed.xml) 패턴 + Node 기반 미니 generator 학습
type: pattern
date: 2026-05-02
---

## 작업 요약

대시보드 런타임 사이클 직후, 사양에 명시되었으나 미구현이었던 두 출력 채널을 완성:

1. **`archive.html`** — `data/archive.js`(7개 항목)를 인라인 JS로 렌더. 추가 `.js` 파일 없이 `<script>` 블록 안에 IIFE.
2. **`scripts/generate-feed.js`** + **`feed.xml`** — Node 미니 generator가 `data/today.js`를 평가해 RSS 2.0 직렬화. 18 뉴스 + 10 인사이트 = 28 items, 20.8KB, 2.4ms.

## 압축 학습 4가지

### 1. 보조 페이지는 인라인 JS로 충분하다
`archive.html`은 단일 페이지 단일 책임 (목록 렌더). 별도 `scripts/archive.js`로 분리하면:
- 파일 1개 늘어남
- HTTP 요청 1개 늘어남 (file:// 환경에서도 latency 발생)
- 작은 코드의 응집도가 떨어짐

규칙: **단일 페이지의 50줄 이하 JS는 `<style>` 옆에 `<script>` 인라인**. `app.js`처럼 1000줄+이면 분리. 이번 archive 페이지는 ~80줄 → 인라인이 맞다.

### 2. 브라우저용 JS를 Node에서 평가하기 — Function 격리
`data/today.js`는 `window.__DAILY__ = {...}` 형태. Node에서 읽어 RSS로 변환할 때 `eval()` 대신:

```js
const sandbox = { window: {} };
new Function("window", code)(sandbox.window);
const data = sandbox.window.__DAILY__;
```

`new Function`은 격리된 스코프를 만들어 globals 오염을 방지. 동일 패턴이 향후 `data/2026-XX-YY.js`를 일괄 처리하는 정적 발행 파이프라인에 그대로 재사용된다.

### 3. RFC 822 + XML escaping은 짧은 함수 2개로 끝
`<title>`, `<description>`, `<link>` 모두 `&`, `<`, `>`, `"`, `'` 다섯 문자 escape. 그리고 `<pubDate>`는 `Date.toUTCString()`이 RFC 822 호환 (ex: `Fri, 01 May 2026 13:30:00 GMT`). 외부 라이브러리(rss, feed-generator) 불필요.

규칙: **RSS 생성에 npm install 금지** — 평문 템플릿 + 두 헬퍼면 끝.

### 4. 스크린샷은 콘텐츠 밀도가 높을 때 더 잘 잡힌다
Cycle 1의 메인 대시보드 스크린샷이 흰색이었던 이유 가설: hero 아래 카드 그리드가 viewport 첫 화면에 안 들어와 흰 배경만 캡처. archive.html은 헤더 바로 아래에 짙은 카드들이 즉시 나타나 정상 캡처됨.

규칙: **시각 회귀가 필요할 때는 페이지의 콘텐츠 밀도가 높은 영역을 직접 viewport에 띄우고 캡처** — `scrollIntoView({block:'start'})` 후 약간의 정착 대기.

## 산출물 측정

| 산출물 | 크기 | 라인 |
|--------|------|------|
| archive.html (HTML+CSS+JS inline) | 5.8KB | 175 |
| scripts/generate-feed.js | 3.5KB | 130 |
| feed.xml (생성 결과) | 16.7KB | 358 |

## 다음 사이클로 미루는 것

- 비-오늘 archive 항목들이 가리키는 `data/2026-XX-YY.js` 파일 자동 생성
- generate-feed.js를 cron 또는 GitHub Actions 06:00 KST 스케줄로 묶기
- archive.html 검색·날짜 범위 필터 (현재 7개라 불필요, 90일 누적 시 추가)
- feed.xml의 `<atom:link rel="self">` URL을 실제 도메인으로 (`DN_SITE_URL` 환경변수)
