# ⚡ Быстрое обновление бота на сервере

## 🎯 Для системы стриков (текущее обновление)

### На Mac (push в GitHub):

```bash
cd "/Users/kudinow/Yandex.Disk.localized/Cursor/Бот для развитие креативности/projects/creativity-bot"
git add .
git commit -m "Добавлена система стриков и бейджей"
git push origin main
```

### На сервере (применить изменения):

```bash
ssh ubuntu@ВАШ_IP_АДРЕС
cd ~/creativity-bot-repo
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose logs -f
```

### ✅ Проверка:

В логах должно быть:
```
[БД] Добавлено поле current_streak в таблицу users
[БД] Добавлено поле best_streak в таблицу users
[БД] Добавлено поле last_completed_date в таблицу users
[БД] Добавлено новых бейджей: 4
[БОТ] Бот запущен и готов к работе
```

Протестируйте в Telegram:
- `/stats` — должна показывать серии
- `/streak` — должна показывать бейджи

### 🆘 Если не работает:

```bash
# Применить миграцию вручную
docker compose exec creativity-bot node scripts/migrate-streaks.js
docker compose restart
docker compose logs -f
```

---

## 📋 Универсальный алгоритм обновления

### Любое обновление кода:

1. **На Mac:**
   ```bash
   git add .
   git commit -m "Описание изменений"
   git push origin main
   ```

2. **На сервере:**
   ```bash
   ssh ubuntu@ВАШ_IP
   cd ~/creativity-bot-repo
   git pull origin main
   docker compose down
   docker compose up -d
   ```

3. **Проверка:**
   ```bash
   docker compose logs -f
   ```

### Обновление с изменением зависимостей (package.json):

```bash
ssh ubuntu@ВАШ_IP
cd ~/creativity-bot-repo
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose logs -f
```

### Обновление с изменением структуры БД:

```bash
ssh ubuntu@ВАШ_IP
cd ~/creativity-bot-repo

# Бэкап перед изменениями
./scripts/backup-db.sh

git pull origin main
docker compose down
docker compose up -d

# Если нужно - применить миграцию вручную
docker compose exec creativity-bot node scripts/migrate-streaks.js
docker compose restart

docker compose logs -f
```

---

## 🔍 Полезные команды

### Просмотр логов:
```bash
docker compose logs -f
docker compose logs --tail=100
```

### Проверка статуса:
```bash
docker compose ps
```

### Перезапуск:
```bash
docker compose restart
```

### Остановка:
```bash
docker compose down
```

### Запуск:
```bash
docker compose up -d
```

### Зайти в контейнер:
```bash
docker compose exec -it creativity-bot sh
```

### Проверка БД:
```bash
docker compose exec creativity-bot sqlite3 /app/database.db "SELECT * FROM users;"
docker compose exec creativity-bot sqlite3 /app/database.db "SELECT * FROM badges;"
```

---

## 📚 Подробности

- [HOW_TO_UPDATE.md](./HOW_TO_UPDATE.md) — полная инструкция
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) — руководство по миграциям
- [DEPLOY.md](./DEPLOY.md) — первоначальный деплой

