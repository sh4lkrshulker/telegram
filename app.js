// Публичные настройки Supabase; service_role key никогда не вставляют в браузерный код.
const SUPABASE_URL = 'https://ilcxearxoovnlhowhjzl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CO8RQnNoHWmqZpEd5TGuCw_YNwv3-bV';

// SDK подключается с CDN, поэтому проект остаётся статическим и подходит для Pages.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ссылки на элементы страницы, которые обновляются при работе с сообщениями.
const ui = {
  messenger: document.querySelector('.messenger'),
  indicator: document.querySelector('#connection-indicator'),
  settingsButton: document.querySelector('#settings-button'),
  settingsDialog: document.querySelector('#settings-dialog'),
  settingsClose: document.querySelector('#settings-close'),
  accentOptions: document.querySelectorAll('[data-accent-choice]'),
  soundSetting: document.querySelector('#sound-setting'),
  notificationSetting: document.querySelector('#notification-setting'),
  notificationStatus: document.querySelector('#notification-status'),
  settingsUsername: document.querySelector('#settings-username'),
  settingsEmail: document.querySelector('#settings-email'),
  signoutButton: document.querySelector('#signout-button'),
  pointsBalance: document.querySelector('#points-balance'),
  editProfileButton: document.querySelector('#edit-profile-button'),
  profileEditDialog: document.querySelector('#profile-edit-dialog'),
  profileEditForm: document.querySelector('#profile-edit-form'),
  profileDisplayName: document.querySelector('#profile-display-name'),
  profileBio: document.querySelector('#profile-bio'),
  profileEmoji: document.querySelector('#profile-emoji'),
  profileButton: document.querySelector('#profile-button'),
  profileDialog: document.querySelector('#profile-dialog'),
  profileCard: document.querySelector('#profile-card'),
  giftButton: document.querySelector('#gift-button'),
  giftDialog: document.querySelector('#gift-dialog'),
  giftRecipient: document.querySelector('#gift-recipient'),
  giftBalance: document.querySelector('#gift-balance'),
  giftOptions: document.querySelector('#gift-options'),
  adminCode: document.querySelector('#admin-code'),
  adminUnlockButton: document.querySelector('#admin-unlock-button'),
  adminPanel: document.querySelector('#admin-panel'),
  adminUsers: document.querySelector('#admin-users'),
  adminUserCount: document.querySelector('#admin-user-count'),
  createRoomButton: document.querySelector('#create-room-button'),
  discoverRoomsButton: document.querySelector('#discover-rooms-button'),
  roomList: document.querySelector('#room-list'),
  roomDialog: document.querySelector('#room-dialog'),
  roomForm: document.querySelector('#room-form'),
  roomName: document.querySelector('#room-name'),
  roomDescription: document.querySelector('#room-description'),
  roomKind: document.querySelector('#room-kind'),
  roomPublic: document.querySelector('#room-public'),
  permissionSend: document.querySelector('#permission-send'),
  permissionInvite: document.querySelector('#permission-invite'),
  permissionManage: document.querySelector('#permission-manage'),
  roomManageDialog: document.querySelector('#room-manage-dialog'),
  roomManageTitle: document.querySelector('#room-manage-title'),
  roomManageDescription: document.querySelector('#room-manage-description'),
  roomInviteForm: document.querySelector('#room-invite-form'),
  roomInviteUsername: document.querySelector('#room-invite-username'),
  roomMembers: document.querySelector('#room-members'),
  myAvatar: document.querySelector('#my-avatar'),
  myUsername: document.querySelector('#my-username'),
  search: document.querySelector('#user-search'),
  searchResults: document.querySelector('#search-results'),
  searchHint: document.querySelector('#search-hint'),
  chatList: document.querySelector('#chat-list'),
  chatCount: document.querySelector('#chat-count'),
  emptyState: document.querySelector('#empty-state'),
  conversation: document.querySelector('#conversation'),
  conversationAvatar: document.querySelector('#conversation-avatar'),
  conversationName: document.querySelector('#conversation-name'),
  conversationKind: document.querySelector('#conversation-kind'),
  messages: document.querySelector('#messages'),
  messageForm: document.querySelector('#message-form'),
  messageInput: document.querySelector('#message-input'),
  messageCounter: document.querySelector('#message-counter'),
  backButton: document.querySelector('#back-button'),
  setupScreen: document.querySelector('#setup-screen'),
  setupForm: document.querySelector('#setup-form'),
  emailInput: document.querySelector('#email-input'),
  usernameField: document.querySelector('#username-field'),
  usernameInput: document.querySelector('#username-input'),
  usernameNote: document.querySelector('#username-note'),
  passwordInput: document.querySelector('#password-input'),
  setupEyebrow: document.querySelector('#setup-eyebrow'),
  setupTitle: document.querySelector('#setup-title'),
  setupCopy: document.querySelector('#setup-copy'),
  setupButton: document.querySelector('#setup-button'),
  setupButtonLabel: document.querySelector('#setup-button-label'),
  authToggle: document.querySelector('#auth-toggle'),
  setupError: document.querySelector('#setup-error'),
  toast: document.querySelector('#toast'),
  quickActions: document.querySelectorAll('.quick-action'),
};

// Состояние аккаунта и выбранного собеседника хранится на время работы страницы.
let supabase;
let currentUser;
let myProfile;
let activeProfile;
let activeRoom;
let points = 0;
let authMode = 'signup';
let toastTimer;
let searchTimer;
let refreshTimer;
let messageChannel;
let preferences = { accent: 'mint', sound: false, notifications: false };
const recentProfiles = new Map();

