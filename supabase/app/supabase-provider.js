(function() {
  'use strict';

  var config = window.BIBLE_SUPABASE_CONFIG || {};
  var baseUrl = String(config.url || '').replace(/\/+$/, '');
  var publishableKey = String(config.publishableKey || '');

  function configured_() {
    return config.enabled === true && !!baseUrl && !!publishableKey;
  }

  function headers_(accessToken) {
    var headers = {
      apikey: publishableKey,
      Accept: 'application/json'
    };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    return headers;
  }

  function currentAccessToken_() {
    try {
      var user = JSON.parse(localStorage.getItem('quiz_current_user_v1') || 'null');
      return String(user && user.session_token || '');
    } catch (_) {
      return '';
    }
  }

  async function validAccessToken_() {
    var token = currentAccessToken_();
    if (!window.BibleSupabaseAuth || typeof window.BibleSupabaseAuth.getSession !== 'function') {
      return token;
    }
    var session = await window.BibleSupabaseAuth.getSession();
    if (!session || !session.access_token) return token;
    token = String(session.access_token);
    try {
      var user = JSON.parse(localStorage.getItem('quiz_current_user_v1') || 'null');
      if (user && user.session_token !== token) {
        user.session_token = token;
        if (session.refresh_token) user.refresh_token = session.refresh_token;
        localStorage.setItem('quiz_current_user_v1', JSON.stringify(user));
        if (typeof currentUser === 'object' && currentUser) {
          currentUser.session_token = token;
          if (session.refresh_token) currentUser.refresh_token = session.refresh_token;
        }
      }
    } catch (_) {}
    return token;
  }

  function response_(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  async function rest_(table, query, signal) {
    var accessToken = await validAccessToken_();
    var result = await fetch(baseUrl + '/rest/v1/' + table + '?' + query, {
      headers: headers_(accessToken),
      signal: signal
    });
    if (!result.ok) {
      throw new Error('Supabase ' + table + ' request failed: HTTP ' + result.status);
    }
    return result.json();
  }

  function encodeStoragePath_(value) {
    return String(value || '')
      .replace(/^\.?\//, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/');
  }

  async function fetchContent_(relativePath, signal) {
    if (!configured_()) {
      throw new Error('Supabase content storage is not configured.');
    }
    var accessToken = await validAccessToken_();
    var result = await fetch(
      baseUrl + '/storage/v1/object/authenticated/bible-content/' +
        encodeStoragePath_(relativePath),
      {
        headers: headers_(accessToken),
        signal: signal
      }
    );
    if (!result.ok) {
      throw new Error(
        'Supabase content request failed: HTTP ' + result.status +
        ' (' + relativePath + ')'
      );
    }
    return result;
  }

  function mapQuestion_(row) {
    return {
      N: row.n,
      SUBJECT: row.source_code,
      SOURCE_CODE: row.source_code,
      POINT_CODE: row.point_code,
      Q_EN: row.q_en,
      Q_KO: row.q_ko,
      P_EN: row.passage_en,
      P_KO: row.passage_ko,
      '1_EN': row.option_1_en,
      '1_KO': row.option_1_ko,
      '2_EN': row.option_2_en,
      '2_KO': row.option_2_ko,
      '3_EN': row.option_3_en,
      '3_KO': row.option_3_ko,
      '4_EN': row.option_4_en,
      '4_KO': row.option_4_ko,
      A: row.answer,
      E_EN: row.explanation_en,
      E_KO: row.explanation_ko
    };
  }

  async function callQuestionFunction_(payload, signal) {
    var functionName = String(config.questionFunction || 'bible-content');
    var accessToken = await validAccessToken_();
    var result = await fetch(baseUrl + '/functions/v1/' + functionName, {
      method: 'POST',
      headers: Object.assign({}, headers_(accessToken), {
        Authorization: 'Bearer ' + (accessToken || publishableKey),
        'Content-Type': 'application/json;charset=utf-8'
      }),
      body: JSON.stringify(payload),
      signal: signal
    });
    if (!result.ok) {
      return response_({
        status: 'error',
        code: 'SUPABASE_FUNCTION_ERROR',
        message: 'The Supabase Bible API returned HTTP ' + result.status + '.'
      }, result.status);
    }
    return result;
  }

  async function catalog_(signal) {
    return callQuestionFunction_({ action: 'catalog', sheet: 'BIBLE-OT' }, signal);
  }

  async function metMuseumSearch_(payload, signal) {
    var query = String(payload && payload.query || '').trim();
    var limit = Math.min(100, Math.max(1, parseInt(payload && payload.limit, 10) || 60));
    var parts = [
      'select=met_object_id,title,object_name,culture,period,object_date,year_begin,year_end,region_tags,topic_tags,bible_era_tags,timeline_100y,is_public_domain,object_url',
      'order=title.asc',
      'limit=' + limit
    ];
    if (query) parts.push('title=ilike.' + encodeURIComponent(query + '*'));
    ['era', 'region', 'topic'].forEach(function(name) {
      var value = String(payload && payload[name] || '').trim();
      if (value) parts.push(name === 'era' ? 'bible_era_tags=ilike.' + encodeURIComponent('*' + value + '*') :
        name === 'region' ? 'region_tags=ilike.' + encodeURIComponent('*' + value + '*') :
        'topic_tags=ilike.' + encodeURIComponent('*' + value + '*'));
    });
    return rest_('met_museum_objects', parts.join('&'), signal);
  }

  async function peopleSearch_(payload, signal) {
    var query = String(payload.q || '').trim();
    var limit = Math.min(100, Math.max(1, parseInt(payload.limit, 10) || 30));
    // Directory search is intentionally prefix based.  A single "D" should
    // start the D section, rather than return arbitrary names that merely
    // contain a d somewhere later in the spelling.
    var encodedPrefix = encodeURIComponent(query + '*');
    var peopleRequest = rest_(
      'bible_people',
      'select=person_id,canonical_name_en,canonical_name_ko,gender,roles' +
        '&or=(canonical_name_en.ilike.' + encodedPrefix + ',canonical_name_ko.ilike.' + encodedPrefix + ')' +
        '&order=canonical_name_en.asc&limit=' + limit,
      signal
    );

    // Aliases are a separate normalized table.  Querying them in parallel
    // keeps aliases first-class in the same search box without exposing any
    // privileged database key in the browser.
    var aliasesRequest = rest_(
      'bible_person_aliases',
      'select=person_id,alias&alias=ilike.' + encodedPrefix +
        '&order=alias.asc&limit=' + limit,
      signal
    );
    var results = await Promise.all([peopleRequest, aliasesRequest]);
    var people = (results[0] || []).map(function(person) {
      return Object.assign({}, person, { __name_match: true });
    });
    var aliases = results[1] || [];
    var aliasIds = aliases.map(function(alias) { return String(alias.person_id || ''); })
      .filter(Boolean);
    var known = {};
    people.forEach(function(person) { known[String(person.person_id)] = true; });
    var missingIds = aliasIds.filter(function(personId, index) {
      return !known[personId] && aliasIds.indexOf(personId) === index;
    });
    if (missingIds.length) {
      var aliasPeople = await rest_(
        'bible_people',
        'select=person_id,canonical_name_en,canonical_name_ko,gender,roles&person_id=in.(' +
          missingIds.map(encodeURIComponent).join(',') + ')&order=canonical_name_en.asc&limit=' + limit,
        signal
      );
      people = people.concat((aliasPeople || []).map(function(person) {
        return Object.assign({}, person, { __name_match: false });
      }));
    }
    var aliasById = {};
    aliases.forEach(function(alias) {
      var personId = String(alias.person_id || '');
      if (!personId) return;
      if (!aliasById[personId]) aliasById[personId] = [];
      aliasById[personId].push(alias.alias);
    });
    people = people.filter(function(person, index, all) {
      return all.findIndex(function(other) { return other.person_id === person.person_id; }) === index;
    }).sort(function(left, right) {
      // A true name match must appear before an alias-only match. Otherwise
      // searching S appears to return an A-name directory.
      if (!!left.__name_match !== !!right.__name_match) {
        return left.__name_match ? -1 : 1;
      }
      return String(left.canonical_name_en || '').localeCompare(String(right.canonical_name_en || ''));
    }).slice(0, limit);
    return response_({
      status: 'success',
      data: people.map(function(person) {
        return {
          PERSON_ID: person.person_id,
          NAME_EN: person.canonical_name_en,
          NAME_KO: person.canonical_name_ko,
          GENDER: person.gender,
          ROLES: Array.isArray(person.roles) ? person.roles.join('|') : '',
          ALIASES: aliasById[person.person_id] || [],
          MATCH_KIND: person.__name_match ? 'name' : 'alias'
        };
      })
    });
  }

  async function personDetail_(payload, signal) {
    var personId = String(payload.person_id || '').trim();
    var encodedId = encodeURIComponent('eq.' + personId);
    var results = await Promise.all([
      rest_('bible_people', 'select=*&person_id=' + encodedId + '&limit=1', signal),
      rest_('bible_person_aliases', 'select=*&person_id=' + encodedId + '&order=alias.asc', signal),
      rest_('bible_person_references', 'select=*&person_id=' + encodedId + '&order=source_code.asc', signal),
      rest_(
        'bible_relationships',
        'select=*&or=(from_id.' + encodedId + ',to_id.' + encodedId + ')',
        signal
      )
    ]);
    var person = results[0][0];
    if (!person) return response_({ status: 'error', message: 'Person not found.' }, 404);
    return response_({
      status: 'success',
      data: {
        person: {
          PERSON_ID: person.person_id,
          NAME_EN: person.canonical_name_en,
          NAME_KO: person.canonical_name_ko,
          GENDER: person.gender,
          DESCRIPTION_EN: person.description_en,
          DESCRIPTION_KO: person.description_ko,
          ROLES: Array.isArray(person.roles) ? person.roles.join('|') : ''
        },
        aliases: results[1].map(function(row) {
          return { ALIAS: row.alias, LANGUAGE: row.language };
        }),
        references: results[2].map(function(row) {
          return {
            SOURCE_CODE: row.source_code,
            REFERENCE_KIND: row.reference_kind,
            IS_KEY: String(row.is_key)
          };
        }),
        relationships: results[3].map(function(row) {
          return {
            RELATIONSHIP_ID: row.relation_id,
            FROM_ID: row.from_id,
            TO_ID: row.to_id,
            RELATIONSHIP_TYPE: row.relationship_type,
            TYPE: row.relationship_type,
            EVIDENCE_SOURCE_CODES: row.evidence_source_codes
          };
        })
      }
    });
  }

  async function request_(payload, signal) {
    if (!configured_()) {
      return response_({
        status: 'error',
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'The Supabase preview is not configured yet.'
      }, 503);
    }
    var action = String(payload.action || '');
    if (action === 'catalog') return catalog_(signal);
    if (action === 'people_search') return peopleSearch_(payload, signal);
    if (action === 'person_detail') return personDetail_(payload, signal);

    // Question totals and protected question rows must pass through the Edge
    // Function so the service-role key is never exposed in the browser.
    return callQuestionFunction_(payload, signal);
  }

  window.BibleSupabaseProvider = Object.freeze({
    isConfigured: configured_,
    request: request_,
    fetchContent: fetchContent_,
    metMuseumSearch: metMuseumSearch_
  });
})();
