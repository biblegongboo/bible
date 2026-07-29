import { createTemplate, listTemplates } from './jsxgraph-templates.js';
import { createChartTemplate, listChartTemplates } from './chart-templates.js';

const $ = (id) => document.getElementById(id);

// Visible names describe the resulting diagram. IDs remain stable for JSON and AI prompts.
const TEMPLATE_INFO = {
  function_graph: ['2D · 기본 함수 그래프 (포물선)', '2D 함수·대수', '포물선 함수와 식 라벨'],
  function_comparison: ['2D · 두 함수 비교 (포물선·직선)', '2D 함수·대수', '두 함수와 교점 비교'],
  region_between_curves: ['2D · 두 곡선 사이 넓이', 'Calculus · 적분', '포물선과 직선 사이 음영 영역'],
  piecewise: ['2D · 조각함수와 열린·닫힌 점', '2D 함수·대수', '두 구간 그래프와 endpoint 표시'],
  tangent_and_secant: ['2D · 접선과 할선', 'Calculus · 미분', '곡선 위 두 점과 접선·할선'],
  coordinate_polygon: ['2D · 좌표평면 사각형', '2D 기하·좌표', '좌표로 만든 다각형과 꼭짓점'],
  circle_geometry: ['2D · 원과 반지름', '2D 기하·좌표', '중심·반지름·원'],
  inequality_region: ['2D · 연립일차부등식 음영', '2D 함수·대수', '직선 경계와 삼각형 음영 영역'],
  calculus_integral_area: ['Calculus · 정적분 넓이', 'Calculus · 적분', '곡선과 x축 사이의 정적분 영역'],
  calculus_riemann_sum: ['Calculus · 리만합 직사각형', 'Calculus · 적분', '곡선 아래 리만합 근사'],
  calculus_tangent_secant: ['Calculus · 접선·할선 비교', 'Calculus · 미분', '미분계수와 평균변화율 비교'],
  calculus_parametric: ['Calculus · 매개변수 타원 곡선', 'Calculus · 특수 곡선', 'x(t), y(t)로 만든 타원'],
  calculus_polar: ['Calculus · 극좌표 네잎장미', 'Calculus · 특수 곡선', 'r = 2 sin(2t) 유형'],
  calculus_accumulation: ['Calculus · 누적함수·FTC', 'Calculus · 적분', '변화율 그래프와 누적 넓이'],
  three3d_coordinate_projection: ['3D · 좌표점과 정사영', '3D 좌표·벡터', '공간 점과 좌표평면 투영선'],
  three3d_rectangular_prism: ['3D · 직육면체', '3D 공간도형', '반투명 직육면체와 꼭짓점'],
  three3d_cylinder: ['3D · 원기둥·회전체', '3D 공간도형', '원기둥과 회전축'],
  three3d_cone: ['3D · 원뿔', '3D 공간도형', '반투명 원뿔과 꼭짓점'],
  three3d_plane_face: ['3D · 평면과 삼각형 면', '3D 좌표·벡터', '공간의 삼각형 평면'],
  calculus_trigonometric: ['Calculus · 사인·코사인 그래프', 'Calculus · 특수 곡선', 'sin과 cos의 주기 비교'],
  calculus_exponential_log: ['Calculus · 지수·로그 그래프', '2D 함수·대수', 'exp(x)와 log(x)'],
  calculus_rational_asymptote: ['Calculus · 유리함수와 점근선', 'Calculus · 미분', '수직·수평 점근선'],
  calculus_limit_hole: ['Calculus · 극한과 removable hole', 'Calculus · 미분', '구멍과 별도 함수값'],
  calculus_derivative_pair: ["Calculus · f와 f′ 비교", 'Calculus · 미분', '원함수와 도함수 그래프'],
  calculus_ellipse_parametric: ['Calculus · 매개변수 타원', 'Calculus · 특수 곡선', '타원과 중심 반지름선'],
  geometry_unit_circle: ['2D · 단위원과 각도', '2D 기하·좌표', '단위원, 반지름, π/3'],
  geometry_vector_components: ['2D · 벡터와 성분', '2D 기하·좌표', '벡터와 수평·수직 성분'],
  calculus_absolute_value: ['Calculus · 절댓값 그래프와 꼭짓점', '2D 함수·대수', 'V자 그래프와 corner'],
  calculus_cubic_inflection: ['Calculus · 삼차함수 변곡점', 'Calculus · 미분', '삼차곡선과 변곡점'],
  calculus_logistic: ['Calculus · 로지스틱 성장 곡선', 'Calculus · 특수 곡선', 'S자 성장곡선과 수평점근선'],
  calculus_inverse_trig: ['Calculus · 아크탄젠트와 점근선', 'Calculus · 특수 곡선', 'atan(x)와 ±π/2'],
  calculus_discontinuity: ['Calculus · 점프 불연속', 'Calculus · 미분', '열린 점·닫힌 점이 있는 불연속'],
  calculus_cardioid: ['Calculus · 극좌표 카디오이드', 'Calculus · 특수 곡선', 'r = 1 + cos(t) 유형'],
  calculus_spiral: ['Calculus · 극좌표 나선', 'Calculus · 특수 곡선', 'r = t/4 유형'],
  geometry_parabola_focus: ['2D · 포물선·초점·준선', '2D 기하·좌표', '포물선, 초점, 준선'],
  geometry_concentric_circles: ['2D · 동심원과 고리 영역', '2D 기하·좌표', '두 동심원과 중심'],
  geometry_triangle_altitude: ['2D · 삼각형 높이', '2D 기하·좌표', '삼각형과 수선·수선의 발'],
  three3d_tetrahedron: ['3D · 사면체', '3D 공간도형', '4개 면으로 만든 사면체'],
  three3d_two_planes: ['3D · 두 평면의 교선', '3D 좌표·벡터', '서로 수직인 두 평면과 교선'],
  three3d_vector: ['3D · 벡터와 성분 분해', '3D 좌표·벡터', '공간 벡터와 투영 성분'],
  three3d_sphere: ['3D · 구와 반지름', '3D 공간도형', '반투명 구와 반지름'],
  three3d_square_pyramid: ['3D · 사각뿔', '3D 공간도형', '사각형 밑면과 꼭짓점'],
  three3d_line_and_plane: ['3D · 직선과 평면의 교점', '3D 좌표·벡터', '평면을 가로지르는 직선과 교점'],
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

const entries = [...listTemplates().map((template) => {
  const [title, category, result] = TEMPLATE_INFO[template.id] || [template.label, 'Unclassified', template.label];
  const json = createTemplate(template.id);
  return { id: template.id, title, category, result, engine: json?.engine || 'jsxgraph', dimension: json?.engine === 'three3d' ? '3d' : '2d' };
}), ...listChartTemplates().map((template) => ({ id:template.id, title:template.label, category:template.category, result:template.result, engine:'chart', dimension:'2d' }))].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
function createAnyTemplate(id) { return createChartTemplate(id) || createTemplate(id); }

function populateCategories() {
  const categories = [...new Set(entries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b));
  $('category').innerHTML = '<option value="all">All categories</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
}

function render() {
  const search = $('search').value.trim().toLowerCase();
  const dimension = $('dimension').value;
  const category = $('category').value;
  const matching = entries.filter((entry) => {
    const text = [entry.title, entry.category, entry.result, entry.id, entry.engine].join(' ').toLowerCase();
    return (!search || text.includes(search)) && (dimension === 'all' || entry.dimension === dimension) && (category === 'all' || entry.category === category);
  });
  $('summary').innerHTML = `<span class="pill ready">Ready JSON templates: ${entries.length}</span><span class="pill">Categories: ${new Set(entries.map((entry) => entry.category)).size}</span><span class="pill">Showing ${matching.length}</span>`;
  $('results').innerHTML = matching.map((entry) => `<article><div class="tags"><span class="tag">${entry.dimension.toUpperCase()}</span><span class="tag">${escapeHtml(entry.category)}</span><span class="tag">${escapeHtml(entry.engine)}</span></div><h2>${escapeHtml(entry.title)}</h2><div class="meta"><strong>Result:</strong> ${escapeHtml(entry.result)}</div><code>Template ID: ${escapeHtml(entry.id)}</code><button data-copy-template="${escapeHtml(entry.id)}">Copy JSON</button></article>`).join('');
  $('empty').style.display = matching.length ? 'none' : 'block';
  document.querySelectorAll('[data-copy-template]').forEach((button) => button.addEventListener('click', async () => {
    const json = JSON.stringify(createAnyTemplate(button.dataset.copyTemplate), null, 2);
    try { await navigator.clipboard.writeText(json); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy JSON'; }, 1400); }
    catch { window.prompt('Copy this JSON:', json); }
  }));
}

$('search').addEventListener('input', render);
$('dimension').addEventListener('change', render);
$('category').addEventListener('change', render);
populateCategories();
render();
