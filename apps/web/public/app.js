let authToken = '';
let currentUser = null;
let currentVehicle = null;
let currentLookupSpecs = [];
let quoteOptionsCache = null;
let activeTier = 'bestQuality';
let editableItems = [];
let companyClients = [];
let companyProducts = [];
let companyQuotes = [];
let catalogItems = [];
let allVehicles = [];
let editingProductId = null;
let editingClientId = null;
let editingVehicleId = null;
let editingCatalogId = null;
let adminPendingUsersCount = 0;
let adminUsersList = [];
let activeProductSubtypeFilter = 'ALL';

const VALID_ROUTES = ['/index', '/oficina', '/admin', '/principal', '/auth', '/help'];

const SUBTYPE_LABELS = {
  MOTOR: 'Óleo de Motor',
  FREIO: 'Fluido de Freio',
  CAMBIO: 'Fluido de Transmissão',
  OLEO: 'Filtro de Óleo',
  COMBUSTIVEL: 'Filtro de Combustível',
  AR: 'Filtro de Ar do Motor',
};

const VEHICLE_TYPE_LABELS = {
  CARRO: 'Automóvel / Passeio',
  UTILITARIO: 'SUV / Utilitário',
  MOTO: 'Motocicleta',
  CAMINHAO: 'Caminhão / Pesado',
};

const QUOTE_PROFILE_LABELS = {
  CHEAPEST: 'Mais Barato',
  BEST_QUALITY: 'Melhor Qualidade ★',
  MOST_EXPENSIVE: 'Mais Caro',
  CUSTOM: 'Personalizado',
};

const QUOTE_STATUS_LABELS = {
  DRAFT: 'Salvo no Balcão',
  SENT: 'Enviado por E-mail',
};

const USER_STATUS_LABELS = {
  APPROVED: 'Conta Ativa',
  PENDING: 'Aguardando Aprovação',
  REJECTED: 'Acesso Recusado',
};

function restoreSavedSession() {
  try {
    const savedToken = window.localStorage.getItem('soil_auth_token');
    const savedUser = window.localStorage.getItem('soil_auth_user');
    if (savedToken && savedUser) {
      authToken = savedToken;
      currentUser = JSON.parse(savedUser);
    }
  } catch {
    authToken = '';
    currentUser = null;
  }
}

