// Ready-to-edit, official Chart.js-shaped templates.  Change labels, data,
// ranges, and colours; keep the outer engine/config structure unchanged.
const TEMPLATES = {
  chart_bar_basic: { label: 'Chart: basic bar', category: 'Chart.js', result: 'One series bar chart', json: { engine:'chart', height:360, config:{ type:'bar', data:{ labels:['A','B','C','D'], datasets:[{ label:'Value', data:[12,19,8,15], backgroundColor:'#2563eb' }] }, options:{ scales:{ y:{ beginAtZero:true } } } } } },
  chart_bar_grouped: { label: 'Chart: grouped bars', category: 'Chart.js', result: 'Two series comparison bars', json: { engine:'chart', height:360, config:{ type:'bar', data:{ labels:['Jan','Feb','Mar'], datasets:[{ label:'Group A', data:[12,19,15], backgroundColor:'#2563eb' },{ label:'Group B', data:[9,14,18], backgroundColor:'#f59e0b' }] }, options:{ scales:{ y:{ beginAtZero:true } } } } } },
  chart_bar_stacked: { label: 'Chart: stacked bars', category: 'Chart.js', result: 'Stacked category totals', json: { engine:'chart', height:360, config:{ type:'bar', data:{ labels:['A','B','C'], datasets:[{ label:'Part 1', data:[8,12,10], backgroundColor:'#2563eb' },{ label:'Part 2', data:[5,7,9], backgroundColor:'#16a34a' }] }, options:{ scales:{ x:{ stacked:true }, y:{ stacked:true, beginAtZero:true } } } } } },
  chart_bar_horizontal: { label: 'Chart: horizontal bars', category: 'Chart.js', result: 'Horizontal category comparison', json: { engine:'chart', height:360, config:{ type:'bar', data:{ labels:['A','B','C','D'], datasets:[{ label:'Value', data:[12,19,8,15], backgroundColor:'#7c3aed' }] }, options:{ indexAxis:'y', scales:{ x:{ beginAtZero:true } } } } } },
  chart_line_basic: { label: 'Chart: line graph', category: 'Chart.js', result: 'Single line trend', json: { engine:'chart', height:360, config:{ type:'line', data:{ labels:['1','2','3','4','5'], datasets:[{ label:'f(x)', data:[2,5,3,7,6], borderColor:'#2563eb', backgroundColor:'#2563eb', tension:0, fill:false }] }, options:{ scales:{ y:{ beginAtZero:true } } } } } },
  chart_line_multi: { label: 'Chart: multiple lines', category: 'Chart.js', result: 'Two line comparison', json: { engine:'chart', height:360, config:{ type:'line', data:{ labels:['1','2','3','4'], datasets:[{ label:'A', data:[2,5,4,8], borderColor:'#2563eb', tension:0 },{ label:'B', data:[6,3,7,5], borderColor:'#dc2626', tension:0 }] }, options:{ scales:{ y:{ beginAtZero:true } } } } } },
  chart_scatter: { label: 'Chart: scatter plot', category: 'Chart.js', result: 'Unconnected x-y data points', json: { engine:'chart', height:360, config:{ type:'scatter', data:{ datasets:[{ label:'Data', data:[{x:1,y:4},{x:3,y:9},{x:6,y:12}], backgroundColor:'#2563eb', pointRadius:5 }] }, options:{ scales:{ x:{ type:'linear', min:0, max:8 }, y:{ min:0, max:14 } } } } } },
  chart_pie: { label: 'Chart: pie chart', category: 'Chart.js', result: 'Part-to-whole sectors', json: { engine:'chart', height:360, config:{ type:'pie', data:{ labels:['A','B','C'], datasets:[{ data:[30,45,25], backgroundColor:['#2563eb','#16a34a','#f59e0b'] }] }, options:{} } } },
  chart_doughnut: { label: 'Chart: doughnut chart', category: 'Chart.js', result: 'Part-to-whole ring', json: { engine:'chart', height:360, config:{ type:'doughnut', data:{ labels:['A','B','C','D'], datasets:[{ data:[28,35,20,17], backgroundColor:['#2563eb','#16a34a','#f59e0b','#dc2626'] }] }, options:{} } } }
};

export function listChartTemplates() {
  return Object.entries(TEMPLATES).map(([id, template]) => ({ id, label:template.label, category:template.category, result:template.result }));
}

export function createChartTemplate(id) {
  const template = TEMPLATES[id];
  return template ? JSON.parse(JSON.stringify(template.json)) : null;
}
