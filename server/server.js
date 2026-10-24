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
    from: `"the oblique Alerts" <${SMTP_EMAIL}>`,
    to: ADMIN_EMAIL,
    replyTo: inquiry.email,
    subject: `⚡ New Client Inquiry: ${inquiry.name} (${inquiry.company || 'Direct Client'})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0c0e14; color: #f1f5f9; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #FF5E62 0%, #8B5CF6 100%); padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">the oblique</h1>
          <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">⚡ New Project Inquiry Received</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="font-size: 15px; color: #cbd5e1; margin-top: 0;">You have received a new project submission through the contact form:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #151923; border-radius: 10px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; width: 120px; border-bottom: 1px solid #1e293b;">Name</td>
              <td style="padding: 12px 16px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #1e293b;">${inquiry.name}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid #1e293b;">Email</td>
              <td style="padding: 12px 16px; color: #38bdf8; border-bottom: 1px solid #1e293b;"><a href="mailto:${inquiry.email}" style="color: #38bdf8; text-decoration: none;">${inquiry.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid #1e293b;">Phone</td>
              <td style="padding: 12px 16px; color: #ffffff; border-bottom: 1px solid #1e293b;">${inquiry.phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid #1e293b;">Company</td>
              <td style="padding: 12px 16px; color: #ffffff; border-bottom: 1px solid #1e293b;">${inquiry.company || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid #1e293b;">Subject</td>
              <td style="padding: 12px 16px; color: #ffffff; border-bottom: 1px solid #1e293b;">${inquiry.subject || 'General Inquiry'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: 700; color: #94a3b8; vertical-align: top;">Message</td>
              <td style="padding: 12px 16px; color: #f1f5f9; line-height: 1.6; white-space: pre-wrap;">${inquiry.message}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 28px;">
            <a href="mailto:${inquiry.email}?subject=Re:%20${encodeURIComponent(inquiry.subject || 'Project Inquiry')} - the oblique" style="display: inline-block; background: linear-gradient(135deg, #FF5E62 0%, #8B5CF6 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-weight: 700; font-size: 14px;">
              Reply Directly to ${inquiry.name} ↗
            </a>
          </div>
        </div>
        <div style="background: #08090d; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b;">
          the oblique Digital Agency · Ludhiana, Punjab
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Helper function to send Auto-Reply to Client
async function sendClientAutoReply(inquiry) {
  if (!transporter) {
    console.warn('⚠️ Nodemailer transporter not configured.');
    return;
  }
  const mailOptions = {
    from: `"the oblique" <${SMTP_EMAIL}>`,
    to: inquiry.email,
    subject: `Thanks for showing interest in the oblique! We've received your brief.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0c0e14; color: #f1f5f9; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 36px 28px; text-align: center; border-bottom: 1px solid #312e81;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">the oblique</h1>
          <p style="margin: 8px 0 0 0; color: #a5b4fc; font-size: 14px;">Digital Engineering · Brand Identity · Growth Systems</p>
        </div>
        
        <div style="padding: 32px 28px;">
          <h2 style="margin-top: 0; font-size: 20px; color: #ffffff; font-weight: 700;">Hi ${inquiry.name},</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.65;">
            Thank you for showing interest in <strong>the oblique</strong>. We’re excited to learn more about your vision and explore how we can build something remarkable together.
          </p>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.65;">
            Our founding team has received your project details and is currently reviewing your brief. We make it a point to personally review every inquiry and will respond within <strong>24 hours</strong>.
          </p>

          <div style="margin: 28px 0; padding: 20px; background: #151923; border-radius: 12px; border: 1px solid #1e293b;">
            <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
              Summary of your inquiry
            </div>
            <div style="font-size: 14px; color: #e2e8f0; margin-bottom: 6px;"><strong>Subject:</strong> ${inquiry.subject || 'New Project Inquiry'}</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.5; white-space: pre-wrap;">"${inquiry.message}"</div>
          </div>

          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.65;">
            Need an urgent response or prefer a quick chat? Connect directly with us on WhatsApp or explore our latest design drops on Instagram:
          </p>

          <!-- Social Connect Buttons -->
          <div style="display: flex; gap: 14px; margin: 24px 0 20px 0; flex-wrap: wrap;">
            <a href="${WHATSAPP_LINK}" target="_blank" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 9999px; font-weight: 700; font-size: 14px;">
              💬 Chat on WhatsApp ↗
            </a>
            <a href="${INSTAGRAM_URL}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #e1306c 0%, #fd1d1d 50%, #f77737 100%); color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 9999px; font-weight: 700; font-size: 14px;">
              📸 Follow on Instagram ↗
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; line-height: 1.5;">
            Warm regards,<br />
            <strong style="color: #ffffff;">The Team at the oblique</strong><br />
            <span style="font-size: 12px; color: #64748b;">Ludhiana, Punjab · <a href="mailto:${SMTP_EMAIL}" style="color: #818cf8; text-decoration: none;">${SMTP_EMAIL}</a></span>
          </p>
        </div>

        <div style="background: #08090d; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b;">
          © ${new Date().getFullYear()} the oblique. All rights reserved.
        </div>
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
