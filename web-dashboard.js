// Web Dashboard для статистики бота
const express = require('express');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Простая аутентификация
const checkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// API endpoints
app.get('/api/stats/overview', checkAuth, (req, res) => {
  try {
    const stats = db.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('[ERROR] /api/stats/overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/questions', checkAuth, (req, res) => {
  try {
    const stats = db.getQuestionsStats();
    res.json(stats);
  } catch (error) {
    console.error('[ERROR] /api/stats/questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', checkAuth, (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'created_at';
    const order = req.query.order || 'DESC';
    const limit = parseInt(req.query.limit) || 50;
    
    const users = db.getAllUsersWithDetails(sortBy, order, limit);
    res.json(users);
  } catch (error) {
    console.error('[ERROR] /api/users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:telegramId', checkAuth, (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const details = db.getUserDetails(telegramId);
    
    if (!details) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(details);
  } catch (error) {
    console.error('[ERROR] /api/users/:telegramId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/suggestions', checkAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const suggestions = db.getPendingSuggestions(limit);
    res.json(suggestions);
  } catch (error) {
    console.error('[ERROR] /api/suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Справка по админским командам
app.get('/commands', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админские команды - Creativity Bot</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #0f0f0f;
      color: #ededed;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid #2d2d2d;
    }

    h1 {
      font-size: 32px;
      font-weight: 600;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #3ecf8e 0%, #2e9e6f 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: #9ca3af;
      font-size: 14px;
    }

    .back-link {
      display: inline-block;
      color: #3ecf8e;
      text-decoration: none;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .section {
      background: #1a1a1a;
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #ededed;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .command {
      background: #0f0f0f;
      border: 1px solid #2d2d2d;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .command-name {
      font-family: 'Courier New', monospace;
      color: #3ecf8e;
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .command-desc {
      color: #9ca3af;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .command-example {
      background: #000;
      border-left: 3px solid #3ecf8e;
      padding: 8px 12px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #ededed;
      border-radius: 4px;
      margin-top: 8px;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
    }

    .badge-danger {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .badge-warning {
      background: rgba(251, 191, 36, 0.1);
      color: #fbbf24;
    }

    .badge-info {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .note {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      padding: 12px;
      margin-top: 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #9ca3af;
    }

    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      padding: 12px;
      margin-top: 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Вернуться к статистике</a>
    
    <header>
      <h1>📋 Административные команды</h1>
      <p class="subtitle">Справочник по всем командам бота для администраторов</p>
    </header>

    <div class="section">
      <div class="section-title">📊 Мониторинг и статистика</div>
      
      <div class="command">
        <div class="command-name">/admin_stats</div>
        <div class="command-desc">Общая статистика системы</div>
        <div class="command-example">Показывает: всего пользователей, активные сегодня/неделя/месяц, процент выполнения, топ серий</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_users [sort] [order]</div>
        <div class="command-desc">Список пользователей с сортировкой</div>
        <div class="command-example">Пример: /admin_users current_streak DESC</div>
        <div class="command-example">Сортировка: created_at, current_streak, best_streak, completed_days</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_user &lt;telegram_id&gt;</div>
        <div class="command-desc">Детальная информация о пользователе</div>
        <div class="command-example">Пример: /admin_user 123456789</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_questions_stats</div>
        <div class="command-desc">Статистика по вопросам (популярные/непопулярные)</div>
        <div class="command-example">Показывает вопросы с наибольшим/наименьшим количеством смен</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">❓ Управление вопросами</div>
      
      <div class="command">
        <div class="command-name">/admin_add_question &lt;текст&gt;</div>
        <div class="command-desc">Добавить новый вопрос в базу</div>
        <div class="command-example">Пример: /admin_add_question 10 способов использовать старую футболку</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_edit_question &lt;id&gt; &lt;текст&gt;</div>
        <div class="command-desc">Редактировать существующий вопрос</div>
        <div class="command-example">Пример: /admin_edit_question 42 10 способов использовать старую одежду</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_delete_question &lt;id&gt; <span class="badge badge-warning">Осторожно</span></div>
        <div class="command-desc">Удалить вопрос (если не используется)</div>
        <div class="command-example">Пример: /admin_delete_question 42</div>
        <div class="note">⚠️ Нельзя удалить вопрос, который использовался в истории пользователей</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_list_questions [страница]</div>
        <div class="command-desc">Список всех вопросов с пагинацией</div>
        <div class="command-example">Пример: /admin_list_questions 2</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_search_question &lt;текст&gt;</div>
        <div class="command-desc">Поиск вопроса по ключевому слову</div>
        <div class="command-example">Пример: /admin_search_question футболка</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">💡 Модерация предложений</div>
      
      <div class="command">
        <div class="command-name">/admin_pending_questions</div>
        <div class="command-desc">Очередь предложенных пользователями вопросов</div>
        <div class="command-example">Показывает ID, автора, дату и текст вопроса</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_approve_question &lt;id&gt;</div>
        <div class="command-desc">Одобрить предложенный вопрос</div>
        <div class="command-example">Пример: /admin_approve_question 5</div>
        <div class="note">✅ Вопрос добавляется в основную базу и удаляется из предложений</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_reject_question &lt;id&gt;</div>
        <div class="command-desc">Отклонить предложенный вопрос</div>
        <div class="command-example">Пример: /admin_reject_question 5</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">👤 Управление пользователями</div>
      
      <div class="command">
        <div class="command-name">/admin_reset_questions &lt;telegram_id&gt; <span class="badge badge-info">Безопасно</span></div>
        <div class="command-desc">Сбросить историю вопросов (пользователь сможет получать их заново)</div>
        <div class="command-example">Пример: /admin_reset_questions 123456789</div>
        <div class="note">💾 Сохраняет: статистику, серии, бейджи</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_reset_today &lt;telegram_id&gt; <span class="badge badge-info">Безопасно</span></div>
        <div class="command-desc">Сбросить прогресс за сегодня</div>
        <div class="command-example">Пример: /admin_reset_today 123456789</div>
        <div class="note">💾 Сохраняет: всю остальную историю и статистику</div>
      </div>

      <div class="command">
        <div class="command-name">/admin_reset_user &lt;telegram_id&gt; <span class="badge badge-danger">ОПАСНО</span></div>
        <div class="command-desc">Полный сброс пользователя (всё)</div>
        <div class="command-example">Пример: /admin_reset_user 123456789</div>
        <div class="warning">⚠️ НЕОБРАТИМО! Удаляет всю статистику, серии, бейджи, историю</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">💡 Быстрые примеры</div>
      
      <div class="command">
        <div class="command-name">Сценарий 1: Модерация предложений</div>
        <div class="command-example">1. /admin_pending_questions</div>
        <div class="command-example">2. /admin_approve_question 5   (если хороший)</div>
        <div class="command-example">3. /admin_reject_question 6    (если плохой)</div>
      </div>

      <div class="command">
        <div class="command-name">Сценарий 2: Пользователь прошёл все вопросы</div>
        <div class="command-example">1. /admin_user 123456789       (проверить статистику)</div>
        <div class="command-example">2. /admin_reset_questions 123456789</div>
      </div>

      <div class="command">
        <div class="command-name">Сценарий 3: Анализ вопросов</div>
        <div class="command-example">1. /admin_questions_stats      (смотрим статистику)</div>
        <div class="command-example">2. /admin_search_question футболка</div>
        <div class="command-example">3. /admin_edit_question 42 Новый текст</div>
      </div>
    </div>

    <div class="note">
      <strong>💡 Совет:</strong> Используйте /admin_user перед любым сбросом, чтобы убедиться в необходимости действия
    </div>

    <div class="note" style="margin-top: 12px;">
      <strong>📚 Полная документация:</strong> Смотрите файлы ADMIN_COMMANDS.md и ADMIN_QUICK_REFERENCE.md в репозитории
    </div>
  </div>
</body>
</html>
  `);
});

// HTML Dashboard
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creativity Bot Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      background: #0f0f0f;
      color: #ededed;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid #2d2d2d;
    }

    h1 {
      font-size: 32px;
      font-weight: 600;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #3ecf8e 0%, #2e9e6f 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: #9ca3af;
      font-size: 14px;
    }

    .auth-section {
      background: #1a1a1a;
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 40px;
      max-width: 400px;
      margin: 100px auto;
    }

    .auth-section h2 {
      margin-bottom: 20px;
      color: #ededed;
    }

    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      background: #0f0f0f;
      border: 1px solid #2d2d2d;
      border-radius: 8px;
      color: #ededed;
      font-size: 14px;
      margin-bottom: 16px;
    }

    input[type="password"]:focus {
      outline: none;
      border-color: #3ecf8e;
    }

    button {
      width: 100%;
      padding: 12px 16px;
      background: linear-gradient(135deg, #3ecf8e 0%, #2e9e6f 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }

    button:hover {
      transform: translateY(-2px);
    }

    button:active {
      transform: translateY(0);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: #1a1a1a;
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 24px;
      transition: border-color 0.3s;
    }

    .card:hover {
      border-color: #3ecf8e;
    }

    .card-title {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 12px;
      font-weight: 500;
    }

    .card-value {
      font-size: 36px;
      font-weight: 700;
      color: #ededed;
      margin-bottom: 8px;
    }

    .card-subtitle {
      font-size: 13px;
      color: #6b7280;
    }

    .section {
      background: #1a1a1a;
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #ededed;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th {
      text-align: left;
      padding: 12px;
      font-size: 13px;
      font-weight: 600;
      color: #9ca3af;
      border-bottom: 1px solid #2d2d2d;
    }

    .table td {
      padding: 12px;
      font-size: 14px;
      color: #ededed;
      border-bottom: 1px solid #2d2d2d;
    }

    .table tr:hover {
      background: #0f0f0f;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-success {
      background: rgba(62, 207, 142, 0.1);
      color: #3ecf8e;
    }

    .badge-warning {
      background: rgba(251, 191, 36, 0.1);
      color: #fbbf24;
    }

    .badge-info {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
    }

    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .hidden {
      display: none !important;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #2d2d2d;
      border-top-color: #3ecf8e;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
  </style>
</head>
<body>
  <div id="authSection" class="auth-section">
    <h2>🔐 Вход в панель</h2>
    <p class="subtitle" style="margin-bottom: 20px;">Введите пароль для доступа к статистике</p>
    <input type="password" id="passwordInput" placeholder="Пароль" autocomplete="off">
    <button onclick="authenticate()">Войти</button>
    <div id="authError" class="error hidden" style="margin-top: 16px;">Неверный пароль</div>
  </div>

  <div id="dashboard" class="container hidden">
    <header>
      <div class="header-content">
        <h1>📊 Creativity Bot Dashboard</h1>
        <p class="subtitle">Статистика и аналитика бота для развития креативности</p>
      </div>
      <a href="/commands" class="commands-link">📋 Админские команды</a>
    </header>

    <div id="error" class="error hidden"></div>

    <div class="grid" id="statsGrid">
      <div class="card">
        <div class="card-title">Всего пользователей</div>
        <div class="card-value" id="totalUsers">-</div>
        <div class="card-subtitle">Зарегистрировано в боте</div>
      </div>
      <div class="card">
        <div class="card-title">Активные сегодня</div>
        <div class="card-value" id="activeToday">-</div>
        <div class="card-subtitle">Выполнили задание</div>
      </div>
      <div class="card">
        <div class="card-title">Активные за неделю</div>
        <div class="card-value" id="activeWeek">-</div>
        <div class="card-subtitle">Последние 7 дней</div>
      </div>
      <div class="card">
        <div class="card-title">Процент выполнения</div>
        <div class="card-value" id="completionRate">-</div>
        <div class="card-subtitle">Общий показатель</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">🔥 Топ пользователей по сериям</div>
      <div id="topStreaksLoading" class="loading"><span class="spinner"></span></div>
      <table class="table hidden" id="topStreaksTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Telegram ID</th>
            <th>Текущая серия</th>
            <th>Лучшая серия</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody id="topStreaksBody"></tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">❓ Статистика вопросов</div>
      <div class="grid">
        <div class="card">
          <div class="card-title">Всего вопросов</div>
          <div class="card-value" id="totalQuestions">-</div>
        </div>
        <div class="card">
          <div class="card-title">Неиспользованных</div>
          <div class="card-value" id="unusedQuestions">-</div>
        </div>
        <div class="card">
          <div class="card-title">Предложения пользователей</div>
          <div class="card-value" id="pendingSuggestions">-</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let authToken = '';

    function authenticate() {
      const password = document.getElementById('passwordInput').value;
      authToken = password;
      
      // Проверяем авторизацию
      fetch('/api/stats/overview', {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      })
      .then(response => {
        if (response.ok) {
          document.getElementById('authSection').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
          document.getElementById('authError').classList.add('hidden');
          loadData();
        } else {
          document.getElementById('authError').classList.remove('hidden');
        }
      })
      .catch(error => {
        console.error('Auth error:', error);
        document.getElementById('authError').classList.remove('hidden');
      });
    }

    // Enter для входа
    document.getElementById('passwordInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        authenticate();
      }
    });

    function loadData() {
      loadOverviewStats();
      loadQuestionsStats();
    }

    function loadOverviewStats() {
      fetch('/api/stats/overview', {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      })
      .then(response => response.json())
      .then(data => {
        document.getElementById('totalUsers').textContent = data.totalUsers || 0;
        document.getElementById('activeToday').textContent = data.activeToday || 0;
        document.getElementById('activeWeek').textContent = data.activeWeek || 0;
        document.getElementById('completionRate').textContent = (data.completionRate || 0) + '%';
        document.getElementById('pendingSuggestions').textContent = data.pendingSuggestions || 0;
        
        // Топ стриков
        const tbody = document.getElementById('topStreaksBody');
        tbody.innerHTML = '';
        
        if (data.topStreaks && data.topStreaks.length > 0) {
          data.topStreaks.forEach((user, index) => {
            const row = document.createElement('tr');
            const status = user.current_streak >= 7 ? 'success' : user.current_streak >= 3 ? 'info' : 'warning';
            row.innerHTML = \`
              <td>\${index + 1}</td>
              <td>\${user.telegram_id}</td>
              <td><span class="badge badge-\${status}">\${user.current_streak} дней</span></td>
              <td>\${user.best_streak} дней</td>
              <td><span class="badge badge-\${status}">Активен</span></td>
            \`;
            tbody.appendChild(row);
          });
          
          document.getElementById('topStreaksLoading').classList.add('hidden');
          document.getElementById('topStreaksTable').classList.remove('hidden');
        } else {
          document.getElementById('topStreaksLoading').innerHTML = '<p>Нет данных</p>';
        }
      })
      .catch(error => {
        console.error('Error loading stats:', error);
        showError('Ошибка загрузки статистики');
      });
    }

    function loadQuestionsStats() {
      fetch('/api/stats/questions', {
        headers: {
          'Authorization': 'Bearer ' + authToken
        }
      })
      .then(response => response.json())
      .then(data => {
        document.getElementById('totalQuestions').textContent = data.totalQuestions || 0;
        document.getElementById('unusedQuestions').textContent = data.unusedCount || 0;
      })
      .catch(error => {
        console.error('Error loading questions stats:', error);
      });
    }

    function showError(message) {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = message;
      errorDiv.classList.remove('hidden');
      setTimeout(() => {
        errorDiv.classList.add('hidden');
      }, 5000);
    }

    // Автообновление каждые 30 секунд
    setInterval(() => {
      if (!document.getElementById('dashboard').classList.contains('hidden')) {
        loadData();
      }
    }, 30000);
  </script>
</body>
</html>
  `);
});

// Запуск сервера
const startDashboard = () => {
  app.listen(PORT, () => {
    console.log(`[DASHBOARD] Веб-панель запущена на http://localhost:${PORT}`);
    console.log(`[DASHBOARD] Пароль для входа: ${DASHBOARD_PASSWORD}`);
  });
};

module.exports = { startDashboard };
