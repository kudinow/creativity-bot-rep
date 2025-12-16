// Модуль для планирования задач с помощью cron
const cron = require('node-cron');
require('dotenv').config();

// Запуск планировщика
const startScheduler = (bot, db) => {
  const timezone = process.env.TIMEZONE || 'Europe/Moscow';

  // Задача в 10:00 - рассылка ежедневного вопроса
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[CRON] Начата рассылка ежедневного вопроса');
      
      const users = db.getAllUsers();
      const question = db.getRandomQuestion();
      const today = new Date().toISOString().split('T')[0];

      if (!question) {
        console.error('[ERROR] Не удалось получить вопрос для рассылки');
        return;
      }

      for (const user of users) {
        try {
          // Создаём запись прогресса на сегодня
          db.createDailyProgress(user.id, today, question.id);

          // Отправляем вопрос пользователю
          await bot.sendMessage(
            user.telegram_id,
            `Вопрос дня: ${question.text}\n\nПришли 10 ответов до конца дня. Можно по одному сообщению или списком.`
          );
          
          console.log(`[CRON] Вопрос отправлен пользователю ${user.telegram_id}`);
        } catch (error) {
          console.error(`[ERROR] Ошибка при отправке вопроса пользователю ${user.telegram_id}:`, error);
        }
      }

      console.log(`[CRON] Рассылка завершена. Отправлено пользователям: ${users.length}`);
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
