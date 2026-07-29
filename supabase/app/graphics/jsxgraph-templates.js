// Reusable starter JSON for new GongBoo 2D questions.
// Each template intentionally uses the engine-aligned JSXGraph JSON shape.
const TEMPLATES = {
  function_graph: {
    label: 'Function graph',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-6, 6, 6, -4], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2 - 2*x - 1', range: [-4, 5], attributes: { strokeColor: '#2563eb' } },
      { type: 'text', position: [3.2, 3.8], text: 'f(x) = x² − 2x − 1' }
    ] })
  },
  function_comparison: {
    label: 'Two function comparison',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 6, 5, -4], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2', range: [-2, 3], attributes: { strokeColor: '#2563eb' } },
      { id: 'g', type: 'functiongraph', expression: '2*x', range: [-2, 3], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'text', position: [2.3, 4.8], text: 'f and g' }
    ] })
  },
  region_between_curves: {
    label: 'Area between two curves',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 5, 3, -1], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2', range: [-1, 3], attributes: { strokeColor: '#2563eb' } },
      { id: 'g', type: 'functiongraph', expression: '2*x', range: [-1, 3], attributes: { strokeColor: '#2563eb' } },
      { type: 'regionBetweenCurves', upper: 'g', lower: 'f', range: [0, 2], attributes: { fillColor: '#60a5fa', fillOpacity: 0.25 } }
    ] })
  },
  piecewise: {
    label: 'Piecewise function',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-5, 5, 5, -4], grid: true }, objects: [
      { id: 'left', type: 'functiongraph', expression: 'x + 2', range: [-5, 0], attributes: { strokeColor: '#2563eb' } },
      { id: 'right', type: 'functiongraph', expression: 'x^2 - 2', range: [0, 3], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, 2], name: '', attributes: { fillColor: '#2563eb' } },
      { type: 'point', coords: [0, -2], name: '', attributes: { fillColor: '#ffffff', strokeColor: '#2563eb' } }
    ] })
  },
  tangent_and_secant: {
    label: 'Tangent and secant',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-2, 7, 5, -3], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2', range: [-1.5, 3], attributes: { strokeColor: '#2563eb' } },
      { type: 'line', through: [[-2, -4], [3, 6]], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'segment', from: [1, 1], to: [2, 4], attributes: { strokeColor: '#059669' } },
      { type: 'point', coords: [1, 1], name: 'P', attributes: { fillColor: '#111827' } },
      { type: 'point', coords: [2, 4], name: 'Q', attributes: { fillColor: '#111827' } }
    ] })
  },
  coordinate_polygon: {
    label: 'Coordinate polygon',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 5, 6, -3], grid: true }, objects: [
      { type: 'polygon', points: [[-1, 0], [1, 4], [5, 3], [3, -1]], attributes: { strokeColor: '#2563eb', fillColor: '#bfdbfe', fillOpacity: 0.28 } },
      { type: 'text', position: [-1.4, -0.5], text: 'A' }, { type: 'text', position: [0.7, 4.3], text: 'B' },
      { type: 'text', position: [5.1, 3.2], text: 'C' }, { type: 'text', position: [3.1, -1.4], text: 'D' }
    ] })
  },
  circle_geometry: {
    label: 'Circle and radius',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-5, 5, 5, -5], grid: true }, objects: [
      { type: 'circle', center: [0, 0], radius: 3, attributes: { strokeColor: '#2563eb' } },
      { type: 'segment', from: [0, 0], to: [3, 0], attributes: { strokeColor: '#dc2626' } },
      { type: 'point', coords: [0, 0], name: 'O', attributes: { fillColor: '#111827' } },
      { type: 'text', position: [1.2, 0.4], text: 'r = 3' }
    ] })
  },
  inequality_region: {
    label: 'Linear inequality region',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 7, 7, -1], grid: true }, objects: [
      { id: 'xAxis', type: 'line', y: 0, attributes: { strokeColor: '#111827' } },
      { id: 'yAxis', type: 'line', x: 0, attributes: { strokeColor: '#111827' } },
      { type: 'polygon', points: [[0, 0], [0, 6], [6, 0]], attributes: { strokeColor: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.25 } },
      { type: 'segment', from: [0, 6], to: [6, 0], attributes: { strokeColor: '#2563eb' } },
      { type: 'text', position: [3.2, 3.4], text: 'x + y ≤ 6' }
    ] })
  },
  calculus_integral_area: {
    label: 'Calculus: definite integral area',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 5, 4, -1], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: '4 - x^2', range: [-1, 2], attributes: { strokeColor: '#2563eb' } },
      { id: 'axis', type: 'functiongraph', expression: '0', range: [0, 2], attributes: { strokeColor: '#111827' } },
      { type: 'regionBetweenCurves', upper: 'f', lower: 'axis', range: [0, 2], attributes: { fillColor: '#60a5fa', fillOpacity: 0.25 } },
      { type: 'text', position: [0.7, 3.5], text: '∫₀² (4 − x²) dx' }
    ] })
  },
  calculus_riemann_sum: {
    label: 'Calculus: Riemann sum',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-0.5, 5, 4.5, -0.5], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2/4 + 1', range: [0, 4], attributes: { strokeColor: '#2563eb' } },
      { type: 'polygon', points: [[0, 0], [1, 0], [1, 1.25], [0, 1.25]], attributes: { strokeColor: '#64748b', fillColor: '#cbd5e1', fillOpacity: 0.32 } },
      { type: 'polygon', points: [[1, 0], [2, 0], [2, 2], [1, 2]], attributes: { strokeColor: '#64748b', fillColor: '#cbd5e1', fillOpacity: 0.32 } },
      { type: 'polygon', points: [[2, 0], [3, 0], [3, 3.25], [2, 3.25]], attributes: { strokeColor: '#64748b', fillColor: '#cbd5e1', fillOpacity: 0.32 } },
      { type: 'polygon', points: [[3, 0], [4, 0], [4, 5], [3, 5]], attributes: { strokeColor: '#64748b', fillColor: '#cbd5e1', fillOpacity: 0.32 } }
    ] })
  },
  calculus_tangent_secant: {
    label: 'Calculus: tangent and secant',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-2, 7, 5, -3], grid: true }, objects: [
      { id: 'f', type: 'functiongraph', expression: 'x^2', range: [-1.5, 3], attributes: { strokeColor: '#2563eb' } },
      { type: 'line', through: [[-2, -4], [3, 6]], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'segment', from: [1, 1], to: [2, 4], attributes: { strokeColor: '#059669' } },
      { type: 'point', coords: [1, 1], name: 'P', attributes: { fillColor: '#111827' } },
      { type: 'point', coords: [2, 4], name: 'Q', attributes: { fillColor: '#111827' } }
    ] })
  },
  calculus_parametric: {
    label: 'Calculus: parametric curve',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 4, 4, -4], grid: true }, objects: [
      { type: 'parametric', xExpression: '3*cos(t)', yExpression: '2*sin(t)', range: [0, 6.283185307179586], attributes: { strokeColor: '#2563eb' } },
      { type: 'text', position: [-3.5, 3.2], text: 'x = 3 cos t,  y = 2 sin t' }
    ] })
  },
  calculus_polar: {
    label: 'Calculus: polar curve',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 3, 3, -3], grid: true }, objects: [
      { type: 'polar', rExpression: '2*sin(2*t)', range: [0, 6.283185307179586], attributes: { strokeColor: '#2563eb' } },
      { type: 'text', position: [-2.8, 2.5], text: 'r = 2 sin(2θ)' }
    ] })
  },
  calculus_accumulation: {
    label: 'Calculus: accumulation / FTC',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 6, 5, -2], grid: true }, objects: [
      { id: 'rate', type: 'functiongraph', expression: 'sin(x) + 1', range: [0, 4], attributes: { strokeColor: '#2563eb' } },
      { id: 'axis', type: 'functiongraph', expression: '0', range: [0, 4], attributes: { strokeColor: '#111827' } },
      { type: 'regionBetweenCurves', upper: 'rate', lower: 'axis', range: [0, 3], attributes: { fillColor: '#60a5fa', fillOpacity: 0.22 } },
      { type: 'text', position: [1.2, 4.8], text: 'A(x) = ∫₀ˣ f(t) dt' }
    ] })
  },
  three3d_coordinate_projection: {
    label: '3D: coordinate point and projection',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'point', position: [2, 3, 1], name: 'P(2, 3, 1)', attributes: { color: '#111827' } },
      { type: 'segment', from: [0, 0, 0], to: [2, 3, 1], attributes: { color: '#2563eb' } },
      { type: 'segment', from: [2, 3, 1], to: [2, 0, 1], attributes: { color: '#64748b', opacity: 0.65 } },
      { type: 'segment', from: [2, 0, 1], to: [2, 0, 0], attributes: { color: '#64748b', opacity: 0.65 } },
      { type: 'segment', from: [2, 0, 1], to: [0, 0, 1], attributes: { color: '#64748b', opacity: 0.65 } }
    ] })
  },
  three3d_rectangular_prism: {
    label: '3D: rectangular prism',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 5 }, objects: [
      { type: 'box', center: [1.5, 1, 1], size: [3, 2, 2], attributes: { color: '#60a5fa', opacity: 0.48 } },
      { type: 'point', position: [3, 2, 2], name: 'P(3, 2, 2)', attributes: { color: '#111827' } }
    ] })
  },
  three3d_cylinder: {
    label: '3D: cylinder / solid of revolution',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'cylinder', center: [0, 1.5, 0], radius: 1.4, height: 3, attributes: { color: '#60a5fa', opacity: 0.52 } },
      { type: 'segment', from: [0, 0, 0], to: [0, 3, 0], attributes: { color: '#dc2626' } }
    ] })
  },
  three3d_cone: {
    label: '3D: cone',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'cone', center: [0, 1.8, 0], radius: 1.5, height: 3.6, attributes: { color: '#a78bfa', opacity: 0.5 } },
      { type: 'point', position: [0, 3.6, 0], name: 'vertex', attributes: { color: '#111827' } }
    ] })
  },
  three3d_plane_face: {
    label: '3D: plane and triangular face',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'face', points: [[0, 0, 0], [3, 0, 0], [1, 3, 2]], attributes: { color: '#34d399', opacity: 0.45 } },
      { type: 'point', position: [1, 3, 2], name: 'P', attributes: { color: '#111827' } }
    ] })
  },
  calculus_trigonometric: {
    label: 'Calculus: sine and cosine',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 3, 7, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: '2*sin(x)', range: [0, 6.283185307179586], attributes: { strokeColor: '#2563eb' } },
      { type: 'functiongraph', expression: '2*cos(x)', range: [0, 6.283185307179586], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'text', position: [3.8, 2.5], text: '2 sin x   and   2 cos x' }
    ] })
  },
  calculus_exponential_log: {
    label: 'Calculus: exponential and logarithm',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 5, 5, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: 'exp(x)', range: [-2, 1.6], attributes: { strokeColor: '#2563eb' } },
      { type: 'functiongraph', expression: 'log(x)', range: [0.08, 4.5], attributes: { strokeColor: '#059669' } },
      { type: 'line', y: 0, attributes: { strokeColor: '#111827' } },
      { type: 'text', position: [1.7, 4.2], text: 'eˣ and ln x' }
    ] })
  },
  calculus_rational_asymptote: {
    label: 'Calculus: rational function and asymptotes',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-5, 5, 5, -5], grid: true }, objects: [
      { type: 'functiongraph', expression: '1/(x-1)+1', range: [-5, 0.92], attributes: { strokeColor: '#2563eb' } },
      { type: 'functiongraph', expression: '1/(x-1)+1', range: [1.08, 5], attributes: { strokeColor: '#2563eb' } },
      { type: 'line', x: 1, attributes: { strokeColor: '#64748b', dash: 2 } },
      { type: 'line', y: 1, attributes: { strokeColor: '#64748b', dash: 2 } }
    ] })
  },
  calculus_limit_hole: {
    label: 'Calculus: limit with removable hole',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 4, 4, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: 'x+1', range: [-3, 4], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [1, 2], name: '', attributes: { strokeColor: '#2563eb' }, marker: 'open' },
      { type: 'point', coords: [1, -1], name: 'f(1)', attributes: { fillColor: '#dc2626', strokeColor: '#dc2626' } },
      { type: 'text', position: [1.25, 2.25], text: 'limit = 2' }
    ] })
  },
  calculus_derivative_pair: {
    label: 'Calculus: f and f prime',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 5, 4, -4], grid: true }, objects: [
      { type: 'functiongraph', expression: 'x^3/3-x', range: [-2.4, 2.4], attributes: { strokeColor: '#2563eb' } },
      { type: 'functiongraph', expression: 'x^2-1', range: [-2.4, 2.4], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'text', position: [1.6, 3.8], text: 'f(x)' }, { type: 'text', position: [1.7, 1.7], text: "f'(x)" }
    ] })
  },
  calculus_ellipse_parametric: {
    label: 'Calculus: ellipse parametric',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 4, 4, -4], grid: true }, objects: [
      { type: 'parametric', xExpression: '3*cos(t)', yExpression: '2*sin(t)', range: [0, 6.283185307179586], attributes: { strokeColor: '#7c3aed' } },
      { type: 'segment', from: [0, 0], to: [3, 0], attributes: { strokeColor: '#64748b', dash: 2 } }
    ] })
  },
  geometry_unit_circle: {
    label: '2D: unit circle and angle',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-2, 2, 2, -2], grid: true }, objects: [
      { type: 'circle', center: [0, 0], radius: 1, attributes: { strokeColor: '#2563eb' } },
      { type: 'segment', from: [0, 0], to: [0.5, 0.8660254], attributes: { strokeColor: '#dc2626' } },
      { type: 'point', coords: [0.5, 0.8660254], name: '(1/2, √3/2)', attributes: { fillColor: '#111827' } },
      { type: 'text', position: [0.15, 0.32], text: 'π/3' }
    ] })
  },
  geometry_vector_components: {
    label: '2D: vector components',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 5, 6, -1], grid: true }, objects: [
      { type: 'arrow', from: [0, 0], to: [4, 3], attributes: { strokeColor: '#2563eb' } },
      { type: 'segment', from: [4, 0], to: [4, 3], attributes: { strokeColor: '#64748b', dash: 2 } },
      { type: 'segment', from: [0, 0], to: [4, 0], attributes: { strokeColor: '#64748b', dash: 2 } },
      { type: 'text', position: [2, 1.8], text: 'v = ⟨4, 3⟩' }
    ] })
  },
  calculus_absolute_value: {
    label: 'Calculus: absolute value and corners',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 5, 4, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: 'abs(x)-1', range: [-4, 4], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, -1], name: 'corner', attributes: { fillColor: '#111827' } },
      { type: 'text', position: [-3.5, 4.1], text: 'f(x) = |x| - 1' }
    ] })
  },
  calculus_cubic_inflection: {
    label: 'Calculus: cubic and inflection point',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-3, 5, 3, -5], grid: true }, objects: [
      { type: 'functiongraph', expression: 'x^3-x', range: [-2, 2], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, 0], name: 'inflection', attributes: { fillColor: '#dc2626' } },
      { type: 'line', x: 0, attributes: { strokeColor: '#94a3b8', dash: 2 } }
    ] })
  },
  calculus_logistic: {
    label: 'Calculus: logistic growth',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-6, 1.3, 6, -0.3], grid: true }, objects: [
      { type: 'functiongraph', expression: '1/(1+exp(-x))', range: [-6, 6], attributes: { strokeColor: '#2563eb' } },
      { type: 'line', y: 1, attributes: { strokeColor: '#94a3b8', dash: 2 } },
      { type: 'point', coords: [0, 0.5], name: 'P', attributes: { fillColor: '#111827' } }
    ] })
  },
  calculus_inverse_trig: {
    label: 'Calculus: inverse tangent',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-6, 2.4, 6, -2.4], grid: true }, objects: [
      { type: 'functiongraph', expression: 'atan(x)', range: [-6, 6], attributes: { strokeColor: '#2563eb' } },
      { type: 'line', y: 'pi/2', attributes: { strokeColor: '#94a3b8', dash: 2 } },
      { type: 'line', y: '-pi/2', attributes: { strokeColor: '#94a3b8', dash: 2 } }
    ] })
  },
  calculus_discontinuity: {
    label: 'Calculus: jump discontinuity',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 4, 4, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: 'x+1', range: [-4, 0], attributes: { strokeColor: '#2563eb' } },
      { type: 'functiongraph', expression: 'x-1', range: [0, 4], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, 1], name: '', marker: 'open', attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, -1], name: 'f(0)', attributes: { fillColor: '#dc2626', strokeColor: '#dc2626' } }
    ] })
  },
  calculus_cardioid: {
    label: 'Calculus: polar cardioid',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 4, 4, -4], grid: true }, objects: [
      { type: 'polar', rExpression: '1+cos(t)', range: [0, 6.283185307179586], attributes: { strokeColor: '#7c3aed' } },
      { type: 'text', position: [-0.7, 3.4], text: 'r = 1 + cos t' }
    ] })
  },
  calculus_spiral: {
    label: 'Calculus: polar spiral',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-5, 5, 5, -5], grid: true }, objects: [
      { type: 'polar', rExpression: 't/4', range: [0, 12.566370614359172], attributes: { strokeColor: '#0f766e' } },
      { type: 'text', position: [-4.5, 4.2], text: 'r = theta / 4' }
    ] })
  },
  geometry_parabola_focus: {
    label: '2D: parabola with focus and directrix',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 5, 4, -3], grid: true }, objects: [
      { type: 'functiongraph', expression: 'x^2/4', range: [-4, 4], attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, 1], name: 'F', attributes: { fillColor: '#dc2626' } },
      { type: 'line', y: -1, attributes: { strokeColor: '#64748b', dash: 2 } },
      { type: 'text', position: [1.8, -1.3], text: 'directrix' }
    ] })
  },
  geometry_concentric_circles: {
    label: '2D: concentric circles and annulus',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-4, 4, 4, -4], grid: true }, objects: [
      { type: 'circle', center: [0, 0], radius: 3, attributes: { strokeColor: '#2563eb' } },
      { type: 'circle', center: [0, 0], radius: 1.5, attributes: { strokeColor: '#2563eb' } },
      { type: 'point', coords: [0, 0], name: 'O', attributes: { fillColor: '#111827' } }
    ] })
  },
  geometry_triangle_altitude: {
    label: '2D: triangle with altitude',
    build: () => ({ engine: 'jsxgraph', board: { boundingbox: [-1, 5, 7, -1], grid: true }, objects: [
      { type: 'polygon', points: [[0, 0], [6, 0], [2, 4]], attributes: { strokeColor: '#2563eb', fillOpacity: 0 } },
      { type: 'segment', from: [2, 4], to: [2, 0], attributes: { strokeColor: '#dc2626', dash: 2 } },
      { type: 'point', coords: [2, 0], name: 'H', attributes: { fillColor: '#dc2626' } }
    ] })
  },
  three3d_tetrahedron: {
    label: '3D: tetrahedron',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'face', points: [[-1.5, 0, -1], [1.5, 0, -1], [0, 0, 1.7]], attributes: { color: '#94a3b8', opacity: 0.36 } },
      { type: 'face', points: [[-1.5, 0, -1], [1.5, 0, -1], [0, 3, 0]], attributes: { color: '#60a5fa', opacity: 0.44 } },
      { type: 'face', points: [[1.5, 0, -1], [0, 0, 1.7], [0, 3, 0]], attributes: { color: '#60a5fa', opacity: 0.44 } },
      { type: 'face', points: [[0, 0, 1.7], [-1.5, 0, -1], [0, 3, 0]], attributes: { color: '#60a5fa', opacity: 0.44 } }
    ] })
  },
  three3d_two_planes: {
    label: '3D: intersecting planes',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'face', points: [[-3, 0, -3], [3, 0, -3], [3, 0, 3], [-3, 0, 3]], attributes: { color: '#60a5fa', opacity: 0.28 } },
      { type: 'face', points: [[-3, -2, 0], [3, -2, 0], [3, 3, 0], [-3, 3, 0]], attributes: { color: '#f59e0b', opacity: 0.28 } },
      { type: 'line', from: [-3, 0, 0], to: [3, 0, 0], attributes: { color: '#dc2626' } }
    ] })
  },
  three3d_vector: {
    label: '3D: vector and components',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'segment', from: [0, 0, 0], to: [3, 2, 2], attributes: { color: '#2563eb' } },
      { type: 'segment', from: [3, 2, 2], to: [3, 0, 2], attributes: { color: '#64748b', opacity: 0.65 } },
      { type: 'segment', from: [3, 0, 2], to: [3, 0, 0], attributes: { color: '#64748b', opacity: 0.65 } },
      { type: 'point', position: [3, 2, 2], name: 'v = (3, 2, 2)', attributes: { color: '#111827' } }
    ] })
  },
  three3d_sphere: {
    label: '3D: sphere',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'sphere', center: [0, 0, 0], radius: 2, attributes: { color: '#60a5fa', opacity: 0.48 } },
      { type: 'point', position: [0, 2, 0], name: 'r = 2', attributes: { color: '#111827' } }
    ] })
  },
  three3d_square_pyramid: {
    label: '3D: square pyramid',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'face', points: [[-1.5, 0, -1.5], [1.5, 0, -1.5], [1.5, 0, 1.5], [-1.5, 0, 1.5]], attributes: { color: '#94a3b8', opacity: 0.35 } },
      { type: 'face', points: [[-1.5, 0, -1.5], [1.5, 0, -1.5], [0, 3, 0]], attributes: { color: '#a78bfa', opacity: 0.42 } },
      { type: 'face', points: [[1.5, 0, -1.5], [1.5, 0, 1.5], [0, 3, 0]], attributes: { color: '#a78bfa', opacity: 0.42 } },
      { type: 'face', points: [[1.5, 0, 1.5], [-1.5, 0, 1.5], [0, 3, 0]], attributes: { color: '#a78bfa', opacity: 0.42 } },
      { type: 'face', points: [[-1.5, 0, 1.5], [-1.5, 0, -1.5], [0, 3, 0]], attributes: { color: '#a78bfa', opacity: 0.42 } }
    ] })
  },
  three3d_line_and_plane: {
    label: '3D: line and plane',
    build: () => ({ engine: 'three3d', scene: { axes: true, grid: true, axisLength: 4 }, objects: [
      { type: 'face', points: [[-2, 0, -2], [2, 0, -2], [2, 0, 2], [-2, 0, 2]], attributes: { color: '#60a5fa', opacity: 0.3 } },
      { type: 'segment', from: [-2, 3, -1], to: [2, -2, 1], attributes: { color: '#dc2626' } },
      { type: 'point', position: [0.4, 0, 0.2], name: 'intersection', attributes: { color: '#111827' } }
    ] })
  }
};

export function listTemplates() {
  return Object.entries(TEMPLATES).map(([id, template]) => ({ id, label: template.label }));
}

export function createTemplate(id) {
  const template = TEMPLATES[id];
  return template ? template.build() : null;
}
