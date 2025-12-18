// Модуль для планирования задач с помощью cron
const cron = require('node-cron');
require('dotenv').config();

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

// Запуск планировщика
const startScheduler = (bot, db) => {
  const timezone = process.env.TIMEZONE || 'Europe/Moscow';

  // Задача в 10:00 - рассылка ежедневного вопроса
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[CRON] Начата рассылка ежедневного вопроса');
      
      const users = db.getAllUsers();
      const today = new Date().toISOString().split('T')[0];
      let successCount = 0;

      for (const user of users) {
        try {
          // Получаем случайный вопрос для каждого пользователя (исключая уже использованные)
          const question = db.getRandomQuestion(user.id);
          
          if (!question) {
            console.error(`[ERROR] Не удалось получить вопрос для пользователя ${user.telegram_id}`);
            continue;
          }

          // Создаём запись прогресса на сегодня
          db.createDailyProgress(user.id, today, question.id);

          // Получаем прогресс для отображения кнопки
          const progress = db.getTodayProgress(user.telegram_id);
          const progressBar = generateProgressBar(0);
          const keyboard = createQuestionKeyboard(progress.question_changes_count || 0, false);

          // Отправляем вопрос пользователю с кнопкой смены вопроса
          await bot.sendMessage(
            user.telegram_id,
            `Вопрос дня: ${question.text}\n\n${progressBar}\n\nПришли 10 ответов до конца дня. Можно по одному сообщению или списком.`,
            { reply_markup: keyboard }
          );
          
          successCount++;
          console.log(`[CRON] Вопрос отправлен пользователю ${user.telegram_id} (ID вопроса: ${question.id})`);
        } catch (error) {
          console.error(`[ERROR] Ошибка при отправке вопроса пользователю ${user.telegram_id}:`, error);
        }
      }

      console.log(`[CRON] Рассылка завершена. Успешно отправлено: ${successCount}/${users.length}`);
    } catch (error) {
      console.error('[ERROR] Ошибка при выполнении задачи рассылки:', error);
    }
  }, {
    timezone
  });

  // Задача в 18:00 - напоминание для тех, кто не выполнил задание
  cron.schedule('0 18 * * *', async () => {
    try {
      console.log('[CRON] Начата рассылка напоминаний в 18:00');
      
      const users = db.getAllUsers();
      const today = new Date().toISOString().split('T')[0];
      let sentCount = 0;

      for (const user of users) {
        try {
          const progress = db.getTodayProgress(user.telegram_id);
          
          // Отправляем напоминание только тем, кто не завершил задание
          if (!progress || !progress.is_completed) {
            const answersCount = progress ? progress.answers_count : 0;
            const remaining = 10 - answersCount;
            
            let message = '⏰ Напоминание!\n\n';
            
            if (answersCount > 0) {
              message += `У тебя уже ${answersCount}/10 ответов.\nОсталось ${remaining}. Продолжай!`;
            } else {
              message += 'Не забудь выполнить задание дня!\nПришли 10 ответов до конца дня.\n\nИспользуй /start чтобы увидеть вопрос.';
            }
            
            await bot.sendMessage(user.telegram_id, message);
            sentCount++;
          }
        } catch (error) {
          console.error(`[ERROR] Ошибка при отправке напоминания пользователю ${user.telegram_id}:`, error);
        }
      }

      console.log(`[CRON] Напоминания в 18:00 отправлены: ${sentCount} пользователям`);
    } catch (error) {
      console.error('[ERROR] Ошибка при рассылке напоминаний в 18:00:', error);
    }
  }, {
    timezone
  });

  // Задача в 22:00 - финальное напоминание
  cron.schedule('0 22 * * *', async () => {
    try {
      console.log('[CRON] Начата рассылка финальных напоминаний в 22:00');
      
      const users = db.getAllUsers();
      const today = new Date().toISOString().split('T')[0];
      let sentCount = 0;

      for (const user of users) {
        try {
          const progress = db.getTodayProgress(user.telegram_id);
          
          // Отправляем напоминание только тем, кто не завершил задание
          if (!progress || !progress.is_completed) {
            const answersCount = progress ? progress.answers_count : 0;
            const remaining = 10 - answersCount;
            
            let message = '🔔 Последнее напоминание!\n\n';
            
            if (answersCount > 0) {
              message += `У тебя ${answersCount}/10 ответов.\nОсталось всего ${remaining}!\n\n`;
              message += '⏳ До конца дня осталось меньше 2 часов.\nЗавершай задание, чтобы не прервать серию!';
            } else {
              message += '⏳ До конца дня осталось меньше 2 часов!\n\n';
              message += 'Успей выполнить задание дня и не потерять серию.\n\nИспользуй /start чтобы увидеть вопрос.';
            }
            
            await bot.sendMessage(user.telegram_id, message);
            sentCount++;
          }
        } catch (error) {
          console.error(`[ERROR] Ошибка при отправке финального напоминания пользователю ${user.telegram_id}:`, error);
        }
      }

      console.log(`[CRON] Финальные напоминания в 22:00 отправлены: ${sentCount} пользователям`);
    } catch (error) {
      console.error('[ERROR] Ошибка при рассылке финальных напоминаний в 22:00:', error);
    }
  }, {
    timezone
  });

  // Задача в 23:59 - закрытие дня и подсчёт пропусков
  cron.schedule('59 23 * * *', async () => {
    try {
      console.log('[CRON] Начато закрытие дня');
      
      const today = new Date().toISOString().split('T')[0];
      db.closeDay(today);
      
      console.log('[CRON] День успешно закрыт');
    } catch (error) {
      console.error('[ERROR] Ошибка при закрытии дня:', error);
    }
  }, {
    timezone
  });

  console.log(`[CRON] Планировщик запущен (timezone: ${timezone})`);
};

module.exports = { startScheduler };
