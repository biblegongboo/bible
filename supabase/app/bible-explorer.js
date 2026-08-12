import { VectorMap25D } from './graphics/map25d/vector-map25d.js?v=9.06-map-place-hit-targets1';
import { VectorScene25D, sceneFromGraphicObjects } from './graphics/map25d/vector-scene25d.js?v=9.20-stable-pointer-selection1';

let initialized = false;
let dataPromise = null;
let data = {
  places: [],
  journeys: [],
  timelines: [],
  map25dPlaces: [],
  ancientRoads: [],
  geography: [],
  contextLinks: {},
  peopleIndex: {},
  patristic: [],
  patristicReaders: {}
};
let activePlaceMap = null;
let activeJourneyScene = null;
let activeTimelineScene = null;
const patristicReaderCache = new Map();
const knowledgeCache = new Map();
const libraryCache = new Map();
let librarySection = 'verse';
let librarySourceCode = '';
let sermonIndexPromise = null;
let sermonSelectedSource = '';
let sermonPage = 1;
const SERMON_PAGE_SIZE = 30;
const searchRenderVersions = {};

function beginSearchRender(name) {
  searchRenderVersions[name] = (searchRenderVersions[name] || 0) + 1;
  return searchRenderVersions[name];
}

function isCurrentSearchRender(name, version) {
  return searchRenderVersions[name] === version;
}

const bibleReferenceNavigation = window.BibleReferenceNavigation || (() => {
  const entries = [];
  let index = -1;
  let replaying = false;
  const update = () => {
    ['biblePeopleBack', 'bibleExploreBack'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = index <= 0;
    });
    ['biblePeopleForward', 'bibleExploreForward'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = index < 0 || index >= entries.length - 1;
    });
  };
  const apply = async (state) => {
    if (!state) return;
    replaying = true;
    try {
      if (state.kind === 'person' && typeof window.openBiblePerson === 'function') {
        document.getElementById('bibleExplorePanel')?.setAttribute('hidden', '');
        await window.openBiblePerson(state.personId, { skipHistory: true });
      } else if (state.kind === 'context' && typeof window.openBibleContext === 'function') {
        document.getElementById('biblePeoplePanel')?.setAttribute('hidden', '');
        await window.openBibleContext(state.options || { tab: 'places' }, { skipHistory: true });
      }
    } finally {
      replaying = false;
      update();
    }
  };
  return {
    push(state) {
      if (replaying || !state) return;
      const serialized = JSON.stringify(state);
      if (index >= 0 && JSON.stringify(entries[index]) === serialized) {
        update();
        return;
      }
      entries.splice(index + 1);
      entries.push(state);
      index = entries.length - 1;
      update();
    },
    back() {
      if (index <= 0) return;
      index -= 1;
      apply(entries[index]);
    },
    forward() {
      if (index >= entries.length - 1) return;
      index += 1;
      apply(entries[index]);
    },
    update
  };
})();
window.BibleReferenceNavigation = bibleReferenceNavigation;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

// Every visible search box uses the same predictable behavior: entering "S"
// immediately lists entries whose displayed name starts with S.  Secondary
// fields (aliases, authors, IDs) remain searchable, but always appear after
// direct name/title matches so the result list does not look unrelated.
function normalizedSearch(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

// Map and journey sources do not always use the exact same displayed form as
// the Atlas directory (for example a numeric duplicate suffix or a parenthetic
// qualifier). Resolve the visible label once, consistently, before navigating.
function findPlaceForVisibleLabel(label) {
  const target = normalizedSearch(label)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+\d+$/, '')
    .trim();
  if (!target) return null;
  const candidates = data.places.map((place) => ({
    place,
    name: normalizedSearch(place.name)
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s+\d+$/, '')
      .trim()
  }));
  return candidates.find(({ name }) => name === target)?.place ||
    candidates.find(({ name }) => name.startsWith(target) || target.startsWith(name))?.place ||
    candidates.find(({ name }) => name.includes(target) || target.includes(name))?.place || null;
}

function startsWithSearch(value, needle) {
  if (Array.isArray(value)) return value.some((item) => startsWithSearch(item, needle));
  return normalizedSearch(value).startsWith(needle);
}

function prefixSearch(records, query, primaryFields, secondaryFields = []) {
  const needle = normalizedSearch(query);
  if (!needle) return records.slice();
  const primaryMatches = [];
  const secondaryMatches = [];
  records.forEach((record) => {
    const matches = (fields) => fields.some((field) =>
      startsWithSearch(typeof field === 'function' ? field(record) : record?.[field], needle));
    if (matches(primaryFields)) primaryMatches.push(record);
    else if (matches(secondaryFields)) secondaryMatches.push(record);
  });
  return primaryMatches.concat(secondaryMatches);
}

function setStatus(message, isError = false) {
  const status = document.getElementById('bibleExploreStatus');
  if (!status) return;
  status.textContent = message || '';
  status.classList.toggle('is-error', isError);
}

