# МедАнамнез — Инструкция запуска

## Требования
- Python 3.9+
- pip

## Установка и запуск

```bash
# 1. Перейти в папку проекта
cd medical_app

# 2. Создать виртуальное окружение
python -m venv venv

# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

# 3. Установить зависимости
pip install -r requirements.txt

# 4. Запустить сервер
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Первый запуск — инициализация данных

Откройте браузер и выполните POST-запрос для создания тестовых аккаунтов:

**Вариант 1 — через браузер (Swagger UI):**
```
http://localhost:8000/docs
→ POST /admin/seed → Execute
```

**Вариант 2 — через PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/admin/seed" -Method POST
```

**Вариант 3 — через curl:**
```bash
curl -X POST http://localhost:8000/admin/seed
```

Это создаст:
- Администратор: `admin@clinic.ru` / `admin123`
- Врач: `Иванов Иван Иванович` / `doctor@clinic.ru` / `doctor123`

## Сценарий использования

### Шаг 1 — Войти как администратор
- Открыть `http://localhost:8000/login`
- Email: `admin@clinic.ru`, Пароль: `admin123`

### Шаг 2 — Создать пациента
- В панели администратора создать пациента (ФИО, email, пароль, роль: Пациент)

### Шаг 3 — Создать запись на приём
- Выбрать пациента и врача
- Указать дату и время приёма (сегодня — чтобы врач видел в своём дашборде)

### Шаг 4 — Войти как пациент
- Выйти (`/logout`)
- Войти с данными созданного пациента

### Шаг 5 — Заполнить анамнез
- На дашборде пациента нажать «Заполнить анамнез»
- Пройти все 5 шагов мастера:
  1. Кликнуть по 3D модели тела или выбрать из списка
  2. Выбрать уровень боли слайдером
  3. Отметить симптомы (ИИ предлагает на основе области)
  4. Добавить дополнительную информацию
  5. Подтвердить отправку

### Шаг 6 — Посмотреть данные как врач
- Выйти и войти как `doctor@clinic.ru` / `doctor123`
- Видны все пациенты на сегодня со статусами
- Открыть карту пациента — просмотр анамнеза

## Структура файлов

```
medical_app/
├── main.py           — FastAPI приложение, все маршруты
├── models.py         — SQLAlchemy модели БД
├── database.py       — Настройка БД (SQLite)
├── auth.py           — JWT авторизация
├── ai_agent.py       — ИИ-агент: подбор симптомов
├── requirements.txt  — Зависимости Python
├── templates/
│   ├── base.html              — Базовый шаблон
│   ├── login.html             — Страница входа
│   ├── register.html          — Регистрация пациента
│   ├── patient_dashboard.html — Дашборд пациента
│   ├── anamnesis.html         — Мастер анамнеза (5 шагов)
│   ├── doctor_dashboard.html  — Дашборд врача
│   ├── admin_dashboard.html   — Панель администратора
│   └── patient_detail.html    — Карта пациента (для врача)
└── static/
    ├── css/style.css       — Все стили
    ├── js/body3d.js        — Three.js 3D модель тела
    └── js/anamnesis.js     — Логика мастера анамнеза
```

## API Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| GET | /login | Страница входа |
| POST | /login | Авторизация |
| GET | /register | Регистрация пациента |
| POST | /register | Создание аккаунта |
| GET | /logout | Выход |
| GET | /patient/dashboard | Дашборд пациента |
| GET | /patient/anamnesis/{id} | Страница анамнеза |
| POST | /api/anamnesis/symptoms | Получить симптомы (AI) |
| POST | /api/anamnesis/save | Сохранить анамнез |
| GET | /doctor/dashboard | Дашборд врача |
| GET | /doctor/patient/{id} | Карта пациента |
| GET | /admin/dashboard | Панель администратора |
| POST | /admin/create-user | Создать пользователя |
| POST | /admin/create-appointment | Создать запись на приём |
| POST | /admin/seed | Инициализировать тестовые данные |
| GET | /docs | Swagger UI (документация API) |
