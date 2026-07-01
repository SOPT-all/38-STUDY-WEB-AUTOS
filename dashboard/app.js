import { GitHubClient } from "./api/github.js";
import { $, show, hide, setProgress } from "./ui/dom.js";
import { fetchData } from "./data/loader.js";
import { renderSummaryCards, renderTable } from "./ui/components.js";
import {
  renderStatusChart,
  renderReviewChart,
  renderActivityChart,
  renderWeeklyChart,
} from "./ui/charts.js";

const OWNER = "SOPT-all";
const REPO = "38-STUDY-WEB-AUTOS";

// ── 앱 상태 ───────────────────────────────────────────
let allPRs = [];
let reviewsMap = new Map();
let currentFilter = "all";
let lastConfig = null;

/**
 * 저장소 메타 정보를 헤더 바에 업데이트합니다.
 * @param {Object} repoInfo - GitHub 저장소 API 응답 객체
 * @param {{ owner: string, repo: string }} config - 현재 설정값
 */
function updateRepoInfo(repoInfo, config) {
  const link = $("repo-link");
  link.textContent = `${config.owner}/${config.repo}`;
  link.href = repoInfo.html_url;
  $("repo-stars").textContent = `⭐ ${repoInfo.stargazers_count.toLocaleString()}`;
  $("repo-forks").textContent = `🍴 ${repoInfo.forks_count.toLocaleString()}`;
  $("last-updated").textContent = `업데이트: ${new Date().toLocaleTimeString("ko-KR")}`;
}

/**
 * 설정값을 받아 GitHub 데이터를 로드하고 대시보드를 전체 렌더링합니다.
 * 저장소 정보 조회와 PR 수집을 병렬로 실행해 시간을 단축합니다.
 * @param {{ owner: string, repo: string, token: string, prLimit: number }} config
 */
async function loadDashboard(config) {
  lastConfig = config;
  const client = new GitHubClient(config.owner, config.repo, config.token || null);

  hide("config-panel");
  hide("dashboard");
  hide("error-state");
  show("loading");

  try {
    const [repoInfo, { prs, reviewsMap: rMap }] = await Promise.all([
      client.fetchRepo(),
      fetchData(client, config.prLimit),
    ]);

    allPRs = prs;
    reviewsMap = rMap;

    setProgress(100, "완료!");
    await new Promise((r) => setTimeout(r, 350));
    hide("loading");
    show("dashboard");

    updateRepoInfo(repoInfo, config);
    show("refresh-btn");

    renderSummaryCards(prs, reviewsMap);
    renderStatusChart(prs);
    renderReviewChart(reviewsMap);
    renderActivityChart(prs, reviewsMap);
    renderWeeklyChart(prs);
    renderTable(prs, reviewsMap, currentFilter);

    try {
      const rl = await client.fetchRateLimit();
      $("rate-limit").textContent = `API ${rl.rate.remaining}/${rl.rate.limit} 남음`;
    } catch {}
  } catch (err) {
    hide("loading");
    $("error-msg").textContent = err.message;
    show("error-state");
  }
}

/**
 * 폼 제출 / 새로고침 / 필터 버튼에 이벤트 리스너를 등록하고 앱을 시작합니다.
 */
function init() {
  $("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
    loadDashboard({
      owner: OWNER,
      repo: REPO,
      token: $("token").value.trim(),
      prLimit: parseInt($("pr-limit").value, 10),
    });
  });

  $("back-btn").addEventListener("click", () => {
    hide("error-state");
    show("config-panel");
  });

  $("refresh-btn").addEventListener("click", () => {
    if (lastConfig) loadDashboard(lastConfig);
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTable(allPRs, reviewsMap, currentFilter);
    });
  });
}

init();
