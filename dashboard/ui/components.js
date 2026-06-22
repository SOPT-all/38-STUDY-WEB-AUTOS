import { $, escHtml } from "./dom.js";
import {
  calcPRStatusCounts,
  calcAvgTimeToFirstReview,
  calcAvgTimeToMerge,
  calcNoReviewOpenPRs,
  formatHours,
  calcElapsedHours,
} from "../analytics/analytics.js";

// ── 요약 카드 ─────────────────────────────────────────

/**
 * 요약 통계 카드 6개를 계산하여 DOM에 반영합니다.
 * (전체 PR / 오픈 / 머지됨 / 평균 첫 리뷰 / 평균 머지 / 총 리뷰)
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 */
export function renderSummaryCards(prs, reviewsMap) {
  const { open, merged, total } = calcPRStatusCounts(prs);
  const noReview = calcNoReviewOpenPRs(prs, reviewsMap);
  const totalReviews = [...reviewsMap.values()].reduce((s, r) => s + r.length, 0);
  const mergeRate = total > 0 ? Math.round((merged / total) * 100) : 0;

  $("stat-total").textContent = total;
  $("stat-open").textContent = open;
  $("stat-open-sub").textContent = `리뷰 없는 오픈 PR: ${noReview}개`;
  $("stat-merged").textContent = merged;
  $("stat-merged-sub").textContent = `머지율 ${mergeRate}%`;
  $("stat-avg-review").textContent = formatHours(calcAvgTimeToFirstReview(prs, reviewsMap));
  $("stat-avg-merge").textContent = formatHours(calcAvgTimeToMerge(prs));
  $("stat-reviews").textContent = totalReviews;
  $("stat-reviews-sub").textContent =
    `PR당 평균 ${total > 0 ? (totalReviews / total).toFixed(1) : 0}개`;
}

// ── PR 테이블 ─────────────────────────────────────────

/**
 * 필터 값에 따라 PR 목록을 걸러냅니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {'all'|'open'|'merged'|'closed'} filter - 필터 조건
 * @returns {Object[]} 조건에 맞는 PR 배열
 */
function filterPRs(prs, filter) {
  if (filter === "open") return prs.filter((pr) => pr.state === "open");
  if (filter === "merged") return prs.filter((pr) => pr.merged_at != null);
  if (filter === "closed")
    return prs.filter((pr) => pr.state === "closed" && pr.merged_at == null);
  return prs;
}

/**
 * PR의 표시용 상태 키와 한국어 레이블을 반환합니다.
 * @param {Object} pr - GitHub PR 객체
 * @returns {{ key: 'merged'|'open'|'closed', label: string }}
 */
function getPRStatus(pr) {
  if (pr.merged_at) return { key: "merged", label: "머지됨" };
  if (pr.state === "open") return { key: "open", label: "오픈" };
  return { key: "closed", label: "닫힘" };
}

/**
 * PR 한 행의 HTML 문자열을 생성합니다.
 * @param {Object} pr - GitHub PR 객체
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @returns {string} <tr>...</tr> HTML 문자열
 */
function buildPRRow(pr, reviewsMap) {
  const reviews = reviewsMap.get(pr.number) ?? [];
  const mergeHours = pr.merged_at
    ? (new Date(pr.merged_at) - new Date(pr.created_at)) / 36e5
    : null;
  const { key: statusKey, label: statusLabel } = getPRStatus(pr);
  const age = formatHours(calcElapsedHours(pr.created_at, pr.merged_at ?? pr.closed_at));

  return `
    <tr>
      <td><a href="${pr.html_url}" target="_blank" class="pr-num">#${pr.number}</a></td>
      <td class="pr-title-cell"><a href="${pr.html_url}" target="_blank" title="${escHtml(pr.title)}">${escHtml(pr.title)}</a></td>
      <td><div class="author"><img src="${pr.user.avatar_url}&s=40" class="avatar" alt="" loading="lazy"/>${escHtml(pr.user.login)}</div></td>
      <td><span class="badge ${statusKey}">${statusLabel}</span></td>
      <td>${age}</td>
      <td>${reviews.length}</td>
      <td>${mergeHours != null ? formatHours(mergeHours) : "-"}</td>
    </tr>`;
}

/**
 * 필터 조건에 맞는 PR 목록을 테이블에 렌더링합니다. 최대 60개까지 표시합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @param {'all'|'open'|'merged'|'closed'} filter - 필터 조건
 */
export function renderTable(prs, reviewsMap, filter) {
  const filtered = filterPRs(prs, filter);
  const tbody = $("pr-tbody");
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.insertAdjacentHTML(
      "beforeend",
      `<tr><td colspan="7" style="text-align:center;color:#484f58;padding:32px">해당하는 PR이 없습니다</td></tr>`,
    );
    return;
  }

  for (const pr of filtered.slice(0, 60)) {
    tbody.insertAdjacentHTML("beforeend", buildPRRow(pr, reviewsMap));
  }
}