// Акценты меняют только цвета действий; нейтральная тёмная тема остаётся прежней.
const ACCENT_COLORS = {
  mint: { main: '#b5e66c', hover: '#96c94e', soft: '#293526', text: '#d0ecaa' },
  amber: { main: '#f1c477', hover: '#d9a94f', soft: '#3a3021', text: '#f4d9a6' },
  coral: { main: '#ff896b', hover: '#e56e51', soft: '#3b2823', text: '#ffc1ae' },
};

function preferenceStorageKey() {
  return `linea-settings-${currentUser?.id || 'guest'}`;
}

function savePreferences() {
  try {
    localStorage.setItem(preferenceStorageKey(), JSON.stringify(preferences));
  } catch {
    showToast('Браузер не разрешил сохранить настройки.', true);
  }
}

function applyAccent(accent) {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.mint;
  preferences.accent = ACCENT_COLORS[accent] ? accent : 'mint';
  const root = document.documentElement;
  root.style.setProperty('--green', colors.main);
  root.style.setProperty('--green-dark', colors.hover);
  root.style.setProperty('--green-soft', colors.soft);
  root.style.setProperty('--accent-text', colors.text);
  ui.accentOptions.forEach((button) => {
    const selected = button.dataset.accentChoice === preferences.accent;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

// Загружает сохранённые параметры и заполняет сведения об аккаунте в настройках.
function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceStorageKey()) || '{}');
    preferences = {
      accent: ACCENT_COLORS[saved.accent] ? saved.accent : 'mint',
      sound: saved.sound === true,
      notifications: saved.notifications === true,
    };
  } catch {
    preferences = { accent: 'mint', sound: false, notifications: false };
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    preferences.notifications = false;
  }
  applyAccent(preferences.accent);
  ui.soundSetting.checked = preferences.sound;
  ui.notificationSetting.checked = preferences.notifications;
  ui.notificationSetting.disabled = typeof Notification === 'undefined' || Notification.permission === 'denied';
  ui.notificationStatus.textContent = typeof Notification === 'undefined'
    ? 'Этот браузер не поддерживает уведомления'
    : Notification.permission === 'denied'
      ? 'Разреши уведомления для сайта в настройках браузера'
      : 'Показывать, когда вкладка неактивна';
  ui.settingsUsername.textContent = myProfile ? `@${myProfile.username}` : '—';
  ui.settingsEmail.textContent = currentUser?.email || 'Email не указан';
}

function openSettings() {
  loadPreferences();
  ui.settingsDialog.showModal();
}

// Проигрывает короткий сигнал без внешних аудиофайлов.
function playMessageSound() {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 740;
    volume.gain.setValueAtTime(0.035, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.addEventListener('ended', () => context.close(), { once: true });
  } catch {
    // Уведомление остаётся доступным, даже если браузер блокирует аудио.
  }
}

function notifyIncomingMessage(message) {
  if (message.sender_id === currentUser.id || message.recipient_id !== currentUser.id) return;
  if (message.message_type === 'gift') loadPoints();
  if (preferences.sound) playMessageSound();
  if (!preferences.notifications || !document.hidden || Notification.permission !== 'granted') return;

  const sender = recentProfiles.get(message.sender_id);
  const notification = new Notification(sender ? `@${sender.username}` : 'Новое сообщение', {
    body: message.body,
    tag: `linea-${message.sender_id}`,
  });
  notification.onclick = () => {
    window.focus();
    if (sender) openConversation(sender);
    notification.close();
  };
}

async function signOut() {
  ui.signoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  ui.signoutButton.disabled = false;
  if (error) {
    showToast(`Не удалось выйти: ${error.message}`, true);
    return;
  }

  ui.emailInput.value = currentUser.email || '';
  currentUser = null;
  myProfile = null;
  activeProfile = null;
  activeRoom = null;
  points = 0;
  recentProfiles.clear();
  ui.settingsButton.hidden = true;
  ui.pointsBalance.textContent = '0 ✦';
  ui.myAvatar.replaceWith(makeAvatar('?', 'avatar-small', 'my-avatar'));
  ui.myAvatar = document.querySelector('#my-avatar');
  ui.settingsDialog.close();
  ui.messenger.classList.remove('chat-open');
  ui.conversation.hidden = true;
  ui.emptyState.hidden = false;
  ui.myUsername.textContent = 'Не выполнен вход';
  setAuthMode('login');
  showSetup();
}

// Меняет цвет индикатора соединения возле названия приложения.
function setConnection(state) {
  ui.indicator.classList.toggle('is-connected', state === 'connected');
  ui.indicator.classList.toggle('is-error', state === 'error');
}

// Показывает временное уведомление об ошибке или результате действия.
function showToast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('is-error', isError);
  ui.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 3400);
}

// Подбирает цвет аватара на основе имени и показывает его первые две буквы.
function avatarClass(username) {
  let hash = 0;
  for (const character of username) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return `avatar-tone-${Math.abs(hash) % 5}`;
}

