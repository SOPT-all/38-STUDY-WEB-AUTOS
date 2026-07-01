import { $, setProgress } from "../ui/dom.js";

/**
 * GitHub 클라이언트를 통해 PR 목록과 각 PR의 리뷰를 수집합니다.
 * 수집 진행 상황을 로딩 진행바와 텍스트에 실시간으로 반영합니다.
 *
 * API 속도 제한을 피하기 위해 15개 PR마다 250ms 대기합니다.
 *
 * @param {import('../api/github.js').GitHubClient} client - GitHub API 클라이언트
 * @param {number} prLimit - 수집할 최대 PR 수
 * @returns {Promise<{ prs: Object[], reviewsMap: Map<number, Object[]> }>}
 */
export async function fetchData(client, prLimit) {
  $("loading-text").textContent = "PR 목록 불러오는 중...";
  setProgress(5, "");

  const prs = (await client.fetchPRs(Math.ceil(prLimit / 100))).slice(0, prLimit);
  setProgress(15, `PR ${prs.length}개 로드 완료`);

  const reviewsMap = new Map();
  for (let i = 0; i < prs.length; i++) {
    setProgress(
      15 + Math.round((i / prs.length) * 78),
      `리뷰 수집 중... (${i + 1}/${prs.length})`,
    );
    $("loading-text").textContent = `PR #${prs[i].number} 리뷰 수집 중`;
    reviewsMap.set(prs[i].number, await client.fetchPRReviews(prs[i].number));
    if (i > 0 && i % 15 === 0) await new Promise((r) => setTimeout(r, 250));
  }

  return { prs, reviewsMap };
}
