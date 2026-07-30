import { VectorMap25D } from './graphics/map25d/vector-map25d.js?v=8.51-patristic-reader1';
import { VectorScene25D, sceneFromGraphicObjects } from './graphics/map25d/vector-scene25d.js?v=8.44-map25d-all1';

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
    fetch('./content/bible-geography25d.json?v=8.49-context-ui1').then(checkResponse),
    fetch('./content/bible-context-links.json?v=8.48-entity-context1').then(checkResponse),
    fetch('./content/people-index.json?v=8.50-place-links1').then(checkResponse),
    fetch('./content/patristic-deep-index.json?v=8.49-context-ui1').then(checkResponse),
    fetch('./content/patristic-reader-manifest.json?v=8.51-patristic-reader1').then(checkResponse)
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
      fetch(`./content/knowledge/${relativePath}?v=8.53-knowledge-ui1`).then(checkResponse));
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
  host.querySelectorAll('[data-related-person-id]').forEach((button) => {
    button.addEventListener('click', () => {
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
        return `<article class="bible-modern-card">
          <strong>${escapeHtml(modern.name_en)}</strong>
          <span>${escapeHtml(modern.type || modern.class || 'Modern location')}</span>
          <small>Source confidence: ${escapeHtml(association.confidence_score || 0)}</small>
          <small>${escapeHtml(modern.latitude)}, ${escapeHtml(modern.longitude)}</small>
        </article>`;
      }).join('')}</div>
      ${images.length ? `<div class="bible-source-images">${images.map((image) => {
        const thumbnail = String(image.thumbnail_url_pattern || '').replace('####', '480');
        return `<figure>
          <img src="${escapeHtml(thumbnail || image.file_url)}" alt="${escapeHtml(Object.values(image.descriptions || {})[0] || place.name)}" loading="lazy">
          <figcaption>${escapeHtml(image.credit || image.author || 'Source contributor')} ·
            ${escapeHtml(image.license)}
            <a href="${escapeHtml(image.source_page_url || image.credit_url)}" target="_blank" rel="noopener">Source</a>
          </figcaption>
        </figure>`;
      }).join('')}</div>` : ''}
    </section>`;
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
  host.innerHTML = `<article class="bible-person-card">
    <div class="bible-person-title"><div><h3>${escapeHtml(record.name_en)}</h3>
    <p>${escapeHtml(record.category)}${record.subtype ? ` · ${escapeHtml(record.subtype)}` : ''}</p></div>
    <span class="bible-person-id">${escapeHtml(record.entity_id)}</span></div>
    ${record.aliases_en?.length ? `<div class="bible-person-meta">${record.aliases_en.map((alias) =>
      `<span class="bible-person-chip">${escapeHtml(alias)}</span>`).join('')}</div>` : ''}
    <p>${escapeHtml(record.description_en || 'No source description is available.')}</p>
    <section class="bible-person-section"><h4>Scripture references (${record.source_codes.length})</h4>
      <div class="bible-reference-grid">${record.source_codes.slice(0, 60).map((code) =>
        `<span class="bible-reference">${escapeHtml(code)}</span>`).join('')}</div>
      ${record.source_codes.length > 60 ? `<p>Showing the first 60 of ${record.source_codes.length} references.</p>` : ''}
    </section>
  </article>`;
}

async function renderSemanticKnowledge(query = '', sourceCode = '') {
  const results = document.getElementById('bibleKnowledgeEntityResults');
  const detail = document.getElementById('bibleKnowledgeEntityDetail');
  results.innerHTML = knowledgeEmpty('Loading Scripture-linked entities...');
  try {
    let ids = null;
    if (sourceCode) {
      const index = await loadKnowledge('semantic/by-source.json');
      ids = new Set(index.source_to_entities?.[sourceCode] || []);
    }
    const needle = String(query).trim().toLowerCase();
    const records = (await loadSemanticRecords()).filter((record) =>
      (!ids || ids.has(record.entity_id)) &&
      (!needle || `${record.name_en} ${(record.aliases_en || []).join(' ')} ${record.description_en}`
        .toLowerCase().includes(needle))
    ).slice(0, 100);
    results.innerHTML = records.map((record, index) =>
      `<button type="button" class="bible-person-result" data-entity-index="${index}">
        <strong>${escapeHtml(record.name_en)}</strong>
        <span>${escapeHtml(record.category)}${record.subtype ? ` · ${escapeHtml(record.subtype)}` : ''}</span>
      </button>`).join('') || knowledgeEmpty('No matching entity');
    results.querySelectorAll('[data-entity-index]').forEach((button) =>
      button.addEventListener('click', () => renderEntityDetail(records[Number(button.dataset.entityIndex)], detail)));
    if (records.length) renderEntityDetail(records[0], detail);
    else detail.innerHTML = '';
    setStatus(sourceCode
      ? `${records.length} key term, living thing, object, or group record(s) linked to ${sourceCode}.`
      : `${records.length} semantic Bible record(s) shown.`);
  } catch (error) {
    results.innerHTML = knowledgeEmpty('Unable to load semantic records', error.message);
  }
}

async function renderWordSearch(query = '') {
  const results = document.getElementById('bibleWordResults');
  const detail = document.getElementById('bibleWordDetail');
  const needle = String(query).trim().toLowerCase();
  const manifest = await loadKnowledge('concordance/manifest.json');
  const words = (manifest.all_words || []).filter((entry) =>
    !needle || entry.word.includes(needle)).slice(0, 120);
  results.innerHTML = words.map((entry, index) =>
    `<button type="button" class="bible-person-result" data-word-index="${index}">
      <strong>${escapeHtml(entry.word)}</strong><span>${entry.count.toLocaleString()} occurrences · ${entry.book_numbers.length} book(s)</span>
    </button>`).join('') || knowledgeEmpty('No word found');
  const showWord = async (entry) => {
    detail.innerHTML = knowledgeEmpty(`Loading “${entry.word}” across Scripture...`);
    const bookPayloads = await Promise.all(entry.book_numbers.map((bookNumber) => {
      const book = manifest.books.find((item) => item.book_number === bookNumber);
      return loadKnowledge(book.file.replace(/^knowledge\//, ''));
    }));
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
          `<span class="bible-reference">${escapeHtml(code)}</span>`).join('')}</div>
        ${references.length > 240 ? `<p>Showing the first 240 of ${references.length} verse locations.</p>` : ''}
      </section></article>`;
  };
  results.querySelectorAll('[data-word-index]').forEach((button) =>
    button.addEventListener('click', () => showWord(words[Number(button.dataset.wordIndex)])));
  if (needle && words.length) showWord(words[0]);
  setStatus(`${words.length} concordance result(s) shown.`);
}

