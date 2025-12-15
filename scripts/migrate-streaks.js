// Скрипт миграции для добавления системы стриков
const Database = require('better-sqlite3');
const path = require('path');

// Путь к базе данных
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.db');

console.log('[МИГРАЦИЯ] Начало миграции системы стриков...');
console.log('[МИГРАЦИЯ] Путь к БД:', DB_PATH);

try {
  const db = new Database(DB_PATH);
  
  // Проверяем текущую структуру таблицы users
  const userColumns = db.pragma('table_info(users)');
  console.log('[МИГРАЦИЯ] Текущие поля в таблице users:', userColumns.map(c => c.name).join(', '));
  
  const hasCurrentStreak = userColumns.some(col => col.name === 'current_streak');
  const hasBestStreak = userColumns.some(col => col.name === 'best_streak');
  const hasLastCompleted = userColumns.some(col => col.name === 'last_completed_date');
  
  // Добавляем недостающие поля
  if (!hasCurrentStreak) {
    console.log('[МИГРАЦИЯ] Добавляю поле current_streak...');
    db.exec('ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0');
    console.log('[МИГРАЦИЯ] ✅ Поле current_streak добавлено');
  } else {
    console.log('[МИГРАЦИЯ] ℹ️  Поле current_streak уже существует');
  }
  
  if (!hasBestStreak) {
    console.log('[МИГРАЦИЯ] Добавляю поле best_streak...');
    db.exec('ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0');
    console.log('[МИГРАЦИЯ] ✅ Поле best_streak добавлено');
  } else {
    console.log('[МИГРАЦИЯ] ℹ️  Поле best_streak уже существует');
  }
  
  if (!hasLastCompleted) {
    console.log('[МИГРАЦИЯ] Добавляю поле last_completed_date...');
    db.exec('ALTER TABLE users ADD COLUMN last_completed_date TEXT');
    console.log('[МИГРАЦИЯ] ✅ Поле last_completed_date добавлено');
  } else {
    console.log('[МИГРАЦИЯ] ℹ️  Поле last_completed_date уже существует');
  }
  
  // Создаём таблицу badges если её нет
  console.log('[МИГРАЦИЯ] Проверяю таблицу badges...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      emoji TEXT NOT NULL,
      description TEXT NOT NULL,
      requirement INTEGER NOT NULL
    )
  `);
  console.log('[МИГРАЦИЯ] ✅ Таблица badges готова');
  
  // Создаём таблицу user_badges если её нет
  console.log('[МИГРАЦИЯ] Проверяю таблицу user_badges...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      earned_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (badge_id) REFERENCES badges(id),
      UNIQUE(user_id, badge_id)
    )
  `);
  console.log('[МИГРАЦИЯ] ✅ Таблица user_badges готова');
  
  // Добавляем бейджи
  console.log('[МИГРАЦИЯ] Загружаю бейджи...');
  const badges = [
    { name: 'Новичок', emoji: '🔥', description: '3 дня подряд', requirement: 3 },
    { name: 'Энтузиаст', emoji: '🌟', description: '7 дней подряд', requirement: 7 },
    { name: 'Мастер', emoji: '💎', description: '30 дней подряд', requirement: 30 },
    { name: 'Легенда', emoji: '👑', description: '100 дней подряд', requirement: 100 }
  ];
  
  const insert = db.prepare('INSERT OR IGNORE INTO badges (name, emoji, description, requirement) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((badgeList) => {
    for (const badge of badgeList) {
      insert.run(badge.name, badge.emoji, badge.description, badge.requirement);
    }
  });
  
  insertMany(badges);
  
  const badgeCount = db.prepare('SELECT COUNT(*) as count FROM badges').get();
  console.log('[МИГРАЦИЯ] ✅ Бейджей в базе:', badgeCount.count);
  
  // Проверяем финальную структуру
  const finalColumns = db.pragma('table_info(users)');
  console.log('[МИГРАЦИЯ] Финальные поля в таблице users:', finalColumns.map(c => c.name).join(', '));
  
  db.close();
  
  console.log('[МИГРАЦИЯ] ✅ Миграция завершена успешно!');
  process.exit(0);
  
} catch (error) {
  console.error('[МИГРАЦИЯ] ❌ Ошибка при миграции:', error);
  process.exit(1);
}