function persistSession(token, user) {
  try {
    if (token && user) {
      window.localStorage.setItem('soil_auth_token', token);
      window.localStorage.setItem('soil_auth_user', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('soil_auth_token');
      window.localStorage.removeItem('soil_auth_user');
    }
  } catch {
    // Ignora se localStorage estiver indisponível
  }
}

async function initSession() {
  initAntigravityParticles();
  initHeroTypingPreview();
  initGlobalFloatingDismissListeners();
  syncCatalogSubtypes();

  restoreSavedSession();
  updatePersonaNavigation(window.location.pathname);

  await preloadFleetAndCatalogs();
  if (authToken) {
    await loadClients();
  }

  populateVehicleSelectors();
  syncAllCustomSelects();
  await applyRouteFromPath(window.location.pathname);

  window.addEventListener('popstate', () => {
    applyRouteFromPath(window.location.pathname);
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.textContent = next === 'dark' ? 'Modo Claro' : 'Modo Escuro';
  }
}

function handleRoleWorkspaceClick(event) {
  if (event) event.preventDefault();
  if (!currentUser || !authToken) {
    navigateTo('/auth', event);
    return;
  }
  const dest = currentUser.role === 'ADMIN' ? '/admin' : '/oficina';
  navigateTo(dest, event);
}

async function navigateToOnboardingForm(event) {
  if (event) event.preventDefault();
  await navigateTo('/principal', event);
  const cnpjInput = document.getElementById('reg-cnpj');
  if (cnpjInput) cnpjInput.focus();
}

function switchAuthTab(tabName) {
  const loginBtn = document.getElementById('auth-tab-login');
  const regBtn = document.getElementById('auth-tab-register');
  const loginPanel = document.getElementById('auth-panel-login');
  const regPanel = document.getElementById('auth-panel-register');

  const isReg = tabName === 'register';
  if (loginBtn) loginBtn.classList.toggle('active', !isReg);
  if (regBtn) regBtn.classList.toggle('active', isReg);
  if (loginPanel) loginPanel.style.display = isReg ? 'none' : 'block';
  if (regPanel) regPanel.style.display = isReg ? 'block' : 'none';
}

function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  const icon = btnEl?.querySelector('.symbol');
  if (icon) {
    icon.textContent = isPwd ? 'visibility_off' : 'visibility';
  }
}

function maskCnpjInput(inputEl) {
  if (!inputEl) return;
  const digits = String(inputEl.value || '')
    .replace(/\D/g, '')
    .slice(0, 14);
  let out = digits;
  if (digits.length > 12) {
    out = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  } else if (digits.length > 8) {
    out = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  } else if (digits.length > 5) {
    out = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  } else if (digits.length > 2) {
    out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  inputEl.value = out;
}

function maskPhoneInput(inputEl) {
  if (!inputEl) return;
  const digits = String(inputEl.value || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  let out = digits;
  if (digits.length > 10) {
    out = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  } else if (digits.length > 6) {
    out = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else if (digits.length > 2) {
    out = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  inputEl.value = out;
}

async function navigateTo(path, event) {
  if (event) event.preventDefault();
  window.history.pushState({}, '', path);
  await applyRouteFromPath(path);
}

async function applyRouteFromPath(rawPath) {
  const route = VALID_ROUTES.includes(rawPath) ? rawPath : '/index';
  const effectiveViewRoute = route === '/principal' ? '/auth' : route;

  const viewMap = {
    '/index': 'view-index',
    '/oficina': 'view-oficina',
    '/admin': 'view-admin',
    '/auth': 'view-auth',
    '/help': 'view-help',
  };

  const navMap = {
    '/index': 'nav-index',
    '/oficina': 'nav-oficina',
    '/admin': 'nav-admin',
    '/help': 'nav-help',
  };

  Object.entries(viewMap).forEach(([r, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = r === effectiveViewRoute ? 'block' : 'none';
  });

  Object.entries(navMap).forEach(([r, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', r === route);
  });

  updatePersonaNavigation(route);

  if (route === '/oficina') {
    await refreshOficinaWorkspace();
  } else if (route === '/admin') {
    await refreshAdminWorkspace();
  } else if (route === '/principal') {
    renderAuthSessionDetails();
    switchAuthTab('register');
  } else if (route === '/auth') {
    renderAuthSessionDetails();
    switchAuthTab('login');
  }

  syncAllCustomSelects();
}

/* ============================================================================
   NAVBAR E CONTROLE POR ROLE (VISITANTE / MECÂNICO USER / ADMIN)
   ============================================================================ */
function updatePersonaNavigation() {
  const navIndex = document.getElementById('nav-index');
  const navOficina = document.getElementById('nav-oficina');
  const navAdmin = document.getElementById('nav-admin');
  const navHelp = document.getElementById('nav-help');
  const visitorActions = document.getElementById('visitor-actions');
  const loggedActions = document.getElementById('logged-actions');
  const badge = document.getElementById('tenant-badge');
  const pillLink = document.getElementById('tenant-pill-link');
  const dot = document.getElementById('tenant-dot');

  const isLogged = Boolean(currentUser && authToken);
  const isAdmin = isLogged && currentUser.role === 'ADMIN';
  const isMechanic = isLogged && currentUser.role === 'USER';

  if (navIndex) navIndex.style.display = 'inline-flex';
  if (navHelp) navHelp.style.display = 'inline-flex';

  if (!isLogged) {
    if (navOficina) navOficina.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
    if (visitorActions) visitorActions.style.display = 'flex';
    if (loggedActions) loggedActions.style.display = 'none';
    if (dot) dot.classList.add('offline');
    return;
  }

  if (visitorActions) visitorActions.style.display = 'none';
  if (loggedActions) loggedActions.style.display = 'flex';
  if (dot) dot.classList.remove('offline');

  if (isAdmin) {
    if (navOficina) navOficina.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'inline-flex';
    if (badge) badge.textContent = `Admin • ${currentUser.name}`;
    if (pillLink) pillLink.setAttribute('href', '/admin');
  } else if (isMechanic) {
    if (navOficina) navOficina.style.display = 'inline-flex';
    if (navAdmin) navAdmin.style.display = 'none';
    const companyLabel = currentUser.companyTradeName || 'Minha Oficina';
    if (badge) badge.textContent = `${currentUser.name} • ${companyLabel}`;
    if (pillLink) pillLink.setAttribute('href', '/oficina');
  }
}

function initHeroTypingPreview() {
  const target = document.getElementById('typing-spec-preview');
  if (!target) return;

  const phrases = [
    'Catálogo Homologado • 3 Lubrificantes & 3 Filtros',
    'Lubrificantes • Óleo de Motor, Fluido de Freio e Câmbio',
    'Filtros • Óleo, Combustível e Ar do Motor',
    'Cotação Inteligente • Mais Barato, Melhor Qualidade e Mais Caro',
  ];

  let phraseIdx = 0;
  setInterval(() => {
    phraseIdx = (phraseIdx + 1) % phrases.length;
    target.textContent = phrases[phraseIdx];
  }, 3600);
}

/* Campo de Partículas Orbitais estilo antigravity.google (Zero Azul) */
function initAntigravityParticles() {
  const canvas = document.getElementById('agy-particles-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;

  const palette = ['#FFE432', '#FBBC04', '#00B95C', '#FC413D', '#A6ACB8'];
  const particles = Array.from({ length: 72 }, (_, idx) => {
    const angle = (idx / 72) * Math.PI * 2;
    const radiusSpread = 0.65 + (idx % 7) * 0.08;
    return {
      angle,
      speed: 0.0016 + (idx % 5) * 0.0004,
      radiusSpread,
      size: 1.3 + (idx % 3) * 0.85,
      color: palette[idx % palette.length],
      alpha: 0.22 + (idx % 4) * 0.12,
    };
  });

  function resize() {
    if (!canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = Math.max(rect.width, 320);
    height = canvas.height = Math.max(rect.height, 260);
    pointerX = width / 2;
    pointerY = height / 2;
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
  });

  function renderFrame() {
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2 + (pointerX - width / 2) * 0.035;
    const centerY = height / 2 + (pointerY - height / 2) * 0.035;
    const baseRadiusX = Math.min(width * 0.42, 420);
    const baseRadiusY = Math.min(height * 0.38, 150);

    for (const p of particles) {
      p.angle += p.speed;
      const x = centerX + Math.cos(p.angle) * baseRadiusX * p.radiusSpread;
      const y = centerY + Math.sin(p.angle) * baseRadiusY * p.radiusSpread;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
}

/* ============================================================================
   AUTENTICAÇÃO E REDIRECIONAMENTO POR ROLE (/auth)
   ============================================================================ */
async function authenticateWithCredentials(loginOrEmail, password, silent = false) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginOrEmail, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (!silent) {
        showToast('login-feedback', data.error?.message || 'Credenciais inválidas.', true);
      }
      return false;
    }

    authToken = data.accessToken;
    currentUser = data.user;
    persistSession(authToken, currentUser);
    updatePersonaNavigation();

    await Promise.all([loadClients(), preloadFleetAndCatalogs()]);
    renderAuthSessionDetails();

    if (currentVehicle) {
      await selectVehicle(currentVehicle.id, false);
    }

    if (!silent) {
      const roleTitle = currentUser.role === 'ADMIN' ? 'Administrador' : 'Mecânico / Consultor';
      showToast('login-feedback', `Bem-vindo, ${currentUser.name} (${roleTitle}).`, false);
    }
    return true;
  } catch (err) {
    console.error('Erro de autenticação:', err);
    return false;
  }
}

function fillLoginForm(login, password) {
  const idInput = document.getElementById('login-identifier');
  const pwdInput = document.getElementById('login-password');
  if (idInput) idInput.value = login;
  if (pwdInput) pwdInput.value = password;
  pushFloatingToast(`Credenciais de "${login}" preenchidas. Clique em Entrar.`, false);
}

async function preloadFleetAndCatalogs() {
  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const vehRes = await fetch('/api/vehicles/disambiguate?q=', { headers });
    if (vehRes.ok) {
      const vehData = await vehRes.json();
      allVehicles = vehData.candidates || [];
      populateVehicleSelectors();
    }

    if (authToken) {
      const catRes = await fetch('/api/catalogs', { headers });
      if (catRes.ok) {
        catalogItems = await catRes.json();
      }
    }
  } catch (err) {
    console.error('Erro ao carregar frota:', err);
  }
}

function renderAuthSessionDetails() {
  const container = document.getElementById('auth-session-details');
  const loginCard = document.getElementById('auth-login-card');
  const loggedCard = document.getElementById('auth-logged-card');

  const isLogged = Boolean(currentUser && authToken);
  if (loginCard) loginCard.style.display = isLogged ? 'none' : 'block';
  if (loggedCard) loggedCard.style.display = isLogged ? 'block' : 'none';

  if (!container) return;

  if (!isLogged) {
    container.innerHTML = '';
    return;
  }

  const roleDescription =
    currentUser.role === 'ADMIN'
      ? 'Curadoria e Frota Nacional'
      : 'Atendimento e Cotação da Oficina';
  const roleBadgeLabel = currentUser.role === 'ADMIN' ? 'Administrador' : 'Mecânico / Consultor';

  const companyName = currentUser.companyTradeName || 'Estabelecimento Credenciado';
  const companyDoc = currentUser.cnpjFormatted ? `CNPJ ${currentUser.cnpjFormatted}` : 'Cadastro Ativo';
  const targetRoute = currentUser.role === 'ADMIN' ? '/admin' : '/oficina';
  const targetLabel = currentUser.role === 'ADMIN' ? 'Ir para Administração →' : 'Ir para Minha Oficina →';

  container.innerHTML = `
    <div class="data-row">
      <div>
        <strong>Profissional Conectado</strong>
        <div class="data-row-meta">${currentUser.name} • ${currentUser.email}</div>
      </div>
      <span class="badge-slot">${USER_STATUS_LABELS[currentUser.status] || 'Conta Ativa'}</span>
    </div>
    <div class="data-row">
      <div>
        <strong>Perfil de Acesso</strong>
        <div class="data-row-meta">Usuário: ${currentUser.login} • ${roleDescription}</div>
      </div>
      <span class="badge-capacity">${roleBadgeLabel}</span>
    </div>
    <div class="data-row">
      <div>
        <strong>Empresa Vinculada</strong>
        <div class="data-row-meta">${companyName}</div>
      </div>
      <span class="product-price-code">${companyDoc}</span>
    </div>
    <div style="padding-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
      <button type="button" class="btn btn-primary btn-sm" onclick="navigateTo('${targetRoute}', event)">
        ${targetLabel}
      </button>
      <button type="button" class="btn btn-danger btn-sm" onclick="logoutSession()">
        Encerrar Sessão
      </button>
    </div>
  `;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('login-identifier').value.trim();
  const pwd = document.getElementById('login-password').value;
  const ok = await authenticateWithCredentials(id, pwd, false);
  if (ok) {
    // O role direciona automaticamente para Administração (ADMIN) ou Minha Oficina (USER / Mecânico)
    const dest = currentUser?.role === 'ADMIN' ? '/admin' : '/oficina';
    await navigateTo(dest);
  }
}

async function quickSwitchSession(profile) {
  if (profile === 'admin') {
    const ok = await authenticateWithCredentials('thiago.admin', 'Soil@2026!', false);
    if (ok) await navigateTo('/admin');
  } else {
    const ok = await authenticateWithCredentials('marcos.paulista', 'Oficina@2026!', false);
    if (ok) await navigateTo('/oficina');
  }
}

async function logoutSession() {
  authToken = '';
  currentUser = null;
  persistSession('', null);
  closeQuoteDrawer();
  updatePersonaNavigation();
  renderAuthSessionDetails();
  if (currentVehicle) {
    await selectVehicle(currentVehicle.id, false);
  }
  await navigateTo('/index');
  pushFloatingToast('Sessão encerrada.', false);
}

async function openFeatureFromLanding(feature) {
  if (feature === 'office') {
    if (!authToken || !currentUser) {
      await navigateTo('/auth');
      pushFloatingToast('Faça login para acessar Minha Oficina.', false);
      return;
    }
    await navigateTo(currentUser.role === 'ADMIN' ? '/admin' : '/oficina');
    return;
  }

  await navigateTo('/index');

  if (feature === 'search') {
    const searchInput = document.getElementById('search-query');
    if (searchInput) {
      searchInput.focus();
      openOmniboxSuggestions();
    }
  } else if (feature === 'specs') {
    if (!currentVehicle && allVehicles.length > 0) {
      await selectVehicle(allVehicles[0].id, false);
    }
    const specsEl = document.getElementById('specs-workspace');
    if (specsEl && typeof specsEl.scrollIntoView === 'function') {
      specsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else if (feature === 'quote') {
    if (!currentVehicle && allVehicles.length > 0) {
      await selectVehicle(allVehicles[0].id, false);
    }
    openQuoteDrawer();
  }
}

/* ============================================================================
   ROTA /index: SELETORES EM CASCATA (CATEGORIA -> MONTADORA -> MODELO -> ANO)
   ============================================================================ */
function populateVehicleSelectors() {
  const catSel = document.getElementById('filter-category');
  const manufSel = document.getElementById('filter-manufacturer');
  const modelSel = document.getElementById('filter-model');
  const yearSel = document.getElementById('filter-year');
  if (!catSel || !manufSel || !modelSel || !yearSel) return;

  const selectedCat = catSel.value;
  const prevManuf = manufSel.value;
  const prevModel = modelSel.value;
  const prevYear = yearSel.value;

  const byCat = allVehicles.filter((v) => !selectedCat || v.type === selectedCat);
  const manufacturers = Array.from(new Set(byCat.map((v) => v.manufacturer))).sort();

  manufSel.innerHTML =
    `<option value="">Todas as Marcas (${manufacturers.length})</option>` +
    manufacturers.map((m) => `<option value="${m}">${m}</option>`).join('');
  if (manufacturers.includes(prevManuf)) {
    manufSel.value = prevManuf;
  } else {
    manufSel.value = '';
  }

  const activeManuf = manufSel.value;
  const byManuf = byCat.filter((v) => !activeManuf || v.manufacturer === activeManuf);
  const models = Array.from(new Set(byManuf.map((v) => v.model))).sort();

  modelSel.innerHTML =
    `<option value="">Todos (${models.length})</option>` +
    models.map((m) => `<option value="${m}">${m}</option>`).join('');
  if (models.includes(prevModel)) {
    modelSel.value = prevModel;
  } else {
    modelSel.value = '';
  }

  const activeModel = modelSel.value;
  const byModel = byManuf.filter((v) => !activeModel || v.model === activeModel);

  const yearsSet = new Set();
  byModel.forEach((v) => {
    for (let y = v.manufYearStart; y <= v.manufYearEnd; y += 1) {
      yearsSet.add(y);
    }
  });
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  yearSel.innerHTML =
    `<option value="">Todos os Anos</option>` +
    years.map((y) => `<option value="${y}">${y}</option>`).join('');
  if (prevYear && years.includes(Number(prevYear))) {
    yearSel.value = prevYear;
  } else {
    yearSel.value = '';
  }

  syncAllCustomSelects();
}

async function handleCategorySelectorChange() {
  const manufSel = document.getElementById('filter-manufacturer');
  const modelSel = document.getElementById('filter-model');
  const yearSel = document.getElementById('filter-year');
  if (manufSel) manufSel.value = '';
  if (modelSel) modelSel.value = '';
  if (yearSel) yearSel.value = '';
  populateVehicleSelectors();
  await applySelectorVehicleFilter();
}

async function handleManufacturerSelectorChange() {
  const modelSel = document.getElementById('filter-model');
  const yearSel = document.getElementById('filter-year');
  if (modelSel) modelSel.value = '';
  if (yearSel) yearSel.value = '';
  populateVehicleSelectors();
  await applySelectorVehicleFilter();
}

async function handleModelSelectorChange() {
  const yearSel = document.getElementById('filter-year');
  if (yearSel) yearSel.value = '';
  populateVehicleSelectors();
  await applySelectorVehicleFilter();
}

async function handleYearSelectorChange() {
  const filterYear = document.getElementById('filter-year')?.value || '';
  const searchYear = document.getElementById('search-year');
  if (searchYear) {
    searchYear.value = filterYear;
  }
  updateOmniboxYearTriggerLabel(filterYear);
  await applySelectorVehicleFilter();
}

async function applySelectorVehicleFilter() {
  const cat = document.getElementById('filter-category')?.value || '';
  const manuf = document.getElementById('filter-manufacturer')?.value || '';
  const model = document.getElementById('filter-model')?.value || '';
  const yearVal = Number(
    document.getElementById('filter-year')?.value ||
      document.getElementById('search-year')?.value ||
      0,
  );
  const query = (document.getElementById('search-query')?.value || '').trim().toLowerCase();

  if (!cat && !manuf && !model && !yearVal && !query) {
    document.getElementById('disambiguation-container').style.display = 'none';
    return;
  }

  const matches = allVehicles.filter((v) => {
    if (cat && v.type !== cat) return false;
    if (manuf && v.manufacturer !== manuf) return false;
    if (model && v.model !== model) return false;
    if (yearVal && (yearVal < v.manufYearStart || yearVal > v.manufYearEnd)) return false;
    if (
      query &&
      !v.fullLabel.toLowerCase().includes(query) &&
      !v.manufacturer.toLowerCase().includes(query) &&
      !v.model.toLowerCase().includes(query) &&
      !(v.version && v.version.toLowerCase().includes(query))
    ) {
      return false;
    }
    return true;
  });

  const disambigBox = document.getElementById('disambiguation-container');
  const listEl = document.getElementById('disambiguation-list');
  const headingEl = document.getElementById('disambiguation-heading');

  if (matches.length === 0) {
    disambigBox.style.display = 'block';
    headingEl.textContent = 'Nenhum veículo encontrado para esta combinação';
    listEl.innerHTML = `<div class="empty-state">Tente alterar o ano ou limpar os filtros acima.</div>`;
    document.getElementById('specs-workspace').style.display = 'none';
    document.getElementById('selected-vehicle-banner').style.display = 'none';
    return;
  }

  if (matches.length === 1 && (model || manuf)) {
    disambigBox.style.display = 'none';
    await selectVehicle(matches[0].id, false);
    return;
  }

  const displayedMatches = matches.slice(0, 120);
  disambigBox.style.display = 'block';
  headingEl.textContent =
    matches.length > 120
      ? `${matches.length} motorizações encontradas (exibindo as 120 primeiras — refine por Modelo ou Ano)`
      : `${matches.length} motorizações encontradas — selecione a versão exata`;
  listEl.innerHTML = displayedMatches
    .map(
      (v) => `
      <button type="button" class="candidate-card" onclick="selectVehicle(${v.id}, true)">
        <span class="badge-slot">${v.manufYearStart}–${v.manufYearEnd} • ${VEHICLE_TYPE_LABELS[v.type] || v.type}</span>
        <div style="font-weight: 500; font-size: 1rem; margin-top: 8px;">${v.fullLabel}</div>
        <div style="font-family: 'Google Sans Code', monospace; font-size: 0.74rem; color: var(--theme-on-surface-variant); margin-top: 6px;">
          Abrir os 6 itens obrigatórios →
        </div>
      </button>
    `,
    )
    .join('');

  document.getElementById('specs-workspace').style.display = 'none';
  document.getElementById('selected-vehicle-banner').style.display = 'none';
}

function resetVehicleSelectors() {
  const catSel = document.getElementById('filter-category');
  const manufSel = document.getElementById('filter-manufacturer');
  const modelSel = document.getElementById('filter-model');
  const yearSel = document.getElementById('filter-year');
  const searchInput = document.getElementById('search-query');
  const searchYear = document.getElementById('search-year');

  if (catSel) catSel.value = '';
  if (manufSel) manufSel.value = '';
  if (modelSel) modelSel.value = '';
  if (yearSel) yearSel.value = '';
  if (searchInput) searchInput.value = '';
  if (searchYear) searchYear.value = '';
  updateOmniboxYearTriggerLabel('');

  populateVehicleSelectors();
  clearSelectedVehicle();
}

function clearSelectedVehicle() {
  currentVehicle = null;
  currentLookupSpecs = [];
  document.getElementById('disambiguation-container').style.display = 'none';
  document.getElementById('selected-vehicle-banner').style.display = 'none';
  document.getElementById('specs-workspace').style.display = 'none';
}

/* ============================================================================
   OMNIBOX INTERATIVA: MENU DE SUGESTÕES DA FROTA AO CLICAR OU DIGITAR
   ============================================================================ */
function openOmniboxSuggestions() {
  closeOmniboxYearDropdown();
  const menu = document.getElementById('omnibox-suggestions');
  if (!menu) return;
  renderOmniboxSuggestionsList();
  menu.classList.add('open');
}

function closeOmniboxSuggestions() {
  const menu = document.getElementById('omnibox-suggestions');
  if (menu) menu.classList.remove('open');
}

function filterOmniboxSuggestions() {
  closeOmniboxYearDropdown();
  const menu = document.getElementById('omnibox-suggestions');
  if (!menu) return;
  renderOmniboxSuggestionsList();
  menu.classList.add('open');
}

function getFleetAvailableYears() {
  const yearsSet = new Set();
  allVehicles.forEach((v) => {
    for (let y = v.manufYearStart; y <= v.manufYearEnd; y += 1) {
      yearsSet.add(y);
    }
  });
  if (yearsSet.size === 0) {
    for (let y = 2026; y >= 2015; y -= 1) {
      yearsSet.add(y);
    }
  }
  return Array.from(yearsSet).sort((a, b) => b - a);
}

function renderOmniboxYearDropdownList() {
  const dropdown = document.getElementById('omnibox-year-dropdown');
  const yearInput = document.getElementById('search-year');
  if (!dropdown || !yearInput) return;

  const currentVal = String(yearInput.value || '').trim();
  const years = getFleetAvailableYears();

  dropdown.innerHTML = [
    `<button type="button" class="custom-select-option ${currentVal === '' ? 'selected' : ''}" onclick="pickOmniboxYear('', event)">
      <span>Todos os Anos</span>
      ${currentVal === '' ? '<span class="symbol" translate="no" style="font-size: 16px;">check</span>' : ''}
    </button>`,
    ...years.map(
      (y) => `
      <button type="button" class="custom-select-option ${currentVal === String(y) ? 'selected' : ''}" onclick="pickOmniboxYear('${y}', event)">
        <span>${y}</span>
        ${currentVal === String(y) ? '<span class="symbol" translate="no" style="font-size: 16px;">check</span>' : ''}
      </button>
    `,
    ),
  ].join('');
}

function updateOmniboxYearTriggerLabel(yearStr) {
  const labelEl = document.getElementById('omnibox-year-label');
  const triggerEl = document.getElementById('omnibox-year-trigger');
  const cleanYear = String(yearStr || '').trim();
  if (labelEl) {
    labelEl.textContent = cleanYear ? `Ano: ${cleanYear}` : 'Ano (opc.)';
  }
  if (triggerEl) {
    triggerEl.classList.toggle('has-value', Boolean(cleanYear));
  }
}

function toggleOmniboxYearDropdown(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  const dropdown = document.getElementById('omnibox-year-dropdown');
  const group = document.getElementById('omnibox-year-group');
  if (!dropdown) return;

  const isOpen = dropdown.classList.contains('open');
  closeOmniboxSuggestions();
  closeAllCustomSelectMenus();

  if (isOpen) {
    closeOmniboxYearDropdown();
  } else {
    renderOmniboxYearDropdownList();
    dropdown.classList.add('open');
    if (group) group.classList.add('open');
  }
}

function openOmniboxYearDropdown(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  closeOmniboxSuggestions();
  const dropdown = document.getElementById('omnibox-year-dropdown');
  const group = document.getElementById('omnibox-year-group');
  if (!dropdown) return;
  renderOmniboxYearDropdownList();
  dropdown.classList.add('open');
  if (group) group.classList.add('open');
}

function closeOmniboxYearDropdown() {
  const dropdown = document.getElementById('omnibox-year-dropdown');
  const group = document.getElementById('omnibox-year-group');
  if (dropdown) dropdown.classList.remove('open');
  if (group) group.classList.remove('open');
}

async function syncYearFromOmniboxToSelectors(yearStr) {
  updateOmniboxYearTriggerLabel(yearStr);
  const filterYear = document.getElementById('filter-year');
  if (filterYear) {
    const hasOption = Array.from(filterYear.options || []).some((opt) => opt.value === String(yearStr));
    if (yearStr === '' || hasOption) {
      filterYear.value = String(yearStr);
    }
    syncAllCustomSelects();
  }
  await applySelectorVehicleFilter();
}

async function pickOmniboxYear(yearStr, event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  const yearInput = document.getElementById('search-year');
  if (yearInput) {
    yearInput.value = String(yearStr);
  }
  closeOmniboxYearDropdown();
  await syncYearFromOmniboxToSelectors(yearStr);
}

function renderOmniboxSuggestionsList() {
  const menu = document.getElementById('omnibox-suggestions');
  if (!menu) return;

  const query = (document.getElementById('search-query')?.value || '').trim().toLowerCase();
  const yearVal = Number(document.getElementById('search-year')?.value || 0);

  const matches = allVehicles.filter((v) => {
    const matchesText =
      !query ||
      v.fullLabel.toLowerCase().includes(query) ||
      v.manufacturer.toLowerCase().includes(query) ||
      v.model.toLowerCase().includes(query) ||
      (v.version && v.version.toLowerCase().includes(query));

    const matchesYear =
      !yearVal || (yearVal >= v.manufYearStart && yearVal <= v.manufYearEnd);

    return matchesText && matchesYear;
  });

  if (matches.length === 0) {
    menu.innerHTML = `
      <div class="omnibox-suggestion-header">
        <span>Nenhuma motorização correspondente</span>
      </div>
      <div style="padding: 10px 14px; font-size: 0.84rem; color: var(--theme-on-surface-variant);">
        Pressione <strong>Consultar</strong> ou utilize os seletores de Categoria e Montadora abaixo.
      </div>
    `;
    return;
  }

  const topMatches = matches.slice(0, 80);
  menu.innerHTML = `
    <div class="omnibox-suggestion-header">
      <span>Frota Homologada (${matches.length})</span>
      <span>Clique para abrir os 6 itens</span>
    </div>
    ${topMatches
      .map(
        (v) => `
      <button type="button" class="omnibox-suggestion-item" onclick="pickVehicleFromOmnibox(${v.id})">
        <div>
          <div class="omnibox-suggestion-title">${v.fullLabel}</div>
          <div class="omnibox-suggestion-meta">
            ${VEHICLE_TYPE_LABELS[v.type] || v.type} • Fabricação ${v.manufYearStart} a ${v.manufYearEnd}
          </div>
        </div>
        <span class="badge-slot">Selecionar →</span>
      </button>
    `,
      )
      .join('')}
    ${
      matches.length > 80
        ? `<div style="padding: 8px 14px; font-size: 0.76rem; color: var(--theme-on-surface-variant); border-top: 1px solid var(--theme-outline-variant); text-align: center;">
            Exibindo 80 de ${matches.length} veículos homologados — digite marca, modelo ou motorização para filtrar
          </div>`
        : ''
    }
  `;
}

async function pickVehicleFromOmnibox(vehicleId) {
  closeOmniboxSuggestions();
  const picked = allVehicles.find((v) => v.id === vehicleId);
  if (picked) {
    const searchInput = document.getElementById('search-query');
    if (searchInput) searchInput.value = `${picked.manufacturer} ${picked.model}`;

    const catSel = document.getElementById('filter-category');
    const manufSel = document.getElementById('filter-manufacturer');
    const modelSel = document.getElementById('filter-model');
    if (catSel) catSel.value = picked.type;
    populateVehicleSelectors();
    if (manufSel) manufSel.value = picked.manufacturer;
    populateVehicleSelectors();
    if (modelSel) modelSel.value = picked.model;
    populateVehicleSelectors();
  }
  await selectVehicle(vehicleId, false);
}

/* ============================================================================
   ROTA /index: PESQUISA, DESAMBIGUAÇÃO, 6 ITENS & GAVETA DE ORÇAMENTO
   ============================================================================ */
async function handleSearchSubmit(event) {
  event.preventDefault();
  closeOmniboxSuggestions();
  const q = document.getElementById('search-query').value.trim();
  const yearVal = document.getElementById('search-year').value;
  await executeDisambiguationSearch(q, yearVal ? Number(yearVal) : undefined);
}

async function executeDisambiguationSearch(query, year) {
  const params = new URLSearchParams({ q: query });
  if (year) params.set('year', String(year));

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const res = await fetch(`/api/vehicles/disambiguate?${params.toString()}`, { headers });

  const disambigBox = document.getElementById('disambiguation-container');
  const listEl = document.getElementById('disambiguation-list');
  const headingEl = document.getElementById('disambiguation-heading');

  if (!res.ok) {
    disambigBox.style.display = 'block';
    headingEl.textContent = 'Não foi possível consultar a frota no momento';
    listEl.innerHTML = `<div class="empty-state">Tente novamente em instantes.</div>`;
    return;
  }

  const data = await res.json();

  if (data.candidates.length === 0) {
    disambigBox.style.display = 'block';
    headingEl.textContent = 'Nenhum veículo encontrado';
    listEl.innerHTML = `<div class="empty-state">Nenhuma motorização encontrada para "${query || 'o filtro informado'}".</div>`;
    document.getElementById('specs-workspace').style.display = 'none';
    document.getElementById('selected-vehicle-banner').style.display = 'none';
    return;
  }

  if (data.requiresDisambiguation) {
    disambigBox.style.display = 'block';
    headingEl.textContent = `${data.candidates.length} versões encontradas — clique na motorização exata`;
    listEl.innerHTML = data.candidates
      .map(
        (v) => `
        <button type="button" class="candidate-card" onclick="selectVehicle(${v.id}, true)">
          <span class="badge-slot">${v.manufYearStart}–${v.manufYearEnd} • ${VEHICLE_TYPE_LABELS[v.type] || v.type}</span>
          <div style="font-weight: 500; font-size: 1rem; margin-top: 8px;">${v.fullLabel}</div>
          <div style="font-family: 'Google Sans Code', monospace; font-size: 0.74rem; color: var(--theme-on-surface-variant); margin-top: 6px;">
            Abrir os 6 itens obrigatórios →
          </div>
        </button>
      `,
      )
      .join('');
    document.getElementById('specs-workspace').style.display = 'none';
    document.getElementById('selected-vehicle-banner').style.display = 'none';
  } else {
    disambigBox.style.display = 'none';
    await selectVehicle(data.candidates[0].id, false);
  }
}

async function selectVehicle(vehicleId, keepDisambiguationVisible = false) {
  if (!keepDisambiguationVisible) {
    document.getElementById('disambiguation-container').style.display = 'none';
  }

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const lookupRes = await fetch(`/api/lookup/${vehicleId}`, { headers });
  if (!lookupRes.ok) return;

  const lookup = await lookupRes.json();
  currentVehicle = lookup.vehicle;
  currentLookupSpecs = lookup.specifications || [];

  if (authToken) {
    const quoteRes = await fetch(`/api/quotes/options/${vehicleId}`, { headers });
    if (quoteRes.ok) {
      quoteOptionsCache = await quoteRes.json();
      updateDrawerTierPrices();
      selectQuoteTier('bestQuality');
    }
  } else {
    quoteOptionsCache = null;
    editableItems = [];
  }

  document.getElementById('selected-vehicle-banner').style.display = 'flex';
  document.getElementById('selected-vehicle-years').textContent =
    `${VEHICLE_TYPE_LABELS[lookup.vehicle.type] || lookup.vehicle.type || 'Veículo'} • ${lookup.vehicle.manufYearStart} a ${lookup.vehicle.manufYearEnd}`;
  document.getElementById('selected-vehicle-title').textContent = lookup.vehicle.fullLabel;
  document.getElementById('drawer-vehicle-name').textContent = lookup.vehicle.fullLabel;

  renderSixSpecsGrid(currentLookupSpecs);
}

function renderSixSpecsGrid(specifications) {
  document.getElementById('specs-workspace').style.display = 'block';

  const lubricants = specifications.filter((s) => s.category === 'OLEO');
  const filters = specifications.filter((s) => s.category === 'FILTRO');
  const selectedProductIds = new Set(editableItems.map((i) => i.productId));

  const renderCard = (slot) => {
    const capNum = Number(slot.capacityLiters || 1);
    const capLabel =
      slot.category === 'OLEO' && slot.capacityLiters
        ? capNum === 1
          ? '1.0 Litro'
          : `${slot.capacityLiters} Litros`
        : `${slot.capacityLiters || 1} un.`;

    const slotLabel = SUBTYPE_LABELS[slot.subtype] || `${slot.category} • ${slot.subtype}`;
    const safeSpec = String(slot.specification || '').replace(/'/g, "\\'");

    let productsHtml = '';
    if (slot.availableProducts.length > 0) {
      productsHtml = slot.availableProducts
        .map((p) => {
          const isSelected = selectedProductIds.has(p.id);
          return `
            <div
              class="product-mini-row ${isSelected ? 'selected-in-quote' : ''}"
              onclick="selectProductFromSpecCard('${slot.subtype}', ${p.id})"
              title="Clique para usar este produto no orçamento"
            >
              <div class="data-row-title-group">
                <span><strong>${p.manufacturer}</strong> • ${p.name}</span>
                ${p.isBestQuality ? '<span class="tag-best">Melhor Qualidade ★</span>' : ''}
                ${isSelected ? '<span class="badge-slot">No Orçamento ✓</span>' : ''}
              </div>
              <span class="product-price-code">R$ ${p.price.toFixed(2)}</span>
            </div>
          `;
        })
        .join('');
    } else if (!authToken) {
      productsHtml = `
        <div
          class="product-mini-row"
          onclick="navigateTo('/auth', event)"
          title="Entre com a conta da sua oficina para carregar marcas e preços"
        >
          <span style="color: var(--theme-on-surface-variant);">
            Faça login para consultar marcas e preços do estoque da sua oficina
          </span>
          <span class="btn btn-outline btn-sm">Entrar →</span>
        </div>
      `;
    } else {
      productsHtml = `<div class="data-row-meta">Sem produto cadastrado no estoque da oficina para esta aplicação.</div>`;
    }

    return `
      <article class="spec-card">
        <div class="spec-card-header">
          <span class="badge-slot">${slotLabel}</span>
          <span class="badge-capacity">${capLabel}</span>
        </div>
        <h3 class="spec-card-title">${slot.name}</h3>
        <div
          class="spec-norm"
          onclick="copyTextToClipboard('${safeSpec}', 'Norma técnica copiada')"
          title="Clique para copiar a norma técnica"
        >
          <span>${slot.specification}</span>
          <span class="spec-norm-copy-hint">Copiar</span>
        </div>
        ${slot.notes ? `<div style="font-size: 0.79rem; color: var(--theme-on-surface-variant);">Observação: ${slot.notes}</div>` : ''}
        <div class="product-mini-list">${productsHtml}</div>
      </article>
    `;
  };

  document.getElementById('grid-lubricants').innerHTML = lubricants.map(renderCard).join('');
  document.getElementById('grid-filters').innerHTML = filters.map(renderCard).join('');
}

function selectProductFromSpecCard(slotSubtype, productId) {
  const slot = currentLookupSpecs.find((s) => s.subtype === slotSubtype);
  if (!slot) return;
  const product = slot.availableProducts.find((p) => p.id === productId);
  if (!product) return;

  const recommendedQty =
    slot.category === 'OLEO' && slot.capacityLiters ? Math.ceil(slot.capacityLiters) : 1;

  const siblingIds = new Set(slot.availableProducts.map((p) => p.id));
  const existingIdx = editableItems.findIndex((item) => siblingIds.has(item.productId));

  const newEntry = {
    productId: product.id,
    productName: product.name,
    manufacturer: product.manufacturer,
    quantity: existingIdx >= 0 ? editableItems[existingIdx].quantity : recommendedQty,
    unitPrice: product.price,
  };

  if (existingIdx >= 0) {
    editableItems[existingIdx] = newEntry;
  } else {
    editableItems.push(newEntry);
  }

  renderDrawerItems();
  renderSixSpecsGrid(currentLookupSpecs);
  pushFloatingToast(
    `${product.manufacturer} (${product.name}) selecionado no orçamento.`,
    false,
  );
}

function copyTextToClipboard(text, feedbackLabel = 'Copiado') {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  pushFloatingToast(`${feedbackLabel}: ${text}`, false);
}

function updateDrawerTierPrices() {
  if (!quoteOptionsCache) return;
  document.getElementById('price-cheapest').textContent =
    `R$ ${quoteOptionsCache.cheapest.totalAmount.toFixed(2)}`;
  document.getElementById('price-bestQuality').textContent =
    `R$ ${quoteOptionsCache.bestQuality.totalAmount.toFixed(2)}`;
  document.getElementById('price-mostExpensive').textContent =
    `R$ ${quoteOptionsCache.mostExpensive.totalAmount.toFixed(2)}`;
}

function selectQuoteTier(tierKey) {
  activeTier = tierKey;
  ['cheapest', 'bestQuality', 'mostExpensive'].forEach((k) => {
    const el = document.getElementById(`tab-${k}`);
    if (el) el.classList.toggle('active', k === tierKey);
  });

  if (!quoteOptionsCache || !quoteOptionsCache[tierKey]) return;
  editableItems = quoteOptionsCache[tierKey].items.map((item) => ({ ...item }));
  renderDrawerItems();
  if (currentLookupSpecs.length > 0) {
    renderSixSpecsGrid(currentLookupSpecs);
  }
}

function findSpecSlotForQuoteItem(item) {
  if (!currentLookupSpecs || currentLookupSpecs.length === 0) return null;
  if (item.catalogId) {
    const byCat = currentLookupSpecs.find((s) => s.catalogId === item.catalogId);
    if (byCat) return byCat;
  }
  return (
    currentLookupSpecs.find(
      (s) =>
        Array.isArray(s.availableProducts) &&
        s.availableProducts.some((p) => p.id === item.productId),
    ) || null
  );
}

function getQuoteItemTechnicalVolumeNote(item) {
  const slot = findSpecSlotForQuoteItem(item);
  if (!slot || slot.category !== 'OLEO' || !slot.capacityLiters) return '';
  const nom = Number(slot.capacityLiters);
  const qty = Number(item.quantity);
  if (!(nom > 0) || !(qty > 0)) return '';

  const diff = Number((qty - nom).toFixed(2));
  if (diff > 0.04 && Number.isInteger(qty)) {
    return `${qty} frasco(s) de 1L • Cárter/Sistema: ${nom.toFixed(1)} L (Sobra técnica: ${diff.toFixed(1)} L)`;
  }
  if (!Number.isInteger(nom) && Math.abs(diff) <= 0.04) {
    const wholeBottles = Math.ceil(nom);
    const leftover = (wholeBottles - nom).toFixed(1);
    return `Volume nominal: ${nom.toFixed(1)} L (Em frascos de 1L: ${wholeBottles} un • Sobra: ${leftover} L)`;
  }
  return `Capacidade nominal: ${nom.toFixed(1)} L`;
}

function toggleQuoteOilBottleRounding() {
  if (!editableItems || editableItems.length === 0) return;
  let hasFractional = false;
  editableItems.forEach((item) => {
    const slot = findSpecSlotForQuoteItem(item);
    if (slot && slot.category === 'OLEO' && slot.capacityLiters) {
      if (!Number.isInteger(Number(item.quantity))) {
        hasFractional = true;
      }
    }
  });

  editableItems.forEach((item) => {
    const slot = findSpecSlotForQuoteItem(item);
    if (slot && slot.category === 'OLEO' && slot.capacityLiters) {
      const nom = Number(slot.capacityLiters);
      item.quantity = hasFractional ? Math.ceil(nom) : nom;
    }
  });

  const btn = document.getElementById('btn-toggle-bottle-rounding');
  if (btn) {
    btn.textContent = hasFractional ? 'Usar Litragem Exata' : 'Fechar Frascos 1L';
  }
  renderDrawerItems();
  pushFloatingToast(
    hasFractional
      ? 'Quantidades arredondadas para frascos inteiros de 1L (com cálculo de sobra técnica).'
      : 'Quantidades ajustadas para a litragem nominal exata do sistema.',
    false,
  );
}

function renderDrawerItems() {
  const container = document.getElementById('drawer-items-list');
  if (!container) return;
  let totalCents = 0;

  let anyFractionalOil = false;
  editableItems.forEach((item) => {
    const slot = findSpecSlotForQuoteItem(item);
    if (slot && slot.category === 'OLEO' && !Number.isInteger(Number(item.quantity))) {
      anyFractionalOil = true;
    }
  });
  const roundBtn = document.getElementById('btn-toggle-bottle-rounding');
  if (roundBtn) {
    roundBtn.textContent = anyFractionalOil ? 'Fechar Frascos 1L' : 'Usar Litragem Exata';
  }

  container.innerHTML = editableItems
    .map((item, idx) => {
      const subtotalCents = Math.round(item.unitPrice * 100 * item.quantity);
      totalCents += subtotalCents;
      const volNote = getQuoteItemTechnicalVolumeNote(item);
      return `
        <div class="quote-item-row">
          <div style="font-size: 0.79rem;">
            <strong>${item.manufacturer}</strong><br />
            <span style="color: var(--theme-on-surface-variant);">${item.productName}</span>
            ${
              volNote
                ? `<div style="font-family: 'Google Sans Code', monospace; font-size: 0.7rem; color: var(--theme-accent); margin-top: 3px;">${volNote}</div>`
                : ''
            }
          </div>
          <input
            type="number"
            step="0.1"
            min="0.1"
            class="input-field"
            value="${item.quantity}"
            onchange="updateItemQty(${idx}, this.value)"
            title="Quantidade"
          />
          <input
            type="number"
            step="0.10"
            min="1"
            class="input-field"
            value="${item.unitPrice.toFixed(2)}"
            onchange="updateItemPrice(${idx}, this.value)"
            title="Preço Unitário (R$)"
          />
          <button type="button" class="btn btn-outline btn-sm" style="padding: 6px;" onclick="removeQuoteItem(${idx})" title="Remover item">
            ✕
          </button>
        </div>
      `;
    })
    .join('');

  document.getElementById('drawer-total-amount').textContent =
    `R$ ${(totalCents / 100).toFixed(2)}`;
}

function updateItemQty(idx, val) {
  const num = Number(val);
  if (num > 0 && editableItems[idx]) {
    editableItems[idx].quantity = num;
    renderDrawerItems();
  }
}

function updateItemPrice(idx, val) {
  const num = Number(val);
  if (num > 0 && editableItems[idx]) {
    editableItems[idx].unitPrice = num;
    renderDrawerItems();
  }
}

function removeQuoteItem(idx) {
  if (editableItems.length <= 1) return;
  editableItems.splice(idx, 1);
  renderDrawerItems();
  if (currentLookupSpecs.length > 0) {
    renderSixSpecsGrid(currentLookupSpecs);
  }
}

function openQuoteDrawer() {
  if (!authToken || !currentUser) {
    navigateTo('/auth');
    pushFloatingToast('Entre na sua conta para montar e enviar orçamentos com os preços da sua oficina.', false);
    return;
  }
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('quote-drawer').classList.add('open');
  syncAllCustomSelects();
}

function closeQuoteDrawer() {
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.getElementById('quote-drawer').classList.remove('open');
}

async function loadClients() {
  if (!authToken) return;
  const res = await fetch('/api/clients', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) return;
  companyClients = await res.json();
  const select = document.getElementById('drawer-client-select');
  if (select) {
    select.innerHTML =
      companyClients.length > 0
        ? companyClients.map((c) => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')
        : `<option value="">Cadastre um cliente abaixo</option>`;
    syncAllCustomSelects();
  }
}

async function createQuickClient() {
  const name = document.getElementById('new-client-name').value.trim();
  const phone = document.getElementById('new-client-phone').value.trim();
  const email = document.getElementById('new-client-email').value.trim();

  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name, phone, email }),
  });

  if (res.ok) {
    const created = await res.json();
    await loadClients();
    document.getElementById('drawer-client-select').value = String(created.id);
    syncAllCustomSelects();
    document.getElementById('new-client-name').value = '';
    document.getElementById('new-client-phone').value = '';
    document.getElementById('new-client-email').value = '';
    showToast('drawer-feedback', `Cliente ${created.name} cadastrado e selecionado.`, false);
  } else {
    const err = await res.json();
    showToast('drawer-feedback', err.error?.message || 'Erro ao cadastrar cliente.', true);
  }
}

async function saveAndSendQuoteEmail() {
  if (!currentVehicle) return;
  const clientId = Number(document.getElementById('drawer-client-select').value);

  const profileMap = {
    cheapest: 'CHEAPEST',
    bestQuality: 'BEST_QUALITY',
    mostExpensive: 'MOST_EXPENSIVE',
  };

  const createRes = await fetch('/api/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      vehicleId: currentVehicle.id,
      clientId,
      profile: profileMap[activeTier] || 'CUSTOM',
      items: editableItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    showToast('drawer-feedback', err.error?.message || 'Falha ao gravar orçamento.', true);
    return;
  }

  const savedQuote = await createRes.json();
  const sendRes = await fetch(`/api/quotes/${savedQuote.id}/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (sendRes.ok) {
    const sentData = await sendRes.json();
    showToast(
      'drawer-feedback',
      `Orçamento de R$ ${sentData.totalAmount.toFixed(2)} enviado com sucesso para o e-mail do cliente.`,
      false,
    );
  } else {
    const err = await sendRes.json();
    showToast('drawer-feedback', err.error?.message || 'Falha ao enviar e-mail.', true);
  }
}

function buildQuoteSummaryText() {
  if (!currentVehicle || editableItems.length === 0) return '';
  const tierLabels = {
    cheapest: 'Econômico Homologado',
    bestQuality: 'Melhor Qualidade OEM ★',
    mostExpensive: 'Alta Performance',
    custom: 'Personalizado',
  };
  const workshopName = currentUser?.companyTradeName || 'Centro Automotivo Credenciado SOIL';
  const cnpjText = currentUser?.cnpjFormatted ? ` (CNPJ: ${currentUser.cnpjFormatted})` : '';
  const clientId = Number(document.getElementById('drawer-client-select')?.value || 0);
  const clientObj = companyClients.find((c) => c.id === clientId);
  const clientLine = clientObj ? `Cliente: ${clientObj.name} (${clientObj.email})` : 'Atendimento de Balcão';

  const total = editableItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lines = [
    `ORÇAMENTO TÉCNICO HOMOLOGADO — SOIL B2B`,
    `Oficina: ${workshopName}${cnpjText}`,
    clientLine,
    `Veículo: ${currentVehicle.fullLabel} (${currentVehicle.manufYearStart}–${currentVehicle.manufYearEnd})`,
    `Perfil Selecionado: ${tierLabels[activeTier] || 'Personalizado'}`,
    `--------------------------------------------------`,
    ...editableItems.map((item, idx) => {
      const sub = (item.quantity * item.unitPrice).toFixed(2);
      const volNote = getQuoteItemTechnicalVolumeNote(item);
      const noteSuffix = volNote ? `\n   [${volNote}]` : '';
      return `${idx + 1}. ${item.manufacturer} • ${item.productName}${noteSuffix}\n   Qtd: ${item.quantity} x R$ ${item.unitPrice.toFixed(2)} = R$ ${sub}`;
    }),
    `--------------------------------------------------`,
    `VALOR TOTAL DOS INSUMOS: R$ ${total.toFixed(2)}`,
    `Especificações validadas segundo catálogo técnico TecDoc / OEM.`,
  ];
  return lines.join('\n');
}

async function copyCurrentQuoteSummary() {
  const summary = buildQuoteSummaryText();
  if (!summary) {
    showToast('drawer-feedback', 'Selecione um veículo com itens na cotação antes de copiar.', true);
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(summary);
    }
    showToast(
      'drawer-feedback',
      'Resumo comercial copiado para a área de transferência (pronto para colar no WhatsApp ou atendimento).',
      false,
    );
  } catch {
    showToast('drawer-feedback', 'Resumo comercial preparado com sucesso.', false);
  }
}

function sendCurrentQuoteWhatsApp() {
  const summary = buildQuoteSummaryText();
  if (!summary) {
    showToast('drawer-feedback', 'Selecione um veículo com itens na cotação antes de enviar no WhatsApp.', true);
    return;
  }
  const clientId = Number(document.getElementById('drawer-client-select')?.value || 0);
  const clientObj = companyClients.find((c) => c.id === clientId);
  const digits = clientObj?.phone ? String(clientObj.phone).replace(/\D/g, '') : '';
  const phonePath = digits.length >= 10 ? `55${digits}` : '';
  const waUrl = `https://wa.me/${phonePath}?text=${encodeURIComponent(summary)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  showToast(
    'drawer-feedback',
    clientObj
      ? `Abrindo WhatsApp para ${clientObj.name} com a proposta formatada.`
      : 'Abrindo WhatsApp com o resumo comercial pronto para envio.',
    false,
  );
}

function sendSavedQuoteWhatsApp(quoteId) {
  const quote = companyQuotes.find((q) => q.id === quoteId);
  if (!quote) return;
  const veh = allVehicles.find((v) => v.id === quote.vehicleId);
  const clientObj = quote.clientId ? companyClients.find((c) => c.id === quote.clientId) : null;
  const workshopName = currentUser?.companyTradeName || 'Centro Automotivo Credenciado SOIL';
  const lines = [
    `ORÇAMENTO TÉCNICO HOMOLOGADO — SOIL B2B (#${quote.id})`,
    `Oficina: ${workshopName}`,
    clientObj ? `Cliente: ${clientObj.name}` : 'Atendimento de Balcão',
    `Veículo: ${veh ? veh.fullLabel : `Veículo #${quote.vehicleId}`}`,
    `--------------------------------------------------`,
    ...quote.items.map((item, idx) => {
      const sub = (item.quantity * item.unitPrice).toFixed(2);
      return `${idx + 1}. ${item.manufacturer} • ${item.productName}\n   Qtd: ${item.quantity} x R$ ${item.unitPrice.toFixed(2)} = R$ ${sub}`;
    }),
    `--------------------------------------------------`,
    `VALOR TOTAL DOS INSUMOS: R$ ${quote.totalAmount.toFixed(2)}`,
  ];
  const digits = clientObj?.phone ? String(clientObj.phone).replace(/\D/g, '') : '';
  const phonePath = digits.length >= 10 ? `55${digits}` : '';
  const waUrl = `https://wa.me/${phonePath}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  pushFloatingToast(
    clientObj
      ? `Abrindo WhatsApp de ${clientObj.name} para envio da cotação #${quote.id}.`
      : `Abrindo WhatsApp com a cotação #${quote.id}.`,
    false,
  );
}

function openPrintableQuoteWindow(docData) {
  const win = window.open('', '_blank', 'width=860,height=920');
  if (!win) {
    pushFloatingToast('Permita pop-ups no navegador para abrir a folha de impressão / PDF.', true);
    return;
  }

  const rowsHtml = docData.items
    .map((item, idx) => {
      const sub = (item.quantity * item.unitPrice).toFixed(2);
      const volNote = getQuoteItemTechnicalVolumeNote(item);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${item.manufacturer}</strong> — ${item.productName}
            ${volNote ? `<div style="font-size: 11px; color: #4b5563; margin-top: 2px;">${volNote}</div>` : ''}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">R$ ${item.unitPrice.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 600;">R$ ${sub}</td>
        </tr>
      `;
    })
    .join('');

  const nowStr = new Date().toLocaleDateString('pt-BR');
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Orçamento Técnico — ${docData.vehicleLabel}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 36px; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .sub { font-size: 12px; color: #4b5563; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
    th { background: #111827; color: #ffffff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .total-box { display: flex; justify-content: flex-end; align-items: center; gap: 16px; font-size: 18px; padding: 14px 18px; background: #f3f4f6; border-radius: 8px; }
    .footer { margin-top: 36px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Imprimir / Salvar como PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="brand">${docData.workshopName}</div>
      <div class="sub">${docData.workshopCnpj ? `CNPJ: ${docData.workshopCnpj} • ` : ''}Unidade Credenciada SOIL B2B</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; font-size: 14px;">ORÇAMENTO TÉCNICO HOMOLOGADO</div>
      <div class="sub">Emissão: ${nowStr} • Validade: 7 dias</div>
    </div>
  </div>
  <div class="meta-grid">
    <div>
      <strong>Veículo / Aplicação:</strong><br/>
      ${docData.vehicleLabel}<br/>
      <span style="color: #4b5563;">Período de Fabricação: ${docData.vehicleYears}</span>
    </div>
    <div>
      <strong>Destinatário:</strong><br/>
      ${docData.clientName}<br/>
      <span style="color: #4b5563;">${docData.clientContact}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 36px;">#</th>
        <th>Marca &amp; Descrição do Insumo Homologado</th>
        <th style="text-align: center; width: 70px;">Qtd</th>
        <th style="text-align: right; width: 110px;">Unitário</th>
        <th style="text-align: right; width: 120px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="total-box">
    <span>VALOR TOTAL DOS INSUMOS:</span>
    <strong>R$ ${docData.totalAmount.toFixed(2)}</strong>
  </div>
  <div class="footer">
    <span>Catálogo técnico sincronizado com normas OEM e referências cruzadas TecDoc Brasil.</span>
    <span>SOIL Tecnologia e Dados Automotivos Ltda.</span>
  </div>
</body>
</html>`);
  win.document.close();
}

function printCurrentQuote() {
  if (!currentVehicle || editableItems.length === 0) {
    showToast('drawer-feedback', 'Selecione um veículo com itens na cotação antes de imprimir.', true);
    return;
  }
  const clientId = Number(document.getElementById('drawer-client-select')?.value || 0);
  const clientObj = companyClients.find((c) => c.id === clientId);
  const totalAmount = editableItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  openPrintableQuoteWindow({
    workshopName: currentUser?.companyTradeName || 'Auto Center Paulista Lubrificantes',
    workshopCnpj: currentUser?.cnpjFormatted || '11.444.777/0001-61',
    vehicleLabel: currentVehicle.fullLabel,
    vehicleYears: `${currentVehicle.manufYearStart} a ${currentVehicle.manufYearEnd}`,
    clientName: clientObj ? clientObj.name : 'Atendimento de Balcão',
    clientContact: clientObj ? `${clientObj.email} • Tel: ${clientObj.phone}` : 'Consumidor / Frota',
    items: editableItems,
    totalAmount,
  });
}

function printSavedQuoteById(quoteId) {
  const quote = companyQuotes.find((q) => q.id === quoteId);
  if (!quote) return;
  const veh = allVehicles.find((v) => v.id === quote.vehicleId);
  const clientObj = quote.clientId ? companyClients.find((c) => c.id === quote.clientId) : null;

  openPrintableQuoteWindow({
    workshopName: currentUser?.companyTradeName || 'Auto Center Paulista Lubrificantes',
    workshopCnpj: currentUser?.cnpjFormatted || '11.444.777/0001-61',
    vehicleLabel: veh ? veh.fullLabel : `Veículo #${quote.vehicleId}`,
    vehicleYears: veh ? `${veh.manufYearStart} a ${veh.manufYearEnd}` : 'Homologado',
    clientName: clientObj ? clientObj.name : 'Atendimento de Balcão',
    clientContact: clientObj ? `${clientObj.email} • Tel: ${clientObj.phone}` : 'Consumidor / Frota',
    items: quote.items,
    totalAmount: quote.totalAmount,
  });
}

/* ============================================================================
   ROTA /oficina: GESTÃO DE ESTOQUE, CLIENTES E ORÇAMENTOS DA OFICINA
   ============================================================================ */
function switchOficinaTab(tab) {
  ['products', 'clients', 'quotes'].forEach((t) => {
    document.getElementById(`oficina-tab-${t}`).classList.toggle('active', t === tab);
    const panel = document.getElementById(`oficina-panel-${t}`);
    if (panel) {
      panel.style.display = t === tab ? (t === 'quotes' ? 'block' : 'grid') : 'none';
    }
  });
  syncAllCustomSelects();
}

async function refreshOficinaWorkspace() {
  if (!authToken) return;
  const [catRes, prodRes, cliRes, quoRes] = await Promise.all([
    fetch('/api/catalogs', { headers: { Authorization: `Bearer ${authToken}` } }),
    fetch('/api/products', { headers: { Authorization: `Bearer ${authToken}` } }),
    fetch('/api/clients', { headers: { Authorization: `Bearer ${authToken}` } }),
    fetch('/api/quotes', { headers: { Authorization: `Bearer ${authToken}` } }),
  ]);

  if (catRes.ok) {
    catalogItems = await catRes.json();
    const sel = document.getElementById('prod-catalog-select');
    if (sel) {
      sel.innerHTML = catalogItems
        .map(
          (c) =>
            `<option value="${c.id}">${SUBTYPE_LABELS[c.subtype] || c.subtype} — ${c.name}</option>`,
        )
        .join('');
    }
  }

  if (prodRes.ok) {
    companyProducts = await prodRes.json();
    renderProductsList();
  }

  if (cliRes.ok) {
    companyClients = await cliRes.json();
  }

  if (quoRes.ok) {
    companyQuotes = await quoRes.json();
  }

  renderClientsList();
  renderQuotesList();

  renderOficinaKpis();
  syncAllCustomSelects();
}

function renderOficinaKpis() {
  const prodValEl = document.getElementById('kpi-oficina-products');
  const prodMetaEl = document.getElementById('kpi-oficina-products-meta');
  const covValEl = document.getElementById('kpi-oficina-coverage');
  const covMetaEl = document.getElementById('kpi-oficina-coverage-meta');
  const cliValEl = document.getElementById('kpi-oficina-clients');
  const cliMetaEl = document.getElementById('kpi-oficina-clients-meta');
  const quoValEl = document.getElementById('kpi-oficina-quotes');
  const quoMetaEl = document.getElementById('kpi-oficina-quotes-meta');

  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));
  const coveredSubtypes = new Set();
  const distinctCatalogs = new Set();
  let bestQualityCount = 0;

  companyProducts.forEach((p) => {
    distinctCatalogs.add(p.catalogId);
    if (p.isBestQuality) bestQualityCount += 1;
    const cat = catalogById.get(p.catalogId);
    if (cat && cat.subtype) {
      coveredSubtypes.add(cat.subtype);
    }
  });

  if (prodValEl) prodValEl.textContent = String(companyProducts.length);
  if (prodMetaEl) {
    prodMetaEl.textContent = `${distinctCatalogs.size} normas • ${bestQualityCount} destaques ★`;
  }

  if (covValEl) covValEl.textContent = `${coveredSubtypes.size}/6`;
  if (covMetaEl) {
    covMetaEl.textContent =
      coveredSubtypes.size === 6
        ? '100% dos 6 subtipos cobertos'
        : `${6 - coveredSubtypes.size} subtipo(s) sem estoque`;
  }

  if (cliValEl) cliValEl.textContent = String(companyClients.length);
  if (cliMetaEl) {
    cliMetaEl.textContent =
      companyClients.length > 0 ? 'Contatos ativos no CNPJ' : 'Cadastre clientes para envio';
  }

  const totalQuoteAmount = companyQuotes.reduce((acc, q) => acc + (Number(q.totalAmount) || 0), 0);
  const sentQuotesCount = companyQuotes.filter((q) => q.status === 'SENT').length;
  if (quoValEl) quoValEl.textContent = String(companyQuotes.length);
  if (quoMetaEl) {
    quoMetaEl.textContent = `R$ ${totalQuoteAmount.toFixed(2)} (${sentQuotesCount} enviado${sentQuotesCount === 1 ? '' : 's'})`;
  }
}

function setProductSubtypeFilter(subtype) {
  activeProductSubtypeFilter = subtype || 'ALL';
  const pillContainer = document.getElementById('prod-subtype-pills');
  if (pillContainer) {
    pillContainer.querySelectorAll('.subtype-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-subtype') === activeProductSubtypeFilter);
    });
  }
  renderProductsList();
}

function updateProductSubtypePillCounts(catalogById) {
  const pillContainer = document.getElementById('prod-subtype-pills');
  if (!pillContainer) return;
  const counts = {
    ALL: companyProducts.length,
    MOTOR: 0,
    FREIO: 0,
    CAMBIO: 0,
    OLEO: 0,
    COMBUSTIVEL: 0,
    AR: 0,
  };
  companyProducts.forEach((p) => {
    const cat = catalogById.get(p.catalogId);
    if (cat && cat.subtype && counts[cat.subtype] !== undefined) {
      counts[cat.subtype] += 1;
    }
  });
  const baseLabels = {
    ALL: 'Todos',
    MOTOR: 'Óleo Motor',
    FREIO: 'Freio',
    CAMBIO: 'Câmbio',
    OLEO: 'Filtro Óleo',
    COMBUSTIVEL: 'Filtro Comb.',
    AR: 'Filtro Ar',
  };
  pillContainer.querySelectorAll('.subtype-pill').forEach((btn) => {
    const st = btn.getAttribute('data-subtype');
    if (st && baseLabels[st]) {
      btn.textContent = `${baseLabels[st]} (${counts[st] || 0})`;
      btn.classList.toggle('active', st === activeProductSubtypeFilter);
    }
  });
}

function renderProductsList() {
  const container = document.getElementById('oficina-products-list');
  if (!container) return;
  const filter = (document.getElementById('prod-filter-input')?.value || '').trim().toLowerCase();
  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

  updateProductSubtypePillCounts(catalogById);

  const filtered = companyProducts.filter((p) => {
    const cat = catalogById.get(p.catalogId);
    if (activeProductSubtypeFilter !== 'ALL') {
      if (!cat || cat.subtype !== activeProductSubtypeFilter) return false;
    }
    if (!filter) return true;
    const catText = cat
      ? `${cat.name} ${cat.specification} ${SUBTYPE_LABELS[cat.subtype] || cat.subtype}`.toLowerCase()
      : '';
    return (
      p.name.toLowerCase().includes(filter) ||
      p.manufacturer.toLowerCase().includes(filter) ||
      (p.sku && p.sku.toLowerCase().includes(filter)) ||
      catText.includes(filter)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhum produto encontrado para este filtro no estoque da oficina.</div>`;
    return;
  }

  container.innerHTML =
    `<div style="padding: 4px 2px 10px; font-size: 0.78rem; color: var(--theme-on-surface-variant); font-family: 'Google Sans Code', monospace;">
      Exibindo ${filtered.length} de ${companyProducts.length} produtos homologados em estoque • Clique em um item para editar preço ou código
    </div>` +
    filtered
      .map((p) => {
        const cat = catalogById.get(p.catalogId);
        const catLabel = cat
          ? `${SUBTYPE_LABELS[cat.subtype] || cat.subtype} • ${cat.name}`
          : 'Aplicação homologada';
        const isEditing = editingProductId === p.id;

        return `
        <div
          class="data-row clickable ${isEditing ? 'editing-active' : ''}"
          onclick="prefillProductFormFromRow(${p.id})"
          title="Clique para editar este produto diretamente no formulário ao lado"
        >
          <div>
            <div class="data-row-title-group">
              <strong>${p.manufacturer} • ${p.name}</strong>
              ${p.isBestQuality ? '<span class="tag-best">Melhor Qualidade ★</span>' : ''}
            </div>
            <div class="data-row-meta">
              Código: ${p.sku || 'Sem código'} • ${catLabel}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="product-price-code">R$ ${p.price.toFixed(2)}</span>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="event.stopPropagation(); prefillProductFormFromRow(${p.id})"
            >
              ${isEditing ? 'Editando' : 'Editar'}
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              onclick="event.stopPropagation(); deleteProductById(${p.id})"
            >
              Excluir
            </button>
          </div>
        </div>
      `;
      })
      .join('');
}

function prefillProductFormFromRow(productId) {
  const prod = companyProducts.find((p) => p.id === productId);
  if (!prod) return;
  editingProductId = prod.id;

  const catSel = document.getElementById('prod-catalog-select');
  const manufInput = document.getElementById('prod-manufacturer');
  const skuInput = document.getElementById('prod-sku');
  const nameInput = document.getElementById('prod-name');
  const priceInput = document.getElementById('prod-price');
  const qualSel = document.getElementById('prod-best-quality');

  if (catSel) catSel.value = String(prod.catalogId);
  if (manufInput) manufInput.value = prod.manufacturer;
  if (skuInput) skuInput.value = prod.sku || '';
  if (nameInput) nameInput.value = prod.name;
  if (priceInput) priceInput.value = prod.price.toFixed(2);
  if (qualSel) qualSel.value = prod.isBestQuality ? 'true' : 'false';

  const badgeEl = document.getElementById('prod-form-badge');
  const titleEl = document.getElementById('prod-form-title');
  const submitBtn = document.getElementById('prod-form-submit-btn');
  const cancelBtn = document.getElementById('prod-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = `Editando Item #${prod.id}`;
  if (titleEl) titleEl.textContent = 'Editar Produto do Estoque';
  if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  renderProductsList();
  syncAllCustomSelects();
  if (priceInput) priceInput.focus();
  pushFloatingToast(
    `Editando "${prod.manufacturer} • ${prod.name}". Altere o preço ou código e clique em Salvar Alterações.`,
    false,
  );
}

function cancelProductEdit(showFeedback = true) {
  editingProductId = null;
  const manufInput = document.getElementById('prod-manufacturer');
  const skuInput = document.getElementById('prod-sku');
  const nameInput = document.getElementById('prod-name');
  const priceInput = document.getElementById('prod-price');
  const qualSel = document.getElementById('prod-best-quality');

  if (manufInput) manufInput.value = '';
  if (skuInput) skuInput.value = '';
  if (nameInput) nameInput.value = '';
  if (priceInput) priceInput.value = '';
  if (qualSel) qualSel.value = 'false';

  const badgeEl = document.getElementById('prod-form-badge');
  const titleEl = document.getElementById('prod-form-title');
  const submitBtn = document.getElementById('prod-form-submit-btn');
  const cancelBtn = document.getElementById('prod-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = 'Novo Item de Estoque';
  if (titleEl) titleEl.textContent = 'Adicionar Produto';
  if (submitBtn) submitBtn.textContent = 'Salvar no Estoque';
  if (cancelBtn) cancelBtn.style.display = 'none';

  renderProductsList();
  syncAllCustomSelects();
  if (showFeedback) {
    pushFloatingToast('Modo de edição encerrado. Formulário pronto para novo cadastro.', false);
  }
}

async function handleCreateProduct(event) {
  event.preventDefault();
  const catalogId = Number(document.getElementById('prod-catalog-select').value);
  const manufacturer = document.getElementById('prod-manufacturer').value.trim();
  const sku = document.getElementById('prod-sku').value.trim();
  const name = document.getElementById('prod-name').value.trim();
  const price = Number(document.getElementById('prod-price').value);
  const isBestQuality = document.getElementById('prod-best-quality').value === 'true';

  const isEditing = editingProductId !== null;
  const endpoint = isEditing ? `/api/products/${editingProductId}` : '/api/products';
  const method = isEditing ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      catalogId,
      manufacturer,
      sku: sku || null,
      name,
      price,
      isBestQuality,
    }),
  });

  const data = await res.json();
  if (res.ok) {
    event.target.reset();
    cancelProductEdit(false);
    showToast(
      'prod-feedback',
      isEditing
        ? `${data.manufacturer} • ${data.name} atualizado para R$ ${Number(data.price).toFixed(2)}.`
        : `${data.manufacturer} • ${data.name} adicionado ao estoque.`,
      false,
    );
    await refreshOficinaWorkspace();
  } else {
    showToast('prod-feedback', data.error?.message || 'Erro ao salvar produto.', true);
  }
}

async function deleteProductById(id) {
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    if (editingProductId === id) {
      cancelProductEdit(false);
    }
    pushFloatingToast('Produto removido do estoque da oficina.', false);
    await refreshOficinaWorkspace();
  }
}

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportProductsCsv() {
  if (companyProducts.length === 0) {
    pushFloatingToast('Não há produtos em estoque para exportar.', true);
    return;
  }
  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));
  const headers = [
    'id',
    'catalogId',
    'aplicacao',
    'fabricante',
    'sku',
    'descricao',
    'preco',
    'melhorQualidade',
  ];
  const rows = companyProducts.map((p) => {
    const cat = catalogById.get(p.catalogId);
    const appLabel = cat
      ? `${SUBTYPE_LABELS[cat.subtype] || cat.subtype} - ${cat.name}`
      : String(p.catalogId);
    return [
      p.id,
      p.catalogId,
      escapeCsvCell(appLabel),
      escapeCsvCell(p.manufacturer),
      escapeCsvCell(p.sku || ''),
      escapeCsvCell(p.name),
      p.price.toFixed(2),
      p.isBestQuality ? 'true' : 'false',
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `soil-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  pushFloatingToast(
    `Tabela CSV com ${companyProducts.length} produtos exportada com sucesso.`,
    false,
  );
}

function triggerImportProductsCsv() {
  const input = document.getElementById('prod-csv-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

function parseProductsCsvText(csvText) {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const splitRow = (line) => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const idxId = headers.findIndex((h) => h === 'id');
  const idxCatalog = headers.findIndex((h) => h === 'catalogid' || h === 'catalog_id');
  const idxManuf = headers.findIndex((h) => h === 'fabricante' || h === 'manufacturer' || h === 'marca');
  const idxSku = headers.findIndex((h) => h === 'sku' || h === 'codigo');
  const idxName = headers.findIndex((h) => h === 'descricao' || h === 'name' || h === 'nome');
  const idxPrice = headers.findIndex((h) => h === 'preco' || h === 'price' || h === 'valor');
  const idxBest = headers.findIndex((h) => h === 'melhorqualidade' || h === 'isbestquality');

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const catalogId = Number(cols[idxCatalog]);
    const manufacturer = cols[idxManuf] || '';
    const sku = idxSku >= 0 ? cols[idxSku] || null : null;
    const name = cols[idxName] || '';
    const rawPrice = (cols[idxPrice] || '').replace(',', '.');
    const price = Number(rawPrice);
    const rawBest = idxBest >= 0 ? (cols[idxBest] || '').toLowerCase() : 'false';
    const isBestQuality = rawBest === 'true' || rawBest === '1' || rawBest === 'sim';
    const rawId = idxId >= 0 ? Number(cols[idxId]) : null;

    if (!catalogId || !manufacturer || !name || !(price > 0)) continue;
    items.push({
      id: rawId && rawId > 0 ? rawId : null,
      catalogId,
      manufacturer,
      sku,
      name,
      price,
      isBestQuality,
    });
  }
  return items;
}

async function handleImportProductsCsv(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const items = parseProductsCsvText(text);
    if (items.length === 0) {
      showToast(
        'prod-feedback',
        'Nenhum item válido encontrado no CSV. Use o mesmo formato de Exportar CSV.',
        true,
      );
      return;
    }

    const res = await fetch('/api/products/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(
        'prod-feedback',
        `Lote processado: ${data.createdCount} criado(s) e ${data.updatedCount} atualizado(s) no estoque.`,
        false,
      );
      await refreshOficinaWorkspace();
    } else {
      showToast('prod-feedback', data.error?.message || 'Erro ao importar lote CSV.', true);
    }
  } catch {
    showToast('prod-feedback', 'Não foi possível ler o arquivo CSV selecionado.', true);
  }
}

function renderClientsList() {
  const container = document.getElementById('oficina-clients-list');
  if (!container) return;

  const filter = (document.getElementById('client-filter-input')?.value || '').trim().toLowerCase();
  const quoteCountByClient = new Map();
  const lastVehicleIdByClient = new Map();
  companyQuotes.forEach((q) => {
    if (q.clientId) {
      quoteCountByClient.set(q.clientId, (quoteCountByClient.get(q.clientId) || 0) + 1);
      if (q.vehicleId) {
        lastVehicleIdByClient.set(q.clientId, q.vehicleId);
      }
    }
  });
  const vehicleById = new Map(allVehicles.map((v) => [v.id, v]));

  const filtered = companyClients.filter((c) => {
    if (!filter) return true;
    const lastVehId = lastVehicleIdByClient.get(c.id);
    const lastVeh = lastVehId ? vehicleById.get(lastVehId) : null;
    const vehText = lastVeh ? lastVeh.fullLabel.toLowerCase() : '';
    return (
      c.name.toLowerCase().includes(filter) ||
      c.email.toLowerCase().includes(filter) ||
      c.phone.toLowerCase().includes(filter) ||
      vehText.includes(filter)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhum cliente encontrado na carteira da oficina.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((c) => {
      const qCount = quoteCountByClient.get(c.id) || 0;
      const lastVehId = lastVehicleIdByClient.get(c.id);
      const lastVeh = lastVehId ? vehicleById.get(lastVehId) : null;
      const isEditing = editingClientId === c.id;
      return `
      <div
        class="data-row clickable ${isEditing ? 'editing-active' : ''}"
        onclick="selectClientForNextQuote(${c.id})"
        title="Clique para selecionar este cliente no próximo orçamento"
      >
        <div>
          <div class="data-row-title-group">
            <strong>${c.name}</strong>
            <span class="badge-slot">${qCount} ${qCount === 1 ? 'cotação' : 'cotações'}</span>
          </div>
          <div class="data-row-meta">${c.email} • Telefone: ${c.phone}</div>
          ${
            lastVeh
              ? `<div style="font-family: 'Google Sans Code', monospace; font-size: 0.73rem; color: var(--theme-accent); margin-top: 4px;">
                  Último veículo cotado: ${lastVeh.fullLabel} (${lastVeh.manufYearStart}–${lastVeh.manufYearEnd})
                </div>`
              : ''
          }
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${
            lastVeh
              ? `<button
                  type="button"
                  class="btn btn-primary btn-sm"
                  onclick="event.stopPropagation(); quoteClientLastVehicle(${c.id}, ${lastVeh.id})"
                  title="Abrir os 6 itens e o orçamento do último veículo deste cliente"
                >
                  Cotar ${lastVeh.model} →
                </button>`
              : ''
          }
          <button
            type="button"
            class="btn btn-outline btn-sm"
            onclick="event.stopPropagation(); prefillClientFormFromRow(${c.id})"
          >
            ${isEditing ? 'Editando' : 'Editar'}
          </button>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            onclick="event.stopPropagation(); deleteClientById(${c.id})"
          >
            Remover
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

async function quoteClientLastVehicle(clientId, vehicleId) {
  selectClientForNextQuote(clientId);
  await navigateTo('/index');
  await selectVehicle(vehicleId, true);
  openQuoteDrawer();
}

function prefillClientFormFromRow(clientId) {
  const client = companyClients.find((c) => c.id === clientId);
  if (!client) return;
  editingClientId = client.id;

  const nameInput = document.getElementById('client-name');
  const phoneInput = document.getElementById('client-phone');
  const emailInput = document.getElementById('client-email');

  if (nameInput) nameInput.value = client.name;
  if (phoneInput) {
    phoneInput.value = client.phone;
    maskPhoneInput(phoneInput);
  }
  if (emailInput) emailInput.value = client.email;

  const badgeEl = document.getElementById('client-form-badge');
  const titleEl = document.getElementById('client-form-title');
  const submitBtn = document.getElementById('client-form-submit-btn');
  const cancelBtn = document.getElementById('client-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = `Editando Cliente #${client.id}`;
  if (titleEl) titleEl.textContent = 'Atualizar Dados do Cliente';
  if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  renderClientsList();
  if (nameInput) nameInput.focus();
  pushFloatingToast(`Editando dados de "${client.name}".`, false);
}

function cancelClientEdit(showFeedback = true) {
  editingClientId = null;
  const nameInput = document.getElementById('client-name');
  const phoneInput = document.getElementById('client-phone');
  const emailInput = document.getElementById('client-email');

  if (nameInput) nameInput.value = '';
  if (phoneInput) phoneInput.value = '';
  if (emailInput) emailInput.value = '';

  const badgeEl = document.getElementById('client-form-badge');
  const titleEl = document.getElementById('client-form-title');
  const submitBtn = document.getElementById('client-form-submit-btn');
  const cancelBtn = document.getElementById('client-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = 'Novo Cadastro';
  if (titleEl) titleEl.textContent = 'Adicionar Cliente';
  if (submitBtn) submitBtn.textContent = 'Salvar Cliente';
  if (cancelBtn) cancelBtn.style.display = 'none';

  renderClientsList();
  if (showFeedback) {
    pushFloatingToast('Edição de cliente cancelada.', false);
  }
}

function selectClientForNextQuote(clientId) {
  const client = companyClients.find((c) => c.id === clientId);
  if (!client) return;
  const select = document.getElementById('drawer-client-select');
  if (select) {
    select.value = String(client.id);
    syncAllCustomSelects();
  }
  pushFloatingToast(`Cliente ${client.name} selecionado para a próxima cotação.`, false);
}

async function handleCreateClientFromPanel(event) {
  event.preventDefault();
  const name = document.getElementById('client-name').value.trim();
  const phone = document.getElementById('client-phone').value.trim();
  const email = document.getElementById('client-email').value.trim();

  const isEditing = editingClientId !== null;
  const endpoint = isEditing ? `/api/clients/${editingClientId}` : '/api/clients';
  const method = isEditing ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name, phone, email }),
  });

  const data = await res.json();
  if (res.ok) {
    event.target.reset();
    cancelClientEdit(false);
    showToast(
      'client-panel-feedback',
      isEditing
        ? `Dados do cliente ${data.name} atualizados com sucesso.`
        : `Cliente ${data.name} adicionado à carteira da oficina.`,
      false,
    );
    await refreshOficinaWorkspace();
    await loadClients();
  } else {
    showToast('client-panel-feedback', data.error?.message || 'Erro ao salvar cliente.', true);
  }
}

async function deleteClientById(id) {
  const res = await fetch(`/api/clients/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    if (editingClientId === id) {
      cancelClientEdit(false);
    }
    pushFloatingToast('Cliente removido da carteira.', false);
    await refreshOficinaWorkspace();
    await loadClients();
  }
}

function renderQuotesList() {
  const container = document.getElementById('oficina-quotes-list');
  if (!container) return;

  if (companyQuotes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Nenhum orçamento emitido ainda nesta sessão. Consulte um veículo em Consulta &amp; Cotação para gerar uma proposta.
      </div>
    `;
    return;
  }

  const filterText = (document.getElementById('quote-filter-input')?.value || '')
    .trim()
    .toLowerCase();
  const statusFilter = document.getElementById('quote-status-filter')?.value || 'ALL';

  const vehicleById = new Map(allVehicles.map((v) => [v.id, v]));
  const clientById = new Map(companyClients.map((c) => [c.id, c]));

  const filteredQuotes = companyQuotes.filter((q) => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (!filterText) return true;
    const veh = vehicleById.get(q.vehicleId);
    const cli = q.clientId ? clientById.get(q.clientId) : null;
    const vehName = (veh ? veh.fullLabel : '').toLowerCase();
    const cliName = (cli ? `${cli.name} ${cli.email}` : 'atendimento de balcão').toLowerCase();
    return vehName.includes(filterText) || cliName.includes(filterText) || String(q.id) === filterText;
  });

  if (filteredQuotes.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhum orçamento corresponde ao filtro selecionado.</div>`;
    return;
  }

  container.innerHTML = filteredQuotes
    .map((q) => {
      const veh = vehicleById.get(q.vehicleId);
      const cli = q.clientId ? clientById.get(q.clientId) : null;
      const vehName = veh ? veh.fullLabel : 'Veículo Consultado';
      const cliName = cli ? cli.name : 'Atendimento de Balcão';
      const profileLabel = QUOTE_PROFILE_LABELS[q.profile] || q.profile;
      const statusLabel = QUOTE_STATUS_LABELS[q.status] || q.status;

      return `
        <div
          class="data-row clickable"
          onclick="openSavedQuoteInDrawer(${q.id})"
          title="Clique para reabrir este orçamento na gaveta lateral"
        >
          <div>
            <div class="data-row-title-group">
              <strong>#${q.id} • ${vehName} • ${profileLabel}</strong>
              <span class="tag-best">${statusLabel}</span>
            </div>
            <div class="data-row-meta">
              Cliente: ${cliName} • ${q.items.length} itens na proposta
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="product-price-code">R$ ${q.totalAmount.toFixed(2)}</span>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="event.stopPropagation(); printSavedQuoteById(${q.id})"
            >
              Imprimir / PDF
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="event.stopPropagation(); sendSavedQuoteWhatsApp(${q.id})"
            >
              WhatsApp
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="event.stopPropagation(); resendQuoteById(${q.id})"
            >
              Reenviar por E-mail
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              onclick="event.stopPropagation(); deleteQuoteById(${q.id})"
            >
              Excluir
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function deleteQuoteById(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    pushFloatingToast(`Orçamento #${quoteId} removido do histórico.`, false);
    await refreshOficinaWorkspace();
  } else {
    const err = await res.json();
    showToast('oficina-quotes-feedback', err.error?.message || 'Erro ao excluir orçamento.', true);
  }
}

async function openSavedQuoteInDrawer(quoteId) {
  const quote = companyQuotes.find((q) => q.id === quoteId);
  if (!quote) return;

  await selectVehicle(quote.vehicleId, false);
  editableItems = quote.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    manufacturer: item.manufacturer,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  if (quote.clientId) {
    const clientSel = document.getElementById('drawer-client-select');
    if (clientSel) clientSel.value = String(quote.clientId);
  }

  renderDrawerItems();
  openQuoteDrawer();
  pushFloatingToast('Orçamento reaberto na gaveta lateral para conferência.', false);
}

async function resendQuoteById(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data = await res.json();
  if (res.ok) {
    showToast(
      'oficina-quotes-feedback',
      `Proposta de R$ ${data.totalAmount.toFixed(2)} reenviada para o e-mail do cliente.`,
      false,
    );
    await refreshOficinaWorkspace();
  } else {
    showToast('oficina-quotes-feedback', data.error?.message || 'Erro ao enviar e-mail.', true);
  }
}

/* ============================================================================
   ROTA /admin: CURADORIA DE CONTAS, FROTA DE VEÍCULOS E ESPECIFICAÇÕES
   ============================================================================ */
function switchAdminTab(tab) {
  ['users', 'vehicles', 'catalogs'].forEach((t) => {
    document.getElementById(`admin-tab-${t}`).classList.toggle('active', t === tab);
    const panel = document.getElementById(`admin-panel-${t}`);
    if (panel) {
      panel.style.display = t === tab ? (t === 'users' ? 'block' : 'grid') : 'none';
    }
  });
  syncAllCustomSelects();
}

function syncCatalogSubtypes() {
  const catSelect = document.getElementById('cat-category');
  const subSelect = document.getElementById('cat-subtype');
  if (!catSelect || !subSelect) return;

  const map = {
    OLEO: [
      { value: 'MOTOR', label: 'Óleo de Motor' },
      { value: 'FREIO', label: 'Fluido de Freio' },
      { value: 'CAMBIO', label: 'Fluido de Transmissão' },
    ],
    FILTRO: [
      { value: 'OLEO', label: 'Filtro de Óleo' },
      { value: 'COMBUSTIVEL', label: 'Filtro de Combustível' },
      { value: 'AR', label: 'Filtro de Ar do Motor' },
    ],
  };

  const options = map[catSelect.value] || map.OLEO;
  subSelect.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  syncAllCustomSelects();
}

async function refreshAdminWorkspace() {
  const roleGuard = document.getElementById('admin-role-guard');
  if (roleGuard) {
    roleGuard.style.display = currentUser?.role === 'ADMIN' ? 'none' : 'block';
  }

  await Promise.all([
    loadAdminPendingUsers(),
    loadAdminVehicles(),
    loadAdminCatalogs(),
  ]);
  renderAdminKpis();
  syncAllCustomSelects();
}

function renderAdminKpis() {
  const brandsValEl = document.getElementById('kpi-admin-brands');
  const brandsMetaEl = document.getElementById('kpi-admin-brands-meta');
  const vehValEl = document.getElementById('kpi-admin-vehicles');
  const vehMetaEl = document.getElementById('kpi-admin-vehicles-meta');
  const catValEl = document.getElementById('kpi-admin-catalogs');
  const catMetaEl = document.getElementById('kpi-admin-catalogs-meta');
  const pendValEl = document.getElementById('kpi-admin-pending');
  const pendMetaEl = document.getElementById('kpi-admin-pending-meta');

  const distinctBrands = new Set(allVehicles.map((v) => v.manufacturer));
  if (brandsValEl) brandsValEl.textContent = String(distinctBrands.size);
  if (brandsMetaEl) brandsMetaEl.textContent = 'Montadoras homologadas no Brasil';

  if (vehValEl) vehValEl.textContent = String(allVehicles.length);
  if (vehMetaEl) {
    vehMetaEl.textContent = `${allVehicles.length * 6} vínculos técnicos (6 slots/veículo)`;
  }

  const oilCount = catalogItems.filter((c) => c.category === 'OLEO').length;
  const filterCount = catalogItems.filter((c) => c.category === 'FILTRO').length;
  if (catValEl) catValEl.textContent = String(catalogItems.length);
  if (catMetaEl) {
    catMetaEl.textContent = `${oilCount} fluidos • ${filterCount} elementos filtrantes`;
  }

  if (pendValEl) pendValEl.textContent = String(adminPendingUsersCount);
  if (pendMetaEl) {
    pendMetaEl.textContent =
      adminPendingUsersCount === 0
        ? 'Fila de aprovação em dia'
        : `${adminPendingUsersCount} conta(s) aguardando revisão`;
  }
}

async function loadAdminPendingUsers() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  if (!authToken || currentUser?.role !== 'ADMIN') {
    adminPendingUsersCount = 0;
    adminUsersList = [];
    renderAdminKpis();
    container.innerHTML = `<div class="empty-state">Entre como Administrador para revisar e aprovar contas de operadores e oficinas.</div>`;
    return;
  }

  const statusSel = document.getElementById('admin-user-status-filter')?.value || 'ALL';
  const res = await fetch(`/api/admin/users?status=${encodeURIComponent(statusSel)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!res.ok) {
    container.innerHTML = `<div class="empty-state">Não foi possível carregar a lista de contas.</div>`;
    return;
  }

  adminUsersList = await res.json();
  if (statusSel === 'ALL') {
    adminPendingUsersCount = adminUsersList.filter((u) => u.status === 'PENDING').length;
  } else if (statusSel === 'PENDING') {
    adminPendingUsersCount = adminUsersList.length;
  }
  renderAdminKpis();
  renderAdminUsersList();
}

function renderAdminUsersList() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  const filter = (document.getElementById('admin-user-search-input')?.value || '')
    .trim()
    .toLowerCase();

  const filtered = adminUsersList.filter((u) => {
    if (!filter) return true;
    return (
      u.name.toLowerCase().includes(filter) ||
      u.login.toLowerCase().includes(filter) ||
      u.email.toLowerCase().includes(filter) ||
      (u.cnpjFormatted && u.cnpjFormatted.toLowerCase().includes(filter)) ||
      (u.companyTradeName && u.companyTradeName.toLowerCase().includes(filter))
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Nenhuma conta encontrada para este filtro de curadoria.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (u) => `
      <div class="data-row">
        <div>
          <div class="data-row-title-group">
            <strong>${u.name} (${u.login})</strong>
            <span class="badge-slot">${USER_STATUS_LABELS[u.status] || u.status}</span>
            ${u.role === 'ADMIN' ? '<span class="tag-best">ADMIN</span>' : ''}
          </div>
          <div class="data-row-meta">
            ${u.companyTradeName || 'Oficina'} • CNPJ ${u.cnpjFormatted} • ${u.email} • Tel: ${u.phone}
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${
            u.status !== 'APPROVED'
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="reviewUserAccount(${u.id}, 'APPROVED')">
                  Aprovar Acesso
                </button>`
              : ''
          }
          ${
            u.status !== 'REJECTED' && u.role !== 'ADMIN'
              ? `<button type="button" class="btn btn-danger btn-sm" onclick="reviewUserAccount(${u.id}, 'REJECTED')">
                  ${u.status === 'APPROVED' ? 'Suspender Acesso' : 'Recusar'}
                </button>`
              : ''
          }
        </div>
      </div>
    `,
    )
    .join('');
}

async function reviewUserAccount(userId, decision) {
  const res = await fetch(`/api/admin/users/${userId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ decision }),
  });

  const data = await res.json();
  if (res.ok) {
    const label = decision === 'APPROVED' ? 'aprovado' : 'recusado';
    showToast('admin-users-feedback', `Cadastro #${data.id} ${label} com sucesso.`, false);
    await loadAdminPendingUsers();
  } else {
    showToast('admin-users-feedback', data.error?.message || 'Falha na revisão da conta.', true);
  }
}

async function loadAdminVehicles() {
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const res = await fetch('/api/vehicles/disambiguate?q=', { headers });
  if (!res.ok) return;

  const data = await res.json();
  allVehicles = data.candidates || [];
  populateVehicleSelectors();
  renderAdminVehiclesList();
  renderAdminKpis();
}

function renderAdminVehiclesList() {
  const listEl = document.getElementById('admin-vehicles-list');
  const filter = (document.getElementById('admin-vehicle-filter-input')?.value || '')
    .trim()
    .toLowerCase();

  const filtered = allVehicles.filter((v) => {
    if (!filter) return true;
    const yearMatch =
      /^\d{4}$/.test(filter) &&
      Number(filter) >= v.manufYearStart &&
      Number(filter) <= v.manufYearEnd;
    return (
      yearMatch ||
      v.fullLabel.toLowerCase().includes(filter) ||
      v.manufacturer.toLowerCase().includes(filter) ||
      v.model.toLowerCase().includes(filter) ||
      (v.version && v.version.toLowerCase().includes(filter))
    );
  });

  if (listEl) {
    const adminDisplayVehicles = filtered.slice(0, 120);
    listEl.innerHTML =
      adminDisplayVehicles.length > 0
        ? `<div style="padding: 6px 2px 10px; font-size: 0.78rem; color: var(--theme-on-surface-variant); font-family: 'Google Sans Code', monospace;">
            ${filter ? `Encontrados: ${filtered.length} de ${allVehicles.length} veículos` : `Total na Base Nacional: ${allVehicles.length} veículos homologados`} ${filtered.length > 120 ? '(exibindo os 120 primeiros)' : ''}
          </div>` +
          adminDisplayVehicles
            .map((v) => {
              const isEditing = editingVehicleId === v.id;
              return `
          <div
            class="data-row clickable ${isEditing ? 'editing-active' : ''}"
            onclick="selectVehicleFromAdminRow(${v.id})"
            title="Clique para consultar os 6 itens deste veículo"
          >
            <div>
              <strong>${v.fullLabel}</strong>
              <div class="data-row-meta">
                ${VEHICLE_TYPE_LABELS[v.type] || v.type} • Fabricação ${v.manufYearStart} a ${v.manufYearEnd}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="event.stopPropagation(); selectVehicleFromAdminRow(${v.id})"
              >
                Ver 6 Itens →
              </button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="event.stopPropagation(); prefillVehicleFormFromRow(${v.id})"
              >
                ${isEditing ? 'Editando' : 'Editar'}
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick="event.stopPropagation(); deleteVehicleById(${v.id})"
              >
                Remover
              </button>
            </div>
          </div>
        `;
            })
            .join('')
        : `<div class="empty-state">Nenhum veículo encontrado para este filtro na base nacional.</div>`;
  }

  const vehSelect = document.getElementById('spec-vehicle-select');
  if (vehSelect) {
    const prevVal = vehSelect.value;
    const selectList = filtered.length > 0 ? filtered.slice(0, 300) : allVehicles.slice(0, 300);
    vehSelect.innerHTML = selectList
      .map((v) => `<option value="${v.id}">${v.fullLabel} (${v.manufYearStart}–${v.manufYearEnd})</option>`)
      .join('');
    if (prevVal && selectList.some((v) => String(v.id) === prevVal)) {
      vehSelect.value = prevVal;
    }
    syncAllCustomSelects();
  }
}

async function selectVehicleFromAdminRow(vehicleId) {
  const vehSelect = document.getElementById('spec-vehicle-select');
  if (vehSelect) {
    vehSelect.value = String(vehicleId);
    syncAllCustomSelects();
  }
  await navigateTo('/index');
  await selectVehicle(vehicleId, false);
}

function prefillVehicleFormFromRow(vehicleId) {
  const veh = allVehicles.find((v) => v.id === vehicleId);
  if (!veh) return;
  editingVehicleId = veh.id;

  const manufInput = document.getElementById('veh-manufacturer');
  const modelInput = document.getElementById('veh-model');
  const verInput = document.getElementById('veh-version');
  const typeSel = document.getElementById('veh-type');
  const startInput = document.getElementById('veh-year-start');
  const endInput = document.getElementById('veh-year-end');

  if (manufInput) manufInput.value = veh.manufacturer;
  if (modelInput) modelInput.value = veh.model;
  if (verInput) verInput.value = veh.version || '';
  if (typeSel) typeSel.value = veh.type || 'CARRO';
  if (startInput) startInput.value = String(veh.manufYearStart);
  if (endInput) endInput.value = String(veh.manufYearEnd);

  const badgeEl = document.getElementById('veh-form-badge');
  const titleEl = document.getElementById('veh-form-title');
  const submitBtn = document.getElementById('veh-form-submit-btn');
  const cancelBtn = document.getElementById('veh-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = `Editando Veículo #${veh.id}`;
  if (titleEl) titleEl.textContent = 'Atualizar Modelo e Motorização';
  if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  renderAdminVehiclesList();
  syncAllCustomSelects();
  if (verInput) verInput.focus();
  pushFloatingToast(`Editando "${veh.fullLabel}".`, false);
}

function cancelVehicleEdit(showFeedback = true) {
  editingVehicleId = null;
  const manufInput = document.getElementById('veh-manufacturer');
  const modelInput = document.getElementById('veh-model');
  const verInput = document.getElementById('veh-version');
  const typeSel = document.getElementById('veh-type');
  const startInput = document.getElementById('veh-year-start');
  const endInput = document.getElementById('veh-year-end');

  if (manufInput) manufInput.value = '';
  if (modelInput) modelInput.value = '';
  if (verInput) verInput.value = '';
  if (typeSel) typeSel.value = 'CARRO';
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';

  const badgeEl = document.getElementById('veh-form-badge');
  const titleEl = document.getElementById('veh-form-title');
  const submitBtn = document.getElementById('veh-form-submit-btn');
  const cancelBtn = document.getElementById('veh-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = 'Novo Veículo';
  if (titleEl) titleEl.textContent = 'Cadastrar Modelo e Motorização';
  if (submitBtn) submitBtn.textContent = 'Cadastrar Veículo';
  if (cancelBtn) cancelBtn.style.display = 'none';

  renderAdminVehiclesList();
  syncAllCustomSelects();
  if (showFeedback) {
    pushFloatingToast('Edição de veículo cancelada.', false);
  }
}

async function handleCreateVehicle(event) {
  event.preventDefault();
  const manufacturer = document.getElementById('veh-manufacturer').value.trim();
  const model = document.getElementById('veh-model').value.trim();
  const version = document.getElementById('veh-version').value.trim();
  const type = document.getElementById('veh-type').value;
  const manufYearStart = Number(document.getElementById('veh-year-start').value);
  const manufYearEnd = Number(document.getElementById('veh-year-end').value);

  const isEditing = editingVehicleId !== null;
  const endpoint = isEditing ? `/api/vehicles/${editingVehicleId}` : '/api/vehicles';
  const method = isEditing ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      manufacturer,
      model,
      version,
      type,
      manufYearStart,
      manufYearEnd,
    }),
  });

  const data = await res.json();
  if (res.ok) {
    event.target.reset();
    cancelVehicleEdit(false);
    showToast(
      'veh-feedback',
      isEditing
        ? `Veículo ${data.manufacturer} ${data.model} (${data.version}) atualizado com sucesso.`
        : `${data.manufacturer} ${data.model} (${data.version}) adicionado à frota.`,
      false,
    );
    await loadAdminVehicles();
  } else {
    showToast('veh-feedback', data.error?.message || 'Erro ao salvar veículo.', true);
  }
}