async function renderDictionary(query = '') {
  const results = document.getElementById('bibleDictionaryResults');
  const detail = document.getElementById('bibleDictionaryDetail');
  const payload = await loadKnowledge('reference/easton.json');
  const needle = String(query).trim().toLowerCase();
  const records = (payload.records || []).filter((record) =>
    !needle || `${record.term_en} ${record.text_en}`.toLowerCase().includes(needle)).slice(0, 100);
  const show = (record) => {
    detail.innerHTML = `<article class="bible-person-card"><div class="bible-person-title">
      <div><h3>${escapeHtml(record.term_en)}</h3><p>Easton Bible Dictionary</p></div></div>
      <p>${escapeHtml(record.text_en || 'No entry text.')}</p></article>`;
  };
  results.innerHTML = records.map((record, index) =>
    `<button type="button" class="bible-person-result" data-dictionary-index="${index}">
      <strong>${escapeHtml(record.term_en)}</strong><span>${escapeHtml(record.match_type || 'Dictionary')}</span>
    </button>`).join('') || knowledgeEmpty('No dictionary entry found');
  results.querySelectorAll('[data-dictionary-index]').forEach((button) =>
    button.addEventListener('click', () => show(records[Number(button.dataset.dictionaryIndex)])));
  if (records.length) show(records[0]);
  setStatus(`${records.length} dictionary result(s) shown.`);
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
  results.innerHTML = records.map((record, index) =>
    `<button type="button" class="bible-person-result" data-topic-index="${index}">
      <strong>${escapeHtml(record.topic)}</strong><span>Topic index</span>
    </button>`).join('');
  results.querySelectorAll('[data-topic-index]').forEach((button) =>
    button.addEventListener('click', () => show(records[Number(button.dataset.topicIndex)])));
  if (records.length) show(records[0]);
  setStatus(`${records.length} Bible topic lists loaded.`);
}

