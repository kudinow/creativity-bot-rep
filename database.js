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
        missed_days INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        last_completed_date TEXT
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
        question_changes_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `);

    // Миграция: добавляем поле question_changes_count, если его нет
    try {
      const columns = db.pragma('table_info(daily_progress)');
      const hasChangesCount = columns.some(col => col.name === 'question_changes_count');
      
      if (!hasChangesCount) {
        db.exec('ALTER TABLE daily_progress ADD COLUMN question_changes_count INTEGER DEFAULT 0');
        console.log('[БД] Добавлено поле question_changes_count в таблицу daily_progress');
      }
    } catch (error) {
      // Игнорируем ошибку, если таблица не существует
    }

    // Миграция: добавляем поля стриков в таблицу users
    try {
      const userColumns = db.pragma('table_info(users)');
      const hasCurrentStreak = userColumns.some(col => col.name === 'current_streak');
      const hasBestStreak = userColumns.some(col => col.name === 'best_streak');
      const hasLastCompleted = userColumns.some(col => col.name === 'last_completed_date');
      
      if (!hasCurrentStreak) {
        db.exec('ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0');
        console.log('[БД] Добавлено поле current_streak в таблицу users');
      }
      if (!hasBestStreak) {
        db.exec('ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0');
        console.log('[БД] Добавлено поле best_streak в таблицу users');
      }
      if (!hasLastCompleted) {
        db.exec('ALTER TABLE users ADD COLUMN last_completed_date TEXT');
        console.log('[БД] Добавлено поле last_completed_date в таблицу users');
      }
    } catch (error) {
      // Игнорируем ошибку, если таблица не существует
    }

    // Таблица бейджей
    db.exec(`
      CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        emoji TEXT NOT NULL,
        description TEXT NOT NULL,
        requirement INTEGER NOT NULL
      )
    `);

    // Таблица полученных бейджей пользователями
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

    // Таблица предложенных вопросов от пользователей
    db.exec(`
      CREATE TABLE IF NOT EXISTS suggested_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('[БД] Таблицы успешно созданы');
  } catch (error) {
    console.error('[ERROR] Ошибка при создании таблиц:', error);
  }
};