async function deleteVehicleById(id) {
  const res = await fetch(`/api/vehicles/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    if (editingVehicleId === id) {
      cancelVehicleEdit(false);
    }
    pushFloatingToast('Veículo removido da frota nacional.', false);
    await loadAdminVehicles();
  } else {
    const err = await res.json();
    showToast('veh-feedback', err.error?.message || 'Apenas administradores podem remover veículos.', true);
  }
}

async function loadAdminCatalogs() {
  if (!authToken) return;
  const res = await fetch('/api/catalogs', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) return;

  catalogItems = await res.json();
  renderAdminCatalogsList();
  renderAdminKpis();

  const specCatSelect = document.getElementById('spec-catalog-select');
  if (specCatSelect) {
    specCatSelect.innerHTML = catalogItems
      .map((c) => `<option value="${c.id}">${SUBTYPE_LABELS[c.subtype] || c.subtype} — ${c.name}</option>`)
      .join('');
    syncAllCustomSelects();
  }
}

function renderAdminCatalogsList() {
  const listEl = document.getElementById('admin-catalogs-list');
  if (!listEl) return;

  const filter = (document.getElementById('admin-catalog-filter-input')?.value || '')
    .trim()
    .toLowerCase();

  const filtered = catalogItems.filter((c) => {
    if (!filter) return true;
    const subLabel = (SUBTYPE_LABELS[c.subtype] || c.subtype).toLowerCase();
    return (
      c.name.toLowerCase().includes(filter) ||
      c.specification.toLowerCase().includes(filter) ||
      subLabel.includes(filter)
    );
  });

  listEl.innerHTML =
    filtered.length > 0
      ? `<div style="padding: 4px 2px 10px; font-size: 0.78rem; color: var(--theme-on-surface-variant); font-family: 'Google Sans Code', monospace;">
          Exibindo ${filtered.length} de ${catalogItems.length} especificações técnicas homologadas
        </div>` +
        filtered
          .map((c) => {
            const isEditing = editingCatalogId === c.id;
            return `
          <div
            class="data-row clickable ${isEditing ? 'editing-active' : ''}"
            onclick="selectCatalogFromAdminRow(${c.id})"
            title="Clique para selecionar esta especificação no formulário de vínculo ao lado"
          >
            <div>
              <div class="data-row-title-group">
                <span class="badge-slot">${SUBTYPE_LABELS[c.subtype] || c.subtype}</span>
                <strong>${c.name}</strong>
              </div>
              <div class="data-row-meta">Norma Técnica: ${c.specification}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="event.stopPropagation(); selectCatalogFromAdminRow(${c.id})"
              >
                Vincular
              </button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                onclick="event.stopPropagation(); prefillCatalogFormFromRow(${c.id})"
              >
                ${isEditing ? 'Editando' : 'Editar'}
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick="event.stopPropagation(); deleteCatalogById(${c.id})"
              >
                Excluir
              </button>
            </div>
          </div>
        `;
          })
          .join('')
      : `<div class="empty-state">Nenhuma especificação encontrada para este filtro.</div>`;
}

function selectCatalogFromAdminRow(catalogId) {
  const specCatSelect = document.getElementById('spec-catalog-select');
  if (specCatSelect) {
    specCatSelect.value = String(catalogId);
    syncAllCustomSelects();
    preloadCurrentTechSpecSlot();
  }
  const litersInput = document.getElementById('spec-liters');
  if (litersInput) litersInput.focus();
  pushFloatingToast('Especificação selecionada para vínculo com veículo.', false);
}

function prefillCatalogFormFromRow(catalogId) {
  const cat = catalogItems.find((c) => c.id === catalogId);
  if (!cat) return;
  editingCatalogId = cat.id;

  const catSel = document.getElementById('cat-category');
  const subSel = document.getElementById('cat-subtype');
  const nameInput = document.getElementById('cat-name');
  const specInput = document.getElementById('cat-spec');

  if (catSel) {
    catSel.value = cat.category;
    syncCatalogSubtypes();
  }
  if (subSel) subSel.value = cat.subtype;
  if (nameInput) nameInput.value = cat.name;
  if (specInput) specInput.value = cat.specification;

  const badgeEl = document.getElementById('cat-form-badge');
  const titleEl = document.getElementById('cat-form-title');
  const submitBtn = document.getElementById('cat-form-submit-btn');
  const cancelBtn = document.getElementById('cat-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = `Editando Norma #${cat.id}`;
  if (titleEl) titleEl.textContent = 'Editar Especificação Técnica';
  if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  renderAdminCatalogsList();
  syncAllCustomSelects();
  if (nameInput) nameInput.focus();
  pushFloatingToast(`Editando "${cat.name}".`, false);
}

function cancelCatalogEdit(showFeedback = true) {
  editingCatalogId = null;
  const catSel = document.getElementById('cat-category');
  const nameInput = document.getElementById('cat-name');
  const specInput = document.getElementById('cat-spec');

  if (catSel) {
    catSel.value = 'OLEO';
    syncCatalogSubtypes();
  }
  if (nameInput) nameInput.value = '';
  if (specInput) specInput.value = '';

  const badgeEl = document.getElementById('cat-form-badge');
  const titleEl = document.getElementById('cat-form-title');
  const submitBtn = document.getElementById('cat-form-submit-btn');
  const cancelBtn = document.getElementById('cat-form-cancel-btn');

  if (badgeEl) badgeEl.textContent = 'Nova Norma ou Elemento';
  if (titleEl) titleEl.textContent = 'Criar Especificação Técnica';
  if (submitBtn) submitBtn.textContent = 'Adicionar ao Catálogo';
  if (cancelBtn) cancelBtn.style.display = 'none';

  renderAdminCatalogsList();
  syncAllCustomSelects();
  if (showFeedback) {
    pushFloatingToast('Edição de especificação cancelada.', false);
  }
}

async function preloadCurrentTechSpecSlot() {
  const vehicleId = Number(document.getElementById('spec-vehicle-select')?.value || 0);
  const catalogId = Number(document.getElementById('spec-catalog-select')?.value || 0);
  if (!vehicleId || !catalogId) return;

  const selectedCatalog = catalogItems.find((c) => c.id === catalogId);
  if (!selectedCatalog) return;

  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const res = await fetch(`/api/lookup/${vehicleId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const specs = data.specifications || [];
    const matchingSlot =
      specs.find((s) => s.catalogId === catalogId) ||
      specs.find(
        (s) => s.category === selectedCatalog.category && s.subtype === selectedCatalog.subtype,
      );

    const litersInput = document.getElementById('spec-liters');
    const intervalInput = document.getElementById('spec-interval');
    const notesInput = document.getElementById('spec-notes');

    if (matchingSlot) {
      if (litersInput) {
        litersInput.value = String(matchingSlot.capacityLiters ?? 1);
      }
      if (intervalInput) {
        intervalInput.value = matchingSlot.intervalKm ? String(matchingSlot.intervalKm) : '';
      }
      if (notesInput) {
        notesInput.value = matchingSlot.notes || '';
      }
    }
  } catch {
    // Mantém os campos editáveis se a consulta falhar
  }
}

async function handleCreateCatalog(event) {
  event.preventDefault();
  const category = document.getElementById('cat-category').value;
  const subtype = document.getElementById('cat-subtype').value;
  const name = document.getElementById('cat-name').value.trim();
  const specification = document.getElementById('cat-spec').value.trim();

  const isEditing = editingCatalogId !== null;
  const endpoint = isEditing ? `/api/catalogs/${editingCatalogId}` : '/api/catalogs';
  const method = isEditing ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ category, subtype, name, specification }),
  });

  const data = await res.json();
  if (res.ok) {
    event.target.reset();
    cancelCatalogEdit(false);
    showToast(
      'cat-feedback',
      isEditing
        ? `Especificação "${data.name}" atualizada com sucesso.`
        : `Especificação "${data.name}" adicionada ao catálogo.`,
      false,
    );
    await loadAdminCatalogs();
  } else {
    showToast('cat-feedback', data.error?.message || 'Erro ao salvar item no catálogo.', true);
  }
}

async function deleteCatalogById(id) {
  const res = await fetch(`/api/catalogs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    if (editingCatalogId === id) {
      cancelCatalogEdit(false);
    }
    pushFloatingToast('Especificação removida do catálogo.', false);
    await loadAdminCatalogs();
  } else {
    const err = await res.json();
    showToast('cat-feedback', err.error?.message || 'Apenas administradores podem remover especificações.', true);
  }
}

async function handleAssignTechSpec(event) {
  event.preventDefault();
  const vehicleId = Number(document.getElementById('spec-vehicle-select').value);
  const catalogId = Number(document.getElementById('spec-catalog-select').value);
  const capacityLiters = Number(document.getElementById('spec-liters').value);
  const intervalVal = document.getElementById('spec-interval').value;
  const notes = document.getElementById('spec-notes').value.trim();

  const res = await fetch('/api/technical-specifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      vehicleId,
      catalogId,
      capacityLiters,
      intervalKm: intervalVal ? Number(intervalVal) : null,
      notes: notes || null,
    }),
  });

  const data = await res.json();
  if (res.ok) {
    showToast('spec-assign-feedback', 'Especificação vinculada com sucesso ao veículo selecionado.', false);
  } else {
    showToast('spec-assign-feedback', data.error?.message || 'Erro ao vincular especificação.', true);
  }
}