function makeAvatar(username, extraClass = '', id = '') {
  const avatar = document.createElement('div');
  avatar.className = `avatar ${avatarClass(username)} ${extraClass}`.trim();
  if (id) avatar.id = id;
  avatar.textContent = username.slice(0, 2).toUpperCase();
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function makeProfileAvatar(profile, extraClass = '', id = '') {
  const avatar = makeAvatar(profile.username, extraClass, id);
  if (profile.avatar_emoji) {
    avatar.textContent = profile.avatar_emoji;
    avatar.classList.add('avatar-emoji');
  }
  return avatar;
}

// Форматирует время сообщения и дату последнего сообщения в списке чатов.
function formatTime(value, includeDate = false) {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  if (includeDate && !sameDay) {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

// Безопасно показывает пояснение в пустом списке, используя текст, а не HTML.
function setListMessage(container, message) {
  const placeholder = document.createElement('p');
  placeholder.className = 'list-placeholder';
  placeholder.textContent = message;
  container.replaceChildren(placeholder);
}

// Показывает форму регистрации/входа и при необходимости выводит ошибку.
function showSetup(message = '') {
  ui.setupScreen.hidden = false;
  ui.setupError.textContent = message;
  ui.setupError.hidden = !message;
  ui.emailInput.focus();
}

// Меняет подписи и браузерные подсказки полей для выбранного режима авторизации.
function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  ui.setupEyebrow.textContent = isSignup ? 'Свой аккаунт — свои разговоры' : 'Рады снова тебя видеть';
  ui.setupTitle.replaceChildren(
    document.createTextNode(isSignup ? 'Создай аккаунт' : 'С возвращением'),
  );
  ui.usernameField.hidden = !isSignup;
  ui.usernameInput.required = isSignup;
  ui.usernameNote.hidden = !isSignup;
  ui.setupCopy.textContent = isSignup
    ? 'Укажи email для входа, придумай пароль и выбер�� имя, по которому тебя найдут друзья.'
    : 'Введи email и пароль, указанные при регистрации.';
  ui.setupButtonLabel.textContent = isSignup ? 'Создать аккаунт' : 'Войти';
  ui.authToggle.textContent = isSignup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  ui.emailInput.autocomplete = isSignup ? 'email' : 'username';
  ui.passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
  ui.setupError.hidden = true;
}

// Сохраняет профиль в состоянии страницы, обновляет шапку и загружает чаты.
async function startApp(profile) {
  myProfile = profile;
  ui.myUsername.textContent = `@${profile.username}`;
  ui.myAvatar.replaceWith(makeAvatar(profile.username, 'avatar-small', 'my-avatar'));
  ui.myAvatar = document.querySelector('#my-avatar');
  ui.settingsButton.hidden = false;
  ui.setupScreen.hidden = true;
  setConnection('connected');
  loadPreferences();
  await loadPoints();
  await loadChats();
  await loadRooms();
  subscribeToMessages();
}

// Загружает профиль пользователя, а после подтверждения регистрации создаёт его
// по username из метаданных Supabase Auth.
async function getOrCreateProfile(user) {
  const { data: existingProfile, error } = await supabase
    .from('chat_profiles')
    .select('user_id, username, display_name, bio, avatar_emoji')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || existingProfile) return { profile: existingProfile, error };

  const username = user.user_metadata?.username;
  if (!username) return { profile: null, error: null };
  const { data: profile, error: insertError } = await supabase
    .from('chat_profiles')
    .insert({ user_id: user.id, username })
    .select('user_id, username, display_name, bio, avatar_emoji')
    .single();
  return { profile, error: insertError };
}

// Регистрирует пользователя по email, паролю и публичному имени либо выполняет вход.
async function authenticate(event) {
  event.preventDefault();
  const email = ui.emailInput.value.trim().toLowerCase();
  const username = ui.usernameInput.value.trim().toLowerCase();
  const password = ui.passwordInput.value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSetup('Введи корректный адрес электронной почты.');
    return;
  }
  if (authMode === 'signup' && !/^[a-z0-9_]{3,20}$/.test(username)) {
    showSetup('Используй 3–20 символов: латинские буквы, цифры или подчёркивание.');
    return;
  }
  if (password.length < 8) {
    showSetup('Пароль должен содержать не менее 8 символов.');
    return;
  }

  ui.setupButton.disabled = true;
  ui.setupButtonLabel.textContent = authMode === 'signup' ? 'Создаём аккаунт...' : 'Входим...';
  ui.setupError.hidden = true;
  let authError;

  if (authMode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        data: { username },
      },
    });
    authError = error;
    if (!error && !data.session) {
      ui.emailInput.value = email;
      setAuthMode('login');
      showSetup('Проверь почту и подтверди регистрацию по ссылке. После подтверждения войди с email и паролем.');
      ui.setupButton.disabled = false;
      ui.setupButtonLabel.textContent = 'Войти';
      return;
    }
    if (!error) currentUser = data.user;
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    authError = error;
    if (!error) currentUser = data.user;
  }

  ui.setupButton.disabled = false;
  ui.setupButtonLabel.textContent = authMode === 'signup' ? 'Создать аккаунт' : 'Войти';
  if (authError) {
    const message = authMode === 'signup'
      ? authError.message.includes('already') || authError.code === 'user_already_exists'
        ? 'Такой юзернейм уже зарегистрирован. Выбери другой или переключись на вход.'
        : `Не получилось создать аккаунт: ${authError.message}`
      : 'Неверный юзернейм или пароль. Проверь данные либо создай аккаунт.';
    showSetup(message);
    return;
  }

  const { profile, error } = await getOrCreateProfile(currentUser);
  if (error || !profile) {
    await supabase.auth.signOut();
    currentUser = null;
    showSetup(error
      ? `Не удалось сохранить профиль: ${error.message}`
      : 'Профиль не найден. Зарегистрируйся заново или проверь настройки базы.');
    return;
  }
  await startApp(profile);
}

