import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import Inquiry from './models/Inquiry.js';
import Newsletter from './models/Newsletter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL || 'theobligue@gmail.com';
const INSTAGRAM_URL = process.env.INSTAGRAM_URL || 'https://www.instagram.com/theobligue/';
const WHATSAPP_LINK = process.env.WHATSAPP_LINK || 'https://wa.me/917717453630';

app.use(cors());
app.use(express.json());

// Nodemailer Transporter Setup
const transporter = (SMTP_EMAIL && SMTP_PASS)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASS
      }
    })
  : null;

// Verify email configuration on startup
if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.warn('⚠️ Nodemailer Transporter verification warning:', error.message);
    } else {
      console.log(`📬 Nodemailer ready to dispatch emails via Gmail SMTP (${SMTP_EMAIL})`);
    }
  });
} else {
  console.log('ℹ️ Nodemailer: SMTP_EMAIL or SMTP_PASS not set in environment.');
}

// MongoDB Connection
let isMongoConnected = false;
const inMemoryInquiries = [];
const inMemoryNewsletters = [];

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    isMongoConnected = true;
    console.log('✅ MongoDB connected successfully to database');
  })
  .catch((err) => {
    isMongoConnected = false;
    console.error('❌ MongoDB Atlas connection error:', err.message);
    console.log('ℹ️ Running with in-memory storage fallback until reconnects.');
  });
} else {
  console.log('ℹ️ MONGO_URI not configured in environment variables. Running with in-memory storage fallback.');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agency: 'the oblique',
    database: isMongoConnected ? 'MongoDB Atlas (Connected)' : 'In-Memory Fallback Active',
    mailer: 'Nodemailer Gmail Active',
    timestamp: new Date().toISOString()
  });
});