/* ============================================================================
   ROTA /principal: CREDENCIAMENTO DE OFICINA E OPERADOR
   ============================================================================ */
async function handleRegisterCompany(event) {
  event.preventDefault();
  const cnpj = document.getElementById('reg-cnpj').value.trim();
  const tradeName = document.getElementById('reg-tradename').value.trim();

  const res = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cnpj, tradeName }),
  });

  const data = await res.json();
  if (res.ok) {
    const signupCnpjInput = document.getElementById('signup-cnpj');
    if (signupCnpjInput) signupCnpjInput.value = data.cnpjFormatted || data.cnpj;
    const signupNameInput = document.getElementById('signup-name');
    if (signupNameInput) signupNameInput.focus();
    showToast(
      'reg-company-feedback',
      `Oficina ${data.tradeName} (${data.cnpjFormatted}) credenciada com sucesso. Agora crie seu usuário abaixo.`,
      false,
    );
  } else {
    showToast('reg-company-feedback', data.error?.message || 'Erro ao validar CNPJ.', true);
  }
}

async function handleSignupUser(event) {
  event.preventDefault();
  const cnpj = document.getElementById('signup-cnpj').value.trim();
  const name = document.getElementById('signup-name').value.trim();
  const login = document.getElementById('signup-login').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cnpj, name, login, phone, email, password }),
  });

  const data = await res.json();
  if (res.ok) {
    event.target.reset();
    showToast(
      'signup-user-feedback',
      `Solicitação enviada para ${data.name}. Assim que a conta for aprovada na Administração, seu acesso estará liberado.`,
      false,
    );
  } else {
    showToast('signup-user-feedback', data.error?.message || 'Erro ao cadastrar operador.', true);
  }
}

