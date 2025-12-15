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
