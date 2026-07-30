import { VectorMap25D } from './graphics/map25d/vector-map25d.js?v=8.47-geography1';
import { VectorScene25D, sceneFromGraphicObjects } from './graphics/map25d/vector-scene25d.js?v=8.44-map25d-all1';

let initialized = false;
let dataPromise = null;
let data = {
  places: [],
  journeys: [],
  timelines: [],
  map25dPlaces: [],
  ancientRoads: [],
  geography: []
};
let activePlaceMap = null;
let activeJourneyScene = null;
let activeTimelineScene = null;

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
    fetch('./content/places.json?v=8.38-family-roles1').then(checkResponse),
    fetch('./content/journeys.json?v=8.42-estimated-journeys1').then(checkResponse),
    fetch('./content/timelines.json?v=8.38-family-roles1').then(checkResponse),
    fetch('./content/bible-map25d.json?v=8.43-map25d-live1').then(checkResponse),
    fetch('./content/ancient-roads25d.json?v=8.45-context-update1').then(checkResponse),
    fetch('./content/bible-geography25d.json?v=8.47-geography1').then(checkResponse)
  ]).then(([places, journeys, timelines, map25d, ancientRoads, geography]) => {
    data = {
      places,
      journeys,
      timelines,
      map25dPlaces: map25d.places || [],
      ancientRoads: ancientRoads.roads || [],
      geography: geography.features || []
    };
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
  if (activePlaceMap) {
    activePlaceMap.destroy();
    activePlaceMap = null;
  }
  const nearby = nearbyPlaces(place);
  host.innerHTML = `<article class="bible-place-card">
    <h3>${escapeHtml(place.name)}</h3>
    <div class="bible-person-meta">
      ${place.type ? `<span class="bible-person-chip">${escapeHtml(place.type)}</span>` : ''}
      <span class="bible-person-chip">${escapeHtml(place.lat)}, ${escapeHtml(place.lon)}</span>
      ${place.source ? `<span class="bible-person-chip">${escapeHtml(place.source)}</span>` : ''}
    </div>
    <p>${escapeHtml(place.description || 'No source description is available.')}</p>
    <div class="bible-place-map bible-place-map25d">
      <div class="bible-map25d-toolbar">
        <strong>2.5D Vector Bible Map</strong>
        <span>Wheel to zoom · Drag to move · Select a point</span>
        <button type="button" data-map25d-fit>Fit all</button>
      </div>
      <div class="bible-map25d-host" data-map25d-host></div>
      <div class="bible-map25d-status" data-map25d-status></div>
    </div>
    <section class="bible-person-section"><h4>Nearby places</h4>
      <div class="bible-person-meta">${nearby.filter((item) => item.id !== place.id).map((item) =>
        `<button type="button" class="bible-nearby-place" data-nearby-place-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`
      ).join('')}</div>
    </section>
  </article>`;
  const mapHost = host.querySelector('[data-map25d-host]');
  const mapStatus = host.querySelector('[data-map25d-status]');
  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+\d+$/, '');
  const selectedName = normalizeName(place.name);
  const selectedLat = Number(place.lat);
  const selectedLon = Number(place.lon);
  const vectorPlace = data.map25dPlaces.find((item) => normalizeName(item.name) === selectedName) ||
    data.map25dPlaces.slice().sort((left, right) => {
      const leftDistance = Math.hypot(Number(left.latitude) - selectedLat, Number(left.longitude) - selectedLon);
      const rightDistance = Math.hypot(Number(right.latitude) - selectedLat, Number(right.longitude) - selectedLon);
      return leftDistance - rightDistance;
    })[0];
  if (mapHost && data.map25dPlaces.length) {
    activePlaceMap = new VectorMap25D(mapHost, {
      minimumZoom: 1,
      maximumZoom: 12,
      labelFontSize: 12,
      pointRadius: 3
    });
    activePlaceMap.setPlaces(data.map25dPlaces);
    activePlaceMap.setGeography(data.geography);
    activePlaceMap.setRoads(data.ancientRoads);
    if (vectorPlace) activePlaceMap.focusOnPlace(vectorPlace.id, 7);
    mapHost.addEventListener('map25d:render', (event) => {
      if (!mapStatus) return;
      mapStatus.textContent = `Zoom ${event.detail.zoom.toFixed(2)} · ${event.detail.visiblePlaces} places · ${event.detail.visibleLabels} labels · ${event.detail.visibleRoads || 0} ancient roads`;
    });
    mapHost.addEventListener('map25d:select', (event) => {
      if (!mapStatus) return;
      const selected = event.detail.place;
      mapStatus.textContent = `${selected.name} · ${selected.verse_reference_count || 0} verse references · ${selected.candidate_count || 0} location candidate(s)`;
    });
    host.querySelector('[data-map25d-fit]')?.addEventListener('click', () => {
      activePlaceMap.fitToData();
      activePlaceMap.scheduleRender();
    });
  } else if (mapStatus) {
    mapStatus.textContent = 'Vector map data is unavailable.';
  }
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
  if (activeJourneyScene) activeJourneyScene.destroy();
  output.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = journey.title_en || journey.journey_id;
  const note = document.createElement('p');
  note.className = 'bible-reference-more';
  note.textContent = journey.status === 'estimated'
    ? 'Estimated Route — reconstructed from source events, Bible references, and source-provided place coordinates.'
    : 'Source-provided coordinate route. Modern political boundaries are not implied.';
  const sceneHost = document.createElement('div');
  sceneHost.className = 'vector-scene25d-host bible-journey-25d';
  output.append(title, note, sceneHost);
  activeJourneyScene = new VectorScene25D(sceneHost, {
    ariaLabel: 'Interactive Bible journey',
    labelFontSize: 12
  });
  activeJourneyScene.setScene(sceneFromGraphicObjects(journey.graphic));
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
  if (activeTimelineScene) activeTimelineScene.destroy();
  const rows = Array.isArray(timeline.graphic?.rows) ? timeline.graphic.rows : [];
  const nodes = rows.map((row, rowIndex) => ({
    id: `event_${rowIndex}`,
    x: rowIndex,
    y: rowIndex % 2 ? -1 : 1,
    label: `${row[0]}. ${row[1]}`,
    color: rowIndex % 2 ? '#fbbf24' : '#60a5fa',
    stroke: '#1e3a8a',
    radius: 4,
    priority: rows.length - rowIndex,
    metadata: { reference: row[2], date: row[3] }
  }));
  output.innerHTML = `<h3>${escapeHtml(timeline.graphic?.title || timeline.book_code)}</h3>
    <p class="bible-reference-more">${escapeHtml(timeline.graphic?.caption || '')}</p>
    <div class="vector-scene25d-host bible-timeline-25d"></div>
    <div class="bible-timeline-selection">Select an event point to view its reference and source date.</div>`;
  const timelineHost = output.querySelector('.bible-timeline-25d');
  activeTimelineScene = new VectorScene25D(timelineHost, {
    ariaLabel: 'Interactive Bible timeline',
    labelFontSize: 11
  });
  activeTimelineScene.setScene({
    nodes,
    edges: nodes.length > 1 ? [{
      id: 'timeline',
      points: nodes.map((node) => [node.x, 0]),
      color: '#64748b',
      width: 2
    }] : [],
    texts: []
  });
  timelineHost.addEventListener('scene25d:select', (event) => {
    const node = event.detail.node;
    output.querySelector('.bible-timeline-selection').textContent =
      `${node.label} · ${node.metadata.reference || 'No reference'} · ${node.metadata.date || 'No source date'}`;
  });
  setStatus(`${timeline.event_count} events loaded in Scripture order.`);
}

function populate() {
  const journeySelector = document.getElementById('bibleJourneySelector');
  const timelineSelector = document.getElementById('bibleTimelineSelector');
  const selectedJourney = journeySelector.value;
  journeySelector.innerHTML = data.journeys.map((journey, index) =>
    `<option value="${index}">${escapeHtml(journey.title_en || journey.journey_id)}</option>`
  ).join('');
  if (selectedJourney !== '' &&
      Number.isInteger(Number(selectedJourney)) &&
      Number(selectedJourney) >= 0 &&
      Number(selectedJourney) < data.journeys.length) {
    journeySelector.value = selectedJourney;
  } else {
    journeySelector.value = '0';
  }
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