/* ============================================================================
   SELECTS CUSTOMIZADOS GLASSMÓRFICOS & NOTIFICAÇÕES TOAST FLUTUANTES
   ============================================================================ */
function renderCustomSelectMenuOptions(select, menu) {
  const options = Array.from(select.options || []);
  const showSearch = options.length > 10;

  const searchBarHtml = showSearch
    ? `
      <div class="custom-select-search-wrap" onclick="event.stopPropagation()">
        <input
          type="search"
          class="custom-select-search-input"
          placeholder="Filtrar opções..."
          aria-label="Filtrar opções desta lista"
          autocomplete="off"
        />
      </div>
    `
    : '';

  const optionsHtml = options
    .map(
      (opt) => `
      <button
        type="button"
        class="custom-select-option ${opt.value === select.value ? 'selected' : ''}"
        data-val="${opt.value}"
      >
        <span>${opt.textContent}</span>
        ${opt.value === select.value ? '<span class="symbol" translate="no" style="font-size: 16px;">check</span>' : ''}
      </button>
    `,
    )
    .join('');

  menu.innerHTML = `${searchBarHtml}<div class="custom-select-options-list">${optionsHtml}</div>`;

  if (showSearch && typeof menu.querySelector === 'function') {
    const searchInput = menu.querySelector('.custom-select-search-input');
    if (searchInput) {
      searchInput.addEventListener('click', (e) => e.stopPropagation());
      searchInput.addEventListener('input', (e) => {
        const q = normalizeText(e.target.value || '');
        const optButtons = menu.querySelectorAll('.custom-select-option');
        optButtons.forEach((btn) => {
          const text = normalizeText(btn.textContent || '');
          btn.style.display = !q || text.includes(q) ? 'flex' : 'none';
        });
      });
    }
  }
}

