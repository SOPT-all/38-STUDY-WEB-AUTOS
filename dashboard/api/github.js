/**
 * GitHub REST API v2022-11-28 클라이언트
 * 인증 토큰이 있을 때와 없을 때 모두 동작하며,
 * 속도 제한·인증 실패·404 등 주요 오류를 한국어 메시지로 변환합니다.
 */
export class GitHubClient {
  #base = "https://api.github.com";
  #owner;
  #repo;
  #headers;

  /**
   * @param {string} owner - 저장소 소유자 (GitHub 로그인명)
   * @param {string} repo  - 저장소 이름
   * @param {string|null} [token] - GitHub Personal Access Token (선택)
   */
  constructor(owner, repo, token = null) {
    this.#owner = owner;
    this.#repo = repo;
    this.#headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * 내부 GET 요청 실행기. 오류 상태를 사람이 읽기 쉬운 예외로 변환합니다.
   * @param {string} path - API 경로 (예: /repos/owner/repo)
   * @param {Record<string, string>} [params] - 쿼리 파라미터
   * @returns {Promise<{ data: any, headers: Headers }>}
   * @throws {Error} API 오류 또는 속도 제한 초과 시
   */
  async #get(path, params = {}) {
    const url = new URL(`${this.#base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, { headers: this.#headers });

    if (!res.ok) {
      const remaining = res.headers.get("x-ratelimit-remaining");

      if ((res.status === 403 || res.status === 429) && remaining === "0") {
        const reset = res.headers.get("x-ratelimit-reset");
        const t = new Date(Number(reset) * 1000).toLocaleTimeString("ko-KR");
        throw new Error(
          `API 속도 제한 초과. ${t} 이후 재시도하거나 GitHub Token을 입력하세요.`,
        );
      }

      if (res.status === 404)
        throw new Error("저장소를 찾을 수 없습니다. Owner / Repo 이름을 확인하세요.");

      if (res.status === 401)
        throw new Error("인증 실패. GitHub Token 값을 확인하세요.");

      throw new Error(`GitHub API 오류: ${res.status} ${res.statusText}`);
    }

    return { data: await res.json(), headers: res.headers };
  }

  /**
   * 저장소 메타 정보(스타 수, 포크 수, URL 등)를 가져옵니다.
   * @returns {Promise<Object>} GitHub 저장소 객체
   */
  async fetchRepo() {
    const { data } = await this.#get(`/repos/${this.#owner}/${this.#repo}`);
    return data;
  }

  /**
   * PR 목록을 최신순으로 가져옵니다. 한 페이지당 최대 100개입니다.
   * @param {number} [maxPages=1] - 최대 페이지 수
   * @returns {Promise<Object[]>} PR 객체 배열
   */
  async fetchPRs(maxPages = 1) {
    const results = [];
    for (let page = 1; page <= maxPages; page++) {
      const { data } = await this.#get(
        `/repos/${this.#owner}/${this.#repo}/pulls`,
        { state: "all", sort: "created", direction: "desc", per_page: 100, page },
      );
      results.push(...data);
      if (data.length < 100) break;
    }
    return results;
  }

  /**
   * 특정 PR의 리뷰 목록을 가져옵니다. 봇 계정([bot] 접미사)은 자동 제외됩니다.
   * @param {number} prNumber - PR 번호
   * @returns {Promise<Object[]>} 리뷰 객체 배열
   */
  async fetchPRReviews(prNumber) {
    const { data } = await this.#get(
      `/repos/${this.#owner}/${this.#repo}/pulls/${prNumber}/reviews`,
      { per_page: 100 },
    );
    return data.filter((r) => !r.user?.login?.endsWith("[bot]"));
  }

  /**
   * 현재 API 속도 제한 상태(남은 요청 수, 초기화 시각 등)를 가져옵니다.
   * @returns {Promise<Object>} rate_limit 응답 객체
   */
  async fetchRateLimit() {
    const { data } = await this.#get("/rate_limit");
    return data;
  }
}