// Восстанавливает последние диалоги по сообщениям текущего пользователя.
async function loadChats() {
  if (!currentUser || !myProfile) return;
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('sender_id, recipient_id, body, created_at')
    .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    setListMessage(ui.chatList, 'Не удалось загрузить диалоги. Проверь подключение к базе.');
    showToast(`Ошибка загрузки чатов: ${error.message}`, true);
    return;
  }

  const latestByUser = new Map();
  const peerIds = new Set();
  for (const message of messages || []) {
    const peerId = message.sender_id === currentUser.id ? message.recipient_id : message.sender_id;
    peerIds.add(peerId);
    if (!latestByUser.has(peerId)) latestByUser.set(peerId, message);
  }

  if (peerIds.size) {
    const { data: profiles, error: profileError } = await supabase
      .from('chat_profiles')
      .select('user_id, username, display_name, bio, avatar_emoji')
      .in('user_id', [...peerIds]);
    if (profileError) {
      setListMessage(ui.chatList, 'Не удалось загрузить пользователей.');
      return;
    }
    for (const profile of profiles || []) recentProfiles.set(profile.user_id, profile);
  }

  if (activeProfile) recentProfiles.set(activeProfile.user_id, activeProfile);
  const profiles = [...recentProfiles.values()].map((profile) => ({
    ...profile,
    lastMessage: latestByUser.get(profile.user_id) || null,
  }));
  profiles.sort((first, second) => {
    const firstDate = first.lastMessage?.created_at || (first.user_id === activeProfile?.user_id ? '9999' : '');
    const secondDate = second.lastMessage?.created_at || (second.user_id === activeProfile?.user_id ? '9999' : '');
    return String(secondDate).localeCompare(String(firstDate));
  });

  ui.chatCount.textContent = String(profiles.length);
  if (!profiles.length) {
    setListMessage(ui.chatList, 'Здесь появятся ваши диалоги');
    return;
  }
  ui.chatList.replaceChildren(...profiles.map((profile) => makePersonRow(profile, true)));
}

// Создаёт кнопку пользователя для выдачи поиска или списка недавних чатов.
function makePersonRow(profile, isChat = false) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `person-row${activeProfile?.user_id === profile.user_id ? ' is-active' : ''}`;
  row.append(makeProfileAvatar(profile));

  const copy = document.createElement('span');
  copy.className = 'person-copy';
  const name = document.createElement('strong');
  name.textContent = profile.display_name || `@${profile.username}`;
  copy.append(name);
  if (isChat && profile.lastMessage) {
    const preview = document.createElement('span');
    const prefix = profile.lastMessage.sender_id === currentUser.id ? 'Вы: ' : '';
    preview.textContent = `${prefix}${profile.lastMessage.body}`;
    copy.append(preview);
  } else if (isChat) {
    const preview = document.createElement('span');
    preview.textContent = 'Начать разговор';
    copy.append(preview);
  }
  row.append(copy);

  if (isChat && profile.lastMessage) {
    const time = document.createElement('span');
    time.className = 'person-time';
    time.textContent = formatTime(profile.lastMessage.created_at, true);
    row.append(time);
  } else if (!isChat) {
    const arrow = document.createElement('span');
    arrow.className = 'result-arrow';
    arrow.textContent = '›';
    row.append(arrow);
  }
  row.addEventListener('click', () => openConversation(profile));
  return row;
}

// Ищет пользователей по началу имени и исключает профиль текущей сессии.
async function searchUsers() {
  const query = ui.search.value.trim().toLowerCase();
  ui.searchResults.replaceChildren();
  if (!query) {
    ui.searchResults.hidden = true;
    ui.searchHint.hidden = false;
    ui.searchHint.textContent = 'Начни вводить имя пользователя';
    return;
  }
  if (!/^[a-z0-9_]{1,20}$/.test(query)) {
    ui.searchResults.hidden = true;
    ui.searchHint.hidden = false;
    ui.searchHint.textContent = 'Ищи по латинскому имени пользователя';
    return;
  }

  ui.searchHint.hidden = false;
  ui.searchHint.textContent = 'Ищем...';
  const { data, error } = await supabase
    .from('chat_profiles')
    .select('user_id, username, display_name, bio, avatar_emoji')
    .ilike('username', `${query}%`)
    .neq('user_id', currentUser.id)
    .order('username')
    .limit(12);

  if (error) {
    ui.searchHint.textContent = 'Поиск недоступен. Проверь настройку базы.';
    return;
  }
  ui.searchResults.hidden = false;
  if (!data?.length) {
    ui.searchHint.textContent = 'Никого с таким именем пока нет';
    return;
  }
  ui.searchHint.hidden = true;
  for (const profile of data) recentProfiles.set(profile.user_id, profile);
  ui.searchResults.replaceChildren(...data.map((profile) => makePersonRow(profile)));
}

// Открывает личный диалог, показывает историю и переключает экран на телефоне.
async function openConversation(profile) {
  activeProfile = profile;
  activeRoom = null;
  recentProfiles.set(profile.user_id, profile);
  ui.conversationName.textContent = profile.display_name || `@${profile.username}`;
  ui.conversationAvatar.replaceWith(makeProfileAvatar(profile, '', 'conversation-avatar'));
  ui.conversationAvatar = document.querySelector('#conversation-avatar');
  ui.profileButton.textContent = 'Профиль';
  ui.profileButton.hidden = false;
  ui.giftButton.hidden = false;
  ui.conversationKind.textContent = 'личный диалог';
  ui.messageInput.disabled = false;
  ui.messageInput.placeholder = 'Напиши что-нибудь хорошее...';
  ui.messageForm.querySelector('button[type="submit"]').disabled = false;
  document.querySelector('.conversation-label').textContent = 'ЛИЧНОЕ';
  ui.emptyState.hidden = true;
  ui.conversation.hidden = false;
  ui.messenger.classList.add('chat-open');
  await loadMessages();
  await loadChats();
  ui.messageInput.focus();
}

