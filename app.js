// Публичные настройки Supabase; service_role key никогда не вставляют в браузерный код.
const SUPABASE_URL = 'https://ilcxearxoovnlhowhjzl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CO8RQnNoHWmqZpEd5TGuCw_YNwv3-bV';

// SDK подключается с CDN, поэтому проект остаётся статическим и подходит для Pages.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ссылки на элементы страницы, которые обновляются при работе с сообщениями.
const ui = {
  messenger: document.querySelector('.messenger'),
  indicator: document.querySelector('#connection-indicator'),
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
};

// Состояние аккаунта и выбранного собеседника хранится на время работы страницы.
let supabase;
let currentUser;
let myProfile;
let activeProfile;
let authMode = 'signup';
let toastTimer;
let searchTimer;
let refreshTimer;
const recentProfiles = new Map();

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
    ? 'Укажи email для входа, придумай пароль и выбери имя, по которому тебя найдут друзья.'
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
  ui.setupScreen.hidden = true;
  setConnection('connected');
  await loadChats();
  subscribeToMessages();
}

// Загружает профиль пользователя, а после подтверждения регистрации создаёт его
// по username из метаданных Supabase Auth.
async function getOrCreateProfile(user) {
  const { data: existingProfile, error } = await supabase
    .from('chat_profiles')
    .select('user_id, username')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || existingProfile) return { profile: existingProfile, error };

  const username = user.user_metadata?.username;
  if (!username) return { profile: null, error: null };
  const { data: profile, error: insertError } = await supabase
    .from('chat_profiles')
    .insert({ user_id: user.id, username })
    .select('user_id, username')
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
      .select('user_id, username')
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
  row.append(makeAvatar(profile.username));

  const copy = document.createElement('span');
  copy.className = 'person-copy';
  const name = document.createElement('strong');
  name.textContent = `@${profile.username}`;
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
    .select('user_id, username')
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
  recentProfiles.set(profile.user_id, profile);
  ui.conversationName.textContent = `@${profile.username}`;
  ui.conversationAvatar.replaceWith(makeAvatar(profile.username, '', 'conversation-avatar'));
  ui.conversationAvatar = document.querySelector('#conversation-avatar');
  ui.emptyState.hidden = true;
  ui.conversation.hidden = false;
  ui.messenger.classList.add('chat-open');
  await loadMessages();
  await loadChats();
  ui.messageInput.focus();
}

// Запрашивает только сообщения между пользователем и выбранным собеседником.
async function loadMessages() {
  if (!activeProfile) return;
  const me = currentUser.id;
  const peer = activeProfile.user_id;
  const filter = `and(sender_id.eq.${me},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me})`;
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, body, created_at')
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
    note.textContent = `Вы с @${activeProfile.username} ещё не переписывались. Самое время поздороваться!`;
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
    row.className = `message-row${isMine ? ' is-mine' : ''}`;
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

// Отправляет сообщение выбранному человеку и очищает поле только после успеха.
async function sendMessage(event) {
  event.preventDefault();
  const body = ui.messageInput.value.trim();
  if (!body || !activeProfile) return;

  const button = ui.messageForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const { error } = await supabase.from('chat_messages').insert({
    sender_id: currentUser.id,
    recipient_id: activeProfile.user_id,
    body,
  });
  button.disabled = false;
  if (error) {
    showToast(`Сообщение не отправлено: ${error.message}`, true);
    return;
  }
  ui.messageInput.value = '';
  updateCounter();
  await loadMessages();
  await loadChats();
}

// Supabase Realtime обновляет открытый чат и список диалогов без перезагрузки.
function subscribeToMessages() {
  supabase
    .channel(`messages-${currentUser.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadChats();
        loadMessages();
      }, 180);
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

// Восстанавливает сессию пользователя и создаёт профиль после подтверждения email.
async function initialize() {
  const validProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL);
  const validPublicKey = SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') ||
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(SUPABASE_PUBLISHABLE_KEY);
  if (!validProjectUrl || !validPublicKey) {
    setAuthMode('signup');
    showSetup('В app.js укажи настоящий URL проекта и Publishable key из Supabase → Project Settings → API. Значение your-anon-key — только пример.');
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
ui.messageForm.addEventListener('submit', sendMessage);
ui.messageInput.addEventListener('input', updateCounter);
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