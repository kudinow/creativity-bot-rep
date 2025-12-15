#!/bin/bash

# Скрипт подготовки проекта для деплоя
# Использование: ./scripts/deploy-prepare.sh

set -e

echo "🚀 Подготовка проекта для деплоя..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка наличия .env файла
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    echo -e "${YELLOW}Создайте .env файл на основе env.example:${NC}"
    echo "cp env.example .env"
    exit 1
fi

# Проверка токена в .env
if ! grep -q "BOT_TOKEN=" .env || grep -q "BOT_TOKEN=your_bot_token_here" .env; then
    echo -e "${RED}❌ Токен бота не настроен в .env файле!${NC}"
    echo -e "${YELLOW}Откройте .env и добавьте реальный токен от @BotFather${NC}"
    exit 1
fi

echo "✅ Проверка .env файла пройдена"

# Создание директории для деплоя
DEPLOY_DIR="deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

echo "📦 Копирование файлов..."

# Копирование необходимых файлов
cp -r data "$DEPLOY_DIR/"
cp index.js "$DEPLOY_DIR/"
cp database.js "$DEPLOY_DIR/"
cp scheduler.js "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp Dockerfile "$DEPLOY_DIR/"
cp docker-compose.yml "$DEPLOY_DIR/"
cp .dockerignore "$DEPLOY_DIR/"
cp env.example "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/"
cp DEPLOY.md "$DEPLOY_DIR/"
cp QUICKSTART.md "$DEPLOY_DIR/"

# НЕ копируем .env (будет создан на сервере)
# НЕ копируем node_modules (будет установлен на сервере)
# НЕ копируем database.db (будет создан на сервере)

echo "📝 Создание .env.example для сервера..."
cat > "$DEPLOY_DIR/.env.server" << 'EOF'
# Переменные окружения для production сервера
# Скопируйте этот файл в .env и заполните реальными значениями

# Токен вашего Telegram бота (получить у @BotFather)
BOT_TOKEN=your_bot_token_here

# Часовой пояс (для правильного времени отправки вопросов)
TIMEZONE=Europe/Moscow

# Путь к базе данных (для Docker оставьте как есть)
DB_PATH=/app/data/database.db
EOF

echo "🗜️  Создание архива..."
cd "$DEPLOY_DIR"
tar -czf ../creativity-bot-deploy.tar.gz .
cd ..

echo "🧹 Очистка временных файлов..."
rm -rf "$DEPLOY_DIR"

echo ""
echo -e "${GREEN}✅ Проект готов к деплою!${NC}"
echo ""
echo "📦 Файл: creativity-bot-deploy.tar.gz"
echo "📏 Размер: $(du -h creativity-bot-deploy.tar.gz | cut -f1)"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "1. Загрузите архив на сервер:"
echo "   scp creativity-bot-deploy.tar.gz yc-user@<IP>:~/"
echo ""
echo "2. На сервере распакуйте:"
echo "   mkdir -p ~/creativity-bot"
echo "   tar -xzf creativity-bot-deploy.tar.gz -C ~/creativity-bot"
echo "   cd ~/creativity-bot"
echo ""
echo "3. Создайте .env файл:"
echo "   cp .env.server .env"
echo "   nano .env"
echo "   (добавьте реальный токен)"
echo ""
echo "4. Запустите:"
echo "   docker-compose up -d"
echo ""
echo "Подробная инструкция: QUICKSTART.md"
