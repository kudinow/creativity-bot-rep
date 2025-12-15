# Используем официальный образ Node.js 20 на базе Alpine (легковесный)
FROM node:20-alpine

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Устанавливаем необходимые системные зависимости для better-sqlite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем все файлы проекта
COPY . .

# Создаём директорию для базы данных с правами на запись
RUN mkdir -p /app/data && chmod 777 /app/data

# Указываем переменные окружения (будут переопределены через .env или docker-compose)
ENV NODE_ENV=production
ENV DB_PATH=/app/data/database.db

# Команда запуска бота
CMD ["node", "index.js"]