// Запрашивает только сообщения между пользователем и выбранным собеседником.
async function loadMessages() {
  if (activeRoom) {
    const { data, error } = await supabase
      .from('room_messages')
      .select('id, sender_id, body, created_at')
      .eq('room_id', activeRoom.id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      showToast(`Не удалось загрузить сообщения сообщества: ${error.message}`, true);
      return;
    }
    renderMessages(data || []);
    return;
  }
  if (!activeProfile) return;
  const me = currentUser.id;
  const peer = activeProfile.user_id;
  const filter = `and(sender_id.eq.${me},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me})`;
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, body, created_at, message_type')
    .or(filter)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    showToast(`Не удалось загрузить переписку: ${error.message}`, true);
    return;
  }
  renderMessages(data || []);
}

// Собирает DOM истории с разделителями дат; текст сообщений вставляется как обычный текст.
function renderMessages(messages) {
  if (!messages.length) {
    const note = document.createElement('p');
    note.className = 'conversation-note';
    note.textContent = activeRoom
      ? 'В этом сообществе пока нет сообщений.'
      : `Вы с @${activeProfile.username} ещё не переписывались. Самое время поздороваться!`;
    ui.messages.replaceChildren(note);
    return;
  }

  const content = [];
  let previousDay = '';
  for (const message of messages) {
    const date = new Date(message.created_at);
    const day = date.toDateString();
    if (day !== previousDay) {
      const divider = document.createElement('div');
      divider.className = 'conversation-day';
      divider.textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
      content.push(divider);
      previousDay = day;
    }

    const row = document.createElement('article');
    const isMine = message.sender_id === currentUser.id;
    row.className = `message-row${isMine ? ' is-mine' : ''}${message.message_type === 'gift' ? ' is-gift' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.body;
    const meta = document.createElement('time');
    meta.className = 'message-meta';
    meta.dateTime = message.created_at;
    meta.textContent = formatTime(message.created_at);
    row.append(bubble, meta);
    content.push(row);
  }
  ui.messages.replaceChildren(...content);
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

async function sendRawMessage(body) {
  const text = body.trim();
  if (!text || (!activeProfile && !activeRoom)) {
    if (!text) showToast('Пиши сообщение перед отправкой', true);
    else showToast('Сначала выбери собеседника или сообщество', true);
    return false;
  }

  const button = ui.messageForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const { error } = activeRoom
    ? await supabase.from('room_messages').insert({ room_id: activeRoom.id, sender_id: currentUser.id, body: text })
    : await supabase.from('chat_messages').insert({
      sender_id: currentUser.id,
      recipient_id: activeProfile.user_id,
      body: text,
    });
  button.disabled = false;

  if (error) {
    showToast(`Сообщение не отправлено: ${error.message}`, true);
    return false;
  }

  ui.messageInput.value = '';
  updateCounter();
  await loadMessages();
  await loadChats();
  return true;
}

// Отправляет сообщение выбранному человеку и очищает поле только после успеха.
async function sendMessage(event) {
  if (event) event.preventDefault();
  await sendRawMessage(ui.messageInput.value);
}

// Supabase Realtime обновляет открытый чат и список диалогов без перезагрузки.
function subscribeToMessages() {
  if (messageChannel) supabase.removeChannel(messageChannel);
  messageChannel = supabase
    .channel(`messages-${currentUser.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) notifyIncomingMessage(payload.new);
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadChats();
        loadMessages();
      }, 180);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'chat_wallets',
      filter: `user_id=eq.${currentUser.id}`,
    }, loadPoints)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, () => {
      if (activeRoom) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(loadMessages, 180);
      }
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('error');
      if (status === 'SUBSCRIBED') setConnection('connected');
    });
}

// Обновляет счётчик длины поля сообщения.
function updateCounter() {
  ui.messageCounter.textContent = `${ui.messageInput.value.length} / 2000`;
}

const GIFT_CATALOG = [
  { code: 'rose', title: 'Роза', icon: '🌹', points: 10 },
  { code: 'heart', title: 'Сердце', icon: '💝', points: 25 },
  { code: 'star', title: 'Звезда', icon: '🌟', points: 50 },
  { code: 'trophy', title: 'Трофей', icon: '🏆', points: 100 },
];

async function loadPoints() {
  const { data, error } = await supabase
    .from('chat_wallets')
    .select('points')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) {
    showToast(`Не удалось загрузить баланс очков: ${error.message}`, true);
    return;
  }
  points = data?.points || 0;
  ui.pointsBalance.textContent = `${points} ✦`;
  ui.giftBalance.textContent = String(points);
}

async function openGiftPicker() {
  if (!activeProfile) return;
  await loadPoints();
  ui.giftRecipient.textContent = `Выбери подарок для @${activeProfile.username}`;
  ui.giftOptions.replaceChildren(...GIFT_CATALOG.map((gift) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gift-option';
    button.disabled = points < gift.points;
    const icon = document.createElement('span');
    icon.className = 'gift-icon';
    icon.textContent = gift.icon;
    const title = document.createElement('strong');
    title.textContent = gift.title;
    const cost = document.createElement('small');
    cost.textContent = `${gift.points} очков`;
    button.append(icon, title, cost);
    button.addEventListener('click', () => sendGift(gift));
    return button;
  }));
  ui.giftDialog.showModal();
}

async function sendGift(gift) {
  const { error } = await supabase.rpc('send_chat_gift', {
    p_recipient_id: activeProfile.user_id,
    p_gift_code: gift.code,
  });
  if (error) {
    showToast(`Не удалось отправить подарок: ${error.message}`, true);
    return;
  }
  ui.giftDialog.close();
  showToast(`${gift.icon} Подарок «${gift.title}» отправлен!`);
  await loadPoints();
  await loadMessages();
  await loadChats();
}

