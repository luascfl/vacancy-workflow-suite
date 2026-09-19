// ==UserScript==
// @name         Vacancy Workflow Suite
// @namespace    https://github.com/luascfl/vacancy-workflow-suite
// @version      1.0.0
// @description  Filtros por plataforma e salvamento manual de vagas CIEE, IEL, TAQE e ISBET na central.
// @author       luascfl
// @license      MIT
// @match        https://portal.ciee.org.br/quero-uma-vaga/*
// @match        https://candidato.ielbahia.com.br/Vaga*
// @match        https://*.taqe.com.br/*
// @match        https://isbet.org.br/*
// @match        https://estudante.startcarreiras.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect       script.google.com
// @run-at        document-idle
// ==/UserScript==

(() => {
  'use strict';

  const PANEL_ID = 'vacancy-workflow-suite-panel';
  const KEYS = Object.freeze({ endpoint: 'workflowSheetsEndpoint', token: 'workflowSheetsAccessToken' });
  const normal = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function setNativeValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function platform() {
    const host = location.hostname;
    if (host.includes('ciee.org.br')) return 'CIEE';
    if (host.includes('ielbahia.com.br')) return 'IEL Bahia';
    if (host.includes('taqe.com.br')) return 'ESPRO TAQE';
    if (host.includes('isbet.org.br')) return 'ISBET';
    if (host.includes('startcarreiras.com')) return 'Start Carreiras';
    return '';
  }

  function adapter() {
    const endpoint = GM_getValue(KEYS.endpoint, '');
    const accessToken = GM_getValue(KEYS.token, '');
    return endpoint && accessToken ? { endpoint, accessToken } : null;
  }

  function configureAdapter() {
    const current = adapter() || { endpoint: '', accessToken: '' };
    const endpoint = prompt('URL /exec do Workflow Sheets Adapter:', current.endpoint);
    if (endpoint === null) return;
    const accessToken = prompt('Token de acesso do adapter:', current.accessToken);
    if (accessToken === null) return;
    GM_setValue(KEYS.endpoint, endpoint.trim());
    GM_setValue(KEYS.token, accessToken.trim());
    setStatus('Adapter configurado neste navegador.');
  }

  function appendAlert(alert) {
    const config = adapter();
    if (!config) return Promise.reject(new Error('Configure o adapter pelo menu antes de salvar vagas.'));
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'POST',
      url: config.endpoint,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ operation: 'appendVacancyAlert', accessToken: config.accessToken, alert }),
      onload: ({ status, responseText }) => {
        if (status < 200 || status >= 300) return reject(new Error(`Adapter retornou HTTP ${status}.`));
        try {
          const response = JSON.parse(responseText);
          if (!response.ok) throw new Error(response.error || 'Adapter recusou a vaga.');
          resolve();
        } catch (error) { reject(error); }
      },
      onerror: () => reject(new Error('Não foi possível alcançar o Workflow Sheets Adapter.')),
    }));
  }

  function setStatus(message) {
    const target = document.querySelector(`#${PANEL_ID} .status`);
    if (target) target.textContent = message;
  }

  function applyCieeFilters(kind) {
    const city = document.querySelector('#CidadeVaga');
    if (!city) throw new Error('O filtro de cidade do CIEE ainda não está disponível.');
    setNativeValue(city, 'Salvador');
    const suggestion = [...document.querySelectorAll('[role="option"], li, button')]
      .find((element) => /salvador\s*-?\s*ba/i.test(normal(element.textContent)));
    suggestion?.click();
    setStatus(`Cidade Salvador preenchida para ${kind}. Revise e clique em Aplicar no CIEE.`);
  }

  function applyIelFilters(kind) {
    const city = document.querySelector('#Cidade');
    if (!city) throw new Error('O filtro de cidade do IEL ainda não está disponível.');
    setNativeValue(city, 'Salvador');
    const category = document.querySelector('#Categoria');
    if (category && kind === 'Aprendiz') setNativeValue(category, '1');
    if (kind === 'Estágio') {
      const course = document.querySelector('#Curso');
      if (course) setNativeValue(course, 'Psicologia');
    }
    const pcd = document.querySelector('#Pcd');
    if (pcd) setNativeValue(pcd, '1');
    setStatus(`Filtros do IEL preenchidos para ${kind}. Revise e pesquise manualmente.`);
  }

  function applyTaqeFilters() {
    const city = document.querySelector('#officeName');
    if (!city) throw new Error('O campo de cidade do TAQE ainda não está disponível.');
    setNativeValue(city, 'Salvador');
    setStatus('Cidade Salvador preenchida no TAQE. Revise e confirme a busca manualmente.');
  }

  function applyIsbetFilters(kind) {
    const vacancyType = document.querySelector('#form-field-tipo_de_vaga');
    const state = document.querySelector('#form-field-estado');
    const city = document.querySelector('#form-field-cidade');
    if (!vacancyType || !state || !city) throw new Error('Os filtros do ISBET ainda não estão disponíveis.');
    setNativeValue(vacancyType, kind === 'Aprendiz' ? 'J' : vacancyType.value);
    setNativeValue(state, 'BA');
    setNativeValue(city, '2162');
    setStatus('Filtros ISBET preenchidos para Bahia e Salvador. Revise e clique em Filtrar manualmente.');
  }

  function visibleListings() {
    const anchors = [...document.querySelectorAll('a[href]')]
      .filter((anchor) => anchor.offsetParent && normal(anchor.textContent).length > 4)
      .map((anchor) => ({
        title: normal(anchor.textContent),
        url: new URL(anchor.href, window.location.origin).href.split('#')[0],
        card: anchor.closest('article, li, .vaga-row, .job-card, .card, div'),
      }))
      .filter((listing, index, all) => /^https:\/\//.test(listing.url) && all.findIndex((item) => item.url === listing.url) === index);
    return anchors.slice(0, 50);
  }

  async function saveVisibleListings() {
    const listings = visibleListings();
    if (!listings.length) throw new Error('Nenhuma vaga visível com link para salvar.');
    if (!confirm(`Salvar ${listings.length} link(s) visível(is) de ${platform()} na planilha central?`)) return;
    let saved = 0;
    for (const listing of listings) {
      const details = normal(listing.card?.textContent);
      await appendAlert({ platform: platform(), title: listing.title, url: listing.url, location: details.slice(0, 280) });
      saved += 1;
    }
    setStatus(`${saved} vaga(s) salva(s) em Alertas capturados.`);
  }

  function addStyle() {
    if (document.getElementById(`${PANEL_ID}-style`)) return;
    const style = document.createElement('style');
    style.id = `${PANEL_ID}-style`;
    style.textContent = `#${PANEL_ID}{background:#fff;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 4px 20px #0002;color:#172033;font:14px system-ui,sans-serif;padding:12px;position:fixed;right:18px;bottom:18px;width:285px;z-index:2147483647}#${PANEL_ID}h2{font-size:15px;margin:0 0 8px}#${PANEL_ID}.actions{display:grid;gap:6px}#${PANEL_ID}button{background:#0a66c2;border:0;border-radius:6px;color:#fff;cursor:pointer;font:inherit;padding:8px;text-align:left}#${PANEL_ID}button.secondary{background:#4b5563}#${PANEL_ID}.status{font-size:12px;line-height:1.4;min-height:18px}`;
    document.head.append(style);
  }

  function mount() {
    addStyle();
    document.getElementById(PANEL_ID)?.remove();
    const box = document.createElement('aside');
    box.id = PANEL_ID;
    box.innerHTML = `<h2>Vacancy Workflow Suite</h2><p>${platform()}</p><div class="actions"></div><p class="status"></p>`;
    const actions = box.querySelector('.actions');
    const add = (label, handler, className = '') => {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = className;
      button.addEventListener('click', () => Promise.resolve(handler()).catch((error) => setStatus(error.message)));
      actions.append(button);
    };
    if (platform() === 'CIEE') {
      add('Preencher filtros CIEE, estágio', () => applyCieeFilters('Estágio'));
      add('Preencher filtros CIEE, aprendiz', () => applyCieeFilters('Aprendiz'));
    }
    if (platform() === 'IEL Bahia') {
      add('Preencher filtros IEL, estágio', () => applyIelFilters('Estágio'));
      add('Preencher filtros IEL, aprendiz', () => applyIelFilters('Aprendiz'));
    }
    if (platform() === 'ESPRO TAQE') add('Preencher cidade Salvador no TAQE', applyTaqeFilters);
    if (platform() === 'ISBET') add('Preencher filtros ISBET, aprendiz', () => applyIsbetFilters('Aprendiz'));
    add('Salvar vagas visíveis na central', saveVisibleListings);
    add('Configurar adapter', configureAdapter, 'secondary');
    document.body.append(box);
  }

  GM_registerMenuCommand('Configurar Workflow Sheets Adapter', configureAdapter);
  GM_registerMenuCommand('Reabrir Vacancy Workflow Suite', mount);
  mount();
})();