function syncAllCustomSelects() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const selects = document.querySelectorAll('select.input-field');

  selects.forEach((select) => {
    let wrapper = select.parentElement;
    if (!wrapper || !wrapper.classList.contains('custom-select-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      if (select.style.marginBottom) {
        wrapper.style.marginBottom = select.style.marginBottom;
        select.style.marginBottom = '';
      }
      if (select.style.maxWidth) {
        wrapper.style.width = select.style.maxWidth;
        wrapper.style.maxWidth = '100%';
        select.style.maxWidth = '';
      }
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      select.classList.add('custom-select-native-hidden');

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'custom-select-trigger';

      const menu = document.createElement('div');
      menu.className = 'custom-select-menu';

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');
        closeAllCustomSelectMenus();
        if (!isOpen) {
          renderCustomSelectMenuOptions(select, menu);
          wrapper.classList.add('open');
        }
      });

      menu.addEventListener('click', (e) => {
        const optBtn = e.target.closest('.custom-select-option');
        if (!optBtn) return;
        e.stopPropagation();
        const val = optBtn.getAttribute('data-val');
        select.value = val;
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
        syncAllCustomSelects();
      });

      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
    }

    const trigger = wrapper.querySelector('.custom-select-trigger');
    const menu = wrapper.querySelector('.custom-select-menu');
    if (!trigger || !menu) return;

    const options = Array.from(select.options || []);
    const selectedOpt = options.find((o) => o.value === select.value) || options[0];
    const labelText = selectedOpt ? selectedOpt.textContent : 'Selecionar...';

    trigger.innerHTML = `
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${labelText}</span>
      <span class="symbol custom-select-chevron" translate="no" aria-hidden="true">expand_more</span>
    `;

    if (wrapper.classList.contains('open')) {
      renderCustomSelectMenuOptions(select, menu);
    }
  });
}

