import { renderSuperGraphicPayload } from './graphics/graphic-router.js?v=8.27-atlas1';

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
    fetch('./content/places.json?v=8.27-atlas1').then(checkResponse),
    fetch('./content/journeys.json?v=8.27-atlas1').then(checkResponse),
    fetch('./content/timelines.json?v=8.27-atlas1').then(checkResponse)
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

function placeMapPayload(selected) {
  const lat = Number(selected.lat);
  const lon = Number(selected.lon);
  const nearby = data.places.filter((place) =>
    Math.abs(Number(place.lat) - lat) <= 3.5 &&
    Math.abs(Number(place.lon) - lon) <= 4.5
  ).sort((left, right) => {
    const leftDistance = Math.abs(Number(left.lat) - lat) + Math.abs(Number(left.lon) - lon);
    const rightDistance = Math.abs(Number(right.lat) - lat) + Math.abs(Number(right.lon) - lon);
    return leftDistance - rightDistance;
  }).slice(0, 36);

  return {
    schemaVersion: '1.1',
    engine: 'jsxgraph',
    type: 'bible.map.places',
    board: { boundingbox: [lon - 4.7, lat + 3.7, lon + 4.7, lat - 3.7], axis: true, grid: true },
    objects: nearby.map((place, index) => {
      const isSelected = place.id === selected.id;
      return {
        id: `place_${index}`,
        type: 'point',
        coords: [Number(place.lon), Number(place.lat)],
        name: place.name,
        attributes: {
          size: isSelected ? 5 : 2.5,
          strokeColor: isSelected ? '#991b1b' : '#1d4ed8',
          fillColor: isSelected ? '#f87171' : '#fbbf24'
        }
      };
    })
  };
}

function renderPlaceDetail(place) {
  const host = document.getElementById('biblePlaceDetail');
  if (!host || !place) return;
  host.innerHTML = `<article class="bible-place-card">
    <h3>${escapeHtml(place.name)}</h3>
    <div class="bible-person-meta">
      ${place.type ? `<span class="bible-person-chip">${escapeHtml(place.type)}</span>` : ''}
      <span class="bible-person-chip">${escapeHtml(place.lat)}, ${escapeHtml(place.lon)}</span>
      ${place.source ? `<span class="bible-person-chip">${escapeHtml(place.source)}</span>` : ''}
    </div>
    <p>${escapeHtml(place.description || 'No source description is available.')}</p>
    <div class="bible-place-map">${renderSuperGraphicPayload(placeMapPayload(place))}</div>
  </article>`;
  document.querySelectorAll('[data-bible-place-id]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.biblePlaceId === place.id);
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
  const journey = data.journeys[Number(index) || 0];
  if (!output || !journey) return;
  output.innerHTML = `<h3>${escapeHtml(journey.title_en || journey.journey_id)}</h3>
    <p class="bible-reference-more">Source-provided coordinate route. Modern political boundaries are not implied.</p>
    ${renderSuperGraphicPayload(journey.graphic)}`;
  setStatus('Journey route loaded.');
}

function renderTimeline(index = 0) {
  const output = document.getElementById('bibleTimelineOutput');
  const timeline = data.timelines[Number(index) || 0];
  if (!output || !timeline) return;
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
  renderPlaceResults();
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
      if (button.dataset.bibleExploreTab === 'journeys' && !document.getElementById('bibleJourneyOutput').innerHTML) renderJourney();
      if (button.dataset.bibleExploreTab === 'timeline' && !document.getElementById('bibleTimelineOutput').innerHTML) renderTimeline();
    });
  });
  document.getElementById('biblePlaceSearch').addEventListener('input', (event) => renderPlaceResults(event.target.value));
  document.getElementById('bibleJourneySelector').addEventListener('change', (event) => renderJourney(event.target.value));
  document.getElementById('bibleTimelineSelector').addEventListener('change', (event) => renderTimeline(event.target.value));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