function renderProfileCard(profile) {
  ui.profileCard.replaceChildren();
  const avatar = makeProfileAvatar(profile, 'profile-card-avatar');
  const name = document.createElement('h3');
  name.textContent = profile.display_name || `@${profile.username}`;
  const username = document.createElement('p');
  username.className = 'profile-card-username';
  username.textContent = `@${profile.username}`;
  const bio = document.createElement('p');
  bio.className = 'profile-card-bio';
  bio.textContent = profile.bio || 'Пользователь пока ничего не рассказал о себе.';
  ui.profileCard.append(avatar, name, username, bio);
  ui.profileDialog.showModal();
}

async function showActiveProfile() {
  if (!activeProfile) return;
  const { data, error } = await supabase
    .from('chat_profiles')
    .select('user_id, username, display_name, bio, avatar_emoji')
    .eq('user_id', activeProfile.user_id)
    .single();
  if (error) {
    showToast(`Не удалось открыть профиль: ${error.message}`, true);
    return;
  }
  activeProfile = data;
  recentProfiles.set(data.user_id, data);
  renderProfileCard(data);
}

async function saveProfile(event) {
  event.preventDefault();
  const profile = {
    display_name: ui.profileDisplayName.value.trim() || null,
    bio: ui.profileBio.value.trim() || null,
    avatar_emoji: ui.profileEmoji.value.trim() || null,
  };
  const { data, error } = await supabase
    .from('chat_profiles')
    .update(profile)
    .eq('user_id', currentUser.id)
    .select('user_id, username, display_name, bio, avatar_emoji')
    .single();
  if (error) {
    showToast(`Не удалось сохранить профиль: ${error.message}`, true);
    return;
  }
  myProfile = data;
  ui.myAvatar.replaceWith(makeProfileAvatar(data, 'avatar-small', 'my-avatar'));
  ui.myAvatar = document.querySelector('#my-avatar');
  ui.myUsername.textContent = data.display_name || `@${data.username}`;
  ui.profileEditDialog.close();
  showToast('Профиль сохранён.');
}

async function unlockAdminPanel() {
  const code = ui.adminCode.value;
  const { data, error } = await supabase.rpc('admin_list_chat_users', { p_code: code });
  if (error) {
    showToast(`Не удалось открыть панель администратора: ${error.message}`, true);
    return;
  }
  ui.adminPanel.hidden = false;
  ui.adminUserCount.textContent = `Пользователи: ${data.length}`;
  ui.adminUsers.replaceChildren(...data.map((user) => {
    const row = document.createElement('div');
    row.className = 'admin-user-row';
    const identity = document.createElement('span');
    identity.textContent = `${user.display_name || `@${user.username}`} · ${user.points} ✦`;
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.max = '1000000';
    amount.value = '100';
    amount.setAttribute('aria-label', `Количество очков для @${user.username}`);
    const grant = document.createElement('button');
    grant.type = 'button';
    grant.className = 'secondary-button';
    grant.textContent = 'Выдать';
    grant.addEventListener('click', async () => {
      const value = Number(amount.value);
      if (!Number.isSafeInteger(value) || value <= 0) {
        showToast('Укажи положительное целое количество очков.', true);
        return;
      }
      const { error: grantError } = await supabase.rpc('admin_grant_chat_points', {
        p_code: ui.adminCode.value,
        p_target_user: user.user_id,
        p_amount: value,
      });
      if (grantError) {
        showToast(`Не удалось выдать очки: ${grantError.message}`, true);
        return;
      }
      showToast(`Выдано ${value} очков пользователю @${user.username}.`);
      await unlockAdminPanel();
      if (user.user_id === currentUser.id) await loadPoints();
    });
    row.append(identity, amount, grant);
    return row;
  }));
}

function makeRoomRow(room, isDiscovery = false) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'person-row room-row';
  const icon = document.createElement('span');
  icon.className = 'room-icon';
  icon.textContent = room.kind === 'channel' ? '📣' : '👥';
  const copy = document.createElement('span');
  copy.className = 'person-copy';
  const title = document.createElement('strong');
  title.textContent = room.title;
  const summary = document.createElement('span');
  summary.textContent = room.description || (room.kind === 'channel' ? 'Канал' : 'Группа');
  copy.append(title, summary);
  row.append(icon, copy);
  if (isDiscovery) {
    const join = document.createElement('span');
    join.className = 'result-arrow';
    join.textContent = '＋';
    row.append(join);
    row.addEventListener('click', async () => {
      const { error } = await supabase.rpc('join_chat_room', { p_room_id: room.id });
      if (error) showToast(`Не удалось вступить: ${error.message}`, true);
      else {
        showToast(`Вы вступили в «${room.title}».`);
        await loadRooms();
      }
    });
  } else {
    row.addEventListener('click', () => openRoom(room));
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openRoomManager(room);
    });
  }
  return row;
}

async function loadRooms() {
  const { data, error } = await supabase
    .from('chat_room_members')
    .select('role, permissions, room:chat_rooms(id, title, description, kind, is_public)')
    .eq('user_id', currentUser.id);
  if (error) {
    showToast(`Не удалось загрузить группы и каналы: ${error.message}`, true);
    return;
  }
  const rooms = (data || []).map((membership) => ({ ...membership.room, role: membership.role, permissions: membership.permissions }));
  ui.roomList.replaceChildren(...rooms.map((room) => makeRoomRow(room)));
}

async function discoverRooms() {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, title, description, kind')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    showToast(`Не удалось загрузить каналы: ${error.message}`, true);
    return;
  }
  if (!data.length) {
    showToast('Публичных групп и каналов пока нет.');
    return;
  }
  ui.roomList.replaceChildren(...data.map((room) => makeRoomRow(room, true)));
}

