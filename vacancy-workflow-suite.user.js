// ==UserScript==
// @name         Vacancy Workflow Suite
// @namespace    https://github.com/luascfl/vacancy-workflow-suite
// @version      2.0.3
// @description  Manual, source-specific vacancy workflows for CIEE, IEL Bahia, TAQE, ISBET, and Start Carreiras.
// @author       luascfl
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/luascfl/vacancy-workflow-suite/main/vacancy-workflow-suite.user.js
// @downloadURL  https://raw.githubusercontent.com/luascfl/vacancy-workflow-suite/main/vacancy-workflow-suite.user.js
// @match        https://portal.ciee.org.br/quero-uma-vaga/*
// @match        https://ciee.app/*
// @match        https://candidato.ielbahia.com.br/*
// @match        https://vagas.taqe.com.br/*
// @match        https://*.taqe.com.br/*
// @match        https://isbet.org.br/*
// @match        https://estudante.startcarreiras.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect       script.google.com
// @run-at        document-idle
// ==/UserScript==

(() => {
  'use strict';

  const PANEL_ID = 'vacancy-workflow-suite-panel';
  const KEYS = Object.freeze({
    endpoint: 'workflowSheetsEndpoint', token: 'workflowSheetsAccessToken',
    legacyReads: 'vacancyWorkflowLegacyReads', saved: 'vacancyWorkflowSavedIds',
  });

  const PLATFORM_STARTS = Object.freeze([
    ['CIEE internship vacancies', 'https://portal.ciee.org.br/quero-uma-vaga/estagio/'],
    ['CIEE apprenticeship vacancies', 'https://portal.ciee.org.br/quero-uma-vaga/jovem-aprendiz/'],
    ['IEL Bahia vacancies', 'https://candidato.ielbahia.com.br/'],
    ['TAQE vacancies', 'https://vagas.taqe.com.br/'],
    ['ISBET vacancies', 'https://isbet.org.br/quero-uma-vaga/'],
    ['Start Carreiras vacancies', 'https://estudante.startcarreiras.com/'],
  ]);

  function openPlatform(url) {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: true, insert: true, setParent: true });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }
  const LEGACY_RANGES = Object.freeze({
    CIEE: { internship: ['alertasCiee', 'AlertasEstagio!A:A'], apprenticeship: ['alertasCiee', 'AlertasAprendiz!A:A'] },
    ISBET: { default: ['alertasIsbet', 'Alertas!A:A'] },
    'IEL Bahia': { default: ['alertasIel', 'Alertas!A:A'] },
    'Start Carreiras': { default: ['alertasStartCarreiras', 'Alertas!A:A'] },
    'ESPRO TAQE': { default: ['alertasEspro', 'Alertas!A:A'] },
  });
  let saving = false;

  const normal = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const visible = (element) => Boolean(element && element.getClientRects().length);
  const absolute = (href) => new URL(href, location.origin).href.split('#')[0];

  function platform() {
    const host = location.hostname;
    if (host.includes('ciee.org.br') || host === 'ciee.app') return 'CIEE';
    if (host.includes('ielbahia.com.br')) return 'IEL Bahia';
    if (host.includes('taqe.com.br')) return 'ESPRO TAQE';
    if (host.includes('isbet.org.br')) return 'ISBET';
    if (host.includes('startcarreiras.com')) return 'Start Carreiras';
    return '';
  }

  function setNativeValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function waitFor(selector, timeout = 7000, root = document) {
    const deadline = Date.now() + timeout;
    let element;
    while (!(element = root.querySelector(selector))) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${selector}.`);
      await sleep(80);
    }
    return element;
  }

  async function waitForEnabledOption(select, value, timeout = 7000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const option = [...select.options].find((item) => item.value === value && !item.disabled);
      if (option && !select.disabled) return option;
      await sleep(80);
    }
    throw new Error(`The dependent city option ${value} did not load after the state changed.`);
  }

  function adapter() {
    const endpoint = normal(GM_getValue(KEYS.endpoint, ''));
    const accessToken = normal(GM_getValue(KEYS.token, ''));
    return endpoint && accessToken ? { endpoint, accessToken } : null;
  }

  function legacyReadsEnabled() {
    return GM_getValue(KEYS.legacyReads, true) === true;
  }

  function configureAdapter() {
    const current = adapter() || { endpoint: '', accessToken: '' };
    const endpoint = prompt('Workflow Sheets Adapter /exec URL:', current.endpoint);
    if (endpoint === null) return;
    const accessToken = prompt('Workflow Sheets Adapter access token:', current.accessToken);
    if (accessToken === null) return;
    const enabled = confirm('Read authorized legacy platform sources before saving? This does not read Alertas Central.');
    GM_setValue(KEYS.endpoint, normal(endpoint));
    GM_setValue(KEYS.token, normal(accessToken));
    GM_setValue(KEYS.legacyReads, enabled);
    setStatus(`Adapter configured. Legacy source reads are ${enabled ? 'enabled' : 'disabled'}.`);
  }

  function requestAdapter(payload) {
    const config = adapter();
    if (!config) return Promise.reject(new Error('Configure the Workflow Sheets Adapter before using sheet operations.'));
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'POST', url: config.endpoint, headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ ...payload, accessToken: config.accessToken }),
      onload: ({ status, responseText }) => {
        if (status < 200 || status >= 300) return reject(new Error(`Adapter returned HTTP ${status}.`));
        try {
          const response = JSON.parse(responseText);
          if (!response.ok) throw new Error(response.error || 'Adapter rejected the request.');
          resolve(response);
        } catch (error) { reject(error); }
      },
      onerror: () => reject(new Error('Could not reach the Workflow Sheets Adapter.')),
    }));
  }

  function appendVacancyAlert(alert) {
    return requestAdapter({ operation: 'appendVacancyAlert', alert });
  }

  async function readLegacySource(source) {
    if (!legacyReadsEnabled()) return new Set();
    const range = LEGACY_RANGES[source.platform]?.[source.legacyKind || 'default'];
    if (!range) return new Set();
    const response = await requestAdapter({ operation: 'read', sheetKey: range[0], range: range[1] });
    return new Set((response.values || []).flat().map(normal).filter(Boolean));
  }

  function savedIds() {
    const value = GM_getValue(KEYS.saved, {});
    return value && typeof value === 'object' ? value : {};
  }

  function isSaved(source, id) {
    return Boolean(savedIds()[`${source.platform}:${id}`]);
  }

  function markSaved(source, id) {
    const saved = savedIds();
    saved[`${source.platform}:${id}`] = new Date().toISOString();
    GM_setValue(KEYS.saved, saved);
  }

  function byIdFromUrl(url, fallback) {
    const parsed = new URL(url, location.origin);
    return parsed.searchParams.get('codigoVaga') || parsed.searchParams.get('id') || parsed.pathname.split('/').filter(Boolean).pop() || fallback;
  }

  async function loadCieeResults() {
    const buttonSelector = 'button.btn-exibir-mais-vagas';
    const sentinelSelector = '.exibir-mais-vagas.text-center';
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const sentinel = document.querySelector(sentinelSelector);
      const button = document.querySelector(buttonSelector);
      if (!visible(button) || (sentinel && getComputedStyle(sentinel).display === 'none')) return;
      const before = document.querySelectorAll('div.vagas-lista > a.vaga-row').length;
      button.scrollIntoView({ block: 'center' });
      button.click();
      for (let wait = 0; wait < 30; wait += 1) {
        await sleep(100);
        if (document.querySelectorAll('div.vagas-lista > a.vaga-row').length > before || !visible(button)) break;
      }
    }
    throw new Error('CIEE stopped loading results after 100 explicit-result requests.');
  }

  function extractCieeListings() {
    const route = location.pathname.includes('jovem-aprendiz') ? 'jovem-aprendiz' : 'estagio';
    return [...document.querySelectorAll('div.vagas-lista > a.vaga-row')].map((row) => {
      const detail = row.querySelector('.btn-view-vaga-detail');
      const raw = row.getAttribute('href') || '';
      const id = new URL(raw, location.origin).searchParams.get('codigoVaga');
      if (!detail || !id) return null;
      const title = normal(row.querySelector('h1,h2,h3,h4,h5,.title,.vaga-title')?.textContent || row.textContent);
      return { platform: 'CIEE', legacyKind: route === 'estagio' ? 'internship' : 'apprenticeship', id, title, url: `https://portal.ciee.org.br/quero-uma-vaga/${route}/?codigoVaga=${encodeURIComponent(id)}`, location: normal(row.querySelector('.localidade,.location')?.textContent) };
    }).filter(Boolean);
  }

  function extractIelListings() {
    const containers = ['#grid', '.detalhe.resultados'];
    const listings = [];
    for (const selector of containers) {
      const container = document.querySelector(selector);
      if (!container) continue;
      for (const vacancy of container.querySelectorAll(selector === '#grid' ? 'li.vaga, div.vaga' : '.vaga')) {
        const heading = vacancy.querySelector(selector === '#grid' ? 'h4,h5' : '.text h4,.text h5,.text h3');
        const match = normal(heading?.textContent).match(/^#(\d+)\s*-\s*(.+)$/);
        if (!match) continue;
        const [, id, title] = match;
        listings.push({ platform: 'IEL Bahia', id, title: normal(title), url: `https://candidato.ielbahia.com.br/Login/Vaga?id=${encodeURIComponent(id)}`, location: normal(vacancy.querySelector('.cidade,.location')?.textContent) });
      }
    }
    return uniqueListings(listings);
  }

  function extractIsbetListings() {
    return uniqueListings([...document.querySelectorAll('div#api > div a[data-href]')].map((link) => {
      const url = absolute(link.dataset.href);
      const card = link.closest('article, .elementor-widget-container, div#api > div');
      return { platform: 'ISBET', id: byIdFromUrl(url, normal(link.textContent)), title: normal(link.querySelector('h1,h2,h3,h4,h5')?.textContent || link.textContent), url, location: normal(card?.querySelector('.location,.cidade')?.textContent) };
    }).filter((listing) => listing.title && /^https:\/\//.test(listing.url)));
  }

  async function extractStartListings() {
    const rows = [...document.querySelectorAll('tbody.MuiTableBody-root > tr')];
    if (!rows.length) throw new Error('No Start Carreiras vacancy rows are rendered. Log in and load the table first.');
    const listings = [];
    for (const row of rows) {
      const share = row.querySelector('button.MuiFab-sizeLarge, button[aria-label*="share" i], button[title*="share" i]');
      if (!share) throw new Error('A Start vacancy row has no source share control. No generic link fallback is used.');
      share.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const copy = document.querySelector('button.MuiFab-sizeSmall:nth-child(1), button[aria-label*="copy" i], button[title*="copy" i]');
      if (!copy) throw new Error('Start share menu did not reveal its source clipboard action.');
      copy.click();
      let url;
      try { url = normal(await navigator.clipboard.readText()); } catch (_) { throw new Error('Start clipboard permission was denied. Allow clipboard read and retry; no vacancy was saved.'); }
      if (!/^https:\/\//.test(url)) throw new Error('Start clipboard did not contain an HTTPS vacancy link.');
      const cells = [...row.querySelectorAll('td')].map((cell) => normal(cell.textContent)).filter(Boolean);
      listings.push({ platform: 'Start Carreiras', id: byIdFromUrl(url, cells[0]), title: cells[0] || normal(row.textContent), company: cells[1] || '', location: cells.find((cell) => /,\s*[A-Z]{2}$/.test(cell)) || '', url });
    }
    return uniqueListings(listings);
  }

  function extractTaqeListings() {
    const sourceLinks = document.querySelectorAll('article a[href], li a[href], section a[href], [class*="vacancy" i] a[href]');
    return uniqueListings([...sourceLinks].filter((link) => /^saiba mais$/i.test(normal(link.textContent))).map((link) => {
      const card = link.closest('article, li, section, [class*="vacancy" i]');
      const url = absolute(link.getAttribute('href'));
      const title = normal(card?.querySelector('h1,h2,h3,h4,h5')?.textContent);
      const company = normal(card?.querySelector('h2')?.textContent);
      const textNodes = card ? [...card.querySelectorAll('p,h4,span')] : [];
      const location = normal(textNodes.find((element) => /,\s*[A-Z]{2}$/.test(normal(element.textContent)))?.textContent);
      return { platform: 'ESPRO TAQE', id: byIdFromUrl(url, title), title, company, location, url };
    }).filter((listing) => listing.title && /^https:\/\//.test(listing.url)));
  }

  function uniqueListings(listings) {
    return listings.filter((listing, index) => listings.findIndex((other) => other.platform === listing.platform && other.id === listing.id) === index);
  }

  async function applyCieeFilters(kind) {
    const expectedRoute = kind === 'Apprenticeship' ? 'jovem-aprendiz' : 'estagio';
    if (!location.pathname.includes(expectedRoute)) {
      throw new Error(`Open the CIEE ${expectedRoute} route before applying the ${kind.toLowerCase()} source filter.`);
    }
    const city = await waitFor('input#CidadeVaga');
    setNativeValue(city, 'Salvador');
    const suggestion = await waitFor('#\\32 927408, [role="option"]');
    if (!/salvador\s*-?\s*ba/i.test(normal(suggestion.textContent))) throw new Error('CIEE did not render the Salvador - BA source suggestion.');
    suggestion.click();
    (await waitFor('div.btn-search')).click();
    await waitFor('div.vagas-lista');
    setStatus(`CIEE ${kind} filter applied and results rendered. Use “Save rendered vacancies” to load and save source rows.`);
  }

  async function applyIelFilters(kind) {
    const city = await waitFor('input#Cidade');
    if (kind === 'Apprenticeship') setNativeValue(await waitFor('select#Categoria'), '1');
    setNativeValue(city, 'Salvador');
    if (kind === 'Internship') setNativeValue(await waitFor('input#Curso'), 'Psicologia');
    setNativeValue(await waitFor('select#Pcd'), '1');
    (await waitFor('.btn-search > .fas')).click();
    await waitFor('#grid, .detalhe.resultados');
    setStatus(`IEL ${kind} filter applied and results rendered.`);
  }

  async function applyIsbetFilters(kind) {
    const type = await waitFor('select#form-field-tipo_de_vaga');
    const state = await waitFor('select#form-field-estado');
    const city = await waitFor('select#form-field-cidade');
    setNativeValue(type, kind === 'Apprenticeship' ? 'J' : 'E');
    setNativeValue(state, 'BA');
    await waitForEnabledOption(city, '2162');
    setNativeValue(city, '2162');
    (await waitFor('.elementor-field-group .elementor-button-text')).click();
    await waitFor('div#api > div a[data-href]');
    setStatus(`ISBET ${kind} filter applied and results rendered.`);
  }

  async function applyTaqeFilters() {
    const city = await waitFor('input#officeName');
    setNativeValue(city, 'Salvador');
    const searchPath = await waitFor('.fa-search > path');
    (searchPath.closest('button,[role="button"],a') || searchPath).click();
    await sleep(300);
    const close = document.querySelector('button:nth-child(1)');
    if (close && /close|fechar|x/i.test(normal(close.getAttribute('aria-label')) + normal(close.textContent))) close.click();
    await waitFor('article a[href], li a[href], section a[href], [class*="vacancy" i] a[href]');
    setStatus('TAQE Salvador filter applied and source results rendered.');
  }

  async function collectListings() {
    const source = platform();
    if (!source) throw new Error('This page is not a supported vacancy platform.');
    if (source === 'CIEE' && location.hostname !== 'ciee.app') await loadCieeResults();
    const listings = source === 'CIEE' ? extractCieeListings()
      : source === 'IEL Bahia' ? extractIelListings()
      : source === 'ISBET' ? extractIsbetListings()
      : source === 'Start Carreiras' ? await extractStartListings()
      : extractTaqeListings();
    if (!listings.length) throw new Error(`No source-specific ${source} vacancy rows are rendered.`);
    return listings;
  }

  async function saveRenderedListings() {
    if (saving) throw new Error('A save is already running. Wait for its partial or complete report.');
    saving = true;
    try {
      const listings = await collectListings();
      let legacyIds = new Set();
      try { legacyIds = await readLegacySource(listings[0]); } catch (error) { setStatus(`Legacy dedup unavailable: ${error.message}. Local dedup remains active.`); }
      const pending = listings.filter((listing) => !isSaved(listing, listing.id) && !legacyIds.has(listing.id) && !legacyIds.has(listing.url));
      const skipped = listings.length - pending.length;
      if (!pending.length) return setStatus(`Nothing to save: ${skipped} source row(s) already known locally or in the configured legacy source.`);
      if (!confirm(`Save ${pending.length} ${platform()} vacancy record(s) to Alertas capturados? ${skipped} duplicate(s) will be skipped.`)) return;
      let saved = 0;
      let failed;
      for (const listing of pending) {
        try {
          await appendVacancyAlert({ platform: listing.platform, title: listing.title, company: listing.company || '', location: listing.location || '', url: listing.url });
          markSaved(listing, listing.id);
          saved += 1;
        } catch (error) { failed = `${listing.id}: ${error.message}`; break; }
      }
      setStatus(failed ? `Partial save: ${saved}/${pending.length} saved. Failed at ${failed}` : `${saved} vacancy record(s) saved; ${skipped} duplicate(s) skipped.`);
    } finally { saving = false; }
  }

  async function inspectCieeScheduling(kind) {
    if (platform() !== 'CIEE') throw new Error('CIEE scheduling inspection is available only on CIEE pages.');
    const range = kind === 'Apprenticeship' ? 'AlertasAprendiz!D:D' : 'AlertasEstagio!D:D';
    const response = await requestAdapter({ operation: 'read', sheetKey: 'alertasCiee', range });
    const links = (response.values || []).flat().map(normal).filter((value) => /^https:\/\//.test(value));
    const state = location.hostname === 'ciee.app' && (/\/login\/?$/.test(location.pathname) || document.querySelector('input#login')) ? 'login required'
      : document.querySelector('div.calendar-size') ? 'calendar rendered'
        : document.querySelector('#candidatar > .mat-mdc-button-touch-target') ? 'application available'
          : document.querySelector('a.link-interesse') ? 'interest available' : 'no supported scheduling state rendered';
    renderScheduleLinks(links, kind, state);
    setStatus(`CIEE ${kind}: ${links.length} authorized source link(s); current page state: ${state}.`);
  }

  function renderScheduleLinks(links, kind, state) {
    const target = document.querySelector(`#${PANEL_ID} .schedule-links`);
    if (!target) return;
    target.replaceChildren();
    const note = document.createElement('p');
    note.textContent = `Current page: ${state}. Open a source link yourself, then inspect again.`;
    target.append(note);
    links.forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = `${kind} source ${index + 1}`;
      target.append(link);
    });
  }

  function confirmCieeInterest() {
    if (platform() !== 'CIEE') throw new Error('CIEE interest action is available only on CIEE pages.');
    if (location.hostname === 'ciee.app' && (/\/login\/?$/.test(location.pathname) || document.querySelector('input#login'))) throw new Error('CIEE login is required; the script will not bypass it.');
    if (document.querySelector('div.calendar-size')) throw new Error('A calendar is rendered. This workflow has no source contract to select a time, so no appointment is claimed or created.');
    if (document.querySelector('#candidatar > .mat-mdc-button-touch-target')) throw new Error('A CIEE application control is rendered. This suite does not apply on your behalf.');
    const interest = document.querySelector('a.link-interesse');
    if (!interest) throw new Error('No CIEE interest action is rendered for this vacancy.');
    if (!confirm(`Mark interest for this rendered CIEE vacancy only?\n${location.href}`)) return;
    interest.click();
    setStatus('Interest click requested for the confirmed rendered vacancy. Verify the site response; no success is inferred from the selector.');
  }

  function rebuildIelLinks() {
    const listings = extractIelListings();
    if (!listings.length) throw new Error('No IEL source vacancy titles matching “#ID - title” are rendered.');
    for (const listing of listings) {
      const heading = [...document.querySelectorAll('#grid h4,#grid h5,.detalhe.resultados .text h4,.detalhe.resultados .text h5,.detalhe.resultados .text h3')]
        .find((element) => normal(element.textContent).startsWith(`#${listing.id} -`));
      if (!heading || heading.querySelector('a[data-vacancy-workflow-link]')) continue;
      const link = document.createElement('a');
      link.href = listing.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.dataset.vacancyWorkflowLink = 'true';
      link.textContent = `${listing.url} - ${listing.title}`;
      link.style.cssText = 'color:inherit;text-decoration:none';
      heading.replaceChildren(link);
    }
    setStatus(`Rebuilt ${listings.length} IEL Login/Vaga?id=… source link(s).`);
  }

  function setStatus(message) {
    const target = document.querySelector(`#${PANEL_ID} .status`);
    if (target) target.textContent = message;
  }

  function addStyle() {
    if (document.getElementById(`${PANEL_ID}-style`)) return;
    const style = document.createElement('style');
    style.id = `${PANEL_ID}-style`;
    style.textContent = [
      `#${PANEL_ID}{background:#fff!important;border:1px solid #d0d7de!important;border-radius:10px!important;box-shadow:0 4px 20px #0002!important;color:#172033!important;font:14px/1.4 system-ui,sans-serif!important;letter-spacing:normal!important;max-height:60vh!important;overflow:auto!important;padding:10px!important;position:fixed!important;right:12px!important;bottom:12px!important;text-transform:none!important;width:260px!important;z-index:2147483647!important}`,
      `#${PANEL_ID} h2{color:#172033!important;font:600 14px/1.3 system-ui,sans-serif!important;letter-spacing:normal!important;margin:0 0 6px!important;text-transform:none!important}`,
      `#${PANEL_ID} p{color:#374151!important;font:12px/1.4 system-ui,sans-serif!important;margin:4px 0!important;text-transform:none!important}`,
      `#${PANEL_ID} .actions{display:grid!important;gap:6px!important}`,
      `#${PANEL_ID} button{background:#0a66c2!important;border:0!important;border-radius:6px!important;color:#fff!important;cursor:pointer!important;font:600 12px/1.3 system-ui,sans-serif!important;letter-spacing:normal!important;margin:0!important;padding:7px 9px!important;text-align:left!important;text-transform:none!important;width:100%!important}`,
      `#${PANEL_ID} button.secondary{background:#4b5563!important}`,
      `#${PANEL_ID} .status,#${PANEL_ID} .schedule-links{min-height:16px!important}`,
      `#${PANEL_ID} .schedule-links a{display:block!important;margin:4px 0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}`,
    ].join('');
    document.head.append(style);
  }

  function mount() {
    addStyle();
    document.getElementById(PANEL_ID)?.remove();
    const box = document.createElement('aside');
    box.id = PANEL_ID;
    box.innerHTML = `<h2>Vacancy Workflow Suite</h2><p>${platform()}</p><div class="actions"></div><p class="status">Manual actions only. No application or appointment is automatic.</p><div class="schedule-links"></div>`;
    const actions = box.querySelector('.actions');
    const add = (label, handler, className = '') => {
      const button = document.createElement('button');
      button.textContent = label; button.className = className;
      button.addEventListener('click', () => Promise.resolve(handler()).catch((error) => setStatus(error.message)));
      actions.append(button);
    };
    if (platform() === 'CIEE') {
      if (location.hostname !== 'ciee.app') { add('Apply CIEE internship filter', () => applyCieeFilters('Internship')); add('Apply CIEE apprenticeship filter', () => applyCieeFilters('Apprenticeship')); }
      add('Inspect CIEE internship scheduling sources', () => inspectCieeScheduling('Internship'));
      add('Inspect CIEE apprenticeship scheduling sources', () => inspectCieeScheduling('Apprenticeship'));
      add('Confirm interest for rendered CIEE vacancy', confirmCieeInterest);
    }
    if (platform() === 'IEL Bahia') { add('Apply IEL internship filter', () => applyIelFilters('Internship')); add('Apply IEL apprenticeship filter', () => applyIelFilters('Apprenticeship')); add('Rebuild IEL Login/Vaga links', rebuildIelLinks); }
    if (platform() === 'ESPRO TAQE') add('Apply TAQE Salvador filter', applyTaqeFilters);
    if (platform() === 'ISBET') { add('Apply ISBET apprenticeship filter', () => applyIsbetFilters('Apprenticeship')); add('Apply ISBET internship filter', () => applyIsbetFilters('Internship')); }
    add('Save rendered vacancies to central', saveRenderedListings);
    add('Configure adapter and legacy reads', configureAdapter, 'secondary');
    document.body.append(box);
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Configure Workflow Sheets Adapter', configureAdapter);
    GM_registerMenuCommand('Show Vacancy Workflow Suite', mount);
    for (const [label, url] of PLATFORM_STARTS) {
      GM_registerMenuCommand(`Open ${label}`, () => openPlatform(url));
    }
  }
  mount();
})();
