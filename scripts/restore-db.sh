#!/bin/bash

# Скрипт восстановления базы данных на сервер
# Использование: ./scripts/restore-db.sh <server-ip> <backup-file>

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка аргументов
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}❌ Укажите IP сервера и файл бэкапа${NC}"
    echo "Использование: $0 <server-ip> <backup-file>"
    echo "Пример: $0 51.250.12.34 backups/database_20231215_120000.db"
    echo ""
    echo "Доступные бэкапы:"
    ls -lh backups/ 2>/dev/null || echo "  (директория backups пуста)"
    exit 1
fi

SERVER_IP=$1
BACKUP_FILE=$2

# Проверка существования файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Файл $BACKUP_FILE не найден${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  ВНИМАНИЕ: Текущая база данных на сервере будет заменена!${NC}"
echo "Сервер: $SERVER_IP"
echo "Бэкап: $BACKUP_FILE"
echo ""
read -p "Продолжить? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Отменено"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 Восстановление базы данных...${NC}"

# Остановка бота
echo "⏸️  Остановка бота на сервере..."
ssh yc-user@$SERVER_IP "cd ~/creativity-bot && docker-compose down" || true

# Загрузка бэкапа на сервер
echo "📤 Загрузка бэкапа на сервер..."
scp "$BACKUP_FILE" yc-user@$SERVER_IP:/tmp/database_restore.db

# Замена базы данных
echo "♻️  Замена базы данных..."
ssh yc-user@$SERVER_IP "mkdir -p ~/creativity-bot/data && mv /tmp/database_restore.db ~/creativity-bot/data/database.db"

# Запуск бота
echo "▶️  Запуск бота..."
ssh yc-user@$SERVER_IP "cd ~/creativity-bot && docker-compose up -d"

# Проверка логов
echo "📋 Проверка логов (Ctrl+C для выхода)..."
sleep 2
ssh yc-user@$SERVER_IP "cd ~/creativity-bot && docker-compose logs -f" || true

echo ""
echo -e "${GREEN}✅ База данных восстановлена успешно!${NC}"
