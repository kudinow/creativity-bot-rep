#!/bin/bash

# Скрипт резервного копирования базы данных с сервера
# Использование: ./scripts/backup-db.sh <server-ip>

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка аргументов
if [ -z "$1" ]; then
    echo -e "${RED}❌ Укажите IP адрес сервера${NC}"
    echo "Использование: $0 <server-ip>"
    echo "Пример: $0 51.250.12.34"
    exit 1
fi

SERVER_IP=$1
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="database_${DATE}.db"

echo -e "${YELLOW}🔄 Создание резервной копии базы данных...${NC}"

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

# Скачивание базы данных с сервера
echo "📥 Скачивание с сервера $SERVER_IP..."

# Пробуем разные возможные пути
if ssh yc-user@$SERVER_IP "[ -f ~/creativity-bot/data/database.db ]"; then
    scp yc-user@$SERVER_IP:~/creativity-bot/data/database.db "$BACKUP_DIR/$BACKUP_FILE"
elif ssh yc-user@$SERVER_IP "docker exec creativity-bot test -f /app/data/database.db" 2>/dev/null; then
    # Если база внутри контейнера
    echo "📦 База находится в контейнере, извлекаем..."
    ssh yc-user@$SERVER_IP "docker cp creativity-bot:/app/data/database.db /tmp/database.db"
    scp yc-user@$SERVER_IP:/tmp/database.db "$BACKUP_DIR/$BACKUP_FILE"
    ssh yc-user@$SERVER_IP "rm /tmp/database.db"
else
    echo -e "${RED}❌ База данных не найдена на сервере${NC}"
    exit 1
fi

# Проверка успешности
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo ""
    echo -e "${GREEN}✅ Резервная копия создана успешно!${NC}"
    echo "📁 Файл: $BACKUP_DIR/$BACKUP_FILE"
    echo "📏 Размер: $SIZE"
    echo ""
    
    # Показываем список всех бэкапов
    echo "📋 Все резервные копии:"
    ls -lh "$BACKUP_DIR"
    
    # Удаление старых бэкапов (оставляем последние 10)
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR" | wc -l)
    if [ $BACKUP_COUNT -gt 10 ]; then
        echo ""
        echo -e "${YELLOW}🧹 Удаление старых бэкапов (оставляем последние 10)...${NC}"
        cd "$BACKUP_DIR"
        ls -t | tail -n +11 | xargs rm -f
        cd ..
    fi
else
    echo -e "${RED}❌ Ошибка при создании резервной копии${NC}"
    exit 1
fi
