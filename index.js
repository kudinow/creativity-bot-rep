// Главный файл Telegram-бота для развития креативности
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const { startScheduler } = require('./scheduler');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

if (!token) {
  console.error('[ERROR] Токен бота не найден. Создайте .env файл с BOT_TOKEN');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Проверка прав администратора
const isAdmin = (telegramId) => adminIds.includes(telegramId);

// Подсчёт количества ответов в тексте
const countAnswers = (text) => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length;
};

// Генерация визуального прогресс-бара
const generateProgressBar = (current, total = 10) => {
  const filled = Math.min(current, total);
  const empty = total - filled;
  
  const filledSquares = '✅'.repeat(filled);
  const emptySquares = '⬜'.repeat(empty);
  
  return filledSquares + emptySquares;
};

// Создание inline-клавиатуры для смены вопроса
const createQuestionKeyboard = (changesCount, isCompleted = false) => {
  // Если задание выполнено или достигнут лимит - не показываем кнопку
  if (isCompleted || changesCount >= 3) {
    return {
      inline_keyboard: []
    };
  }
  
  const remainingChanges = 3 - changesCount;
  return {
    inline_keyboard: [[
      {
        text: `🔄 Другой вопрос (осталось: ${remainingChanges})`,
        callback_data: 'change_question'
      }
    ]]
  };
};

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
  const telegramId = msg.from.id;
  
  try {
    let user = db.getUser(telegramId);
    
    // Если пользователь новый - добавляем в БД
    if (!user) {
      db.addUser(telegramId);
      user = db.getUser(telegramId);
      
      await bot.sendMessage(
        telegramId,
        'Это тренажёр креативности. Каждый день ты получаешь вопрос и придумываешь 10 вариантов ответа. Можно писать что угодно — важно количество.'
      );
    }
    
    // Получаем прогресс за сегодня
    let progress = db.getTodayProgress(telegramId);
    
    // Если прогресса нет - создаём новый вопрос дня
    if (!progress) {
      const question = db.getRandomQuestion();
      const today = new Date().toISOString().split('T')[0];
      db.createDailyProgress(user.id, today, question.id);
      progress = db.getTodayProgress(telegramId);
    }
    
    // Отправляем вопрос дня
    if (progress.is_completed) {
      const progressBar = generateProgressBar(10);
      const bonusKeyboard = {
        inline_keyboard: [[
          {
            text: '🎯 Получить бонусный вопрос',
            callback_data: 'bonus_question'
          }
        ]]
      };
      await bot.sendMessage(
        telegramId,
        `Вопрос дня: ${progress.question_text}\n\n${progressBar}\n\n✅ Ты уже выполнил задание на сегодня! Завтра будет новый вопрос.`,
        { reply_markup: bonusKeyboard }
      );
    } else {
      const progressBar = generateProgressBar(progress.answers_count);
      const remaining = 10 - progress.answers_count;
      const keyboard = createQuestionKeyboard(progress.question_changes_count || 0, progress.is_completed);
      
      if (progress.answers_count > 0) {
        await bot.sendMessage(
          telegramId,
          `Вопрос дня: ${progress.question_text}\n\n${progressBar}\n\nУ тебя уже ${progress.answers_count}/10 ответов.\nОсталось ${remaining}. Продолжай!`,
          { reply_markup: keyboard }
        );
      } else {
        await bot.sendMessage(
          telegramId,
          `Вопрос дня: ${progress.question_text}\n\n${progressBar}\n\nПришли 10 ответов до конца дня. Можно по одному сообщению или списком.`,
          { reply_markup: keyboard }
        );
      }
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /start:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
  }
});

// Обработчик команды /stats
bot.onText(/\/stats/, async (msg) => {
  const telegramId = msg.from.id;
  
  try {
    const user = db.getUser(telegramId);
    
    if (!user) {
      await bot.sendMessage(telegramId, 'Сначала используй команду /start');
      return;
    }
    
    const streakInfo = db.getUserStreakInfo(telegramId);
    const currentStreak = streakInfo ? streakInfo.currentStreak : 0;
    const bestStreak = streakInfo ? streakInfo.bestStreak : 0;
    
    await bot.sendMessage(
      telegramId,
      `📊 Твоя статистика:\n\n` +
      `✅ Выполнено дней: ${user.completed_days}\n` +
      `❌ Пропущено дней: ${user.missed_days}\n\n` +
      `🔥 Текущая серия: ${currentStreak} ${getDaysWord(currentStreak)}\n` +
      `🏆 Лучшая серия: ${bestStreak} ${getDaysWord(bestStreak)}\n\n` +
      `Используй /streak для подробностей о сериях и бейджах`
    );
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /stats:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
  }
});