async function createRoom(event) {
  event.preventDefault();
  const permissions = {
    can_send: ui.permissionSend.checked,
    can_invite: ui.permissionInvite.checked,
    can_manage: ui.permissionManage.checked,
  };
  const { data, error } = await supabase.rpc('create_chat_room', {
    p_kind: ui.roomKind.value,
    p_title: ui.roomName.value.trim(),
    p_description: ui.roomDescription.value.trim(),
    p_is_public: ui.roomPublic.checked,
    p_permissions: permissions,
  });
  if (error) {
    showToast(`Не удалось создать сообщество: ${error.message}`, true);
    return;
  }
  ui.roomForm.reset();
  ui.roomKind.value = 'group';
  ui.permissionSend.disabled = false;
  ui.roomDialog.close();
  await loadRooms();
  openRoom(data);
}

async function openRoom(room) {
  activeRoom = room;
  activeProfile = null;
  ui.conversationName.textContent = room.title;
  ui.conversationAvatar.replaceWith(makeProfileAvatar({
    username: room.title,
    avatar_emoji: room.kind === 'channel' ? '📣' : '👥',
  }, '', 'conversation-avatar'));
  ui.conversationAvatar = document.querySelector('#conversation-avatar');
  ui.profileButton.textContent = 'Участники';
  ui.profileButton.hidden = false;
  ui.giftButton.hidden = true;
  document.querySelector('.conversation-label').textContent = room.kind === 'channel' ? 'КАНАЛ' : 'ГРУППА';
  ui.conversationKind.textContent = room.kind === 'channel' ? 'канал' : 'группа';
  const canSend = room.owner_id === currentUser.id ||
    ['owner', 'admin'].includes(room.role) || room.permissions?.can_send === true;
  ui.messageInput.disabled = !canSend;
  ui.messageInput.placeholder = canSend
    ? 'Напиши что-нибудь хорошее...'
    : 'У тебя нет права отправлять сообщения';
  ui.messageForm.querySelector('button[type="submit"]').disabled = !canSend;
  ui.emptyState.hidden = true;
  ui.conversation.hidden = false;
  ui.messenger.classList.add('chat-open');
  await loadMessages();
  ui.messageInput.focus();
}

async function openRoomManager(room = activeRoom) {
  if (!room) return;
  activeRoom = room;
  ui.roomManageTitle.textContent = room.title;
  ui.roomManageDescription.textContent = `${room.kind === 'channel' ? 'Канал' : 'Группа'} · ${room.description || 'Без описания'}`;
  ui.roomMembers.replaceChildren();
  const { data: ownMembership, error: ownError } = await supabase
    .from('chat_room_members')
    .select('role, permissions')
    .eq('room_id', room.id)
    .eq('user_id', currentUser.id)
    .single();
  if (ownError) {
    showToast(`Не удалось проверить права: ${ownError.message}`, true);
    return;
  }
  const canManage = room.owner_id === currentUser.id || ['owner', 'admin'].includes(ownMembership.role) || ownMembership.permissions?.can_manage;
  const canInvite = canManage || ownMembership.permissions?.can_invite;
  ui.roomInviteForm.hidden = !canInvite;
  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id, role, permissions, profile:chat_profiles(username)')
    .eq('room_id', room.id);
  if (error) {
    showToast(`Не удалось загрузить участников: ${error.message}`, true);
    return;
  }
  ui.roomMembers.replaceChildren(...data.map((member) => {
    const row = document.createElement('div');
    row.className = 'room-member-row';
    const label = document.createElement('span');
    label.textContent = `@${member.profile.username} · ${member.role}`;
    row.append(label);
    if (canManage && member.role !== 'owner' && member.user_id !== currentUser.id) {
      const role = document.createElement('select');
      role.setAttribute('aria-label', `Роль пользователя @${member.profile.username}`);
      role.innerHTML = '<option value="member">Участник</option><option value="admin">Администратор</option>';
      role.value = member.role === 'admin' ? 'admin' : 'member';
      if (ownMembership.role !== 'owner') role.disabled = true;
      const permissions = {};
      for (const permission of ['can_send', 'can_invite', 'can_manage']) {
        const labelText = { can_send: 'писать', can_invite: 'звать', can_manage: 'управлять' }[permission];
        const permissionLabel = document.createElement('label');
        permissionLabel.className = 'member-permission';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = member.permissions?.[permission] === true;
        checkbox.dataset.permission = permission;
        permissionLabel.append(checkbox, document.createTextNode(labelText));
        row.append(permissionLabel);
        permissions[permission] = checkbox;
      }
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'secondary-button';
      save.textContent = 'Сохранить права';
      save.addEventListener('click', async () => {
        const { error: updateError } = await supabase.rpc('update_chat_room_member', {
          p_room_id: room.id,
          p_target_user: member.user_id,
          p_role: role.value,
          p_permissions: Object.fromEntries(Object.entries(permissions).map(([key, input]) => [key, input.checked])),
        });
        if (updateError) showToast(`Не удалось изменить права: ${updateError.message}`, true);
        else showToast(`Права @${member.profile.username} обновлены.`);
      });
      row.append(role, save);
    }
    return row;
  }));
  ui.roomManageDialog.showModal();
}

async function inviteRoomMember(event) {
  event.preventDefault();
  if (!activeRoom) return;
  const { error } = await supabase.rpc('invite_chat_room_member', {
    p_room_id: activeRoom.id,
    p_username: ui.roomInviteUsername.value.trim().toLowerCase(),
  });
  if (error) {
    showToast(`Не удалось добавить участника: ${error.message}`, true);
    return;
  }
  ui.roomInviteUsername.value = '';
  showToast('Участник добавлен.');
  await openRoomManager();
}

