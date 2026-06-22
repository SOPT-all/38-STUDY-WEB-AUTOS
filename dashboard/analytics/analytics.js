/**
 * PR 데이터를 받아 통계 지표를 계산하는 순수 함수 모음.
 * 부수 효과 없이 입력값만으로 결과를 반환합니다.
 */

/**
 * PR 목록에서 상태별 개수를 집계합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @returns {{ open: number, merged: number, closed: number, total: number }}
 */
export const calcPRStatusCounts = (prs) => ({
  open: prs.filter((pr) => pr.state === "open").length,
  merged: prs.filter((pr) => pr.merged_at != null).length,
  closed: prs.filter((pr) => pr.state === "closed" && pr.merged_at == null).length,
  total: prs.length,
});

/**
 * 머지된 PR의 평균 소요 시간을 시간(h) 단위로 계산합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @returns {number|null} 평균 소요 시간(시간). 머지된 PR이 없으면 null.
 */
export const calcAvgTimeToMerge = (prs) => {
  const merged = prs.filter((pr) => pr.merged_at);
  if (merged.length === 0) return null;
  const total = merged.reduce(
    (s, pr) => s + (new Date(pr.merged_at) - new Date(pr.created_at)) / 36e5,
    0,
  );
  return total / merged.length;
};

/**
 * 첫 리뷰까지의 평균 대기 시간을 시간(h) 단위로 계산합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @returns {number|null} 평균 대기 시간(시간). 데이터가 없으면 null.
 */
export const calcAvgTimeToFirstReview = (prs, reviewsMap) => {
  let sum = 0;
  let count = 0;
  for (const pr of prs) {
    const reviews = reviewsMap.get(pr.number) ?? [];
    if (reviews.length === 0) continue;
    const sorted = [...reviews].sort(
      (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at),
    );
    const hours = (new Date(sorted[0].submitted_at) - new Date(pr.created_at)) / 36e5;
    if (hours >= 0) {
      sum += hours;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
};

/**
 * 멤버별 리뷰한 PR 수를 집계합니다. 같은 PR에 여러 번 리뷰해도 1회로 카운트합니다.
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @returns {Record<string, number>} { 멤버 로그인: 리뷰한 PR 수 }
 */
export const calcReviewCounts = (reviewsMap) => {
  const counts = {};
  for (const reviews of reviewsMap.values()) {
    const seen = new Set();
    for (const r of reviews) {
      const login = r.user?.login;
      if (login && !seen.has(login)) {
        seen.add(login);
        counts[login] = (counts[login] ?? 0) + 1;
      }
    }
  }
  return counts;
};

/**
 * 리뷰가 하나도 없는 오픈 PR의 수를 반환합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @returns {number}
 */
export const calcNoReviewOpenPRs = (prs, reviewsMap) =>
  prs
    .filter((pr) => pr.state === "open")
    .filter((pr) => (reviewsMap.get(pr.number) ?? []).length === 0).length;

/**
 * 멤버별 PR 작성 수와 리뷰 참여 수를 집계합니다.
 * 활동량(작성 + 리뷰) 내림차순으로 정렬됩니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 * @returns {{ member: string, authored: number, reviewed: number }[]}
 */
export const calcMemberActivity = (prs, reviewsMap) => {
  const members = new Set();
  prs.forEach((pr) => pr.user?.login && members.add(pr.user.login));
  for (const reviews of reviewsMap.values()) {
    reviews.forEach((r) => r.user?.login && members.add(r.user.login));
  }

  return Array.from(members)
    .map((member) => ({
      member,
      authored: prs.filter((pr) => pr.user?.login === member).length,
      reviewed: [...reviewsMap.values()].filter((reviews) =>
        reviews.some((r) => r.user?.login === member),
      ).length,
    }))
    .sort((a, b) => b.authored + b.reviewed - (a.authored + a.reviewed));
};

/**
 * PR 머지 날짜를 기준으로 주(week)별 머지 수를 집계합니다.
 * 주의 시작은 일요일 기준 UTC입니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @returns {{ week: string, count: number }[]} ISO 주 시작일(YYYY-MM-DD) 기준 오름차순
 */
export const calcWeeklyMerged = (prs) => {
  const byWeek = new Map();
  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const d = new Date(pr.merged_at);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const key = d.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
};

/**
 * 시간(h) 값을 사람이 읽기 쉬운 문자열로 변환합니다.
 * @param {number|null} hours
 * @returns {string} 예: "30분", "2.5시간", "1.2일". null이면 "-".
 */
export const formatHours = (hours) => {
  if (hours == null) return "-";
  if (hours < 1) return `${Math.round(hours * 60)}분`;
  if (hours < 24) return `${hours.toFixed(1)}시간`;
  return `${(hours / 24).toFixed(1)}일`;
};

/**
 * 두 시각 사이의 경과 시간을 시간(h) 단위로 반환합니다.
 * @param {string} createdAt - ISO 8601 시작 시각
 * @param {string|null} [endAt] - ISO 8601 종료 시각 (기본값: 현재)
 * @returns {number}
 */
export const calcElapsedHours = (createdAt, endAt = null) =>
  (new Date(endAt ?? Date.now()) - new Date(createdAt)) / 36e5;