async function renderBooks(query = '') {
  const [bookPayload, chapterPayload] = await Promise.all([
    loadKnowledge('reference/books.json'),
    loadKnowledge('reference/chapters.json')
  ]);
  const results = document.getElementById('bibleBookResults');
  const detail = document.getElementById('bibleBookDetail');
  const needle = String(query).trim().toLowerCase();
  const books = (bookPayload.records || []).filter((book) =>
    !needle || `${book.name_en} ${book.division} ${book.testament}`.toLowerCase().includes(needle));
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
  results.innerHTML = books.map((book, index) =>
    `<button type="button" class="bible-person-result" data-book-index="${index}">
      <strong>${escapeHtml(book.name_en)}</strong><span>${escapeHtml(book.division)}</span>
    </button>`).join('') || knowledgeEmpty('No Bible book found');
  results.querySelectorAll('[data-book-index]').forEach((button) =>
    button.addEventListener('click', () => show(books[Number(button.dataset.bookIndex)])));
  if (books.length) show(books[0]);
  setStatus(`${books.length} Bible book record(s) shown.`);
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
  const needle = String(query).trim().toLowerCase();
  const records = data.patristic.filter((record) =>
    !needle || `${record.title} ${record.author} ${record.publication_year}`.toLowerCase().includes(needle)
  ).slice(0, 80);
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
      reader = await fetch(`./${entry.file}?v=8.51-patristic-reader1`).then(checkResponse);
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

async function openContext(options = {}) {
  open();
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
    renderTimeline(selector.value);
  } else if (tab === 'journeys') {
    renderJourney(document.getElementById('bibleJourneySelector').value);
  } else if (tab === 'patristic') {
    renderPatristic(options.query || '');
  } else if (tab === 'knowledge') {
    renderKnowledge(options);
  }
}

window.openBibleContext = openContext;
window.openBiblePlacesForSource = (sourceCode) =>
  openContext({ tab: 'places', sourceCode });
window.openBibleKnowledgeForSource = (sourceCode) =>
  openContext({ tab: 'knowledge', section: 'entities', sourceCode });

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
  if (activeTab === 'patristic') requestAnimationFrame(() => renderPatristic());
  if (activeTab === 'knowledge') requestAnimationFrame(() => renderKnowledge());
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
      if (selectedTab === 'patristic') document.getElementById('biblePatristicDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Early Church works...</strong></div>';
      if (selectedTab === 'knowledge') document.getElementById('bibleKnowledgeEntityDetail').innerHTML = '<div class="bible-people-empty"><strong>Loading Bible study data...</strong></div>';
      loadData().then(() => requestAnimationFrame(() => {
        if (selectedTab === 'places') renderPlaceResults(document.getElementById('biblePlaceSearch').value);
        if (selectedTab === 'journeys') renderJourney(document.getElementById('bibleJourneySelector').value);
        if (selectedTab === 'timeline') renderTimeline(document.getElementById('bibleTimelineSelector').value);
        if (selectedTab === 'patristic') renderPatristic(document.getElementById('biblePatristicSearch').value);
        if (selectedTab === 'knowledge') renderKnowledge();
      })).catch((error) => setStatus(error.message, true));
    });
  });
  document.getElementById('biblePlaceSearch').addEventListener('input', (event) => renderPlaceResults(event.target.value));
  document.getElementById('bibleJourneySelector').addEventListener('change', (event) => renderJourney(event.target.value));
  document.getElementById('bibleTimelineSelector').addEventListener('change', (event) => renderTimeline(event.target.value));
  document.getElementById('biblePatristicSearch').addEventListener('input', (event) => renderPatristic(event.target.value));
  document.querySelectorAll('[data-knowledge-section]').forEach((button) => {
    button.addEventListener('click', () => renderKnowledge({ section: button.dataset.knowledgeSection }));
  });
  document.getElementById('bibleKnowledgeEntitySearch').addEventListener('input', (event) => {
    event.target.dataset.sourceCode = '';
    renderSemanticKnowledge(event.target.value);
  });
  document.getElementById('bibleWordSearch').addEventListener('input', (event) => renderWordSearch(event.target.value));
  document.getElementById('bibleDictionarySearch').addEventListener('input', (event) => renderDictionary(event.target.value));
  document.getElementById('bibleBookSearch').addEventListener('input', (event) => renderBooks(event.target.value));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