function fetchContent(relativePath, signal) {
  const normalizedPath = String(relativePath || '')
    .replace(/^\.?\//, '')
    .replace(/^content\//, '');
  if (window.BibleSupabaseProvider &&
      typeof window.BibleSupabaseProvider.fetchContent === 'function') {
    return window.BibleSupabaseProvider.fetchContent(`content/${normalizedPath}`, signal);
  }
  return fetch(`./content/${normalizedPath}`, { signal });
}

function fetchStorage(relativePath, signal) {
  const normalizedPath = String(relativePath || '').replace(/^\.?\//, '');
  if (window.BibleSupabaseProvider &&
      typeof window.BibleSupabaseProvider.fetchContent === 'function') {
    return window.BibleSupabaseProvider.fetchContent(normalizedPath, signal);
  }
  return fetch(`./${normalizedPath}`, { signal });
}

async function loadStorageJson(relativePath) {
  const cacheKey = `json:${relativePath}`;
  if (!libraryCache.has(cacheKey)) {
    libraryCache.set(cacheKey, fetchStorage(relativePath).then(checkResponse));
  }
  return libraryCache.get(cacheKey);
}

async function loadStorageJsonlGzip(relativePath) {
  const cacheKey = `jsonl:${relativePath}`;
  if (!libraryCache.has(cacheKey)) {
    libraryCache.set(cacheKey, (async () => {
      const response = await fetchStorage(relativePath);
      if (!response.ok) throw new Error(`Library data could not be loaded (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let text;
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream !== 'function') {
          throw new Error('This browser cannot open compressed library data.');
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        text = await new Response(stream).text();
      } else {
        text = new TextDecoder().decode(bytes);
      }
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    })());
  }
  return libraryCache.get(cacheKey);
}

function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetchContent('places.json').then(checkResponse),
    fetchContent('journeys.json').then(checkResponse),
    fetchContent('timelines.json').then(checkResponse),
    fetchContent('bible-map25d.json').then(checkResponse),
    fetchContent('ancient-roads25d.json').then(checkResponse),
    fetchContent('bible-geography25d.json').then(checkResponse),
    fetchContent('bible-context-links.json').then(checkResponse),
    fetchContent('people-index.json').then(checkResponse),
    fetchContent('patristic-deep-index.json').then(checkResponse),
    fetchContent('patristic-reader-manifest.json').then(checkResponse)
  ]).then(([places, journeys, timelines, map25d, ancientRoads, geography, contextLinks, peopleIndex, patristic, patristicReaders]) => {
    data = {
      places,
      journeys,
      timelines,
      map25dPlaces: map25d.places || [],
      ancientRoads: ancientRoads.roads || [],
      geography: geography.features || [],
      contextLinks: contextLinks || {},
      peopleIndex: peopleIndex || {},
      patristic: (patristic.records || []).filter((record) => record.public_allowed),
      patristicReaders: Object.fromEntries((patristicReaders.records || [])
        .map((record) => [record.reader_key, record]))
    };
    return data;
  });
  return dataPromise;
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Bible context data could not be loaded (${response.status}).`);
  return response.json();
}

function loadKnowledge(relativePath) {
  if (!knowledgeCache.has(relativePath)) {
    knowledgeCache.set(relativePath,
      fetchContent(`knowledge/${relativePath}`).then(checkResponse));
  }
  return knowledgeCache.get(relativePath);
}

function knowledgeEmpty(title, text = '') {
  return `<div class="bible-people-empty"><strong>${escapeHtml(title)}</strong>
    ${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
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
  const relatedEvents = Object.values(data.contextLinks.events || {})
    .filter((event) => (event.place_ids || []).includes(place.id));
  const relatedPersonIds = [...new Set([
    ...Object.entries(data.contextLinks.person_contexts || {})
      .filter(([, context]) => (context.place_ids || []).includes(place.id))
      .map(([personId]) => personId),
    ...relatedEvents.flatMap((event) => event.participant_ids || [])
  ])];
  const relatedPeople = relatedPersonIds.map((personId) => ({
    id: personId,
    name: data.peopleIndex[personId]?.name ||
      personId.replace(/^PER-(THEO-)?/, '').replace(/-\d+(?:-\d+)?$/, '').replaceAll('-', ' ')
  }));
  host.innerHTML = `<article class="bible-place-card">
    <h3>${escapeHtml(place.name)}</h3>
    <div class="bible-person-meta">
      ${place.type ? `<span class="bible-person-chip">${escapeHtml(place.type)}</span>` : ''}
      <span class="bible-person-chip">${escapeHtml(place.lat)}, ${escapeHtml(place.lon)}</span>
      ${place.source ? `<span class="bible-person-chip">${escapeHtml(place.source)}</span>` : ''}
    </div>
    <p>${escapeHtml(place.description || 'No source description is available.')}</p>
    <section class="bible-modern-context" data-modern-place-context>
      ${knowledgeEmpty('Loading ancient and modern location context...')}
    </section>
    <section class="bible-person-section"><h4>Related people</h4>
      <div class="bible-person-meta">${relatedPeople.length
        ? relatedPeople.map((person) =>
          `<button type="button" class="bible-person-chip" data-related-person-id="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>`
        ).join('')
        : '<span class="bible-context-empty">No source-linked people are recorded for this place.</span>'}</div>
    </section>
    <section class="bible-person-section"><h4>Related events</h4>
      <div class="bible-context-list">${relatedEvents.length
        ? relatedEvents.map((event) =>
          `<button type="button" class="bible-context-item" data-related-event-reference="${escapeHtml((event.source_codes || [])[0] || '')}">
            <strong>${escapeHtml(event.title)}</strong>
            <span>${escapeHtml((event.source_codes || [])[0] || '')}</span>
          </button>`
        ).join('')
        : '<div class="bible-context-empty">No source-linked event is recorded for this place.</div>'}</div>
    </section>
    <div class="bible-place-map bible-place-map25d">
      <div class="bible-map25d-toolbar">
        <strong>2.5D Vector Bible Map</strong>
        <span>Wheel to zoom · Drag to move · Select a point</span>
        <button type="button" data-open-people aria-label="Open Bible People" title="Open Bible People">👤 People</button>
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
  renderModernPlaceContext(place, vectorPlace, host.querySelector('[data-modern-place-context]'));
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
      const selected = event.detail.place;
      const linkedPlace = data.places.find((item) => item.id === selected.id) ||
        findPlaceForVisibleLabel(selected.name);
      if (linkedPlace) {
        renderPlaceDetail(linkedPlace);
        window.requestAnimationFrame(() => {
          document.getElementById('biblePlaceDetail')?.scrollIntoView({
            behavior: 'auto',
            block: 'start'
          });
        });
      }
      if (mapStatus) {
        mapStatus.textContent = `${selected.name} · ${selected.verse_reference_count || 0} verse references · ${selected.candidate_count || 0} location candidate(s)`;
      }
    });
    host.querySelector('[data-map25d-fit]')?.addEventListener('click', () => {
      activePlaceMap.fitToData();
      activePlaceMap.scheduleRender();
    });
    host.querySelector('[data-open-people]')?.addEventListener('click', () => {
      close();
      if (typeof window.openBiblePeople === 'function') {
        window.openBiblePeople();
      } else {
        document.getElementById('biblePeopleToggle')?.click();
      }
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
  host.querySelectorAll('[data-related-person-id]').forEach((button) => {
    button.addEventListener('click', () => {
      window.__bibleContextReturn = {
        kind: 'context',
        options: { tab: 'places', placeName: place.name }
      };
      close();
      if (typeof window.openBiblePerson === 'function') {
        window.openBiblePerson(button.dataset.relatedPersonId);
      }
    });
  });
  host.querySelectorAll('[data-related-event-reference]').forEach((button) => {
    button.addEventListener('click', () => {
      openContext({
        tab: 'timeline',
        sourceCode: button.dataset.relatedEventReference
      });
    });
  });
}

function revealPlaceDetail(place) {
  if (!place) return false;
  selectTab('places');
  renderPlaceResults(place.name);
  renderPlaceDetail(place);
  window.requestAnimationFrame(() => {
    document.getElementById('biblePlaceDetail')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  setStatus(`${place.name} city detail opened.`);
  return true;
}

async function renderModernPlaceContext(place, vectorPlace, host) {
  if (!host) return;
  try {
    const [modernPayload, imagePayload] = await Promise.all([
      loadKnowledge('geography/modern-places.json'),
      loadKnowledge('images/licensed-manifest.json')
    ]);
    const ancientId = vectorPlace?.id || '';
    const normalizedName = String(place.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const matches = (modernPayload.records || []).filter((modern) =>
      (modern.ancient_associations || []).some((association) =>
        association.ancient_id === ancientId ||
        String(association.ancient_name_en || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === normalizedName
      )
    ).sort((left, right) => {
      const leftScore = Math.max(...left.ancient_associations.map((item) => item.confidence_score || 0));
      const rightScore = Math.max(...right.ancient_associations.map((item) => item.confidence_score || 0));
      return rightScore - leftScore;
    }).slice(0, 6);
    if (!matches.length) {
      host.innerHTML = knowledgeEmpty('No source-linked modern location',
        'The source dataset does not provide an ancient-to-modern identification for this place.');
      return;
    }
    const modernIds = new Set(matches.map((item) => item.modern_id));
    const images = (imagePayload.records || []).filter((image) =>
      (image.modern_ids || []).some((id) => modernIds.has(id))
    ).slice(0, 8);
    host.innerHTML = `<section class="bible-person-section">
      <h4>Ancient and modern location</h4>
      <div class="bible-modern-grid">${matches.map((modern) => {
        const association = (modern.ancient_associations || []).find((item) =>
          item.ancient_id === ancientId) || modern.ancient_associations[0] || {};
        return `<button type="button" class="bible-modern-card bible-modern-place-link"
          data-modern-ancient-id="${escapeHtml(association.ancient_id || '')}"
          data-modern-ancient-name="${escapeHtml(association.ancient_name_en || place.name)}">
          <strong>${escapeHtml(modern.name_en)}</strong>
          <span>${escapeHtml(modern.type || modern.class || 'Modern location')}</span>
          <small>Source confidence: ${escapeHtml(association.confidence_score || 0)}</small>
          <small>${escapeHtml(modern.latitude)}, ${escapeHtml(modern.longitude)}</small>
        </button>`;
      }).join('')}</div>
      ${images.length ? `<div class="bible-source-images">${images.map((image) => {
        const thumbnail = String(image.thumbnail_url_pattern || '').replace('####', '500');
        const fallback = String(image.file_url || '');
        const description = String(Object.values(image.descriptions || {})[0] || place.name)
          .replace(/<\/?modern\b[^>]*>/gi, '');
        return `<figure>
          <img src="${escapeHtml(thumbnail || fallback)}" data-fallback="${escapeHtml(fallback)}"
            alt="${escapeHtml(description)}" loading="lazy">
          <figcaption>${escapeHtml(image.credit || image.author || 'Source contributor')} ·
            ${escapeHtml(image.license)}
            <a href="${escapeHtml(image.source_page_url || image.credit_url)}" target="_blank" rel="noopener">Source</a>
          </figcaption>
        </figure>`;
      }).join('')}</div>` : ''}
    </section>`;
    host.querySelectorAll('.bible-source-images img[data-fallback]').forEach((image) => {
      image.addEventListener('error', () => {
        if (!image.dataset.fallbackUsed && image.dataset.fallback) {
          image.dataset.fallbackUsed = '1';
          image.src = image.dataset.fallback;
          return;
        }
        image.closest('figure')?.setAttribute('hidden', '');
      });
    });
    host.querySelectorAll('[data-modern-ancient-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const linkedPlace = findLegacyPlaceFromGeocoding(button.dataset.modernAncientId) ||
          findPlaceForVisibleLabel(button.dataset.modernAncientName);
        if (!linkedPlace) {
          setStatus(`No linked ancient city detail is available for ${button.querySelector('strong')?.textContent || 'this location'}.`);
          return;
        }
        selectTab('places');
        renderPlaceResults(linkedPlace.name);
        renderPlaceDetail(linkedPlace);
        window.requestAnimationFrame(() => {
          document.getElementById('biblePlaceDetail')?.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      });
    });
  } catch (error) {
    host.innerHTML = knowledgeEmpty('Modern location context unavailable', error.message);
  }
}

async function loadSemanticRecords() {
  const manifest = await loadKnowledge('semantic/manifest.json');
  const payloads = await Promise.all(Object.values(manifest.categories || {})
    .map((entry) => loadKnowledge(entry.file.replace(/^knowledge\//, ''))));
  return payloads.flatMap((payload) => payload.records || []);
}

function showKnowledgeSection(section) {
  document.querySelectorAll('[data-knowledge-section]').forEach((button) =>
    button.classList.toggle('is-active', button.dataset.knowledgeSection === section));
  document.querySelectorAll('[data-knowledge-view]').forEach((view) =>
    view.classList.toggle('is-active', view.dataset.knowledgeView === section));
}

function renderEntityDetail(record, host) {
  const uniqueSourceCodes = [...new Set(record.source_codes || [])];
  host.innerHTML = `<article class="bible-person-card">
    <div class="bible-person-title"><div><h3>${escapeHtml(record.name_en)}</h3>
    <p>${escapeHtml(record.category)}${record.subtype ? ` · ${escapeHtml(record.subtype)}` : ''}</p></div>
    <span class="bible-person-id">${escapeHtml(record.entity_id)}</span></div>
    ${record.aliases_en?.length ? `<div class="bible-person-meta">${record.aliases_en.map((alias) =>
      `<span class="bible-person-chip">${escapeHtml(alias)}</span>`).join('')}</div>` : ''}
    <p>${escapeHtml(record.description_en || 'No source description is available.')}</p>
    <section class="bible-person-section"><h4>Scripture references (${uniqueSourceCodes.length})</h4>
      <div class="bible-reference-grid">${uniqueSourceCodes.slice(0, 60).map((code) =>
        `<button type="button" class="bible-reference" data-bible-source-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join('')}</div>
      ${uniqueSourceCodes.length > 60 ? `<p>Showing the first 60 of ${uniqueSourceCodes.length} references.</p>` : ''}
    </section>
  </article>`;
}

function mountPagedKnowledgeResults(results, records, renderButton, onSelect, options = {}) {
  const pageSize = Math.max(1, Number(options.pageSize) || 100);
  let visibleCount = Math.min(pageSize, records.length);
  const paint = () => {
    results.innerHTML = records.slice(0, visibleCount).map((record, index) =>
      renderButton(record, index)).join('') || knowledgeEmpty(options.emptyTitle || 'No matching record');
    if (visibleCount < records.length) {
      const nextCount = Math.min(pageSize, records.length - visibleCount);
      results.insertAdjacentHTML('beforeend',
        `<button type="button" class="bible-person-result bible-knowledge-more" data-knowledge-more>
          <strong>Show next ${nextCount}</strong>
          <span>${visibleCount} of ${records.length} records currently shown</span>
        </button>`);
    }
    results.querySelectorAll('[data-knowledge-index]').forEach((button) =>
      button.addEventListener('click', () => onSelect(records[Number(button.dataset.knowledgeIndex)])));
    results.querySelector('[data-knowledge-more]')?.addEventListener('click', () => {
      visibleCount = Math.min(visibleCount + pageSize, records.length);
      paint();
      options.onProgress?.(visibleCount, records.length);
    });
  };
  paint();
  return visibleCount;
}

async function renderSemanticKnowledge(query = '', sourceCode = '') {
  const renderVersion = beginSearchRender('entities');
  const results = document.getElementById('bibleKnowledgeEntityResults');
  const detail = document.getElementById('bibleKnowledgeEntityDetail');
  results.innerHTML = knowledgeEmpty('Loading Scripture-linked entities...');
  try {
    let ids = null;
    if (sourceCode) {
      const index = await loadKnowledge('semantic/by-source.json');
      ids = new Set(index.source_to_entities?.[sourceCode] || []);
    }
    const needle = normalizedSearch(query);
    const availableRecords = (await loadSemanticRecords()).filter((record) =>
      !ids || ids.has(record.entity_id));
    if (!isCurrentSearchRender('entities', renderVersion)) return;
    const records = prefixSearch(availableRecords, needle,
      [(record) => record.name_en],
      [(record) => record.aliases_en || []]);
    const visibleCount = mountPagedKnowledgeResults(results, records, (record, index) =>
      `<button type="button" class="bible-person-result" data-knowledge-index="${index}">
        <strong>${escapeHtml(record.name_en)}</strong>
        <span>${escapeHtml(record.category)}${record.subtype ? ` · ${escapeHtml(record.subtype)}` : ''}</span>
      </button>`,
    (record) => renderEntityDetail(record, detail), {
      pageSize: ids ? Math.max(records.length, 1) : 100,
      emptyTitle: 'No matching entity',
      onProgress: (shown, total) => setStatus(`${shown} of ${total} semantic Bible records shown.`)
    });
    if (records.length) renderEntityDetail(records[0], detail);
    else detail.innerHTML = '';
    setStatus(sourceCode
      ? `${records.length} key term, living thing, object, or group record(s) linked to ${sourceCode}.`
      : `${visibleCount} of ${records.length} semantic Bible records shown.`);
  } catch (error) {
    if (!isCurrentSearchRender('entities', renderVersion)) return;
    results.innerHTML = knowledgeEmpty('Unable to load semantic records', error.message);
  }
}

async function renderWordSearch(query = '') {
  const renderVersion = beginSearchRender('words');
  const results = document.getElementById('bibleWordResults');
  const detail = document.getElementById('bibleWordDetail');
  const needle = normalizedSearch(query);
  const manifest = await loadKnowledge('concordance/manifest.json');
  if (!isCurrentSearchRender('words', renderVersion)) return;
  const allWords = manifest.all_words || [];
  const words = prefixSearch(allWords, needle, [(entry) => entry.word]);
  results.innerHTML = [].map((entry, index) =>
    `<button type="button" class="bible-person-result" data-word-index="${index}">
      <strong>${escapeHtml(entry.word)}</strong><span>${entry.count.toLocaleString()} occurrences · ${entry.book_numbers.length} book(s)</span>
    </button>`).join('') || knowledgeEmpty('No word found');
  const showWord = async (entry) => {
    detail.innerHTML = knowledgeEmpty(`Loading “${entry.word}” across Scripture...`);
    const bookPayloads = await Promise.all(entry.book_numbers.map((bookNumber) => {
      const book = manifest.books.find((item) => item.book_number === bookNumber);
      return loadKnowledge(book.file.replace(/^knowledge\//, ''));
    }));
    if (!isCurrentSearchRender('words', renderVersion)) return;
    const matches = bookPayloads.map((payload) => ({
      book: payload.book,
      record: (payload.records || []).find((item) => item.word.toLowerCase() === entry.word)
    })).filter((item) => item.record);
    const references = matches.flatMap((item) => item.record.source_codes);
    detail.innerHTML = `<article class="bible-person-card"><div class="bible-person-title">
      <div><h3>${escapeHtml(matches[0]?.record.word || entry.word)}</h3>
      <p>${entry.count.toLocaleString()} occurrences in ${matches.length} books</p></div></div>
      <section class="bible-person-section"><h4>Books</h4>
        <div class="bible-person-meta">${matches.map((item) =>
          `<span class="bible-person-chip">${escapeHtml(item.book)} · ${item.record.count}</span>`).join('')}</div>
      </section>
      <section class="bible-person-section"><h4>Verse locations (${references.length})</h4>
        <div class="bible-reference-grid">${references.slice(0, 240).map((code) =>
          `<button type="button" class="bible-reference" data-bible-source-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join('')}</div>
        ${references.length > 240 ? `<p>Showing the first 240 of ${references.length} verse locations.</p>` : ''}
      </section></article>`;
  };
  const visibleCount = mountPagedKnowledgeResults(results, words, (entry, index) =>
    `<button type="button" class="bible-person-result" data-knowledge-index="${index}">
      <strong>${escapeHtml(entry.word)}</strong><span>${entry.count.toLocaleString()} occurrences in ${entry.book_numbers.length} book(s)</span>
    </button>`,
  showWord, {
    pageSize: 100,
    emptyTitle: 'No word found',
    onProgress: (shown, total) => setStatus(`${shown} of ${total} concordance results shown.`)
  });
  if (needle && words.length) showWord(words[0]);
  setStatus(`${visibleCount} of ${words.length} concordance results shown.`);
}

async function renderDictionary(query = '') {
  const renderVersion = beginSearchRender('dictionary');
  const results = document.getElementById('bibleDictionaryResults');
  const detail = document.getElementById('bibleDictionaryDetail');
  const payload = await loadKnowledge('reference/easton.json');
  if (!isCurrentSearchRender('dictionary', renderVersion)) return;
  const needle = normalizedSearch(query);
  const allRecords = payload.records || [];
  const records = prefixSearch(allRecords, needle, [(record) => record.term_en]);
  const show = (record) => {
    detail.innerHTML = `<article class="bible-person-card"><div class="bible-person-title">
      <div><h3>${escapeHtml(record.term_en)}</h3><p>Easton Bible Dictionary</p></div></div>
      <p>${escapeHtml(record.text_en || 'No entry text.')}</p></article>`;
  };
  results.innerHTML = [].map((record, index) =>
    `<button type="button" class="bible-person-result" data-dictionary-index="${index}">
      <strong>${escapeHtml(record.term_en)}</strong><span>${escapeHtml(record.match_type || 'Dictionary')}</span>
    </button>`).join('') || knowledgeEmpty('No dictionary entry found');
  const visibleCount = mountPagedKnowledgeResults(results, records, (record, index) =>
    `<button type="button" class="bible-person-result" data-knowledge-index="${index}">
      <strong>${escapeHtml(record.term_en)}</strong><span>${escapeHtml(record.match_type || 'Dictionary')}</span>
    </button>`,
  show, {
    pageSize: 100,
    emptyTitle: 'No dictionary entry found',
    onProgress: (shown, total) => setStatus(`${shown} of ${total} dictionary results shown.`)
  });
  if (records.length) show(records[0]);
  setStatus(`${visibleCount} of ${records.length} dictionary results shown.`);
}

async function renderTopics() {
  const payload = await loadKnowledge('reference/topics.json');
  const results = document.getElementById('bibleTopicResults');
  const detail = document.getElementById('bibleTopicDetail');
  const records = payload.records || [];
  const show = (record) => {
    detail.innerHTML = `<article class="bible-person-card"><div class="bible-person-title">
      <div><h3>${escapeHtml(record.topic)}</h3><p>BibleData topic list</p></div></div>
      <pre class="bible-topic-source">${escapeHtml(record.source_markdown)}</pre></article>`;
  };
  results.innerHTML = [].map((record, index) =>
    `<button type="button" class="bible-person-result" data-topic-index="${index}">
      <strong>${escapeHtml(record.topic)}</strong><span>Topic index</span>
    </button>`).join('');
  const visibleCount = mountPagedKnowledgeResults(results, records, (record, index) =>
    `<button type="button" class="bible-person-result" data-knowledge-index="${index}">
      <strong>${escapeHtml(record.topic)}</strong><span>Topic index</span>
    </button>`,
  show, {
    pageSize: 100,
    emptyTitle: 'No topic list found',
    onProgress: (shown, total) => setStatus(`${shown} of ${total} Bible topic lists shown.`)
  });
  if (records.length) show(records[0]);
  setStatus(`${visibleCount} of ${records.length} Bible topic lists shown.`);
}

async function renderBooks(query = '') {
  const renderVersion = beginSearchRender('books');
  const [bookPayload, chapterPayload] = await Promise.all([
    loadKnowledge('reference/books.json'),
    loadKnowledge('reference/chapters.json')
  ]);
  if (!isCurrentSearchRender('books', renderVersion)) return;
  const results = document.getElementById('bibleBookResults');
  const detail = document.getElementById('bibleBookDetail');
  const needle = normalizedSearch(query);
  const books = prefixSearch(bookPayload.records || [], needle,
    [(book) => book.name_en],
    [(book) => book.osis_name, (book) => book.division, (book) => book.testament]);
  const show = (book) => {
    const chapters = (chapterPayload.records || []).filter((chapter) =>
      (chapter.book_ids || []).includes(book.source_id) ||
      chapter.osis_ref.startsWith(`${book.osis_name}.`));
    detail.innerHTML = `<article class="bible-person-card"><div class="bible-person-title">
      <div><h3>${escapeHtml(book.name_en)}</h3><p>${escapeHtml(book.division)} · ${escapeHtml(book.testament)}</p></div>
      <span class="bible-person-id">${escapeHtml(book.osis_name)}</span></div>
      <div class="bible-modern-grid">
        <article class="bible-modern-card"><strong>${book.chapter_count}</strong><span>chapters</span></article>
        <article class="bible-modern-card"><strong>${book.verse_count}</strong><span>verses</span></article>
        <article class="bible-modern-card"><strong>${book.people_count}</strong><span>people</span></article>
        <article class="bible-modern-card"><strong>${book.place_count}</strong><span>places</span></article>
      </div>
      <section class="bible-person-section"><h4>Chapter overview</h4>
        <div class="bible-book-chapters">${chapters.sort((a, b) => a.chapter_number - b.chapter_number).map((chapter) =>
          `<span><strong>${chapter.chapter_number}</strong><small>${chapter.people_count} people · ${chapter.place_count} places</small></span>`
        ).join('')}</div>
      </section></article>`;
  };
  results.innerHTML = [].map((book, index) =>
    `<button type="button" class="bible-person-result" data-book-index="${index}">
      <strong>${escapeHtml(book.name_en)}</strong><span>${escapeHtml(book.division)}</span>
    </button>`).join('') || knowledgeEmpty('No Bible book found');
  const visibleCount = mountPagedKnowledgeResults(results, books, (book, index) =>
    `<button type="button" class="bible-person-result" data-knowledge-index="${index}">
      <strong>${escapeHtml(book.name_en)}</strong><span>${escapeHtml(book.division)}</span>
    </button>`,
  show, {
    pageSize: 100,
    emptyTitle: 'No Bible book found',
    onProgress: (shown, total) => setStatus(`${shown} of ${total} Bible book records shown.`)
  });
  if (books.length) show(books[0]);
  setStatus(`${visibleCount} of ${books.length} Bible book records shown.`);
}

async function renderKnowledge(options = {}) {
  const section = options.section || 'entities';
  showKnowledgeSection(section);
  try {
    if (section === 'entities') {
      const search = document.getElementById('bibleKnowledgeEntitySearch');
      if (options.sourceCode) {
        search.value = '';
        search.dataset.sourceCode = options.sourceCode;
      }
      await renderSemanticKnowledge(search.value, search.dataset.sourceCode || '');
    }
    if (section === 'words') await renderWordSearch(document.getElementById('bibleWordSearch').value);
    if (section === 'dictionary') await renderDictionary(document.getElementById('bibleDictionarySearch').value);
    if (section === 'topics') await renderTopics();
    if (section === 'books') await renderBooks(document.getElementById('bibleBookSearch').value);
  } catch (error) {
    setStatus(error.message || 'Bible study data could not be loaded.', true);
    const activeDetail = document.querySelector('[data-knowledge-view].is-active .bible-people-detail');
    if (activeDetail) {
      activeDetail.innerHTML = knowledgeEmpty('Bible study data is temporarily unavailable',
        'Please retry this section.');
    }
  }
}

function renderPlaceResults(query = '') {
  const results = document.getElementById('biblePlaceResults');
  if (!results) return;
  const needle = normalizedSearch(query);
  const places = prefixSearch(data.places, needle,
    [(place) => place.name, (place) => place.name_ko],
    [(place) => place.aliases || []]).slice(0, 60);
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
    labelFontSize: 12,
    selectableLabels: true
  });
  activeJourneyScene.setScene(sceneFromGraphicObjects(journey.graphic));
  sceneHost.addEventListener('scene25d:select', (event) => {
    event.stopPropagation();
    const nodeName = String(event?.detail?.node?.label || event?.detail?.node?.name || '')
      .replace(/\s*\([^)]*\)\s*$/, '').trim();
    const place = findPlaceForVisibleLabel(nodeName);
    if (!place) return;
    selectTab('places');
    renderPlaceResults(place.name);
    renderPlaceDetail(place);
    window.requestAnimationFrame(() => {
      document.getElementById('biblePlaceDetail')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  });
  setStatus('Journey route loaded.');
}

function timelineEventForRow(row) {
  const title = String(row?.[1] || '').trim().toLowerCase();
  const reference = String(row?.[2] || '').trim();
  return Object.values(data.contextLinks.events || {}).find((event) =>
    String(event.title || '').trim().toLowerCase() === title &&
    (!reference || (event.source_codes || []).includes(reference))
  ) || Object.values(data.contextLinks.events || {}).find((event) =>
    reference && (event.source_codes || []).includes(reference)
  ) || null;
}

function renderTimelineEventDetail(timeline, rowIndex, options = {}) {
  const output = document.getElementById('bibleTimelineOutput');
  const selection = output?.querySelector('.bible-timeline-selection');
  const rows = Array.isArray(timeline?.graphic?.rows) ? timeline.graphic.rows : [];
  const row = rows[Number(rowIndex)];
  if (!selection || !row) return;
  const event = timelineEventForRow(row);
  const references = event?.source_codes?.length ? event.source_codes : [row[2]].filter(Boolean);
  const uniqueReferences = [...new Set(references)];
  const people = (event?.participant_ids || []).map((personId) => ({
    id: personId,
    name: data.peopleIndex[personId]?.name ||
      personId.replace(/^PER-(THEO-)?/, '').replace(/-\d+(?:-\d+)?$/, '').replaceAll('-', ' ')
  }));
  const places = (event?.place_ids || []).map((placeId) =>
    data.places.find((place) => place.id === placeId)).filter(Boolean);
  selection.dataset.timelineEventIndex = String(rowIndex);
  selection.classList.toggle('is-revealed', Boolean(options.reveal));
  selection.innerHTML = `<article class="bible-person-card" data-timeline-event-detail="active">
    <div class="bible-person-title"><div><h3>${escapeHtml(row[1])}</h3>
      <p>${escapeHtml(row[2] || 'No reference')} · ${escapeHtml(row[3] || 'No source date')}</p></div></div>
    <section class="bible-person-section"><h4>Related people</h4>
      <div class="bible-person-meta">${people.length ? people.map((person) =>
        `<button type="button" class="bible-person-chip" data-bible-person-id="${escapeHtml(person.id)}" data-timeline-person-id="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>`
      ).join('') : '<span class="bible-context-empty">No source-linked people are recorded.</span>'}</div>
    </section>
    <section class="bible-person-section"><h4>Related places</h4>
      <div class="bible-person-meta">${places.length ? places.map((place) =>
        `<button type="button" class="bible-person-chip" data-bible-place-id="${escapeHtml(place.id)}" data-timeline-place-id="${escapeHtml(place.id)}">${escapeHtml(place.name)}</button>`
      ).join('') : '<span class="bible-context-empty">No source-linked places are recorded.</span>'}</div>
    </section>
    <section class="bible-person-section"><h4>Scripture references (${uniqueReferences.length})</h4>
      <div class="bible-reference-grid">${uniqueReferences.slice(0, 60).map((code) =>
        `<button type="button" class="bible-reference" data-bible-source-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join('')}</div>
    </section>
  </article>`;
  selection.querySelectorAll('[data-timeline-person-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      close();
      if (typeof window.openBiblePerson === 'function') {
        window.openBiblePerson(button.dataset.timelinePersonId);
      }
    });
  });
  selection.querySelectorAll('[data-timeline-place-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const place = data.places.find((item) => item.id === button.dataset.timelinePlaceId);
      if (!place) return;
      revealPlaceDetail(place);
    });
  });
  const eventSelector = document.getElementById('bibleTimelineEventSelector');
  if (eventSelector) eventSelector.value = String(rowIndex);
  if (options.reveal) {
    window.requestAnimationFrame(() => {
      selection.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    window.setTimeout(() => selection.classList.remove('is-revealed'), 1700);
  }
}

function renderTimeline(index = 0, selectedEventIndex = 0) {
  const output = document.getElementById('bibleTimelineOutput');
  const timeline = data.timelines[Number(index) || 0];
  if (!output) return;
  if (!timeline) {
    output.innerHTML = '<div class="bible-people-empty"><strong>Loading timeline...</strong></div>';
    return;
  }
  if (activeTimelineScene) activeTimelineScene.destroy();
  const rows = Array.isArray(timeline.graphic?.rows) ? timeline.graphic.rows : [];
  const eventSelector = document.getElementById('bibleTimelineEventSelector');
  if (eventSelector) {
    eventSelector.innerHTML = rows.map((row, rowIndex) =>
      `<option value="${rowIndex}">${escapeHtml(`${row[0]}. ${row[1]}`)}</option>`).join('');
    eventSelector.value = String(Math.min(Math.max(Number(selectedEventIndex) || 0, 0), Math.max(rows.length - 1, 0)));
  }
  const nodes = rows.map((row, rowIndex) => ({
    id: `event_${rowIndex}`,
    x: rowIndex,
    y: rowIndex % 2 ? -1 : 1,
    label: `${row[0]}. ${row[1]}`,
    color: rowIndex % 2 ? '#fbbf24' : '#60a5fa',
    stroke: '#1e3a8a',
    radius: 5.5,
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
    labelFontSize: 11,
    selectableLabels: true,
    lockVerticalPan: true
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
    event.stopPropagation();
    const node = event.detail.node;
    const rowIndex = Number(String(node.id || '').replace('event_', '')) || 0;
    renderTimelineEventDetail(timeline, rowIndex, { reveal: true });
  });
  if (rows.length) renderTimelineEventDetail(timeline, eventSelector?.value || 0);
  setStatus(`${timeline.event_count} events loaded in Scripture order.`);
}

function selectTab(tabName) {
  document.querySelectorAll('[data-bible-explore-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.bibleExploreTab === tabName);
  });
  document.querySelectorAll('[data-bible-explore-view]').forEach((view) => {
    view.classList.toggle('is-active', view.dataset.bibleExploreView === tabName);
  });
}

function findLegacyPlaceFromGeocoding(placeId) {
  const geocoding = data.contextLinks.geocoding_places?.[placeId];
  if (!geocoding) return null;
  if (geocoding.legacy_place_id) {
    return data.places.find((place) => place.id === geocoding.legacy_place_id) || null;
  }
  const normalized = String(geocoding.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return data.places.find((place) =>
    String(place.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized
  ) || null;
}

function renderPlacesForSourceCode(sourceCode) {
  const placeIds = data.contextLinks.source_to_places?.[sourceCode] || [];
  const matches = placeIds.map(findLegacyPlaceFromGeocoding).filter(Boolean);
  const uniqueMatches = [...new Map(matches.map((place) => [place.id, place])).values()];
  const search = document.getElementById('biblePlaceSearch');
  if (search) search.value = '';
  const results = document.getElementById('biblePlaceResults');
  if (!uniqueMatches.length) {
    results.innerHTML = '<div class="bible-people-empty"><strong>No mapped place for this passage</strong><span>The source dataset does not identify a geographic place in this verse.</span></div>';
    document.getElementById('biblePlaceDetail').innerHTML = '';
    setStatus(`No mapped place is recorded for ${sourceCode}.`);
    return;
  }
  results.innerHTML = uniqueMatches.map((place) =>
    `<button type="button" class="bible-person-result" data-bible-place-id="${escapeHtml(place.id)}">
      <strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(place.type || 'Bible place')}</span>
    </button>`
  ).join('');
  results.querySelectorAll('[data-bible-place-id]').forEach((button) => {
    button.addEventListener('click', () =>
      renderPlaceDetail(data.places.find((place) => place.id === button.dataset.biblePlaceId)));
  });
  renderPlaceDetail(uniqueMatches[0]);
  setStatus(`${uniqueMatches.length} mapped place${uniqueMatches.length === 1 ? '' : 's'} in ${sourceCode}.`);
}

function renderPatristic(query = '') {
  const results = document.getElementById('biblePatristicResults');
  const detail = document.getElementById('biblePatristicDetail');
  if (!results || !detail) return;
  const needle = normalizedSearch(query);
  const records = prefixSearch(data.patristic, needle,
    [(record) => record.title],
    [(record) => record.author, (record) => record.publication_year]).slice(0, 80);
  results.innerHTML = records.map((record, index) =>
    `<button type="button" class="bible-person-result" data-patristic-index="${index}">
      <strong>${escapeHtml(record.title)}</strong>
      <span>${escapeHtml(record.author || 'Unknown author')}</span>
    </button>`
  ).join('') || '<div class="bible-people-empty"><strong>No works found</strong></div>';
  const showRecord = (record) => {
    const readerKey = `${record.id}|${record.language || 'und'}`;
    const readerEntry = data.patristicReaders[readerKey];
    detail.innerHTML = `<article class="bible-person-card">
      <div class="bible-person-title"><div><h3>${escapeHtml(record.title)}</h3>
      <p>${escapeHtml(record.author || 'Unknown author')}</p></div>
      <span class="bible-person-id">${escapeHtml(record.id)}</span></div>
      <div class="bible-person-meta">
        ${record.publication_year ? `<span class="bible-person-chip">${escapeHtml(record.publication_year)}</span>` : ''}
        ${record.language ? `<span class="bible-person-chip">${escapeHtml(record.language)}</span>` : ''}
        <span class="bible-person-chip">Patristic Text Archive</span>
      </div>
      <div class="bible-secondary-notice"><strong>Historical secondary literature</strong>
      This work is not part of the KJV/WEB Bible text.</div>
      <section class="bible-person-section"><h4>Source and licence</h4>
      <p>${escapeHtml(record.licence_name)}</p>
      <a href="${escapeHtml(record.licence_url)}" target="_blank" rel="noopener">View licence</a></section>
      ${readerEntry
        ? `<button type="button" class="bible-patristic-read-button" data-patristic-read>Read work</button>
           <section class="bible-patristic-reader" data-patristic-reader hidden></section>`
        : '<div class="bible-context-empty">A readable source text is not available.</div>'}
    </article>`;
    detail.querySelector('[data-patristic-read]')?.addEventListener('click', () =>
      renderPatristicReader(readerEntry, detail.querySelector('[data-patristic-reader]')));
  };
  results.querySelectorAll('[data-patristic-index]').forEach((button) => {
    button.addEventListener('click', () => showRecord(records[Number(button.dataset.patristicIndex)]));
  });
  if (records.length) showRecord(records[0]);
  setStatus(`${records.length} licensed Early Church work${records.length === 1 ? '' : 's'} shown.`);
}

async function renderPatristicReader(entry, host, page = 0) {
  if (!entry || !host) return;
  host.hidden = false;
  host.innerHTML = '<div class="bible-people-empty"><strong>Loading source text...</strong></div>';
  try {
    let reader = patristicReaderCache.get(entry.reader_key);
    if (!reader) {
      reader = await fetchContent(entry.file).then(checkResponse);
      patristicReaderCache.set(entry.reader_key, reader);
    }
    const pageSize = 40;
    const pageCount = Math.max(1, Math.ceil(reader.blocks.length / pageSize));
    const safePage = Math.max(0, Math.min(page, pageCount - 1));
    const blocks = reader.blocks.slice(safePage * pageSize, (safePage + 1) * pageSize);
    host.innerHTML = `<div class="bible-patristic-reader-header">
      <strong>${escapeHtml(reader.title)}</strong>
      <span>Page ${safePage + 1} of ${pageCount}</span>
    </div>
    <div class="bible-patristic-reader-text">${blocks.map((block) =>
      block.type === 'heading'
        ? `<h4>${escapeHtml(block.text)}</h4>`
        : `<p>${escapeHtml(block.text)}</p>`
    ).join('')}</div>
    <div class="bible-patristic-reader-nav">
      <button type="button" data-reader-page="${safePage - 1}" ${safePage === 0 ? 'disabled' : ''}>Previous</button>
      <button type="button" data-reader-page="${safePage + 1}" ${safePage >= pageCount - 1 ? 'disabled' : ''}>Next</button>
    </div>`;
    host.querySelectorAll('[data-reader-page]').forEach((button) => {
      button.addEventListener('click', () =>
        renderPatristicReader(entry, host, Number(button.dataset.readerPage)));
    });
  } catch (error) {
    host.innerHTML = `<div class="bible-people-empty"><strong>Unable to load this work</strong>
      <span>${escapeHtml(error.message)}</span></div>`;
  }
}

const SOURCE_BOOK_TO_OSIS = {
  Genesis: 'gen', Exodus: 'exod', Leviticus: 'lev', Numbers: 'num', Deuteronomy: 'deut',
  Joshua: 'josh', Judges: 'judg', Ruth: 'ruth', '1-Samuel': '1sam', '2-Samuel': '2sam',
  '1-Kings': '1kgs', '2-Kings': '2kgs', '1-Chronicles': '1chr', '2-Chronicles': '2chr',
  Ezra: 'ezra', Nehemiah: 'neh', Esther: 'esth', Job: 'job', Psalms: 'ps',
  Proverbs: 'prov', Ecclesiastes: 'eccl', 'Song-of-Solomon': 'song', Isaiah: 'isa',
  Jeremiah: 'jer', Lamentations: 'lam', Ezekiel: 'ezek', Daniel: 'dan', Hosea: 'hos',
  Joel: 'joel', Amos: 'amos', Obadiah: 'obad', Jonah: 'jonah', Micah: 'mic',
  Nahum: 'nah', Habakkuk: 'hab', Zephaniah: 'zeph', Haggai: 'hag', Zechariah: 'zech',
  Malachi: 'mal', Matthew: 'matt', Mark: 'mark', Luke: 'luke', John: 'john',
  Acts: 'acts', Romans: 'rom', '1-Corinthians': '1cor', '2-Corinthians': '2cor',
  Galatians: 'gal', Ephesians: 'eph', Philippians: 'phil', Colossians: 'col',
  '1-Thessalonians': '1thess', '2-Thessalonians': '2thess', '1-Timothy': '1tim',
  '2-Timothy': '2tim', Titus: 'titus', Philemon: 'phlm', Hebrews: 'heb',
  James: 'jas', '1-Peter': '1pet', '2-Peter': '2pet', '1-John': '1john',
  '2-John': '2john', '3-John': '3john', Jude: 'jude', Revelation: 'rev'
};

function parseSourceCode(sourceCode) {
  const match = String(sourceCode || '').match(/^(OT|NT)-(.+)-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    book: SOURCE_BOOK_TO_OSIS[match[2]] || '',
    chapter: Number(match[3]),
    verse: Number(match[4])
  };
}

function valueText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(' · ');
  return Object.entries(value).map(([key, item]) => `${key}: ${valueText(item)}`).join(' · ');
}

function libraryRecordHtml(record, category) {
  const title = record.title || record.term || record.source_title || record.section_title ||
    record.author || record.entry_id || 'Library entry';
  const reference = valueText(record.anchor_ref?.raw || record.primary_reference ||
    record.verse_range_osis || record.scripture_references || record.references);
  const blocks = Array.isArray(record.content_blocks) ? record.content_blocks.filter(Boolean) : null;
  const body = record.commentary_text || record.quote || record.definition || record.text ||
    record.content || valueText(record.definition_blocks || record.content_blocks ||
      record.stanzas || record.context);
  return `<article class="bible-person-card bible-library-entry">
    <div class="bible-person-title"><div><h3>${escapeHtml(title)}</h3>
    ${reference ? `<p>${escapeHtml(reference)}</p>` : ''}</div>
    <span class="bible-person-id">${escapeHtml(category)}</span></div>
    ${record.author ? `<div class="bible-person-meta"><span class="bible-person-chip">${escapeHtml(record.author)}</span></div>` : ''}
    <div class="bible-patristic-reader-text">${blocks?.length ? blocks.map((block) => `<p>${escapeHtml(valueText(block))}</p>`).join('') : `<p>${escapeHtml(body || 'No readable text is available for this entry.')}</p>`}</div>
  </article>`;
}

async function loadSermonIndex() {
  if (!sermonIndexPromise) {
    sermonIndexPromise = (async () => {
      const response = await fetchStorage('commentary/sermon/sermon-index.json.gz');
      if (!response.ok) throw new Error(`Sermon index could not be loaded (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed library data.');
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    })();
  }
  return sermonIndexPromise;
}

function sermonReferenceText(reference) {
  return valueText(reference?.raw || reference?.osis || reference);
}

async function renderSermonLibrary(version, results, detail, search) {
  const index = await loadSermonIndex();
  if (!isCurrentSearchRender('library', version)) return;
  const query = normalizedSearch(search.value);
  const sources = (index.sources || []).slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));
  results.innerHTML = `<div class="bible-sermon-summary"><strong>${index.records.toLocaleString()} sermons</strong><span>${index.collections} collections</span></div><button class="bible-person-result${sermonSelectedSource ? '' : ' is-active'}" data-sermon-source=""><strong>All sermons</strong><span>${index.records.toLocaleString()} titles</span></button>` + sources.map((source) => `<button class="bible-person-result${sermonSelectedSource === source.source_id ? ' is-active' : ''}" data-sermon-source="${escapeHtml(source.source_id)}"><strong>${escapeHtml(source.title)}</strong><span>${escapeHtml(source.author || '')} · ${Number(source.records).toLocaleString()} sermons</span></button>`).join('');
  const entries = index.entries.filter((entry) => (!sermonSelectedSource || entry.source_id === sermonSelectedSource) && (!query || [entry.title, entry.author, sermonReferenceText(entry.reference), entry.language, entry.date, entry.source_title].some((value) => normalizedSearch(value).includes(query))));
  const pages = Math.max(1, Math.ceil(entries.length / SERMON_PAGE_SIZE));
  sermonPage = Math.min(Math.max(1, sermonPage), pages);
  const start = (sermonPage - 1) * SERMON_PAGE_SIZE;
  const shown = entries.slice(start, start + SERMON_PAGE_SIZE);
  detail.innerHTML = `<section class="bible-sermon-browser"><header><strong>${entries.length.toLocaleString()} sermons found</strong><span>Choose a title to read one sermon.</span></header><div>${shown.map((entry, offset) => `<button class="bible-sermon-title" data-sermon-entry="${start + offset}"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml([entry.author, sermonReferenceText(entry.reference), entry.date, entry.language].filter(Boolean).join(' · '))}</span><small>${escapeHtml(entry.source_title)}</small></button>`).join('') || knowledgeEmpty('No sermons match this search')}</div><nav class="bible-sermon-pagination"><button data-sermon-page="prev" ${sermonPage === 1 ? 'disabled' : ''}>Previous</button><span>Page ${sermonPage} of ${pages}</span><button data-sermon-page="next" ${sermonPage === pages ? 'disabled' : ''}>Next</button></nav></section>`;
  setStatus(`${entries.length.toLocaleString()} of ${index.records.toLocaleString()} sermons available.`);
  const openSermon = async (position) => {
    const entry = entries[position];
    if (!entry) return;
    detail.innerHTML = knowledgeEmpty('Loading sermon');
    const record = (await loadStorageJsonlGzip(entry.storage_path))[entry.line];
    detail.innerHTML = `<section class="bible-sermon-reader"><button class="bible-sermon-back">← Sermon titles</button>${libraryRecordHtml(record, 'sermon')}<nav class="bible-sermon-pagination"><button data-sermon-neighbor="${position - 1}" ${position === 0 ? 'disabled' : ''}>Previous sermon</button><span>${position + 1} of ${entries.length.toLocaleString()}</span><button data-sermon-neighbor="${position + 1}" ${position === entries.length - 1 ? 'disabled' : ''}>Next sermon</button></nav></section>`;
    detail.querySelector('.bible-sermon-back').onclick = () => renderSermonLibrary(version, results, detail, search);
    detail.querySelectorAll('[data-sermon-neighbor]').forEach((button) => button.onclick = () => openSermon(Number(button.dataset.sermonNeighbor)));
    detail.scrollTo(0, 0);
  };
  results.querySelectorAll('[data-sermon-source]').forEach((button) => button.onclick = () => { sermonSelectedSource = button.dataset.sermonSource; sermonPage = 1; renderLibrary({ section: 'sermon' }); });
  detail.querySelectorAll('[data-sermon-entry]').forEach((button) => button.onclick = () => openSermon(Number(button.dataset.sermonEntry)));
  detail.querySelector('[data-sermon-page="prev"]')?.addEventListener('click', () => { sermonPage -= 1; renderLibrary({ section: 'sermon' }); });
  detail.querySelector('[data-sermon-page="next"]')?.addEventListener('click', () => { sermonPage += 1; renderLibrary({ section: 'sermon' }); });
}

async function loadLibraryManifests() {
  const [verse, remaining] = await Promise.all([
    loadStorageJson('commentary/commentary-manifest.json'),
    loadStorageJson('commentary/remaining-commentary-manifest.json')
  ]);
  return { verse, remaining };
}

async function renderLibrary(options = {}) {
  const renderVersion = beginSearchRender('library');
  librarySection = options.section || librarySection || 'verse';
  if (options.sourceCode) librarySourceCode = options.sourceCode;
  document.querySelectorAll('[data-library-section]').forEach((button) =>
    button.classList.toggle('is-active', button.dataset.librarySection === librarySection));
  const results = document.getElementById('bibleLibraryResults');
  const detail = document.getElementById('bibleLibraryDetail');
  const search = document.getElementById('bibleLibrarySearch');
  if (!results || !detail || !search) return;
  results.innerHTML = knowledgeEmpty('Loading library sources');
  detail.innerHTML = knowledgeEmpty('Select a source');
  try {
    if (librarySection === 'sermon') {
      await renderSermonLibrary(renderVersion, results, detail, search);
      return;
    }
    const manifests = await loadLibraryManifests();
    if (!isCurrentSearchRender('library', renderVersion)) return;
    const manifest = librarySection === 'verse' ? manifests.verse : manifests.remaining;
    let sources = (manifest.sources || []).filter((source) =>
      librarySection === 'verse' ? true : source.category === librarySection);
    sources = prefixSearch(sources, search.value,
      [(source) => source.title || source.source_id],
      [(source) => source.author, (source) => source.source_id]);
    const partitions = manifest.partitions || [];
    const parsed = parseSourceCode(librarySourceCode);
    if (librarySection === 'verse' && parsed?.book) {
      sources = sources.filter((source) => Array.isArray(source.books) && source.books.includes(parsed.book));
    }
    const visible = sources.slice(0, 350);
    results.innerHTML = visible.map((source, index) =>
      `<button type="button" class="bible-person-result" data-library-source="${index}">
        <strong>${escapeHtml(source.title || source.source_id)}</strong>
        <span>${escapeHtml(source.author || `${source.records || 0} records`)}</span>
      </button>`).join('') || knowledgeEmpty('No library source found');

    const showSource = async (source) => {
      detail.innerHTML = knowledgeEmpty('Loading selected source');
      let selectedPartitions = partitions.filter((partition) =>
        partition.source_id === source.source_id &&
        (librarySection !== 'verse' || !parsed?.book || partition.book === parsed.book));
      const recordGroups = await Promise.all(selectedPartitions.map((partition) =>
        loadStorageJsonlGzip(partition.storage_path)));
      if (!isCurrentSearchRender('library', renderVersion)) return;
      let records = recordGroups.flat();
      if (librarySection === 'verse' && parsed) {
        records = records.filter((record) => {
          if (Number(record.chapter) !== parsed.chapter) return false;
          const numbers = String(record.verse_range || '').match(/\d+/g)?.map(Number) || [];
          return numbers.length === 1
            ? numbers[0] === parsed.verse
            : numbers.length > 1 && parsed.verse >= numbers[0] && parsed.verse <= numbers.at(-1);
        });
      }
      detail.innerHTML = records.slice(0, 80).map((record) =>
        libraryRecordHtml(record, librarySection)).join('') ||
        knowledgeEmpty(librarySection === 'verse' ? 'No commentary for this verse' : 'No entries in this source');
      setStatus(`${records.length} matching ${librarySection === 'verse' ? 'commentary' : 'library'} record${records.length === 1 ? '' : 's'}.`);
    };
    results.querySelectorAll('[data-library-source]').forEach((button) => {
      button.addEventListener('click', () => showSource(visible[Number(button.dataset.librarySource)]));
    });
    if (visible.length) await showSource(visible[0]);
    else setStatus('No matching library source is available.');
  } catch (error) {
    if (!isCurrentSearchRender('library', renderVersion)) return;
    detail.innerHTML = knowledgeEmpty('Library data is temporarily unavailable', error.message);
    setStatus(error.message || 'Library data could not be loaded.', true);
  }
}

function museumEmpty(title, text = '') {
  return knowledgeEmpty(title, text);
}

function museumDisplayTitle(record) {
  const title = String(record && record.title || '').trim();
  const objectName = String(record && record.object_name || '').trim();
  return (!title || /^untitled work$/i.test(title)) ? objectName : title;
}

const museumPageSize = 30;
let museumPage = 0;
let museumLetter = '';

async function renderMuseum(selectedIndex = 0) {
  const results = document.getElementById('bibleMuseumResults');
  const detail = document.getElementById('bibleMuseumDetail');
  const search = document.getElementById('bibleMuseumSearch');
  const era = document.getElementById('bibleMuseumEra');
  const region = document.getElementById('bibleMuseumRegion');
  const topic = document.getElementById('bibleMuseumTopic');
  const letters = document.getElementById('bibleMuseumLetters');
  const pager = document.getElementById('bibleMuseumPager');
  if (!results || !detail || !search || !era || !region || !topic || !letters || !pager) return;
  letters.innerHTML = [''].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).map((letter) => `<button type="button" data-museum-letter="${letter}" class="${museumLetter === letter ? 'is-active' : ''}">${letter || 'All'}</button>`).join('');
  letters.querySelectorAll('[data-museum-letter]').forEach((button) => button.addEventListener('click', () => {
    museumLetter = button.dataset.museumLetter || '';
    museumPage = 0;
    search.value = '';
    renderMuseum();
  }));
  const version = beginSearchRender('museum');
  results.innerHTML = museumEmpty('Loading the image collection');
  detail.innerHTML = museumEmpty('Curated Met image collection', 'Explore verified public-domain images by title, era, region, and cultural topic.');
  try {
    if (!window.BibleSupabaseProvider || typeof window.BibleSupabaseProvider.metMuseumSearch !== 'function') {
      throw new Error('Museum catalog is not configured yet.');
    }
    const rows = await window.BibleSupabaseProvider.metMuseumSearch({
      query: search.value, letter: museumLetter, era: era.value, region: region.value, topic: topic.value,
      limit: museumPageSize, offset: museumPage * museumPageSize
    });
    if (!isCurrentSearchRender('museum', version)) return;
    const hasNext = rows.length > museumPageSize;
    const pageRows = rows.slice(0, museumPageSize);
    if (!pageRows.length) {
      results.innerHTML = museumEmpty('No matching artwork found');
      detail.innerHTML = museumEmpty('Try another title or clear one of the filters.');
      pager.innerHTML = museumPage > 0 ? '<button type="button" data-museum-page="previous">Previous</button><span>No results on this page</span>' : '';
      pager.querySelector('[data-museum-page="previous"]')?.addEventListener('click', () => { museumPage = Math.max(0, museumPage - 1); renderMuseum(); });
      setStatus('No Met artworks matched the current filters.');
      return;
    }
    const show = (record) => {
      const displayTitle = museumDisplayTitle(record);
      const objectName = String(record.object_name || '').trim();
      const subtitle = displayTitle && displayTitle !== objectName
        ? (objectName || record.culture || 'Met collection object')
        : (record.culture || record.object_date || 'Met collection object');
      detail.innerHTML = `<article class="bible-person-card bible-museum-card">
        <div class="bible-person-title"><div>${displayTitle ? `<h3>${escapeHtml(displayTitle)}</h3>` : ''}
          <p>${escapeHtml(subtitle)}</p></div>
          <span class="bible-person-id">MET ${escapeHtml(record.met_object_id)}</span></div>
        <div class="bible-person-meta">
          ${record.object_date ? `<span class="bible-person-chip">${escapeHtml(record.object_date)}</span>` : ''}
          ${record.culture ? `<span class="bible-person-chip">${escapeHtml(record.culture)}</span>` : ''}
          ${String(record.is_public_domain) === 'true' ? '<span class="bible-person-chip">Public domain</span>' : ''}
          <span class="bible-person-chip bible-museum-image-status">Image verified</span>
        </div>
        ${record.bible_era_tags ? `<p><strong>Bible-era context:</strong> ${escapeHtml(record.bible_era_tags.split('|').join(' · '))}</p>` : ''}
        ${record.timeline_100y ? `<p><strong>Timeline:</strong> ${escapeHtml(record.timeline_100y.split('|').join(' · '))}</p>` : ''}
        ${record.region_tags ? `<p><strong>Region:</strong> ${escapeHtml(record.region_tags.split('|').join(' · '))}</p>` : ''}
        ${record.topic_tags ? `<p><strong>Topics:</strong> ${escapeHtml(record.topic_tags.split('|').join(' · '))}</p>` : ''}
        <section class="bible-museum-preview">
          <img src="${escapeHtml(record.image_small_url || record.image_original_url)}" alt="${escapeHtml(displayTitle || 'Met artwork')}" loading="lazy">
          ${record.medium ? `<p><strong>Material:</strong> ${escapeHtml(record.medium)}</p>` : ''}
          ${record.credit_line ? `<p><strong>Collection credit:</strong> ${escapeHtml(record.credit_line)}</p>` : ''}
        </section>
        <p class="bible-museum-credit">Metadata and public-domain image: The Metropolitan Museum of Art Open Access.</p>
      </article>`;
    };
    results.innerHTML = pageRows.map((record, index) => {
      const displayTitle = museumDisplayTitle(record);
      return `<button type="button" class="bible-person-result" data-met-result="${index}">
        ${displayTitle ? `<strong>${escapeHtml(displayTitle)}</strong>` : ''}
        <span>${escapeHtml(record.object_date || record.culture || 'Met collection')}</span></button>`;
    }).join('');
    results.querySelectorAll('[data-met-result]').forEach((button) => button.addEventListener('click', () => show(pageRows[Number(button.dataset.metResult)])));
    show(pageRows[Math.min(Math.max(0, selectedIndex), pageRows.length - 1)]);
    pager.innerHTML = `<button type="button" data-museum-page="previous" ${museumPage === 0 ? 'disabled' : ''}>Previous</button><span>Page ${museumPage + 1}</span><button type="button" data-museum-page="next" ${hasNext ? '' : 'disabled'}>Next</button>`;
    pager.querySelector('[data-museum-page="previous"]')?.addEventListener('click', () => { museumPage = Math.max(0, museumPage - 1); renderMuseum(); });
    pager.querySelector('[data-museum-page="next"]')?.addEventListener('click', () => { if (hasNext) { museumPage += 1; renderMuseum(); } });
    setStatus(`${pageRows.length} verified Met images loaded on page ${museumPage + 1}.`);
  } catch (error) {
    if (!isCurrentSearchRender('museum', version)) return;
    results.innerHTML = museumEmpty('Museum catalog is temporarily unavailable');
    detail.innerHTML = museumEmpty('Museum catalog is not ready yet', error.message);
    setStatus(error.message, true);
  }
}

async function openContext(options = {}, navigationOptions = {}) {
  open();
  if (!navigationOptions.skipHistory) {
    bibleReferenceNavigation.push({ kind: 'context', options: { ...options } });
  }
  await loadData();
  const tab = options.tab || 'places';
  selectTab(tab);
  if (tab === 'places' && options.sourceCode) {
    renderPlacesForSourceCode(options.sourceCode);
  } else if (tab === 'places' && options.placeName) {
    const place = data.places.find((item) =>
      String(item.name).toLowerCase() === String(options.placeName).toLowerCase());
    if (place) {
      renderPlaceResults(place.name);
      renderPlaceDetail(place);
    }
  } else if (tab === 'timeline' && options.sourceCode) {
    const sourceMatch = String(options.sourceCode).match(/^(OT|NT)-(.+)-\d{2}-\d{2}$/);
    const book = sourceMatch ? `${sourceMatch[1]}-${sourceMatch[2]}` : '';
    const index = data.timelines.findIndex((timeline) => timeline.book_code === book);
    const selector = document.getElementById('bibleTimelineSelector');
    selector.value = String(index >= 0 ? index : 0);
    const selectedTimeline = data.timelines[Number(selector.value) || 0];
    const rowIndex = (selectedTimeline?.graphic?.rows || []).findIndex((row) =>
      String(row[2] || '') === String(options.sourceCode));
    renderTimeline(selector.value, rowIndex >= 0 ? rowIndex : 0);
  } else if (tab === 'journeys') {
    renderJourney(document.getElementById('bibleJourneySelector').value);
  } else if (tab === 'patristic') {
    renderPatristic(options.query || '');
  } else if (tab === 'knowledge') {
    renderKnowledge(options);
  } else if (tab === 'library') {
    renderLibrary(options);
  } else if (tab === 'museum') {
    renderMuseum();
  }
}

window.openBibleContext = openContext;
window.openBiblePlacesForSource = (sourceCode) =>
  openContext({ tab: 'places', sourceCode });
window.openBibleKnowledgeForSource = (sourceCode) =>
  openContext({ tab: 'knowledge', section: 'entities', sourceCode });
window.openBibleCommentaryForSource = (sourceCode) =>
  openContext({ tab: 'library', section: 'verse', sourceCode });

function populate() {
  const journeySelector = document.getElementById('bibleJourneySelector');
  const timelineSelector = document.getElementById('bibleTimelineSelector');
  const timelineEventSelector = document.getElementById('bibleTimelineEventSelector');
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
  if (timelineEventSelector && !timelineEventSelector.options.length) {
    timelineEventSelector.innerHTML = '<option value="0">Select an event</option>';
  }
  const activeTab = document.querySelector('[data-bible-explore-tab].is-active')?.dataset.bibleExploreTab || 'places';
  if (activeTab === 'places') renderPlaceResults();
  if (activeTab === 'journeys') requestAnimationFrame(() => renderJourney(journeySelector.value));
  if (activeTab === 'timeline') requestAnimationFrame(() => renderTimeline(timelineSelector.value));
  if (activeTab === 'patristic') requestAnimationFrame(() => renderPatristic());
  if (activeTab === 'knowledge') requestAnimationFrame(() => renderKnowledge());
  if (activeTab === 'library') requestAnimationFrame(() => renderLibrary());
  if (activeTab === 'museum') requestAnimationFrame(() => renderMuseum());
}

function open() {
  const panel = document.getElementById('bibleExplorePanel');
  const toggle = document.getElementById('bibleExploreToggle');
  panel.hidden = false;
  document.body.classList.add('bible-people-open');
  toggle.setAttribute('aria-expanded', 'true');
  setStatus('Loading Bible atlas and study tools...');
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
  const peopleButton = document.getElementById('bibleExplorePeople');
  const backButton = document.getElementById('bibleExploreBack');
  const forwardButton = document.getElementById('bibleExploreForward');
  if (!toggle || !panel || !closeButton) return;
  initialized = true;
  toggle.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  if (peopleButton) {
    peopleButton.addEventListener('click', () => {
      close();
      document.getElementById('biblePeopleToggle')?.click();
    });
  }
  if (backButton) backButton.addEventListener('click', () => bibleReferenceNavigation.back());
  if (forwardButton) forwardButton.addEventListener('click', () => bibleReferenceNavigation.forward());
  bibleReferenceNavigation.update();
  panel.addEventListener('click', (event) => { if (event.target === panel) close(); });
  document.querySelectorAll('[data-bible-explore-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-bible-explore-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-bible-explore-view]').forEach((view) => {
        view.classList.toggle('is-active', view.dataset.bibleExploreView === button.dataset.bibleExploreTab);
      });
      const selectedTab = button.dataset.bibleExploreTab;
      bibleReferenceNavigation.push({ kind: 'context', options: { tab: selectedTab } });
      if (selectedTab === 'journeys') document.getElementById('bibleJourneyOutput').innerHTML = '<div class="bible-people-empty"><strong>Loading journey...</strong></div>';
      if (selectedTab === 'timeline') document.getElementById('bibleTimelineOutput').innerHTML = '<div class="bible-people-empty"><strong>Loading timeline...</strong></div>';
      if (selectedTab === 'patristic') document.getElementById('biblePatristicDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Early Church works...</strong></div>';
      if (selectedTab === 'knowledge') document.getElementById('bibleKnowledgeEntityDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Bible study data...</strong></div>';
      if (selectedTab === 'library') document.getElementById('bibleLibraryDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Bible library...</strong></div>';
      if (selectedTab === 'museum') document.getElementById('bibleMuseumDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Met Museum catalog...</strong></div>';
      loadData().then(() => requestAnimationFrame(() => {
        if (selectedTab === 'places') renderPlaceResults(document.getElementById('biblePlaceSearch').value);
        if (selectedTab === 'journeys') renderJourney(document.getElementById('bibleJourneySelector').value);
        if (selectedTab === 'timeline') renderTimeline(document.getElementById('bibleTimelineSelector').value);
        if (selectedTab === 'patristic') renderPatristic(document.getElementById('biblePatristicSearch').value);
        if (selectedTab === 'knowledge') renderKnowledge();
        if (selectedTab === 'library') renderLibrary();
        if (selectedTab === 'museum') renderMuseum();
      })).catch((error) => setStatus(error.message, true));
    });
  });
  document.getElementById('biblePlaceSearch').addEventListener('input', (event) => renderPlaceResults(event.target.value));
  document.getElementById('bibleJourneySelector').addEventListener('change', (event) => renderJourney(event.target.value));
  document.getElementById('bibleTimelineSelector').addEventListener('change', (event) => renderTimeline(event.target.value));
  document.getElementById('bibleTimelineEventSelector').addEventListener('change', (event) =>
    renderTimelineEventDetail(data.timelines[Number(document.getElementById('bibleTimelineSelector').value) || 0],
      event.target.value, { reveal: true }));
  document.getElementById('biblePatristicSearch').addEventListener('input', (event) => renderPatristic(event.target.value));
  document.querySelectorAll('[data-knowledge-section]').forEach((button) => {
    button.addEventListener('click', () => renderKnowledge({ section: button.dataset.knowledgeSection }));
  });
  document.querySelectorAll('[data-library-section]').forEach((button) => {
    button.addEventListener('click', () => renderLibrary({ section: button.dataset.librarySection }));
  });
  document.getElementById('bibleLibrarySearch').addEventListener('input', () => {
    if (librarySection === 'sermon') sermonPage = 1;
    renderLibrary();
  });
  document.getElementById('bibleKnowledgeEntitySearch').addEventListener('input', (event) => {
    event.target.dataset.sourceCode = '';
    renderSemanticKnowledge(event.target.value);
  });
  document.getElementById('bibleWordSearch').addEventListener('input', (event) => renderWordSearch(event.target.value));
  document.getElementById('bibleDictionarySearch').addEventListener('input', (event) => renderDictionary(event.target.value));
  document.getElementById('bibleBookSearch').addEventListener('input', (event) => renderBooks(event.target.value));
  ['bibleMuseumSearch', 'bibleMuseumEra', 'bibleMuseumRegion', 'bibleMuseumTopic'].forEach((id) => {
    document.getElementById(id)?.addEventListener(id === 'bibleMuseumSearch' ? 'input' : 'change', () => renderMuseum());
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
