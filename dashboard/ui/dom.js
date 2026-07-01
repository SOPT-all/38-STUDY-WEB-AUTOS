/**
 * DOM 조작을 위한 경량 유틸리티 함수 모음.
 * document.getElementById 호출과 클래스 토글을 단순하게 래핑합니다.
 */

/**
 * id로 DOM 요소를 가져옵니다.
 * @param {string} id - 요소의 id 속성값
 * @returns {HTMLElement}
 */
export const $ = (id) => document.getElementById(id);

/**
 * 요소에서 'hidden' 클래스를 제거해 화면에 표시합니다.
 * @param {string} id - 요소의 id 속성값
 */
export const show = (id) => $(id).classList.remove("hidden");

/**
 * 요소에 'hidden' 클래스를 추가해 화면에서 숨깁니다.
 * @param {string} id - 요소의 id 속성값
 */
export const hide = (id) => $(id).classList.add("hidden");

/**
 * 로딩 진행바의 너비와 레이블 텍스트를 업데이트합니다.
 * @param {number} pct   - 진행률 (0~100)
 * @param {string} label - 진행 상태 설명 텍스트
 */
export function setProgress(pct, label) {
  $("progress-fill").style.width = `${pct}%`;
  $("progress-label").textContent = label;
}

/**
 * 문자열의 HTML 특수문자를 엔티티로 이스케이프합니다.
 * innerHTML 삽입 전에 사용해 XSS를 방지합니다.
 * @param {string} str - 이스케이프할 원본 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