// Обработчик команды /streak
bot.onText(/\/streak/, async (msg) => {
  const telegramId = msg.from.id;
  
  try {
    const user = db.getUser(telegramId);
    
    if (!user) {
      await bot.sendMessage(telegramId, 'Сначала используй команду /start');
      return;
    }
    
    const streakInfo = db.getUserStreakInfo(telegramId);
    
    if (!streakInfo) {
      await bot.sendMessage(telegramId, 'Не удалось получить информацию о сериях');
      return;
    }
    
    const { currentStreak, bestStreak, badges } = streakInfo;
    const allBadges = db.getAllBadges();
    
    // Формируем сообщение о сериях
    let message = `🔥 Твои серии:\n\n`;
    message += `📈 Текущая серия: ${currentStreak} ${getDaysWord(currentStreak)}\n`;
    message += `🏆 Лучшая серия: ${bestStreak} ${getDaysWord(bestStreak)}\n\n`;
    
    // Добавляем информацию о бейджах
    message += `🎖 Твои бейджи:\n`;
    
    if (badges.length > 0) {
      for (const badge of badges) {
        const earnedDate = new Date(badge.earned_at).toLocaleDateString('ru-RU');
        message += `${badge.emoji} ${badge.name} — ${badge.description} (получен ${earnedDate})\n`;
      }
    } else {
      message += `У тебя пока нет бейджей\n`;
    }
    
    // Показываем следующий бейдж
    message += `\n🎯 Следующие цели:\n`;
    const earnedBadgeIds = new Set(badges.map(b => b.id));
    const nextBadges = allBadges.filter(b => !earnedBadgeIds.has(b.id));
    
    if (nextBadges.length > 0) {
      const nextBadge = nextBadges[0];
      const remaining = nextBadge.requirement - currentStreak;
      message += `${nextBadge.emoji} ${nextBadge.name} — ${nextBadge.description}`;
      if (remaining > 0) {
        message += ` (ещё ${remaining} ${getDaysWord(remaining)})`;
      }
      message += `\n`;
      
      // Показываем остальные будущие бейджи
      for (let i = 1; i < nextBadges.length; i++) {
        const badge = nextBadges[i];
        message += `${badge.emoji} ${badge.name} — ${badge.description}\n`;
      }
    } else {
      message += `🎉 Ты получил все бейджи! Поздравляем!\n`;
    }
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /streak:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
  }
});

// Обработчик команды /help
bot.onText(/\/help/, async (msg) => {
  const telegramId = msg.from.id;
  
  const helpMessage = `📖 Справка по командам:\n\n` +
    `/start — Начать работу или получить вопрос дня\n` +
    `/stats — Показать статистику выполнения\n` +
    `/streak — Показать текущие серии и бейджи\n` +
    `/suggest — Предложить свой вопрос\n` +
    `/donate — Поддержать проект\n` +
    `/help — Показать эту справку\n\n` +
    `💡 Как это работает:\n` +
    `Каждый день ты получаешь вопрос и должен придумать 10 вариантов ответа. ` +
    `Можно отправлять по одному или списком. ` +
    `Выполняй задания каждый день, чтобы увеличить свою серию и получать бейджи!\n\n` +
    `🎖 Бейджи за серии:\n` +
    `🔥 Новичок — 3 дня подряд\n` +
    `🌟 Энтузиаст — 7 дней подряд\n` +
    `💎 Мастер — 30 дней подряд\n` +
    `👑 Легенда — 100 дней подряд\n\n` +
    `💭 Есть идеи по улучшению?\n` +
    `Пиши сюда: @kudinow - буду рад обратной связи!`;
  
  await bot.sendMessage(telegramId, helpMessage);
});

// Состояние для ожидания предложенного вопроса
const waitingForSuggestion = new Set();

// Хранилище прогресса бонусных ответов (telegramId -> количество ответов)
const bonusProgress = new Map();

