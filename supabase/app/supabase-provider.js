(function() {
  'use strict';

  var config = window.BIBLE_SUPABASE_CONFIG || {};
  var baseUrl = String(config.url || '').replace(/\/+$/, '');
  var publishableKey = String(config.publishableKey || '');

  function configured_() {
    return config.enabled === true && !!baseUrl && !!publishableKey;
  }

  function headers_() {
    var headers = {
      apikey: publishableKey,
      Accept: 'application/json'
    };
    var accessToken = currentAccessToken_();
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

  function response_(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  }

  async function rest_(table, query, signal) {
    var result = await fetch(baseUrl + '/rest/v1/' + table + '?' + query, {
      headers: headers_(),
      signal: signal
    });
    if (!result.ok) {
      throw new Error('Supabase ' + table + ' request failed: HTTP ' + result.status);
    }
    return result.json();
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
    var result = await fetch(baseUrl + '/functions/v1/' + functionName, {
      method: 'POST',
      headers: Object.assign({}, headers_(), {
        Authorization: 'Bearer ' + (currentAccessToken_() || publishableKey),
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

  async function peopleSearch_(payload, signal) {
    var query = String(payload.q || '').trim();
    var limit = Math.min(100, Math.max(1, parseInt(payload.limit, 10) || 30));
    var encoded = encodeURIComponent('*' + query + '*');
    var people = await rest_(
      'bible_people',
      'select=person_id,canonical_name_en,canonical_name_ko,gender,roles' +
        '&or=(canonical_name_en.ilike.' + encoded + ',canonical_name_ko.ilike.' + encoded + ')' +
        '&order=canonical_name_en.asc&limit=' + limit,
      signal
    );
    return response_({
      status: 'success',
      data: people.map(function(person) {
        return {
          PERSON_ID: person.person_id,
          NAME_EN: person.canonical_name_en,
          NAME_KO: person.canonical_name_ko,
          GENDER: person.gender,
          ROLES: Array.isArray(person.roles) ? person.roles.join('|') : ''
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
    request: request_
  });
})();
