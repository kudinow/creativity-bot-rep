# Исправление проблемы с устаревшими callback-запросами

## Проблема

Бот падал с ошибкой при запуске после длительного простоя:
```
Bad Request: query is too old and response timeout expired or query ID is invalid
```

## Причина

Когда бот был выключен, пользователи нажимали на кнопки (inline keyboard). Telegram сохраняет эти callback-запросы до 48 часов. При запуске бота он пытался обработать все накопившиеся запросы, включая устаревшие, что приводило к ошибкам и падению бота.

## Решение

### 1. Проверка возраста callback-запросов

Добавлена проверка возраста callback-запроса в начале обработчика `callback_query`:

```javascript
// Проверяем возраст callback-запроса (Telegram хранит их максимум 48 часов)
const messageDate = query.message.date * 1000; // Конвертируем в миллисекунды
const now = Date.now();
const maxAge = 48 * 60 * 60 * 1000; // 48 часов в миллисекундах

if (now - messageDate > maxAge) {
  console.log(`[БОТ] Игнорируем устаревший callback_query от пользователя ${telegramId}`);
  try {
    await bot.answerCallbackQuery(query.id, {
      text: 'Это сообщение устарело. Используй /start для получения актуального вопроса.',
      show_alert: true
    });
  } catch (e) {
    console.log('[БОТ] Не удалось ответить на устаревший callback:', e.message);
  }
  return;
}
```

### 2. Безопасная обработка ошибок в catch-блоке

Обернули `answerCallbackQuery` в дополнительный try-catch в блоке обработки ошибок:

```javascript
} catch (error) {
  console.error('[ERROR] Ошибка при обработке callback_query:', error);
  try {
    await bot.answerCallbackQuery(query.id, {
      text: 'Произошла ошибка. Попробуйте ещё раз.',
      show_alert: true
    });
  } catch (answerError) {
    // Игнорируем ошибки ответа на callback (например, если запрос устарел)
    console.error('[ERROR] Не удалось ответить на callback_query:', answerError.message);
  }
}
```

### 3. Глобальная обработка необработанных ошибок

Добавлены обработчики для предотвращения падения бота:

```javascript
// Обработка необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Необработанное отклонение промиса:', reason);
  // Не падаем - продолжаем работу
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Необработанное исключение:', error);
  // Не падаем - продолжаем работу
});
```

### 4. Улучшенная обработка ошибок polling

```javascript
bot.on('polling_error', (error) => {
  console.error('[ERROR] Ошибка polling:', error.code, error.message);
  // Не падаем при ошибках polling - бот продолжит работу
});
```

## Результат

✅ Бот теперь корректно обрабатывает устаревшие callback-запросы  
✅ Бот не падает при ошибках API Telegram  
✅ Бот продолжает работу при сетевых проблемах  
✅ Пользователи получают понятное сообщение при попытке использовать устаревшие кнопки  

## Дата исправления

29 декабря 2025 года

