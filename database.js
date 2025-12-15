// Модуль для работы с SQLite базой данных
const Database = require('better-sqlite3');
const path = require('path');
const questionsData = require('./data/questions');

// Путь к базе данных (поддержка Docker volumes)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');
const db = new Database(DB_PATH);

// Инициализация базы данных и создание таблиц
const initDatabase = () => {
  try {
    // Таблица пользователей
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        completed_days INTEGER DEFAULT 0,
        missed_days INTEGER DEFAULT 0
      )
    `);

    // Таблица вопросов
    db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL
      )
    `);

    // Таблица ежедневного прогресса
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        answers_count INTEGER DEFAULT 0,
        is_completed INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `);

    console.log('[БД] Таблицы успешно созданы');
  } catch (error) {
    console.error('[ERROR] Ошибка при создании таблиц:', error);
  }
};

// Загрузка вопросов в базу данных (выполняется только один раз)
const seedQuestions = () => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM questions').get();
    
    if (count.count === 0) {
      const insert = db.prepare('INSERT INTO questions (text) VALUES (?)');
      const insertMany = db.transaction((questions) => {
        for (const question of questions) {
          insert.run(question);
        }
      });
      
      insertMany(questionsData);
      console.log(`[БД] Загружено ${questionsData.length} вопросов`);
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при загрузке вопросов:', error);
  }
};

// Добавление нового пользователя
const addUser = (telegramId) => {
  try {
    const stmt = db.prepare('INSERT INTO users (telegram_id, created_at) VALUES (?, ?)');
    const result = stmt.run(telegramId, new Date().toISOString());
    console.log(`[БД] Добавлен новый пользователь: ${telegramId}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[ERROR] Ошибка при добавлении пользователя:', error);
    return null;
  }
};

// Получение пользователя по telegram_id
const getUser = (telegramId) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении пользователя:', error);
    return null;
  }
};

// Получение всех пользователей
const getAllUsers = () => {
  try {
    const stmt = db.prepare('SELECT * FROM users');
    return stmt.all();
  } catch (error) {
    console.error('[ERROR] Ошибка при получении списка пользователей:', error);
    return [];
  }
};

// Получение случайного вопроса
const getRandomQuestion = () => {
  try {
    const stmt = db.prepare('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
    return stmt.get();
  } catch (error) {
    console.error('[ERROR] Ошибка при получении случайного вопроса:', error);
    return null;
  }
};

// Создание записи прогресса на день
const createDailyProgress = (userId, date, questionId) => {
  try {
    const stmt = db.prepare(
      'INSERT INTO daily_progress (user_id, date, question_id, answers_count, is_completed) VALUES (?, ?, ?, 0, 0)'
    );
    const result = stmt.run(userId, date, questionId);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[ERROR] Ошибка при создании записи прогресса:', error);
    return null;
  }
};

// Получение прогресса пользователя за сегодня
const getTodayProgress = (telegramId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT dp.*, q.text as question_text 
      FROM daily_progress dp
      JOIN users u ON dp.user_id = u.id
      JOIN questions q ON dp.question_id = q.id
      WHERE u.telegram_id = ? AND dp.date = ?
    `);
    return stmt.get(telegramId, today);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении прогресса за сегодня:', error);
    return null;
  }
};

// Обновление количества ответов
const updateAnswersCount = (progressId, newCount) => {
  try {
    const stmt = db.prepare('UPDATE daily_progress SET answers_count = ? WHERE id = ?');
    stmt.run(newCount, progressId);
  } catch (error) {
    console.error('[ERROR] Ошибка при обновлении количества ответов:', error);
  }
};

// Отметка дня как завершённого
const markDayCompleted = (progressId, userId) => {
  try {
    const update = db.transaction(() => {
      db.prepare('UPDATE daily_progress SET is_completed = 1 WHERE id = ?').run(progressId);
      db.prepare('UPDATE users SET completed_days = completed_days + 1 WHERE id = ?').run(userId);
    });
    update();
    console.log(`[БД] День отмечен как завершённый для пользователя ${userId}`);
  } catch (error) {
    console.error('[ERROR] Ошибка при отметке дня как завершённого:', error);
  }
};

// Закрытие дня и подсчёт пропусков
const closeDay = (date) => {
  try {
    // Получаем все незавершённые записи за указанную дату
    const incomplete = db.prepare(`
      SELECT dp.id, dp.user_id 
      FROM daily_progress dp 
      WHERE dp.date = ? AND dp.is_completed = 0 AND dp.answers_count < 10
    `).all(date);

    // Увеличиваем счётчик пропущенных дней для каждого пользователя
    const updateMissed = db.prepare('UPDATE users SET missed_days = missed_days + 1 WHERE id = ?');
    const closeTransaction = db.transaction(() => {
      for (const record of incomplete) {
        updateMissed.run(record.user_id);
      }
    });
    closeTransaction();

    console.log(`[БД] Закрыт день ${date}. Пропущено записей: ${incomplete.length}`);
  } catch (error) {
    console.error('[ERROR] Ошибка при закрытии дня:', error);
  }
};

module.exports = {
  initDatabase,
  seedQuestions,
  addUser,
  getUser,
  getAllUsers,
  getRandomQuestion,
  createDailyProgress,
  getTodayProgress,
  updateAnswersCount,
  markDayCompleted,
  closeDay
};