function closeAllCustomSelectMenus() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('.custom-select-wrapper.open').forEach((w) => {
    w.classList.remove('open');
  });
}

function initGlobalFloatingDismissListeners() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    closeAllCustomSelectMenus();
    const omniboxWrapper = document.getElementById('omnibox-wrapper');
    if (omniboxWrapper && !omniboxWrapper.contains(e.target)) {
      closeOmniboxSuggestions();
    }
    const yearGroup = document.getElementById('omnibox-year-group');
    if (yearGroup && !yearGroup.contains(e.target)) {
      closeOmniboxYearDropdown();
    }
  });
}

function showToast(containerId, message, isError = false) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<div class="status-toast ${isError ? 'error' : ''}">${message}</div>`;
  }
  pushFloatingToast(message, isError);
}

function pushFloatingToast(message, isError = false) {
  const viewport = document.getElementById('toast-viewport');
  if (!viewport || typeof document.createElement !== 'function') return;

  const card = document.createElement('div');
  card.className = `toast-card ${isError ? 'error' : ''}`;
  const iconName = isError ? 'error' : 'check_circle';
  const titleText = isError ? 'Atenção' : 'Confirmação';

  card.innerHTML = `
    <span class="symbol toast-icon" translate="no" aria-hidden="true">${iconName}</span>
    <div class="toast-content">
      <div class="toast-title">${titleText}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Fechar notificação">✕</button>
  `;

  const closeBtn = card.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => card.remove());
  }

  viewport.appendChild(card);

  setTimeout(() => {
    if (card.parentNode) {
      card.remove();
    }
  }, 4400);
}

window.addEventListener('DOMContentLoaded', initSession);
