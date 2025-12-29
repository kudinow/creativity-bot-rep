// Модуль для планирования задач с помощью cron
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Склонение слова "день"
const getDaysWord = (count) => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
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
          // Проверяем, заблокировал ли пользователь бота
          if (error.response && error.response.body && 
              (error.response.body.description?.includes('bot was blocked') ||
               error.response.body.description?.includes('user is deactivated'))) {
            console.log(`[CRON] Пользователь ${user.telegram_id} заблокировал бота`);
            db.recordUserBlock(user.telegram_id);
          } else {
          console.error(`[ERROR] Ошибка при отправке вопроса пользователю ${user.telegram_id}:`, error);
          }
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

  // Задача в 03:00 - автоматическое резервное копирование базы данных
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[BACKUP] Начато резервное копирование базы данных');
      
      const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database.db');
      const backupDir = path.join(__dirname, '..', 'backups');
      
      // Создаём папку для бэкапов, если её нет
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Формируем имя файла с датой
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const backupFileName = `database-backup-${dateStr}-${timeStr}.db`;
      const backupPath = path.join(backupDir, backupFileName);
      
      // Копируем файл базы данных
      fs.copyFileSync(dbPath, backupPath);
      
      console.log(`[BACKUP] Резервная копия создана: ${backupFileName}`);
      
      // Удаляем старые бэкапы (оставляем только последние 7 дней)
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('database-backup-') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      // Удаляем файлы старше 7 дней
      const keepCount = 7;
      if (files.length > keepCount) {
        const filesToDelete = files.slice(keepCount);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`[BACKUP] Удалён старый бэкап: ${file.name}`);
        }
      }
      
      console.log(`[BACKUP] Резервное копирование завершено. Хранится бэкапов: ${Math.min(files.length, keepCount)}`);
    } catch (error) {
      console.error('[ERROR] Ошибка при резервном копировании:', error);
    }
  }, {
    timezone
  });

  // Задача по пятницам в 18:00 - отправка еженедельной статистики
  cron.schedule('0 18 * * 5', async () => {
    try {
      console.log('[CRON] Начата рассылка еженедельной статистики');
      
      const users = db.getAllUsers();
      let successCount = 0;
      
      for (const user of users) {
        try {
          const stats = db.getUserStats(user.telegram_id);
          const badges = db.getUserBadges(user.telegram_id);
          
          // Формируем сообщение со статистикой
          let message = `📊 *Твоя статистика за неделю*\n\n`;
          message += `🔥 Текущая серия: *${stats.current_streak} ${getDaysWord(stats.current_streak)}*\n`;
          message += `🏆 Лучшая серия: *${stats.max_streak} ${getDaysWord(stats.max_streak)}*\n`;
          message += `✅ Всего выполнено дней: *${stats.total_completed_days}*\n\n`;
          
          // Добавляем бейджи
          if (badges.length > 0) {
            message += `🎖 *Твои достижения:*\n`;
            for (const badge of badges) {
              message += `${badge.emoji} ${badge.name}\n`;
            }
            message += `\n`;
          }
          
          // Мотивационное сообщение
          if (stats.current_streak === 0) {
            message += `💪 Начни новую серию в понедельник!\n`;
          } else if (stats.current_streak < 7) {
            message += `🚀 Продолжай в том же духе! До недельной серии осталось ${7 - stats.current_streak} ${getDaysWord(7 - stats.current_streak)}!\n`;
          } else if (stats.current_streak < 30) {
            message += `⭐️ Отличный результат! Ты на пути к бейджу "Мастер"!\n`;
          } else {
            message += `👑 Невероятно! Ты настоящий мастер креативности!\n`;
          }
          
          message += `\nХороших выходных! 🎉`;
          
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          successCount++;
          
          // Небольшая задержка между сообщениями
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log(`[CRON] Статистика отправлена пользователю ${user.telegram_id}`);
        } catch (error) {
          // Проверяем, заблокировал ли пользователь бота
          if (error.response && error.response.body && 
              (error.response.body.description?.includes('bot was blocked') ||
               error.response.body.description?.includes('user is deactivated'))) {
            console.log(`[CRON] Пользователь ${user.telegram_id} заблокировал бота`);
            db.recordUserBlock(user.telegram_id);
          } else {
            console.error(`[ERROR] Ошибка при отправке статистики пользователю ${user.telegram_id}:`, error);
          }
        }
      }
      
      console.log(`[CRON] Рассылка статистики завершена. Успешно отправлено: ${successCount}/${users.length}`);
    } catch (error) {
      console.error('[ERROR] Ошибка при рассылке статистики:', error);
    }
  }, {
    timezone
  });

  // Задача по пятницам в 18:00 - еженедельная статистика пользователям
  cron.schedule('0 18 * * 5', async () => {
    try {
      console.log('[CRON] Начата рассылка еженедельной статистики');
      
      const users = db.getAllUsers();
      let successCount = 0;
      
      for (const user of users) {
        try {
          const stats = db.getUserStats(user.telegram_id);
          const badges = db.getUserBadges(user.telegram_id);
          
          // Формируем сообщение со статистикой
          let message = `📊 *Твоя статистика за неделю*\n\n`;
          
          // Текущая серия
          message += `🔥 *Текущая серия:* ${stats.current_streak} ${getDaysWord(stats.current_streak)}\n`;
          
          // Лучшая серия
          if (stats.best_streak > 0) {
            message += `🏆 *Лучшая серия:* ${stats.best_streak} ${getDaysWord(stats.best_streak)}\n`;
          }
          
          // Всего дней активности
          message += `📅 *Всего дней активности:* ${stats.total_days}\n`;
          
          // Всего идей
          message += `💡 *Всего идей:* ${stats.total_ideas}\n\n`;
          
          // Бейджи
          if (badges.length > 0) {
            message += `🎖 *Твои достижения:*\n`;
            badges.forEach(badge => {
              message += `${badge.emoji} ${badge.name} — ${badge.description}\n`;
            });
            message += `\n`;
          }
          
          // Мотивационное сообщение в зависимости от серии
          if (stats.current_streak === 0) {
            message += `💪 Начни новую серию! Ответь на вопрос дня и развивай свою креативность.`;
          } else if (stats.current_streak < 7) {
            message += `🌱 Отличное начало! Продолжай в том же духе.`;
          } else if (stats.current_streak < 30) {
            message += `⚡️ Ты на правильном пути! Твоя серия впечатляет.`;
          } else if (stats.current_streak < 100) {
            message += `🌟 Невероятно! Ты настоящий мастер креативности.`;
          } else {
            message += `👑 Легендарная серия! Ты вдохновляешь других.`;
          }
          
          message += `\n\n_Отличная неделя! Продолжай развивать креативность каждый день 🚀_`;
          
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          successCount++;
          
          // Задержка между отправками
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          // Проверяем, заблокировал ли пользователь бота
          if (error.response && error.response.body && 
              (error.response.body.description?.includes('bot was blocked') ||
               error.response.body.description?.includes('user is deactivated'))) {
            console.log(`[CRON] Пользователь ${user.telegram_id} заблокировал бота`);
            db.recordUserBlock(user.telegram_id);
          } else {
            console.error(`[ERROR] Ошибка при отправке статистики пользователю ${user.telegram_id}:`, error);
          }
        }
      }
      
      console.log(`[CRON] Рассылка статистики завершена. Успешно отправлено: ${successCount}/${users.length}`);
    } catch (error) {
      console.error('[ERROR] Ошибка при рассылке еженедельной статистики:', error);
    }
  }, {
    timezone
  });

  console.log(`[CRON] Планировщик запущен (timezone: ${timezone})`);
  console.log(`[CRON] Автоматическое резервное копирование: каждый день в 03:00`);
  console.log(`[CRON] Еженедельная статистика: каждую пятницу в 18:00`);
};

module.exports = { startScheduler };
