# Быстрый старт: Деплой в Яндекс Облако

Краткая инструкция для быстрого развёртывания бота на виртуальной машине Яндекс Облака.

## Предварительные требования

- Аккаунт в [Яндекс Облаке](https://cloud.yandex.ru)
- Токен Telegram-бота от [@BotFather](https://t.me/BotFather)
- SSH ключ (создайте: `ssh-keygen -t rsa -b 4096`)

---

## Шаг 1: Установка Яндекс CLI

```bash
# macOS/Linux
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash

# Перезапустите терминал
exec -l $SHELL

# Инициализация
yc init
```

Следуйте инструкциям и выберите каталог (folder).

---

## Шаг 2: Создание виртуальной машины

```bash
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

Дождитесь создания VM (1-2 минуты).

---

## Шаг 3: Получение IP и подключение

```bash
# Получить внешний IP
yc compute instance get creativity-bot | grep "address:"

# Подключиться по SSH (замените IP)
ssh yc-user@<ВНЕШНИЙ_IP>
```

---

## Шаг 4: Установка Docker на сервере

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление в группу
sudo usermod -aG docker $USER
newgrp docker

# Установка Docker Compose
sudo apt install docker-compose -y

# Включение автозапуска
sudo systemctl enable docker
```

---

## Шаг 5: Загрузка проекта

### Вариант A: Через Git (если проект в репозитории)

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd creativity-bot
```

### Вариант B: Загрузка с компьютера

**На вашем компьютере:**

```bash
cd "/Users/kudinow/Yandex.Disk.localized/Cursor/Бот для развитие креативности/projects/creativity-bot"

# Создайте архив (исключая ненужное)
tar -czf creativity-bot.tar.gz \
  --exclude=node_modules \
  --exclude=database.db \
  --exclude=.env \
  --exclude=.git \
  .

# Загрузите на сервер (замените IP)
scp creativity-bot.tar.gz yc-user@<ВНЕШНИЙ_IP>:~/
```

**На сервере:**

```bash
# Распаковка
mkdir -p ~/creativity-bot
tar -xzf creativity-bot.tar.gz -C ~/creativity-bot
cd ~/creativity-bot
```

---

## Шаг 6: Настройка окружения

```bash
# Создание .env файла
nano .env
```

**Добавьте:**

```env
BOT_TOKEN=ваш_реальный_токен_от_BotFather
TIMEZONE=Europe/Moscow
```

**Сохраните:** Ctrl+O, Enter, Ctrl+X

---

## Шаг 7: Запуск бота

```bash
# Запуск
docker-compose up -d

# Проверка логов
docker-compose logs -f
```

**Если всё работает, увидите:**
```
[БОТ] Инициализация...
[БД] Таблицы успешно созданы
[БД] Загружено X вопросов
[Планировщик] Задачи настроены
[БОТ] Бот запущен и готов к работе
```

Нажмите Ctrl+C для выхода из логов (бот продолжит работать).

---

## Шаг 8: Тестирование

1. Откройте Telegram
2. Найдите вашего бота
3. Отправьте `/start`
4. Проверьте, что бот отвечает

---

## Управление ботом

### Просмотр логов
```bash
docker-compose logs -f
```

### Перезапуск
```bash
docker-compose restart
```

### Остановка
```bash
docker-compose down
```

### Статус
```bash
docker-compose ps
```

### Обновление кода

```bash
# Если через Git
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Если вручную - загрузите новые файлы через scp и:
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Резервное копирование

```bash
# Скачать базу данных на локальный компьютер
scp yc-user@<IP>:~/creativity-bot/data/database.db ./backup-$(date +%Y%m%d).db
```

---

## Полезные команды

```bash
# Использование ресурсов
docker stats creativity-bot

# Место на диске
df -h

# Очистка неиспользуемых образов
docker system prune -a
```

---

## Проблемы?

### Бот не запускается

```bash
# Проверьте логи
docker-compose logs

# Проверьте .env файл
cat .env

# Проверьте статус
docker-compose ps
```

### База не сохраняется

```bash
# Проверьте volume
docker inspect creativity-bot | grep -A 10 Mounts

# Проверьте права
ls -la ~/creativity-bot/data
```

### Порты заняты или другие проблемы

```bash
# Полная остановка и очистка
docker-compose down -v
docker system prune -f
docker-compose up -d
```

---

## Стоимость

Минимальная конфигурация (1 GB RAM, 2 vCPU 20%, 10 GB диск):
- **~300-500₽/месяц**

Первый пробный период может быть бесплатным (проверьте условия Яндекс Облака).

---

## Что дальше?

✅ Бот работает 24/7  
✅ Автоматический перезапуск при сбоях  
✅ Данные сохраняются между перезапусками  

**Рекомендации:**
- Настройте регулярное резервное копирование
- Мониторьте логи раз в неделю
- Обновляйте систему: `sudo apt update && sudo apt upgrade -y`

Подробная документация: [DEPLOY.md](./DEPLOY.md)