// Обработчик команды /suggest
bot.onText(/\/suggest/, async (msg) => {
  const telegramId = msg.from.id;
  
  try {
    const user = db.getUser(telegramId);
    
    if (!user) {
      await bot.sendMessage(telegramId, 'Сначала используй команду /start');
      return;
    }
    
    waitingForSuggestion.add(telegramId);
    await bot.sendMessage(
      telegramId,
      '💡 Отлично! Напиши свой вариант вопроса.\n\nНапример: "10 способов провести выходной с пользой"\n\nДля отмены отправь /cancel'
    );
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /suggest:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
  }
});

// Обработчик команды /cancel
bot.onText(/\/cancel/, async (msg) => {
  const telegramId = msg.from.id;
  
  if (waitingForSuggestion.has(telegramId)) {
    waitingForSuggestion.delete(telegramId);
    await bot.sendMessage(telegramId, '❌ Предложение вопроса отменено.');
  } else {
    await bot.sendMessage(telegramId, 'Нет активных действий для отмены.');
  }
});

// Обработчик команды /donate
bot.onText(/\/donate/, async (msg) => {
  const telegramId = msg.from.id;
  
  const donateMessage = `💝 Поддержать проект\n\n` +
    `Если тебе нравится бот и ты хочешь поддержать его развитие, ` +
    `буду благодарен за любую помощь!\n\n` +
    `Все средства идут на улучшение бота и добавление новых функций.\n\n` +
    `🔗 Ссылка для доната:\n` +
    `https://www.tinkoff.ru/rm/r_iLwlhumFVz.DCDtYBLVrF/b4Xwm10084\n\n` +
    `Спасибо за поддержку! ❤️`;
  
  await bot.sendMessage(telegramId, donateMessage);
});

// ===== АДМИНИСТРАТИВНЫЕ КОМАНДЫ =====

