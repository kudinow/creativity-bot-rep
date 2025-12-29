# Инструкция по развёртыванию бота в Яндекс Облаке

Эта инструкция поможет развернуть Telegram-бот в Яндекс Облаке, чтобы он работал круглосуточно независимо от вашего компьютера.

## Содержание

1. [Подготовка](#подготовка)
2. [Вариант 1: Яндекс Compute Cloud (виртуальная машина)](#вариант-1-яндекс-compute-cloud)
3. [Вариант 2: Яндекс Container Registry + Cloud Run](#вариант-2-container-registry)
4. [Локальное тестирование Docker](#локальное-тестирование)
5. [Обслуживание и мониторинг](#обслуживание)

---

## Подготовка

### 1. Регистрация в Яндекс Облаке

1. Перейдите на [cloud.yandex.ru](https://cloud.yandex.ru)
2. Войдите или зарегистрируйтесь
3. Создайте новый каталог (folder) или используйте существующий
4. Активируйте пробный период (если доступен) или привяжите платёжный аккаунт

### 2. Установка Яндекс CLI (yc)

**macOS:**
```bash
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
```

**Linux:**
```bash
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
```

**После установки:**
```bash
# Перезапустите терминал или выполните
exec -l $SHELL

# Инициализируйте CLI
yc init
```

### 3. Подготовка Docker образа

Убедитесь, что у вас установлен Docker:
```bash
docker --version
```

Если не установлен, скачайте с [docker.com](https://www.docker.com/get-started)

---

## Вариант 1: Яндекс Compute Cloud

Самый простой способ — развернуть бот на виртуальной машине.

### Шаг 1: Создание виртуальной машины

```bash
# Создаём виртуальную машину
yc compute instance create \
  --name creativity-bot \
  --zone ru-central1-a \
  --network-interface subnet-name=default-ru-central1-a,nat-ip-version=ipv4 \
  --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=10 \
  --memory 1 \
  --cores 2 \
  --core-fraction 20 \
  --ssh-key ~/.ssh/id_rsa.pub
```

**Примечание:** Если у вас нет SSH ключа, создайте его:
```bash
ssh-keygen -t rsa -b 4096
```

### Шаг 2: Подключение к виртуальной машине

```bash
# Узнайте внешний IP адрес
yc compute instance get creativity-bot

# Подключитесь по SSH (замените IP на ваш)
ssh yc-user@<ВНЕШНИЙ_IP>
```

### Шаг 3: Установка Docker на виртуальной машине

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перелогиньтесь или выполните
newgrp docker

# Установка Docker Compose
sudo apt install docker-compose -y
```

### Шаг 4: Загрузка проекта на сервер

**Вариант A: Через Git (рекомендуется)**

```bash
# На сервере
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ>
cd creativity-bot
```

**Вариант B: Через SCP с локального компьютера**

```bash
# С вашего компьютера
cd /Users/kudinow/Yandex.Disk.localized/Cursor/Бот\ для\ развитие\ креативности/projects/creativity-bot
scp -r . yc-user@<ВНЕШНИЙ_IP>:~/creativity-bot/
```

### Шаг 5: Настройка окружения

```bash
# На сервере
cd ~/creativity-bot

# Создайте .env файл
nano .env
```

Добавьте ваши переменные:
```env
BOT_TOKEN=ваш_токен_от_BotFather
TIMEZONE=Europe/Moscow
ADMIN_IDS=ваш_telegram_id

# Веб-панель статистики (опционально)
ENABLE_DASHBOARD=true
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=ваш_надёжный_пароль
```

**💡 Совет:** Для настройки веб-панели статистики см. [DASHBOARD_DEPLOY.md](./DASHBOARD_DEPLOY.md)

Сохраните (Ctrl+O, Enter, Ctrl+X)

### Шаг 6: Запуск бота

```bash
# Сборка и запуск через Docker Compose
docker-compose up -d

# Проверка логов
docker-compose logs -f

# Проверка статуса
docker-compose ps
```

**📊 Веб-панель статистики**

Если вы включили веб-панель (`ENABLE_DASHBOARD=true`), она будет доступна по адресу:

```
http://ВАШ_IP_АДРЕС:3000
```

Для безопасного доступа с SSL и доменом следуйте инструкции в [DASHBOARD_DEPLOY.md](./DASHBOARD_DEPLOY.md).

### Шаг 7: Настройка автозапуска

Docker Compose уже настроен на автоматический перезапуск (`restart: unless-stopped`), но убедимся, что Docker запускается при загрузке системы:

```bash
sudo systemctl enable docker
```

---

## Вариант 2: Container Registry

Более продвинутый вариант с использованием Container Registry и автоматическим деплоем.

### Шаг 1: Создание Container Registry

```bash
# Создаём реестр
yc container registry create --name creativity-bot-registry

# Получаем ID реестра
yc container registry list

# Настраиваем аутентификацию Docker
yc container registry configure-docker
```

### Шаг 2: Сборка и публикация образа

```bash
# На вашем компьютере
cd /Users/kudinow/Yandex.Disk.localized/Cursor/Бот\ для\ развитие\ креативности/projects/creativity-bot

# Получите ID реестра
REGISTRY_ID=$(yc container registry list --format json | jq -r '.[0].id')

# Соберите образ
docker build -t cr.yandex/$REGISTRY_ID/creativity-bot:latest .

# Отправьте в реестр
docker push cr.yandex/$REGISTRY_ID/creativity-bot:latest
```

### Шаг 3: Создание виртуальной машины с образом

```bash
yc compute instance create-with-container \
  --name creativity-bot \
  --zone ru-central1-a \
  --network-interface subnet-name=default-ru-central1-a,nat-ip-version=ipv4 \
  --create-boot-disk size=10 \
  --memory 1 \
  --cores 2 \
  --core-fraction 20 \
  --container-image cr.yandex/$REGISTRY_ID/creativity-bot:latest \
  --container-env BOT_TOKEN=ваш_токен,TIMEZONE=Europe/Moscow \
  --container-restart-policy always
```

---

## Локальное тестирование

Перед деплоем протестируйте Docker локально:

```bash
# Сборка образа
docker build -t creativity-bot .

# Запуск через Docker Compose
docker-compose up

# Или запуск напрямую
docker run -d \
  --name creativity-bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  creativity-bot
```

Проверьте логи:
```bash
docker logs -f creativity-bot
```

Остановка:
```bash
docker-compose down
# или
docker stop creativity-bot && docker rm creativity-bot
```

---

## Обслуживание

### Просмотр логов

```bash
# Docker Compose
docker-compose logs -f

# Обычный Docker
docker logs -f creativity-bot

# На сервере через systemd (если настроен)
journalctl -u docker-creativity-bot -f
```

### Обновление бота

**Если используете Git:**
```bash
ssh yc-user@<IP>
cd ~/creativity-bot
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Если загружаете файлы вручную:**
```bash
# С локального компьютера
scp -r . yc-user@<IP>:~/creativity-bot/

# На сервере
ssh yc-user@<IP>
cd ~/creativity-bot
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Резервное копирование базы данных

```bash
# Создание бэкапа
docker cp creativity-bot:/app/data/database.db ./backup-$(date +%Y%m%d).db

# Или если используется volume
docker run --rm \
  -v creativity-bot_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data
```

### Восстановление из бэкапа

```bash
# Копирование в контейнер
docker cp backup-20231215.db creativity-bot:/app/data/database.db

# Перезапуск
docker-compose restart
```

### Мониторинг ресурсов

```bash
# Использование ресурсов
docker stats creativity-bot

# Информация о контейнере
docker inspect creativity-bot
```

### Остановка и удаление

```bash
# Остановка
docker-compose down

# Полное удаление (включая volumes)
docker-compose down -v

# Удаление виртуальной машины в Яндекс Облаке
yc compute instance delete creativity-bot
```

---

## Безопасность

### Рекомендации

1. **Не храните токен в коде** — используйте переменные окружения
2. **Ограничьте доступ к SSH** — настройте firewall:
   ```bash
   # Только SSH с вашего IP
   yc vpc security-group create \
     --name creativity-bot-sg \
     --rule "direction=ingress,port=22,protocol=tcp,v4-cidrs=[ВАШ_IP/32]"
   ```
3. **Защитите веб-панель:**
   - Используйте сложный пароль в `DASHBOARD_PASSWORD`
   - Настройте SSL через Nginx (см. [DASHBOARD_DEPLOY.md](./DASHBOARD_DEPLOY.md))
   - Ограничьте доступ по IP, если возможно
4. **Регулярно обновляйте систему:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
5. **Настройте автоматические обновления безопасности:**
   ```bash
   sudo apt install unattended-upgrades -y
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

---

## Стоимость

### Примерный расчёт для минимальной конфигурации:

- **Compute Cloud:** ~300-500₽/месяц (VM с 1GB RAM, 2 vCPU 20%)
- **Container Registry:** Бесплатно до 10 GB
- **Сетевой трафик:** Первые 100 GB/месяц бесплатно

**Итого:** ~300-500₽/месяц

---

## Устранение проблем

### Бот не запускается

```bash
# Проверьте логи
docker-compose logs

# Проверьте переменные окружения
docker exec creativity-bot env

# Проверьте статус контейнера
docker ps -a
```

### База данных не сохраняется

Убедитесь, что volume правильно смонтирован:
```bash
docker inspect creativity-bot | grep -A 10 Mounts
```

### Бот падает при запуске

Проверьте права доступа к директории данных:
```bash
docker exec creativity-bot ls -la /app/data
```

### Проблемы с polling

Убедитесь, что токен корректный и бот не запущен в другом месте (только одна активная сессия polling).

---

## Полезные команды

```bash
# Перезапуск бота
docker-compose restart

# Пересборка образа
docker-compose build --no-cache

# Очистка неиспользуемых образов
docker system prune -a

# Экспорт логов
docker-compose logs > bot-logs.txt

# Проверка использования диска
docker system df
```

---

## Дополнительная информация

### Связанные документы

- [DASHBOARD_DEPLOY.md](./DASHBOARD_DEPLOY.md) — настройка веб-панели статистики на сервере
- [DASHBOARD.md](./DASHBOARD.md) — описание возможностей веб-панели
- [ADMIN_COMMANDS.md](./ADMIN_COMMANDS.md) — административные команды
- [README.md](./README.md) — основная документация

### Внешние ресурсы

- [Документация Яндекс Облака](https://cloud.yandex.ru/docs)
- [Docker документация](https://docs.docker.com)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)

Если возникнут вопросы, проверьте логи и убедитесь, что все переменные окружения настроены правильно.
