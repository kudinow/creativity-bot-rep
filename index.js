// Главный файл Telegram-бота для развития креативности
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const { startScheduler } = require('./scheduler');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('[ERROR] Токен бота не найден. Создайте .env файл с BOT_TOKEN');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

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
      await bot.sendMessage(
        telegramId,
        `Вопрос дня: ${progress.question_text}\n\n${progressBar}\n\n✅ Ты уже выполнил задание на сегодня! Завтра будет новый вопрос.`
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
    `/help — Показать эту справку\n\n` +
    `💡 Как это работает:\n` +
    `Каждый день ты получаешь вопрос и должен придумать 10 вариантов ответа. ` +
    `Можно отправлять по одному или списком. ` +
    `Выполняй задания каждый день, чтобы увеличить свою серию и получать бейджи!\n\n` +
    `🎖 Бейджи за серии:\n` +
    `🔥 Новичок — 3 дня подряд\n` +
    `🌟 Энтузиаст — 7 дней подряд\n` +
    `💎 Мастер — 30 дней подряд\n` +
    `👑 Легенда — 100 дней подряд`;
  
  await bot.sendMessage(telegramId, helpMessage);
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
      
      // Получаем новый вопрос (исключая текущий)
      const newQuestion = db.getRandomQuestionExcept(progress.question_id);
      
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
      
      // Получаем случайный вопрос для бонусной тренировки
      const bonusQuestion = db.getRandomQuestion();
      
      if (!bonusQuestion) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Не удалось получить вопрос. Попробуй позже.',
          show_alert: true
        });
        return;
      }
      
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
    
    // Получаем прогресс за сегодня
    let progress = db.getTodayProgress(telegramId);
    
    // Если прогресса нет - создаём новый вопрос дня
    if (!progress) {
      const question = db.getRandomQuestion();
      const today = new Date().toISOString().split('T')[0];
      db.createDailyProgress(user.id, today, question.id);
      progress = db.getTodayProgress(telegramId);
    }
    
    // Если день уже завершён - считаем как бонусную тренировку
    if (progress.is_completed) {
      // Подсчитываем ответы для бонусной тренировки (не сохраняем в БД)
      const bonusAnswers = countAnswers(msg.text);
      const progressBar = generateProgressBar(bonusAnswers);
      
      if (bonusAnswers >= 10) {
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
          `${progressBar}\n\nПринято ответов: ${bonusAnswers}/10\nПродолжай тренироваться! Осталось ${10 - bonusAnswers}.`
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
