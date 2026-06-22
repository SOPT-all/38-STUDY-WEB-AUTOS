import { $ } from "./dom.js";
import {
  calcPRStatusCounts,
  calcReviewCounts,
  calcMemberActivity,
  calcWeeklyMerged,
} from "../analytics/analytics.js";

// ── Chart.js 공통 스타일 상수 ─────────────────────────
const TICK = { color: "#8b949e", font: { family: "Inter", size: 11 } };
const GRID = { color: "#21262d" };
const LEGEND = {
  labels: { color: "#8b949e", font: { family: "Inter", size: 12 }, padding: 16 },
};

const C = {
  blue: "#58a6ff",
  green: "#3fb950",
  red: "#f85149",
  purple: "#bc8cff",
  orange: "#d29922",
};

// ── 차트 인스턴스 레지스트리 ──────────────────────────
const charts = {};

/**
 * 기존 차트 인스턴스를 파괴하고 레지스트리에서 제거합니다.
 * 같은 canvas에 새 차트를 그리기 전에 반드시 호출해야 합니다.
 * @param {'status'|'reviews'|'activity'|'weekly'} key - 차트 식별 키
 */
function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

/**
 * PR 상태(오픈 / 머지됨 / 닫힘) 분포를 도넛 차트로 렌더링합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 */
export function renderStatusChart(prs) {
  destroyChart("status");
  const { open, merged, closed } = calcPRStatusCounts(prs);

  charts.status = new Chart($("chart-status"), {
    type: "doughnut",
    data: {
      labels: ["오픈", "머지됨", "닫힘 (미머지)"],
      datasets: [
        {
          data: [open, merged, closed],
          backgroundColor: [C.orange, C.purple, C.red],
          borderColor: "#161b22",
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { ...LEGEND.labels } } },
      cutout: "65%",
    },
  });
}

/**
 * 멤버별 리뷰 참여도(리뷰한 PR 수)를 수평 막대 차트로 렌더링합니다.
 * 상위 12명만 표시합니다.
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 */
export function renderReviewChart(reviewsMap) {
  destroyChart("reviews");
  const sorted = Object.entries(calcReviewCounts(reviewsMap))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  charts.reviews = new Chart($("chart-reviews"), {
    type: "bar",
    data: {
      labels: sorted.map(([login]) => login),
      datasets: [
        {
          label: "리뷰한 PR 수",
          data: sorted.map(([, n]) => n),
          backgroundColor: C.blue + "bb",
          borderColor: C.blue,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { ...TICK, precision: 0 }, grid: GRID },
        y: {
          ticks: { color: "#e6edf3", font: { family: "Inter", size: 12 } },
          grid: { display: false },
        },
      },
    },
  });
}

/**
 * 멤버별 PR 작성 수와 리뷰 참여 수를 비교하는 묶음 막대 차트를 렌더링합니다.
 * 활동량 상위 10명만 표시합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 * @param {Map<number, Object[]>} reviewsMap - PR 번호 → 리뷰 배열 맵
 */
export function renderActivityChart(prs, reviewsMap) {
  destroyChart("activity");
  const data = calcMemberActivity(prs, reviewsMap).slice(0, 10);

  charts.activity = new Chart($("chart-activity"), {
    type: "bar",
    data: {
      labels: data.map((d) => d.member),
      datasets: [
        {
          label: "PR 작성",
          data: data.map((d) => d.authored),
          backgroundColor: C.green + "bb",
          borderColor: C.green,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "PR 리뷰",
          data: data.map((d) => d.reviewed),
          backgroundColor: C.blue + "bb",
          borderColor: C.blue,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: LEGEND },
      scales: {
        x: {
          ticks: { color: "#e6edf3", font: { family: "Inter", size: 11 } },
          grid: GRID,
        },
        y: { ticks: { ...TICK, precision: 0 }, grid: GRID },
      },
    },
  });
}

/**
 * 최근 12주간 머지된 PR 수 추이를 선형 차트로 렌더링합니다.
 * @param {Object[]} prs - GitHub PR 객체 배열
 */
export function renderWeeklyChart(prs) {
  destroyChart("weekly");
  const weekly = calcWeeklyMerged(prs).slice(-12);

  charts.weekly = new Chart($("chart-weekly"), {
    type: "line",
    data: {
      labels: weekly.map((d) => d.week),
      datasets: [
        {
          label: "머지된 PR",
          data: weekly.map((d) => d.count),
          borderColor: C.purple,
          backgroundColor: C.purple + "22",
          pointBackgroundColor: C.purple,
          pointRadius: 4,
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { ...TICK, maxRotation: 30 }, grid: GRID },
        y: { ticks: { ...TICK, precision: 0 }, grid: GRID },
      },
    },
  });
}
