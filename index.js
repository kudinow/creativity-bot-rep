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
      await bot.sendMessage(
        telegramId,
        `Вопрос дня: ${progress.question_text}\n\nТы уже выполнил задание на сегодня! Завтра будет новый вопрос.`
      );
    } else {
      await bot.sendMessage(
        telegramId,
        `Вопрос дня: ${progress.question_text}\n\nПришли 10 ответов до конца дня. Можно по одному сообщению или списком.`
      );
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
    
    await bot.sendMessage(
      telegramId,
      `📊 Твоя статистика:\n✅ Выполнено дней: ${user.completed_days}\n❌ Пропущено дней: ${user.missed_days}`
    );
  } catch (error) {
    console.error('[ERROR] Ошибка при обработке /stats:', error);
    await bot.sendMessage(telegramId, 'Произошла ошибка. Попробуйте ещё раз.');
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
    
    // Если день уже завершён - игнорируем
    if (progress.is_completed) {
      await bot.sendMessage(telegramId, 'Принято. Завтра будет новый вопрос.');
      return;
    }
    
    // Подсчитываем количество новых ответов
    const newAnswers = countAnswers(msg.text);
    const totalAnswers = progress.answers_count + newAnswers;
    
    // Обновляем количество ответов
    db.updateAnswersCount(progress.id, totalAnswers);
    
    // Проверяем, достигли ли мы 10 ответов
    if (totalAnswers >= 10) {
      db.markDayCompleted(progress.id, user.id);
      await bot.sendMessage(telegramId, 'Принято. Завтра будет новый вопрос.');
    } else {
      await bot.sendMessage(telegramId, `Принято ответов: ${totalAnswers}/10`);
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
startScheduler(bot, db);

// Запуск бота
console.log('[БОТ] Бот запущен и готов к работе');
