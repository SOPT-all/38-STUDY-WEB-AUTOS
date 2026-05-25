#!/usr/bin/env bash

set -euo pipefail

TARGET_BRANCH="$1"
SOURCE_BRANCH="$2"

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "GEMINI_API_KEY is not configured." >&2
  exit 1
fi

git fetch origin "$TARGET_BRANCH" --depth=1

MERGE_BASE=$(git merge-base "origin/$TARGET_BRANCH" HEAD)
COMMITS=$(git log --no-merges "$MERGE_BASE..HEAD" --oneline)
DIFF_STATS=$(git diff --stat "$MERGE_BASE..HEAD")
DIFF_CONTENT=$(git diff --unified=3 "$MERGE_BASE..HEAD" \
  -- . \
  ':(exclude)package-lock.json' \
  ':(exclude)yarn.lock' \
  ':(exclude)pnpm-lock.yaml' \
  ':(exclude)dist/**' \
  ':(exclude).gitignore')

if [ -z "$DIFF_CONTENT" ]; then
  {
    echo "should_create=false"
    echo "title=[chore] 변경 사항 없음"
    echo "body<<EOF"
    echo "변경 사항이 없어 PR을 생성하지 않습니다."
    echo "EOF"
  } >> "$GITHUB_OUTPUT"
  exit 0
fi

PR_TEMPLATE=$(cat .github/PULL_REQUEST_TEMPLATE.md)

PROMPT=$(cat <<EOF
당신은 GitHub Pull Request 제목과 AI 요약 블록을 작성하는 한국어 기술 문서 작성자입니다.

목표:
- feature 브랜치에서 test 브랜치로 보내는 PR의 제목과 설명을 생성합니다.
- 사람이 수정할 수 있도록 기본 PR 템플릿은 유지하고, AI가 생성한 내용은 별도 블록으로 구분합니다.

제목 규칙:
- 반드시 한국어로 작성합니다.
- 형식은 "[type] 작업 내용"입니다.
- type은 feat, fix, refactor, chore, docs, test, ci 중 하나만 사용합니다.
- 60자 이내를 권장합니다.

요약 규칙:
- 반드시 한국어 마크다운으로 작성합니다.
- 변경 사항은 커밋 목록, 변경 파일 통계, 상세 diff에 근거해 작성합니다.
- 확실하지 않은 내용은 추측하지 말고 "확인 필요"라고 적습니다.
- 테스트를 실제로 실행했다고 추정하지 않습니다.
- 각 섹션은 1~3개의 bullet로 짧고 선명하게 작성합니다.
- 아래 형식을 정확히 따릅니다.

출력 형식:
TITLE: [feat] 예시 제목
---
## 🤖 AI PR 분석 결과
_아래 내용은 변경 diff를 기준으로 자동 생성되었습니다._

### 📝 Summary
- ...
### ⚒️ 상세 변경 사항
- ...
### 🔍 리뷰어 주의사항
- ...

PR 템플릿:
---
$PR_TEMPLATE
---

PR 정보:
- base branch: $TARGET_BRANCH
- head branch: $SOURCE_BRANCH

커밋 목록:
$COMMITS

변경 파일 통계:
$DIFF_STATS

상세 diff:
$DIFF_CONTENT
EOF
)

GEMINI_RESPONSE=$(curl -sS -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg prompt "$PROMPT" '{
    contents: [
      {
        role: "user",
        parts: [{ text: $prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  }')")

FULL_RESPONSE=$(printf '%s' "$GEMINI_RESPONSE" | jq -r '
  .candidates[0].content.parts
  | map(.text // "")
  | join("")
')

if [ -z "$FULL_RESPONSE" ] || [ "$FULL_RESPONSE" = "null" ]; then
  echo "Gemini API returned an empty response." >&2
  echo "$GEMINI_RESPONSE" >&2
  exit 1
fi

PR_TITLE=$(printf '%s\n' "$FULL_RESPONSE" | grep '^TITLE:' | sed 's/^TITLE: //')
PR_SUMMARY=$(printf '%s\n' "$FULL_RESPONSE" | sed '1,/^---$/d')

if [ -z "$PR_TITLE" ] || [ -z "$PR_SUMMARY" ]; then
  echo "Failed to parse Gemini response." >&2
  exit 1
fi

PR_BODY=$(cat <<EOF
$PR_TEMPLATE

---

<!-- ai-pr-summary:start -->

$PR_SUMMARY

<!-- ai-pr-summary:end -->
EOF
)

{
  echo "should_create=true"
  echo "title=$PR_TITLE"
  echo "body<<EOF"
  echo "$PR_BODY"
  echo "EOF"
} >> "$GITHUB_OUTPUT"