// Helper function to send notification to Admin
async function sendAdminNotification(inquiry) {
  if (!transporter) {
    console.warn('⚠️ Nodemailer transporter not configured.');
    return;
  }
  const mailOptions = {
    from: `"the oblique Studio" <${SMTP_EMAIL}>`,
    to: ADMIN_EMAIL,
    replyTo: inquiry.email,
    subject: `⚡ New Project Inquiry: ${inquiry.name} (${inquiry.company || 'Direct Client'})`,
    text: `New Project Inquiry from the oblique Contact Form:

Client Name: ${inquiry.name}
Email: ${inquiry.email}
Phone: ${inquiry.phone || 'Not provided'}
Company: ${inquiry.company || 'Not provided'}
Subject: ${inquiry.subject || 'General Inquiry'}

Project Message:
${inquiry.message}

---
Received at: ${new Date().toLocaleString()}
Reply directly to: ${inquiry.email}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #0f172a; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">the oblique</h1>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">New Client Project Brief</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; width: 110px; border-bottom: 1px solid #f1f5f9;">Name</td>
              <td style="padding: 10px 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${inquiry.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; border-bottom: 1px solid #f1f5f9;">Email</td>
              <td style="padding: 10px 14px; color: #2563eb; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${inquiry.email}" style="color: #2563eb; text-decoration: none;">${inquiry.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; border-bottom: 1px solid #f1f5f9;">Phone</td>
              <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${inquiry.phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; border-bottom: 1px solid #f1f5f9;">Company</td>
              <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${inquiry.company || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; border-bottom: 1px solid #f1f5f9;">Subject</td>
              <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${inquiry.subject || 'General Inquiry'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 700; color: #64748b; vertical-align: top;">Message</td>
              <td style="padding: 10px 14px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${inquiry.message}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="mailto:${inquiry.email}?subject=Re:%20${encodeURIComponent(inquiry.subject || 'Project Inquiry')} - the oblique" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Reply to ${inquiry.name} ↗
            </a>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Helper function to send Auto-Reply to Client (Optimized for Primary Inbox Delivery)
async function sendClientAutoReply(inquiry) {
  if (!transporter) {
    console.warn('⚠️ Nodemailer transporter not configured.');
    return;
  }

  const subjectTopic = inquiry.subject ? inquiry.subject.trim() : 'Project Inquiry';
  const mailSubject = `Re: ${subjectTopic} — the oblique`;

  const plainText = `Hi ${inquiry.name},

Thank you for reaching out to the oblique. We have successfully received your project inquiry.

Our senior team personally reviews every brief and will get back to you within 24 hours.

Summary of your message:
Subject: ${subjectTopic}
"${inquiry.message}"

Need an urgent response or want to send a quick voice note?
- WhatsApp: ${WHATSAPP_LINK}
- Instagram: ${INSTAGRAM_URL}
- Direct Email: ${SMTP_EMAIL}

Warm regards,
The Team at the oblique
Ludhiana, Punjab
https://theoblique.agency`;

  const mailOptions = {
    from: `"the oblique" <${SMTP_EMAIL}>`,
    to: inquiry.email,
    replyTo: SMTP_EMAIL,
    subject: mailSubject,
    text: plainText,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #222222; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;">
        <p style="font-size: 18px; font-weight: bold; margin-top: 0; color: #111111;">the oblique</p>
        
        <p>Hi ${inquiry.name},</p>
        
        <p>Thank you for reaching out to <strong>the oblique</strong>. We have successfully received your project inquiry.</p>
        
        <p>Our founding team is reviewing your requirements and will connect with you within <strong>24 hours</strong> with initial recommendations.</p>
        
        <div style="margin: 20px 0; padding: 14px 16px; background: #f8f9fa; border-left: 3px solid #2563eb; font-size: 14px; color: #333333; border-radius: 4px;">
          <strong>Subject:</strong> ${subjectTopic}<br>
          <span style="color: #666666; font-size: 13px;">"${inquiry.message}"</span>
        </div>
        
        <p>If you have any immediate questions or would like to send a quick note, feel free to reply directly to this email or reach us on WhatsApp at <a href="${WHATSAPP_LINK}" style="color: #2563eb; text-decoration: none; font-weight: 600;">+91 77174 53630</a>.</p>
        
        <p style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eeeeee; color: #555555; font-size: 14px;">
          Warm regards,<br>
          <strong style="color: #111111;">The Team at the oblique</strong><br>
          <span style="font-size: 13px; color: #777777;">Ludhiana, Punjab · <a href="${INSTAGRAM_URL}" style="color: #2563eb; text-decoration: none;">@theobligue</a> · <a href="mailto:${SMTP_EMAIL}" style="color: #2563eb; text-decoration: none;">${SMTP_EMAIL}</a></span>
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Create new project inquiry (Contact Form)
app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, company, phone, subject, services, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and project message are required.' });
    }

    let savedInquiry;

    if (isMongoConnected) {
      savedInquiry = await Inquiry.create({
        name,
        email,
        company: company || '',
        phone: phone || '',
        subject: subject || '',
        services: services || [],
        message
      });
      console.log(`💾 Saved inquiry to MongoDB Atlas for ${email}`);
    } else {
      savedInquiry = {
        _id: `inq_${Date.now()}`,
        name,
        email,
        company: company || '',
        phone: phone || '',
        subject: subject || '',
        services: services || [],
        message,
        createdAt: new Date()
      };
      inMemoryInquiries.push(savedInquiry);
      console.log(`ℹ️ Saved inquiry to in-memory fallback for ${email}`);
    }

    // Trigger dual email dispatch asynchronously
    let adminEmailStatus = 'pending';
    let clientEmailStatus = 'pending';

    try {
      await sendAdminNotification(savedInquiry);
      adminEmailStatus = 'sent';
      console.log(`✅ Admin notification email sent to ${ADMIN_EMAIL}`);
    } catch (adminErr) {
      adminEmailStatus = 'failed';
      console.error('❌ Failed to send admin notification email:', adminErr.message);
    }

    try {
      await sendClientAutoReply(savedInquiry);
      clientEmailStatus = 'sent';
      console.log(`✅ Auto-reply email sent to client ${email}`);
    } catch (clientErr) {
      clientEmailStatus = 'failed';
      console.error('❌ Failed to send client auto-reply email:', clientErr.message);
    }

    return res.status(201).json({
      success: true,
      inquiry: savedInquiry,
      emailNotifications: {
        admin: adminEmailStatus,
        client: clientEmailStatus
      }
    });

  } catch (err) {
    console.error('Error creating inquiry:', err);
    res.status(500).json({ error: 'Server error saving inquiry.' });
  }
});

// Get all inquiries
app.get('/api/inquiries', async (req, res) => {
  try {
    if (isMongoConnected) {
      const list = await Inquiry.find().sort({ createdAt: -1 });
      return res.json({ success: true, count: list.length, inquiries: list });
    } else {
      return res.json({ success: true, count: inMemoryInquiries.length, inquiries: inMemoryInquiries });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// Subscribe to newsletter
app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    if (isMongoConnected) {
      const existing = await Newsletter.findOne({ email });
      if (existing) {
        return res.json({ success: true, message: 'Already subscribed.' });
      }
      const sub = await Newsletter.create({ email });
      return res.status(201).json({ success: true, sub });
    } else {
      if (!inMemoryNewsletters.includes(email)) {
        inMemoryNewsletters.push(email);
      }
      return res.status(201).json({ success: true, email });
    }
  } catch (err) {
    console.error('Error subscribing:', err);
    res.status(500).json({ error: 'Server error subscribing to newsletter.' });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 the oblique Express Server running on http://localhost:${PORT}`);
  });
}

export default app;