// Восстанавливает сессию пользователя и создаёт профиль после подтверждения email.
async function initialize() {
  const validProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL);
  const validPublicKey = SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(SUPABASE_PUBLISHABLE_KEY);
  if (!validProjectUrl || !validPublicKey) {
    setAuthMode('signup');
    showSetup('В app.js укажи настоящий URL проекта и Publishable key из Supabase → Project Settings → API. Значение your-anon-key — только пример, не рабочий ключ.');
    setConnection('error');
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  setConnection('pending');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    showSetup(`Не удалось подключиться к Supabase: ${sessionError.message}`);
    setConnection('error');
    return;
  }

  const session = sessionData.session;
  if (!session) {
    setConnection('connected');
    setAuthMode('signup');
    showSetup();
    return;
  }
  if (session.user.is_anonymous) {
    await supabase.auth.signOut();
    setAuthMode('signup');
    showSetup();
    return;
  }
  currentUser = session.user;

  const { profile, error } = await getOrCreateProfile(currentUser);
  if (error) {
    showSetup(`Не удалось открыть профиль: ${error.message}. Выполни SQL из README.`);
    setConnection('error');
    return;
  }
  if (profile) {
    await startApp(profile);
  } else {
    await supabase.auth.signOut();
    currentUser = null;
    setAuthMode('signup');
    showSetup('Профиль аккаунта не найден. Зарегистрируйся заново или проверь настройки базы.');
  }
}

// Обработчики авторизации, поиска, отправки сообщений и навигации по чатам.
ui.setupForm.addEventListener('submit', authenticate);
ui.authToggle.addEventListener('click', () => setAuthMode(authMode === 'signup' ? 'login' : 'signup'));
ui.settingsButton.addEventListener('click', openSettings);
ui.settingsClose.addEventListener('click', () => ui.settingsDialog.close());
ui.settingsDialog.addEventListener('click', (event) => {
  if (event.target === ui.settingsDialog) ui.settingsDialog.close();
});
ui.accentOptions.forEach((button) => {
  button.addEventListener('click', () => {
    applyAccent(button.dataset.accentChoice);
    savePreferences();
  });
});
ui.soundSetting.addEventListener('change', () => {
  preferences.sound = ui.soundSetting.checked;
  savePreferences();
});
ui.notificationSetting.addEventListener('change', async () => {
  if (!ui.notificationSetting.checked) {
    preferences.notifications = false;
    savePreferences();
    return;
  }

  if (typeof Notification === 'undefined' || !window.isSecureContext) {
    ui.notificationSetting.checked = false;
    showToast('Браузерные уведомления доступны только на HTTPS-сайте.', true);
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    preferences.notifications = permission === 'granted';
    ui.notificationSetting.checked = preferences.notifications;
    ui.notificationStatus.textContent = permission === 'denied'
      ? 'Разреши уведомления для сайта в настройках браузера'
      : 'Показывать, когда вкладка неактивна';
    savePreferences();
    if (!preferences.notifications) showToast('Браузер не разрешил уведомления.', true);
  } catch {
    preferences.notifications = false;
    ui.notificationSetting.checked = false;
    showToast('Не удалось запросить разрешение уведомлений.', true);
  }
});
ui.signoutButton.addEventListener('click', signOut);
ui.editProfileButton.addEventListener('click', () => {
  ui.profileDisplayName.value = myProfile.display_name || '';
  ui.profileBio.value = myProfile.bio || '';
  ui.profileEmoji.value = myProfile.avatar_emoji || '';
  ui.settingsDialog.close();
  ui.profileEditDialog.showModal();
});
ui.profileEditForm.addEventListener('submit', saveProfile);
ui.profileButton.addEventListener('click', () => {
  if (activeRoom) openRoomManager();
  else showActiveProfile();
});
ui.giftButton.addEventListener('click', openGiftPicker);
ui.adminUnlockButton.addEventListener('click', unlockAdminPanel);
ui.adminCode.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    unlockAdminPanel();
  }
});
ui.createRoomButton.addEventListener('click', () => ui.roomDialog.showModal());
ui.discoverRoomsButton.addEventListener('click', discoverRooms);
ui.roomForm.addEventListener('submit', createRoom);
ui.roomInviteForm.addEventListener('submit', inviteRoomMember);
ui.roomKind.addEventListener('change', () => {
  const channel = ui.roomKind.value === 'channel';
  ui.permissionSend.disabled = channel;
  if (channel) ui.permissionSend.checked = false;
});
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
});
ui.messageForm.addEventListener('submit', sendMessage);
ui.messageInput.addEventListener('input', updateCounter);
ui.messageInput.addEventListener('keydown', (event) => {
  const isSendShortcut = event.key === 'Enter' && !event.shiftKey;
  const isFastSend = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
  if ((isSendShortcut || isFastSend) && !event.repeat) {
    event.preventDefault();
    sendRawMessage(ui.messageInput.value);
  }
});
ui.quickActions.forEach((button) => {
  button.addEventListener('click', () => {
    sendRawMessage(button.dataset.quickMessage || '');
  });
});
ui.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchUsers, 180);
});
ui.backButton.addEventListener('click', () => ui.messenger.classList.remove('chat-open'));
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    ui.search.focus();
  }
  if (event.key === 'Escape' && ui.messenger.classList.contains('chat-open')) {
    ui.messenger.classList.remove('chat-open');
  }
});

// Запускаем подключение и повторяем его при восстановлении сети.
window.addEventListener('online', initialize);
initialize();
