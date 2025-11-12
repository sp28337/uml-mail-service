import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

const app = express();

// Middleware — предварительная обработка запросов
app.use(express.json()); // Разбирает JSON из body запроса
app.use(cors()); // Разрешает запросы с других портов (фронтенд)


app.use(cors({
  origin: [
    process.env.CORS_FRONTEND_URL!, 
    process.env.CORS_LOCALHOST_FRONTEND_URL!
  ],
  credentials: true
}));


// Настройка почтового транспорта
// Это конфигурация для подключения к SMTP серверу Gmail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, // Использует SSL/TLS для безопасности
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Тестируем подключение при запуске сервера
transporter.verify((error, success) => {
  if (success) {
    console.log('✅ SMTP сервер готов к отправке писем');    
  } else {
    console.error('❌ Ошибка подключения SMTP:', error);
  }
});

// API маршрут для обработки данных формы
// Когда фронтенд отправляет POST запрос на /api/contact, этот код выполняется
app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    // Получаем данные из body запроса
    const { name, phone, email, subject, message } = req.body;

    // Валидация — проверяем, что все обязательные поля заполнены
    if (!name || !phone || !subject || !message) {
      return res.status(400).json({ 
        error: 'Заполните все обязательные поля (Имя, Телефон, Тема, Сообщение)' 
      });
    }

    // Проверяем корректность email, если он указан
    if (email && !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Некорректный email адрес' 
      });
    }

    console.log('📨 Получена новая заявка:', { name, phone, email, subject });

    // ОТПРАВЛЯЕМ ПИСЬМО АДМИНИСТРАТОРУ
    await transporter.sendMail({
      from: process.env.EMAIL_USER, // От кого отправляем (наша почта)
      to: process.env.ADMIN_EMAIL, // Кому отправляем (корпоративная почта)
      subject: `🔔 Новая заявка: ${subject}`, // Тема письма
      // html — HTML разметка письма
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #164e3b; border-bottom: 2px solid #164e3b; padding-bottom: 10px;">
            📌 Новая заявка от клиента
          </h2>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong style="color: #164e3b;">Имя:</strong> ${name}</p>
            <p><strong style="color: #164e3b;">Телефон:</strong> <a href="tel:${phone}">${phone}</a></p>
            <p><strong style="color: #164e3b;">Email:</strong> <a href="mailto:${email}">${email || 'не указан'}</a></p>
            <p><strong style="color: #164e3b;">Тема:</strong> ${subject}</p>
          </div>
          
          <h3 style="color: #164e3b;">Сообщение клиента:</h3>
          <div style="background-color: #fff; padding: 15px; border-left: 4px solid #164e3b;">
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Это письмо отправлено автоматически из контактной формы сайта
          </p>
        </div>
      `
    });

    console.log('✅ Письмо администратору отправлено успешно');

    // ОТПРАВЛЯЕМ ПОДТВЕРЖДЕНИЕ КЛИЕНТУ (опционально)
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email, // Отправляем клиенту его же email
        subject: 'Мы получили вашу заявку', // Тема письма
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #164e3b;">Спасибо за вашу заявку, ${name}!</h2>
            
            <p>Мы получили вашу заявку и уже её рассматриваем.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Тема:</strong> ${subject}</p>
              <p><strong>Статус:</strong> ⏳ В обработке</p>
              <p><strong>Время обработки:</strong> 1-24 часа</p>
            </div>
            
            <p>Мы свяжемся с вами по номеру <strong>${phone}</strong> в ближайшее время.</p>
            
            <p style="color: #999;">С уважением,<br>Союз военных юристов</p>
          </div>
        `
      });

      console.log('✅ Подтверждение отправлено клиенту');
    }

    // Отправляем успешный ответ фронтенду
    res.status(200).json({ 
      success: true, 
      message: 'Заявка успешно отправлена!' 
    });

  } catch (error) {
    console.error('❌ Ошибка при обработке заявки:', error);
    res.status(500).json({ 
      error: 'Ошибка при отправке заявки. Попробуйте позже.' 
    });
  }
});

// Простой маршрут для проверки, работает ли сервер
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'Server is running ✅' });
});

// Запускаем сервер
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`
  🚀 Сервер запущен на http://localhost:${PORT}
  📧 Готов обрабатывать заявки и отправлять письма
  `);
});