// Загрузка вопросов в базу данных (добавляет только новые вопросы)
const seedQuestions = () => {
  try {
    // Получаем все существующие вопросы из БД
    const existingQuestions = db.prepare('SELECT text FROM questions').all();
    const existingTexts = new Set(existingQuestions.map(q => q.text));
    
    // Готовим запрос на вставку
    const insert = db.prepare('INSERT INTO questions (text) VALUES (?)');
    let addedCount = 0;
    
    // Добавляем только те вопросы, которых ещё нет в БД
    for (const question of questionsData) {
      if (!existingTexts.has(question)) {
        insert.run(question);
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      console.log(`[БД] Добавлено новых вопросов: ${addedCount}`);
    }
    console.log(`[БД] Всего вопросов в базе: ${existingTexts.size + addedCount}`);
  } catch (error) {
    console.error('[ERROR] Ошибка при загрузке вопросов:', error);
  }
};

// Загрузка бейджей в базу данных
const seedBadges = () => {
  try {
    const badges = [
      { name: 'Новичок', emoji: '🔥', description: '3 дня подряд', requirement: 3 },
      { name: 'Энтузиаст', emoji: '🌟', description: '7 дней подряд', requirement: 7 },
      { name: 'Мастер', emoji: '💎', description: '30 дней подряд', requirement: 30 },
      { name: 'Легенда', emoji: '👑', description: '100 дней подряд', requirement: 100 }
    ];

    const existingBadges = db.prepare('SELECT name FROM badges').all();
    const existingNames = new Set(existingBadges.map(b => b.name));

    const insert = db.prepare('INSERT OR IGNORE INTO badges (name, emoji, description, requirement) VALUES (?, ?, ?, ?)');
    let addedCount = 0;

    for (const badge of badges) {
      if (!existingNames.has(badge.name)) {
        insert.run(badge.name, badge.emoji, badge.description, badge.requirement);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      console.log(`[БД] Добавлено новых бейджей: ${addedCount}`);
    }
    console.log(`[БД] Всего бейджей в базе: ${existingNames.size + addedCount}`);
  } catch (error) {
    console.error('[ERROR] Ошибка при загрузке бейджей:', error);
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
const getRandomQuestion = (userId = null) => {
  try {
    // Если передан userId, исключаем вопросы, на которые пользователь уже отвечал
    if (userId) {
      const stmt = db.prepare(`
        SELECT * FROM questions 
        WHERE id NOT IN (
          SELECT DISTINCT question_id 
          FROM daily_progress 
          WHERE user_id = ?
        )
        ORDER BY RANDOM() 
        LIMIT 1
      `);
      const question = stmt.get(userId);
      
      // Если все вопросы использованы, возвращаем любой случайный
      if (!question) {
        console.log(`[БД] Пользователь ${userId} использовал все вопросы, возвращаем случайный`);
        const fallbackStmt = db.prepare('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
        return fallbackStmt.get();
      }
      
      return question;
    }
    
    // Если userId не передан, возвращаем просто случайный вопрос
    const stmt = db.prepare('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
    return stmt.get();
  } catch (error) {
    console.error('[ERROR] Ошибка при получении случайного вопроса:', error);
    return null;
  }
};

// Получение случайного вопроса, исключая указанный (используется при смене вопроса)
const getRandomQuestionExcept = (excludeQuestionId, userId = null) => {
  try {
    // Если передан userId, исключаем вопросы, на которые пользователь уже отвечал
    if (userId) {
      const stmt = db.prepare(`
        SELECT * FROM questions 
        WHERE id != ? 
        AND id NOT IN (
          SELECT DISTINCT question_id 
          FROM daily_progress 
          WHERE user_id = ? AND is_completed = 1
        )
        ORDER BY RANDOM() 
        LIMIT 1
      `);
      const question = stmt.get(excludeQuestionId, userId);
      
      // Если подходящих вопросов нет (кроме текущего и завершённых), берём любой кроме текущего
      if (!question) {
        console.log(`[БД] Нет новых вопросов для пользователя ${userId}, берём любой кроме текущего`);
        const fallbackStmt = db.prepare('SELECT * FROM questions WHERE id != ? ORDER BY RANDOM() LIMIT 1');
        return fallbackStmt.get(excludeQuestionId);
      }
      
      return question;
    }
    
    // Если userId не передан, просто исключаем указанный вопрос
    const stmt = db.prepare('SELECT * FROM questions WHERE id != ? ORDER BY RANDOM() LIMIT 1');
    return stmt.get(excludeQuestionId);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении случайного вопроса:', error);
    return null;
  }
};

// Создание записи прогресса на день
const createDailyProgress = (userId, date, questionId) => {
  try {
    const stmt = db.prepare(
      'INSERT INTO daily_progress (user_id, date, question_id, answers_count, is_completed, question_changes_count) VALUES (?, ?, ?, 0, 0, 0)'
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

// Отметка дня как завершённого с обновлением стриков
const markDayCompleted = (progressId, userId) => {
  try {
    const update = db.transaction(() => {
      // Отмечаем день как завершённый
      db.prepare('UPDATE daily_progress SET is_completed = 1 WHERE id = ?').run(progressId);
      db.prepare('UPDATE users SET completed_days = completed_days + 1 WHERE id = ?').run(userId);
      
      // Обновляем стрики
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const today = new Date().toISOString().split('T')[0];
      
      let newStreak = 1;
      
      if (user.last_completed_date) {
        const lastDate = new Date(user.last_completed_date);
        const todayDate = new Date(today);
        const diffTime = todayDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Если последний день был вчера - увеличиваем стрик
        if (diffDays === 1) {
          newStreak = (user.current_streak || 0) + 1;
        } else if (diffDays === 0) {
          // Если это сегодня (не должно произойти, но на всякий случай)
          newStreak = user.current_streak || 1;
        }
        // Если пропущен день - стрик сбрасывается до 1
      }
      
      // Обновляем лучший стрик, если нужно
      const newBestStreak = Math.max(newStreak, user.best_streak || 0);
      
      // Сохраняем новые значения
      db.prepare(`
        UPDATE users 
        SET current_streak = ?, 
            best_streak = ?, 
            last_completed_date = ? 
        WHERE id = ?
      `).run(newStreak, newBestStreak, today, userId);
    });
    update();
    console.log(`[БД] День отмечен как завершённый для пользователя ${userId}`);
  } catch (error) {
    console.error('[ERROR] Ошибка при отметке дня как завершённого:', error);
  }
};

// Смена вопроса для текущего дня
const changeQuestionForToday = (progressId, newQuestionId) => {
  try {
    const update = db.transaction(() => {
      // Обновляем вопрос, сбрасываем счётчик ответов и увеличиваем счётчик смен
      db.prepare(`
        UPDATE daily_progress 
        SET question_id = ?, 
            answers_count = 0, 
            question_changes_count = question_changes_count + 1 
        WHERE id = ?
      `).run(newQuestionId, progressId);
    });
    update();
    console.log(`[БД] Вопрос изменён для записи прогресса ${progressId}`);
    return true;
  } catch (error) {
    console.error('[ERROR] Ошибка при смене вопроса:', error);
    return false;
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

    // Увеличиваем счётчик пропущенных дней и сбрасываем стрик
    const updateMissed = db.prepare('UPDATE users SET missed_days = missed_days + 1, current_streak = 0 WHERE id = ?');
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

// Получение всех бейджей
const getAllBadges = () => {
  try {
    return db.prepare('SELECT * FROM badges ORDER BY requirement ASC').all();
  } catch (error) {
    console.error('[ERROR] Ошибка при получении списка бейджей:', error);
    return [];
  }
};

// Получение бейджей пользователя
const getUserBadges = (userId) => {
  try {
    return db.prepare(`
      SELECT b.*, ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY b.requirement ASC
    `).all(userId);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении бейджей пользователя:', error);
    return [];
  }
};

// Проверка и награждение новыми бейджами
const checkAndAwardBadges = (userId, currentStreak) => {
  try {
    const allBadges = getAllBadges();
    const userBadges = getUserBadges(userId);
    const earnedBadgeIds = new Set(userBadges.map(b => b.id));
    
    const newBadges = [];
    const insert = db.prepare('INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)');
    
    for (const badge of allBadges) {
      // Если бейдж ещё не получен и требование выполнено
      if (!earnedBadgeIds.has(badge.id) && currentStreak >= badge.requirement) {
        insert.run(userId, badge.id, new Date().toISOString());
        newBadges.push(badge);
        console.log(`[БД] Пользователь ${userId} получил бейдж: ${badge.name}`);
      }
    }
    
    return newBadges;
  } catch (error) {
    console.error('[ERROR] Ошибка при проверке бейджей:', error);
    return [];
  }
};

// Получение информации о стриках пользователя
const getUserStreakInfo = (telegramId) => {
  try {
    const user = getUser(telegramId);
    if (!user) return null;
    
    const badges = getUserBadges(user.id);
    
    return {
      currentStreak: user.current_streak || 0,
      bestStreak: user.best_streak || 0,
      badges: badges
    };
  } catch (error) {
    console.error('[ERROR] Ошибка при получении информации о стриках:', error);
    return null;
  }
};

// Добавление предложенного вопроса от пользователя
const addSuggestedQuestion = (userId, questionText) => {
  try {
    const stmt = db.prepare('INSERT INTO suggested_questions (user_id, question_text, created_at) VALUES (?, ?, ?)');
    const result = stmt.run(userId, questionText, new Date().toISOString());
    console.log(`[БД] Добавлен предложенный вопрос от пользователя ${userId}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[ERROR] Ошибка при добавлении предложенного вопроса:', error);
    return null;
  }
};

// ===== АДМИНИСТРАТИВНЫЕ ФУНКЦИИ =====

// Получение общей статистики системы
const getSystemStats = () => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeToday = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM daily_progress 
      WHERE date = ? AND is_completed = 1
    `).get(new Date().toISOString().split('T')[0]).count;
    
    const activeWeek = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM daily_progress 
      WHERE date >= date('now', '-7 days') AND is_completed = 1
    `).get().count;
    
    const activeMonth = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM daily_progress 
      WHERE date >= date('now', '-30 days') AND is_completed = 1
    `).get().count;
    
    const totalCompleted = db.prepare('SELECT SUM(completed_days) as total FROM users').get().total || 0;
    const totalMissed = db.prepare('SELECT SUM(missed_days) as total FROM users').get().total || 0;
    const completionRate = totalCompleted + totalMissed > 0 
      ? ((totalCompleted / (totalCompleted + totalMissed)) * 100).toFixed(1) 
      : 0;
    
    const topStreaks = db.prepare(`
      SELECT telegram_id, current_streak, best_streak 
      FROM users 
      WHERE current_streak > 0 
      ORDER BY current_streak DESC 
      LIMIT 5
    `).all();
    
    const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    const pendingSuggestions = db.prepare('SELECT COUNT(*) as count FROM suggested_questions').get().count;
    
    return {
      totalUsers,
      activeToday,
      activeWeek,
      activeMonth,
      totalCompleted,
      totalMissed,
      completionRate,
      topStreaks,
      totalQuestions,
      pendingSuggestions
    };
  } catch (error) {
    console.error('[ERROR] Ошибка при получении статистики системы:', error);
    return null;
  }
};

// Получение списка всех пользователей с сортировкой
const getAllUsersWithDetails = (sortBy = 'created_at', order = 'DESC', limit = 50) => {
  try {
    const validSorts = ['created_at', 'current_streak', 'best_streak', 'completed_days', 'last_completed_date'];
    const validOrders = ['ASC', 'DESC'];
    
    if (!validSorts.includes(sortBy)) sortBy = 'created_at';
    if (!validOrders.includes(order)) order = 'DESC';
    
    const stmt = db.prepare(`
      SELECT * FROM users 
      ORDER BY ${sortBy} ${order} 
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении списка пользователей:', error);
    return [];
  }
};

// Получение детальной информации о пользователе
const getUserDetails = (telegramId) => {
  try {
    const user = getUser(telegramId);
    if (!user) return null;
    
    // История за последние 30 дней
    const history = db.prepare(`
      SELECT date, question_id, answers_count, is_completed, question_changes_count
      FROM daily_progress
      WHERE user_id = ? AND date >= date('now', '-30 days')
      ORDER BY date DESC
    `).all(user.id);
    
    // Бейджи
    const badges = getUserBadges(user.id);
    
    // Общее количество смен вопросов
    const totalChanges = db.prepare(`
      SELECT SUM(question_changes_count) as total
      FROM daily_progress
      WHERE user_id = ?
    `).get(user.id).total || 0;
    
    return {
      user,
      history,
      badges,
      totalChanges
    };
  } catch (error) {
    console.error('[ERROR] Ошибка при получении деталей пользователя:', error);
    return null;
  }
};

// Статистика по вопросам
const getQuestionsStats = () => {
  try {
    // Количество использований каждого вопроса
    const questionUsage = db.prepare(`
      SELECT q.id, q.text, COUNT(dp.id) as usage_count,
             SUM(dp.question_changes_count) as total_changes
      FROM questions q
      LEFT JOIN daily_progress dp ON q.id = dp.question_id
      GROUP BY q.id
      ORDER BY usage_count DESC
    `).all();
    
    const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    
    // Самые популярные (меньше всего смен)
    const mostPopular = questionUsage
      .filter(q => q.usage_count > 0)
      .sort((a, b) => (a.total_changes / a.usage_count) - (b.total_changes / b.usage_count))
      .slice(0, 5);
    
    // Самые непопулярные (больше всего смен)
    const leastPopular = questionUsage
      .filter(q => q.usage_count > 0)
      .sort((a, b) => (b.total_changes / b.usage_count) - (a.total_changes / a.usage_count))
      .slice(0, 5);
    
    // Вопросы, которые давно не показывались
    const unused = questionUsage
      .filter(q => q.usage_count === 0)
      .length;
    
    return {
      totalQuestions,
      mostPopular,
      leastPopular,
      unusedCount: unused
    };
  } catch (error) {
    console.error('[ERROR] Ошибка при получении статистики вопросов:', error);
    return null;
  }
};

// Добавление нового вопроса
const addQuestion = (questionText) => {
  try {
    const stmt = db.prepare('INSERT INTO questions (text) VALUES (?)');
    const result = stmt.run(questionText);
    console.log(`[БД] Добавлен новый вопрос: ${questionText}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[ERROR] Ошибка при добавлении вопроса:', error);
    return null;
  }
};

// Удаление вопроса
const deleteQuestion = (questionId) => {
  try {
    // Проверяем, используется ли вопрос
    const usage = db.prepare('SELECT COUNT(*) as count FROM daily_progress WHERE question_id = ?').get(questionId).count;
    
    if (usage > 0) {
      return { success: false, message: 'Вопрос используется в истории пользователей' };
    }
    
    const stmt = db.prepare('DELETE FROM questions WHERE id = ?');
    const result = stmt.run(questionId);
    
    if (result.changes > 0) {
      console.log(`[БД] Удалён вопрос с ID ${questionId}`);
      return { success: true };
    }
    
    return { success: false, message: 'Вопрос не найден' };
  } catch (error) {
    console.error('[ERROR] Ошибка при удалении вопроса:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Редактирование вопроса
const editQuestion = (questionId, newText) => {
  try {
    const stmt = db.prepare('UPDATE questions SET text = ? WHERE id = ?');
    const result = stmt.run(newText, questionId);
    
    if (result.changes > 0) {
      console.log(`[БД] Обновлён вопрос с ID ${questionId}`);
      return { success: true };
    }
    
    return { success: false, message: 'Вопрос не найден' };
  } catch (error) {
    console.error('[ERROR] Ошибка при редактировании вопроса:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Получение всех вопросов с пагинацией
const getAllQuestions = (page = 1, perPage = 10) => {
  try {
    const offset = (page - 1) * perPage;
    const questions = db.prepare('SELECT * FROM questions LIMIT ? OFFSET ?').all(perPage, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    
    return {
      questions,
      total,
      page,
      totalPages: Math.ceil(total / perPage)
    };
  } catch (error) {
    console.error('[ERROR] Ошибка при получении списка вопросов:', error);
    return null;
  }
};

// Поиск вопросов
const searchQuestions = (searchText) => {
  try {
    const stmt = db.prepare('SELECT * FROM questions WHERE text LIKE ? LIMIT 20');
    return stmt.all(`%${searchText}%`);
  } catch (error) {
    console.error('[ERROR] Ошибка при поиске вопросов:', error);
    return [];
  }
};

// Получение предложенных вопросов
const getPendingSuggestions = (limit = 20) => {
  try {
    const stmt = db.prepare(`
      SELECT sq.*, u.telegram_id
      FROM suggested_questions sq
      JOIN users u ON sq.user_id = u.id
      ORDER BY sq.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (error) {
    console.error('[ERROR] Ошибка при получении предложенных вопросов:', error);
    return [];
  }
};

// Одобрение предложенного вопроса
const approveSuggestion = (suggestionId) => {
  try {
    const transaction = db.transaction(() => {
      // Получаем текст вопроса
      const suggestion = db.prepare('SELECT question_text FROM suggested_questions WHERE id = ?').get(suggestionId);
      
      if (!suggestion) {
        return { success: false, message: 'Предложение не найдено' };
      }
      
      // Добавляем в основную базу
      db.prepare('INSERT INTO questions (text) VALUES (?)').run(suggestion.question_text);
      
      // Удаляем из предложенных
      db.prepare('DELETE FROM suggested_questions WHERE id = ?').run(suggestionId);
      
      return { success: true, text: suggestion.question_text };
    });
    
    return transaction();
  } catch (error) {
    console.error('[ERROR] Ошибка при одобрении предложения:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Отклонение предложенного вопроса
const rejectSuggestion = (suggestionId) => {
  try {
    const stmt = db.prepare('DELETE FROM suggested_questions WHERE id = ?');
    const result = stmt.run(suggestionId);
    
    if (result.changes > 0) {
      return { success: true };
    }
    
    return { success: false, message: 'Предложение не найдено' };
  } catch (error) {
    console.error('[ERROR] Ошибка при отклонении предложения:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Сброс истории вопросов пользователя (чтобы он мог получать их снова)
const resetUserQuestions = (telegramId) => {
  try {
    const user = getUser(telegramId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    const result = db.prepare('DELETE FROM daily_progress WHERE user_id = ?').run(user.id);
    console.log(`[БД] Сброшена история вопросов для пользователя ${telegramId}: удалено записей - ${result.changes}`);
    
    return { success: true, deletedRecords: result.changes };
  } catch (error) {
    console.error('[ERROR] Ошибка при сбросе истории вопросов:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Полный сброс пользователя (статистика, история, бейджи)
const resetUserFull = (telegramId) => {
  try {
    const user = getUser(telegramId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    const transaction = db.transaction(() => {
      // Сбрасываем статистику
      db.prepare(`
        UPDATE users 
        SET completed_days = 0, 
            missed_days = 0, 
            current_streak = 0, 
            best_streak = 0, 
            last_completed_date = NULL 
        WHERE id = ?
      `).run(user.id);
      
      // Удаляем историю вопросов
      db.prepare('DELETE FROM daily_progress WHERE user_id = ?').run(user.id);
      
      // Удаляем бейджи
      db.prepare('DELETE FROM user_badges WHERE user_id = ?').run(user.id);
      
      console.log(`[БД] Полный сброс пользователя ${telegramId}`);
      return { success: true };
    });
    
    return transaction();
  } catch (error) {
    console.error('[ERROR] Ошибка при полном сбросе пользователя:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

// Сброс прогресса за сегодня
const resetTodayProgress = (telegramId) => {
  try {
    const user = getUser(telegramId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const result = db.prepare('DELETE FROM daily_progress WHERE user_id = ? AND date = ?').run(user.id, today);
    
    if (result.changes > 0) {
      console.log(`[БД] Сброшен прогресс за сегодня для пользователя ${telegramId}`);
      return { success: true };
    }
    
    return { success: false, message: 'Нет прогресса за сегодня' };
  } catch (error) {
    console.error('[ERROR] Ошибка при сбросе прогресса за сегодня:', error);
    return { success: false, message: 'Ошибка базы данных' };
  }
};

module.exports = {
  initDatabase,
  seedQuestions,
  seedBadges,
  addUser,
  getUser,
  getAllUsers,
  getRandomQuestion,
  getRandomQuestionExcept,
  createDailyProgress,
  getTodayProgress,
  updateAnswersCount,
  markDayCompleted,
  changeQuestionForToday,
  closeDay,
  getAllBadges,
  getUserBadges,
  checkAndAwardBadges,
  getUserStreakInfo,
  addSuggestedQuestion,
  // Административные функции
  getSystemStats,
  getAllUsersWithDetails,
  getUserDetails,
  getQuestionsStats,
  addQuestion,
  deleteQuestion,
  editQuestion,
  getAllQuestions,
  searchQuestions,
  getPendingSuggestions,
  approveSuggestion,
  rejectSuggestion,
  resetUserQuestions,
  resetUserFull,
  resetTodayProgress
};
