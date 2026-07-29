import { renderSuperGraphicPayload } from './graphics/graphic-router.js?v=8.37-family-label1';

let initialized = false;
let dataPromise = null;
let data = { places: [], journeys: [], timelines: [] };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function setStatus(message, isError = false) {
  const status = document.getElementById('bibleExploreStatus');
  if (!status) return;
  status.textContent = message || '';
  status.classList.toggle('is-error', isError);
}

function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetch('./content/places.json?v=8.37-family-label1').then(checkResponse),
    fetch('./content/journeys.json?v=8.37-family-label1').then(checkResponse),
    fetch('./content/timelines.json?v=8.37-family-label1').then(checkResponse)
  ]).then(([places, journeys, timelines]) => {
    data = { places, journeys, timelines };
    return data;
  });
  return dataPromise;
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Bible context data could not be loaded (${response.status}).`);
  return response.json();
}

function nearbyPlaces(selected) {
  const lat = Number(selected.lat);
  const lon = Number(selected.lon);
  return data.places.slice().sort((left, right) => {
    if (left.id === selected.id) return -1;
    if (right.id === selected.id) return 1;
    const leftDistance = Math.hypot(Number(left.lat) - lat, Number(left.lon) - lon);
    const rightDistance = Math.hypot(Number(right.lat) - lat, Number(right.lon) - lon);
    return leftDistance - rightDistance;
  }).slice(0, 24);
}

function placeMapPayload(selected, nearby) {
  const latitudes = nearby.map((place) => Number(place.lat));
  const longitudes = nearby.map((place) => Number(place.lon));
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const lonPad = Math.max(0.18, (maxLon - minLon) * 0.16);
  const latPad = Math.max(0.18, (maxLat - minLat) * 0.16);
  const left = minLon - lonPad;
  const right = maxLon + lonPad;
  const top = maxLat + latPad;
  const bottom = minLat - latPad;
  const labelBoxes = [];
  return {
    schemaVersion: '1.1',
    engine: 'jsxgraph',
    type: 'bible.map.places',
    board: { boundingbox: [left, top, right, bottom], axis: true, grid: true, square: true },
    objects: nearby.map((place, index) => {
      const isSelected = place.id === selected.id;
      const angle = (Math.PI * 2 * index / Math.max(1, nearby.length)) - Math.PI / 2;
      const ring = index % 3;
      const offsetDistance = isSelected ? 16 : Math.round((25 + ring * 17) * 1.716);
      const offsetX = Math.round(Math.cos(angle) * offsetDistance);
      const offsetY = Math.round(Math.sin(angle) * offsetDistance);
      const anchorX = ((Number(place.lon) - left) / Math.max(0.0001, right - left)) * 700 + offsetX;
      const anchorY = ((top - Number(place.lat)) / Math.max(0.0001, top - bottom)) * 700 - offsetY;
      const labelWidth = Math.max(32, String(place.name || '').length * 7.4);
      const labelBox = { left: anchorX - 3, right: anchorX + labelWidth, top: anchorY - 10, bottom: anchorY + 10 };
      const collides = !isSelected && labelBoxes.some((box) =>
        labelBox.left < box.right && labelBox.right > box.left &&
        labelBox.top < box.bottom && labelBox.bottom > box.top
      );
      if (!collides) labelBoxes.push(labelBox);
      return {
        id: `place_${index}`,
        type: 'point',
        coords: [Number(place.lon), Number(place.lat)],
        name: collides ? '' : place.name,
        attributes: {
          size: isSelected ? 5 : 2.5,
          strokeColor: isSelected ? '#991b1b' : '#1d4ed8',
          fillColor: isSelected ? '#f87171' : '#fbbf24',
          label: {
            offset: [
              offsetX,
              offsetY
            ],
            fontSize: isSelected ? 15 : 12,
            color: isSelected ? '#991b1b' : '#172033'
          }
        }
      };
    })
  };
}

function renderPlaceDetail(place) {
  const host = document.getElementById('biblePlaceDetail');
  if (!host || !place) return;
  const nearby = nearbyPlaces(place);
  host.innerHTML = `<article class="bible-place-card">
    <h3>${escapeHtml(place.name)}</h3>
    <div class="bible-person-meta">
      ${place.type ? `<span class="bible-person-chip">${escapeHtml(place.type)}</span>` : ''}
      <span class="bible-person-chip">${escapeHtml(place.lat)}, ${escapeHtml(place.lon)}</span>
      ${place.source ? `<span class="bible-person-chip">${escapeHtml(place.source)}</span>` : ''}
    </div>
    <p>${escapeHtml(place.description || 'No source description is available.')}</p>
    <div class="bible-place-map">${renderSuperGraphicPayload(placeMapPayload(place, nearby))}</div>
    <section class="bible-person-section"><h4>Nearby places</h4>
      <div class="bible-person-meta">${nearby.filter((item) => item.id !== place.id).map((item) =>
        `<button type="button" class="bible-nearby-place" data-nearby-place-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`
      ).join('')}</div>
    </section>
  </article>`;
  document.querySelectorAll('[data-bible-place-id]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.biblePlaceId === place.id);
  });
  host.querySelectorAll('[data-nearby-place-id]').forEach((button) => {
    button.addEventListener('click', () => {
      renderPlaceDetail(data.places.find((item) => item.id === button.dataset.nearbyPlaceId));
    });
  });
}

function renderPlaceResults(query = '') {
  const results = document.getElementById('biblePlaceResults');
  if (!results) return;
  const needle = String(query).trim().toLowerCase();
  const places = data.places.filter((place) => {
    if (!needle) return true;
    const aliases = Array.isArray(place.aliases) ? place.aliases.join(' ') : '';
    return `${place.name} ${place.name_ko || ''} ${aliases}`.toLowerCase().includes(needle);
  }).slice(0, 60);
  results.innerHTML = places.map((place) =>
    `<button type="button" class="bible-person-result" data-bible-place-id="${escapeHtml(place.id)}">
      <strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(place.type || 'Bible place')}</span>
    </button>`
  ).join('') || '<div class="bible-people-empty"><strong>No places found</strong></div>';
  results.querySelectorAll('[data-bible-place-id]').forEach((button) => {
    button.addEventListener('click', () => {
      renderPlaceDetail(data.places.find((place) => place.id === button.dataset.biblePlaceId));
    });
  });
  setStatus(`${places.length} place${places.length === 1 ? '' : 's'} shown.`);
  if (places.length && !document.querySelector('.bible-place-card')) renderPlaceDetail(places[0]);
}

function renderJourney(index = 0) {
  const output = document.getElementById('bibleJourneyOutput');
  const journeyIndex = Number(index) || 0;
  const journey = data.journeys[journeyIndex];
  if (!output || !journey) return;
  const graphic = structuredClone(journey.graphic);
  if (journeyIndex === 0 && Array.isArray(graphic?.board?.boundingbox) && graphic.board.boundingbox.length === 4) {
    const [left, top, right, bottom] = graphic.board.boundingbox.map(Number);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const zoomScale = 0.8;
    graphic.board.boundingbox = [
      centerX + (left - centerX) * zoomScale,
      centerY + (top - centerY) * zoomScale,
      centerX + (right - centerX) * zoomScale,
      centerY + (bottom - centerY) * zoomScale
    ];
  }
  output.innerHTML = `<h3>${escapeHtml(journey.title_en || journey.journey_id)}</h3>
    <p class="bible-reference-more">Source-provided coordinate route. Modern political boundaries are not implied.</p>
    ${renderSuperGraphicPayload(graphic)}`;
  setStatus('Journey route loaded.');
}

function renderTimeline(index = 0) {
  const output = document.getElementById('bibleTimelineOutput');
  const timeline = data.timelines[Number(index) || 0];
  if (!output) return;
  if (!timeline) {
    output.innerHTML = '<div class="bible-people-empty"><strong>Loading timeline...</strong></div>';
    return;
  }
  output.innerHTML = renderSuperGraphicPayload(timeline.graphic);
  setStatus(`${timeline.event_count} events loaded in Scripture order.`);
}

function populate() {
  const journeySelector = document.getElementById('bibleJourneySelector');
  const timelineSelector = document.getElementById('bibleTimelineSelector');
  journeySelector.innerHTML = data.journeys.map((journey, index) =>
    `<option value="${index}">${escapeHtml(journey.title_en || journey.journey_id)}</option>`
  ).join('');
  timelineSelector.innerHTML = data.timelines.map((timeline, index) =>
    `<option value="${index}">${escapeHtml(timeline.book_code.replace(/^(OT|NT)-/, ''))} (${timeline.event_count} events)</option>`
  ).join('');
  const activeTab = document.querySelector('[data-bible-explore-tab].is-active')?.dataset.bibleExploreTab || 'places';
  if (activeTab === 'places') renderPlaceResults();
  if (activeTab === 'journeys') requestAnimationFrame(() => renderJourney(journeySelector.value));
  if (activeTab === 'timeline') requestAnimationFrame(() => renderTimeline(timelineSelector.value));
}

function open() {
  const panel = document.getElementById('bibleExplorePanel');
  const toggle = document.getElementById('bibleExploreToggle');
  panel.hidden = false;
  document.body.classList.add('bible-people-open');
  toggle.setAttribute('aria-expanded', 'true');
  setStatus('Loading 1,274 places, journeys, and timelines...');
  loadData().then(populate).catch((error) => setStatus(error.message, true));
}

function close() {
  document.getElementById('bibleExplorePanel').hidden = true;
  document.getElementById('bibleExploreToggle').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('bible-people-open');
}

function init() {
  if (initialized) return;
  const toggle = document.getElementById('bibleExploreToggle');
  const panel = document.getElementById('bibleExplorePanel');
  const closeButton = document.getElementById('bibleExploreClose');
  if (!toggle || !panel || !closeButton) return;
  initialized = true;
  toggle.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  panel.addEventListener('click', (event) => { if (event.target === panel) close(); });
  document.querySelectorAll('[data-bible-explore-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-bible-explore-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-bible-explore-view]').forEach((view) => {
        view.classList.toggle('is-active', view.dataset.bibleExploreView === button.dataset.bibleExploreTab);
      });
      const selectedTab = button.dataset.bibleExploreTab;
      if (selectedTab === 'journeys') document.getElementById('bibleJourneyOutput').innerHTML = '<div class="bible-people-empty"><strong>Loading journey...</strong></div>';
      if (selectedTab === 'timeline') document.getElementById('bibleTimelineOutput').innerHTML = '<div class="bible-people-empty"><strong>Loading timeline...</strong></div>';
      loadData().then(() => requestAnimationFrame(() => {
        if (selectedTab === 'places') renderPlaceResults(document.getElementById('biblePlaceSearch').value);
        if (selectedTab === 'journeys') renderJourney(document.getElementById('bibleJourneySelector').value);
        if (selectedTab === 'timeline') renderTimeline(document.getElementById('bibleTimelineSelector').value);
      })).catch((error) => setStatus(error.message, true));
    });
  });
  document.getElementById('biblePlaceSearch').addEventListener('input', (event) => renderPlaceResults(event.target.value));
  document.getElementById('bibleJourneySelector').addEventListener('change', (event) => renderJourney(event.target.value));
  document.getElementById('bibleTimelineSelector').addEventListener('change', (event) => renderTimeline(event.target.value));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