// Общая статистика системы
bot.onText(/\/admin_stats/, async (msg) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const stats = db.getSystemStats();
    
    if (!stats) {
      await bot.sendMessage(telegramId, '❌ Не удалось получить статистику.');
      return;
    }
    
    let message = `📊 Статистика системы\n\n`;
    message += `👥 Всего пользователей: ${stats.totalUsers}\n`;
    message += `✅ Активные сегодня: ${stats.activeToday}\n`;
    message += `📅 Активные за неделю: ${stats.activeWeek}\n`;
    message += `📆 Активные за месяц: ${stats.activeMonth}\n\n`;
    message += `✅ Выполнено заданий: ${stats.totalCompleted}\n`;
    message += `❌ Пропущено заданий: ${stats.totalMissed}\n`;
    message += `📈 Процент выполнения: ${stats.completionRate}%\n\n`;
    message += `❓ Вопросов в базе: ${stats.totalQuestions}\n`;
    message += `💡 Предложений от пользователей: ${stats.pendingSuggestions}\n\n`;
    
    if (stats.topStreaks.length > 0) {
      message += `🔥 Топ серий:\n`;
      stats.topStreaks.forEach((user, idx) => {
        message += `${idx + 1}. ID ${user.telegram_id}: ${user.current_streak} дней (рекорд: ${user.best_streak})\n`;
      });
    }
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_stats:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Список пользователей
bot.onText(/\/admin_users(?:\s+(.+))?/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const params = match[1] ? match[1].split(' ') : [];
    const sortBy = params[0] || 'created_at';
    const order = params[1] || 'DESC';
    
    const users = db.getAllUsersWithDetails(sortBy, order, 20);
    
    if (users.length === 0) {
      await bot.sendMessage(telegramId, 'Пользователей не найдено.');
      return;
    }
    
    let message = `👥 Список пользователей (топ 20):\n\n`;
    
    users.forEach((user, idx) => {
      const lastActive = user.last_completed_date || 'никогда';
      message += `${idx + 1}. ID: ${user.telegram_id}\n`;
      message += `   🔥 Серия: ${user.current_streak} | Рекорд: ${user.best_streak}\n`;
      message += `   ✅ Выполнено: ${user.completed_days} | ❌ Пропущено: ${user.missed_days}\n`;
      message += `   📅 Последняя активность: ${lastActive}\n\n`;
    });
    
    message += `\nИспользуйте /admin_user <telegram_id> для деталей`;
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_users:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Детальная информация о пользователе
bot.onText(/\/admin_user\s+(\d+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const targetUserId = parseInt(match[1]);
    const details = db.getUserDetails(targetUserId);
    
    if (!details) {
      await bot.sendMessage(telegramId, '❌ Пользователь не найден.');
      return;
    }
    
    const { user, history, badges, totalChanges } = details;
    
    let message = `👤 Пользователь ${user.telegram_id}\n\n`;
    message += `📅 Регистрация: ${new Date(user.created_at).toLocaleDateString('ru-RU')}\n`;
    message += `📅 Последняя активность: ${user.last_completed_date || 'никогда'}\n\n`;
    message += `🔥 Текущая серия: ${user.current_streak}\n`;
    message += `🏆 Лучшая серия: ${user.best_streak}\n`;
    message += `✅ Выполнено дней: ${user.completed_days}\n`;
    message += `❌ Пропущено дней: ${user.missed_days}\n`;
    message += `🔄 Всего смен вопросов: ${totalChanges}\n\n`;
    
    if (badges.length > 0) {
      message += `🎖 Бейджи:\n`;
      badges.forEach(badge => {
        message += `${badge.emoji} ${badge.name}\n`;
      });
      message += `\n`;
    }
    
    if (history.length > 0) {
      message += `📊 История за последние 7 дней:\n`;
      history.slice(0, 7).forEach(day => {
        const status = day.is_completed ? '✅' : '⏳';
        message += `${status} ${day.date}: ${day.answers_count}/10 ответов\n`;
      });
    }
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_user:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Статистика по вопросам
bot.onText(/\/admin_questions_stats/, async (msg) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const stats = db.getQuestionsStats();
    
    if (!stats) {
      await bot.sendMessage(telegramId, '❌ Не удалось получить статистику.');
      return;
    }
    
    let message = `📊 Статистика вопросов\n\n`;
    message += `❓ Всего вопросов: ${stats.totalQuestions}\n`;
    message += `💤 Неиспользованных: ${stats.unusedCount}\n\n`;
    
    if (stats.mostPopular.length > 0) {
      message += `⭐ Самые популярные (меньше смен):\n`;
      stats.mostPopular.forEach((q, idx) => {
        const changeRate = (q.total_changes / q.usage_count).toFixed(2);
        message += `${idx + 1}. ID ${q.id}: ${changeRate} смен/использование\n`;
        message += `   "${q.text.substring(0, 50)}..."\n`;
      });
      message += `\n`;
    }
    
    if (stats.leastPopular.length > 0) {
      message += `👎 Самые непопулярные (больше смен):\n`;
      stats.leastPopular.forEach((q, idx) => {
        const changeRate = (q.total_changes / q.usage_count).toFixed(2);
        message += `${idx + 1}. ID ${q.id}: ${changeRate} смен/использование\n`;
        message += `   "${q.text.substring(0, 50)}..."\n`;
      });
    }
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_questions_stats:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Добавление нового вопроса
bot.onText(/\/admin_add_question\s+(.+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const questionText = match[1].trim();
    
    if (questionText.length < 10) {
      await bot.sendMessage(telegramId, '❌ Вопрос слишком короткий (минимум 10 символов).');
      return;
    }
    
    const id = db.addQuestion(questionText);
    
    if (id) {
      await bot.sendMessage(telegramId, `✅ Вопрос добавлен с ID ${id}:\n"${questionText}"`);
    } else {
      await bot.sendMessage(telegramId, '❌ Не удалось добавить вопрос.');
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_add_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Удаление вопроса
bot.onText(/\/admin_delete_question\s+(\d+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const questionId = parseInt(match[1]);
    const result = db.deleteQuestion(questionId);
    
    if (result.success) {
      await bot.sendMessage(telegramId, `✅ Вопрос с ID ${questionId} удалён.`);
    } else {
      await bot.sendMessage(telegramId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_delete_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Редактирование вопроса
bot.onText(/\/admin_edit_question\s+(\d+)\s+(.+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const questionId = parseInt(match[1]);
    const newText = match[2].trim();
    
    if (newText.length < 10) {
      await bot.sendMessage(telegramId, '❌ Вопрос слишком короткий (минимум 10 символов).');
      return;
    }
    
    const result = db.editQuestion(questionId, newText);
    
    if (result.success) {
      await bot.sendMessage(telegramId, `✅ Вопрос с ID ${questionId} обновлён:\n"${newText}"`);
    } else {
      await bot.sendMessage(telegramId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_edit_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Список всех вопросов
bot.onText(/\/admin_list_questions(?:\s+(\d+))?/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const page = match[1] ? parseInt(match[1]) : 1;
    const result = db.getAllQuestions(page, 10);
    
    if (!result || result.questions.length === 0) {
      await bot.sendMessage(telegramId, 'Вопросов не найдено.');
      return;
    }
    
    let message = `📝 Список вопросов (стр. ${result.page}/${result.totalPages}):\n\n`;
    
    result.questions.forEach((q) => {
      message += `ID ${q.id}: ${q.text}\n\n`;
    });
    
    if (result.totalPages > 1) {
      message += `Используйте /admin_list_questions <номер_страницы>`;
    }
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_list_questions:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Поиск вопроса
bot.onText(/\/admin_search_question\s+(.+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const searchText = match[1].trim();
    const questions = db.searchQuestions(searchText);
    
    if (questions.length === 0) {
      await bot.sendMessage(telegramId, 'Вопросов не найдено.');
      return;
    }
    
    let message = `🔍 Найдено вопросов: ${questions.length}\n\n`;
    
    questions.forEach((q) => {
      message += `ID ${q.id}: ${q.text}\n\n`;
    });
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_search_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Предложенные вопросы
bot.onText(/\/admin_pending_questions/, async (msg) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const suggestions = db.getPendingSuggestions(10);
    
    if (suggestions.length === 0) {
      await bot.sendMessage(telegramId, 'Нет предложенных вопросов.');
      return;
    }
    
    let message = `💡 Предложенные вопросы:\n\n`;
    
    suggestions.forEach((s) => {
      const date = new Date(s.created_at).toLocaleDateString('ru-RU');
      message += `ID ${s.id} от пользователя ${s.telegram_id} (${date}):\n`;
      message += `"${s.question_text}"\n`;
      message += `/admin_approve_question ${s.id} | /admin_reject_question ${s.id}\n\n`;
    });
    
    await bot.sendMessage(telegramId, message);
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_pending_questions:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Одобрение предложенного вопроса
bot.onText(/\/admin_approve_question\s+(\d+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const suggestionId = parseInt(match[1]);
    const result = db.approveSuggestion(suggestionId);
    
    if (result.success) {
      await bot.sendMessage(telegramId, `✅ Вопрос одобрен и добавлен в базу:\n"${result.text}"`);
    } else {
      await bot.sendMessage(telegramId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_approve_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Отклонение предложенного вопроса
bot.onText(/\/admin_reject_question\s+(\d+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  
  if (!isAdmin(telegramId)) {
    await bot.sendMessage(telegramId, '❌ У вас нет прав для выполнения этой команды.');
    return;
  }
  
  try {
    const suggestionId = parseInt(match[1]);
    const result = db.rejectSuggestion(suggestionId);
    
    if (result.success) {
      await bot.sendMessage(telegramId, `✅ Предложение с ID ${suggestionId} отклонено.`);
    } else {
      await bot.sendMessage(telegramId, `❌ ${result.message}`);
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /admin_reject_question:', error);
    await bot.sendMessage(telegramId, '❌ Произошла ошибка.');
  }
});

// Вспомогательная функция для склонения слова "день"
const getDaysWord = (count) => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'дней';
  }
  
  if (lastDigit === 1) {
    return 'день';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }
  
  return 'дней';
};

// Обработчик нажатий на inline-кнопки
bot.on('callback_query', async (query) => {
  const telegramId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  
  try {
    if (query.data === 'change_question') {
      const user = db.getUser(telegramId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Сначала используй команду /start',
          show_alert: true
        });
        return;
      }
      
      // Получаем текущий прогресс
      const progress = db.getTodayProgress(telegramId);
      
      if (!progress) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Ошибка: прогресс не найден',
          show_alert: true
        });
        return;
      }
      
      // Проверяем, не завершено ли задание
      if (progress.is_completed) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Ты уже выполнил задание на сегодня!',
          show_alert: true
        });
        return;
      }
      
      // Проверяем лимит смен
      const changesCount = progress.question_changes_count || 0;
      if (changesCount >= 3) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Достигнут лимит смены вопросов (3 раза в день)',
          show_alert: true
        });
        return;
      }
      
      // Получаем новый вопрос (исключая текущий и уже завершённые)
      const newQuestion = db.getRandomQuestionExcept(progress.question_id, user.id);
      
      if (!newQuestion) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Не удалось найти другой вопрос. Попробуй позже.',
          show_alert: true
        });
        return;
      }
      
      // Меняем вопрос и сбрасываем счётчики
      const success = db.changeQuestionForToday(progress.id, newQuestion.id);
      
      if (!success) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Произошла ошибка при смене вопроса',
          show_alert: true
        });
        return;
      }
      
      // Получаем обновлённый прогресс
      const updatedProgress = db.getTodayProgress(telegramId);
      const newChangesCount = updatedProgress.question_changes_count || 0;
      const progressBar = generateProgressBar(0);
      const keyboard = createQuestionKeyboard(newChangesCount, false);
      
      // Удаляем старое сообщение с кнопкой
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (e) {
        // Игнорируем ошибку, если сообщение уже удалено
      }
      
      // Отправляем новый вопрос
      await bot.sendMessage(
        telegramId,
        `Вопрос дня: ${newQuestion.text}\n\n${progressBar}\n\nПришли 10 ответов до конца дня. Можно по одному сообщению или списком.`,
        { reply_markup: keyboard }
      );
      
      await bot.answerCallbackQuery(query.id, {
        text: `Вопрос изменён! Осталось смен: ${3 - newChangesCount}`
      });
    } else if (query.data === 'bonus_question') {
      const user = db.getUser(telegramId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Сначала используй команду /start',
          show_alert: true
        });
        return;
      }
      
      // Получаем случайный вопрос для бонусной тренировки (исключая уже использованные)
      const bonusQuestion = db.getRandomQuestion(user.id);
      
      if (!bonusQuestion) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Не удалось получить вопрос. Попробуй позже.',
          show_alert: true
        });
        return;
      }
      
      // Сбрасываем счётчик бонусных ответов для нового вопроса
      bonusProgress.set(telegramId, 0);
      
      // Удаляем старое сообщение с кнопкой
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (e) {
        // Игнорируем ошибку, если сообщение уже удалено
      }
      
      const progressBar = generateProgressBar(0);
      
      // Отправляем бонусный вопрос без кнопки смены (это просто тренировка)
      await bot.sendMessage(
        telegramId,
        `🎯 Бонусный вопрос для тренировки:\n\n${bonusQuestion.text}\n\n${progressBar}\n\nПришли 10 ответов. Это не влияет на статистику - просто для практики!`
      );
      
      await bot.answerCallbackQuery(query.id, {
        text: 'Держи новый вопрос для тренировки!'
      });
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке callback_query:', error);
    await bot.answerCallbackQuery(query.id, {
      text: 'Произошла ошибка. Попробуйте ещё раз.',
      show_alert: true
    });
  }
});

// Обработчик текстовых сообщений (ответы пользователя)
bot.on('message', async (msg) => {
  // Игнорируем команды
  if (!msg.text || msg.text.startsWith('/')) {
    return;
  }
  
  const telegramId = msg.from.id;
  
  try {
    const user = db.getUser(telegramId);
    
    if (!user) {
      await bot.sendMessage(telegramId, 'Сначала используй команду /start');
      return;
    }
    
    // Проверяем, ожидается ли предложенный вопрос
    if (waitingForSuggestion.has(telegramId)) {
      const questionText = msg.text.trim();
      
      if (questionText.length < 10) {
        await bot.sendMessage(telegramId, '❌ Вопрос слишком короткий. Попробуй сформулировать подробнее (минимум 10 символов).');
        return;
      }
      
      if (questionText.length > 200) {
        await bot.sendMessage(telegramId, '❌ Вопрос слишком длинный. Постарайся уложиться в 200 символов.');
        return;
      }
      
      const result = db.addSuggestedQuestion(user.id, questionText);
      waitingForSuggestion.delete(telegramId);
      
      if (result) {
        await bot.sendMessage(
          telegramId,
          '✅ Спасибо! Твой вопрос принят и будет рассмотрен.\n\nМожешь продолжить тренировку с помощью /start'
        );
      } else {
        await bot.sendMessage(telegramId, '❌ Не удалось сохранить вопрос. Попробуй позже.');
      }
      return;
    }
    
    // Получаем прогресс за сегодня
    let progress = db.getTodayProgress(telegramId);
    
    // Если прогресса нет - создаём новый вопрос дня
    if (!progress) {
      const question = db.getRandomQuestion(user.id);
      const today = new Date().toISOString().split('T')[0];
      db.createDailyProgress(user.id, today, question.id);
      progress = db.getTodayProgress(telegramId);
    }
    
    // Если день уже завершён - считаем как бонусную тренировку
    if (progress.is_completed) {
      // Получаем текущий прогресс бонусных ответов
      const currentBonusCount = bonusProgress.get(telegramId) || 0;
      
      // Подсчитываем новые ответы
      const newBonusAnswers = countAnswers(msg.text);
      const totalBonusAnswers = currentBonusCount + newBonusAnswers;
      
      // Обновляем прогресс бонусных ответов
      bonusProgress.set(telegramId, totalBonusAnswers);
      
      const progressBar = generateProgressBar(totalBonusAnswers);
      
      if (totalBonusAnswers >= 10) {
        // Сбрасываем счётчик для следующего бонусного вопроса
        bonusProgress.delete(telegramId);
        
        // Кнопка для получения ещё одного бонусного вопроса
        const bonusKeyboard = {
          inline_keyboard: [[
            {
              text: '🎯 Получить новый вопрос',
              callback_data: 'bonus_question'
            }
          ]]
        };
        
        await bot.sendMessage(
          telegramId, 
          `${progressBar}\n\n✅ Отлично! Ещё 10 ответов!\n\nХочешь продолжить тренировку?`,
          { reply_markup: bonusKeyboard }
        );
      } else {
        await bot.sendMessage(
          telegramId, 
          `${progressBar}\n\nПринято ответов: ${totalBonusAnswers}/10\nПродолжай тренироваться! Осталось ${10 - totalBonusAnswers}.`
        );
      }
      return;
    }
    
    // Подсчитываем количество новых ответов
    const newAnswers = countAnswers(msg.text);
    const totalAnswers = progress.answers_count + newAnswers;
    
    // Обновляем количество ответов
    db.updateAnswersCount(progress.id, totalAnswers);
    
    // Генерируем прогресс-бар
    const progressBar = generateProgressBar(totalAnswers);
    
    // Проверяем, достигли ли мы 10 ответов
    if (totalAnswers >= 10) {
      // Отмечаем день как завершённый (это обновит стрики)
      db.markDayCompleted(progress.id, user.id);
      
      // Получаем обновлённую информацию о пользователе
      const updatedUser = db.getUser(telegramId);
      const currentStreak = updatedUser.current_streak || 0;
      
      // Проверяем, получил ли пользователь новые бейджи
      const newBadges = db.checkAndAwardBadges(updatedUser.id, currentStreak);
      
      let completionMessage = `${progressBar}\n\n✅ Отлично! Ты выполнил задание на сегодня!\n`;
      completionMessage += `🔥 Серия: ${currentStreak} ${getDaysWord(currentStreak)}\n`;
      
      // Если есть новые бейджи - объявляем о них
      if (newBadges.length > 0) {
        completionMessage += `\n🎉 Новое достижение!\n`;
        for (const badge of newBadges) {
          completionMessage += `${badge.emoji} ${badge.name} — ${badge.description}\n`;
        }
      }
      
      completionMessage += `\nЗавтра будет новый вопрос.`;
      
      // Кнопка для получения бонусного вопроса
      const bonusKeyboard = {
        inline_keyboard: [[
          {
            text: '🎯 Получить новый вопрос',
            callback_data: 'bonus_question'
          }
        ]]
      };
      
      await bot.sendMessage(telegramId, completionMessage, { reply_markup: bonusKeyboard });
    } else {
      // Получаем обновленный прогресс для актуального значения question_changes_count
      const updatedProgress = db.getTodayProgress(telegramId);
      const keyboard = createQuestionKeyboard(updatedProgress.question_changes_count || 0, false);
      
      await bot.sendMessage(
        telegramId, 
        `${progressBar}\n\nПринято ответов: ${totalAnswers}/10\nПродолжай! Осталось ${10 - totalAnswers}.`,
        { reply_markup: keyboard }
      );
    }
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке сообщения:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
  }
});

// Обработка ошибок polling
bot.on('polling_error', (error) => {
  console.error('[ERROR] Ошибка polling:', error);
});

// Инициализация
console.log('[БОТ] Инициализация...');
db.initDatabase();
db.seedQuestions();
db.seedBadges();
startScheduler(bot, db);

// Запуск бота
console.log('[БОТ] Бот запущен и готов к работе');
