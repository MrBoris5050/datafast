# Email & SMS Configuration for datafast

This document explains how to set up SMTP email and Arkessel SMS functionality for password reset and OTP features.

## Environment Variables

Add these variables to your `.env.local` file:

```env
# =====================================
# SMTP Configuration for Email Sending
# =====================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="datafast <noreply@inventordatahub.com>"

# =====================================
# Arkessel SMS Configuration
# =====================================
ARKESSEL_API_KEY="your-arkessel-api-key"
ARKESSEL_SENDER_ID="datafast"
ARKESSEL_SMS_URL="https://sms.arkesel.com/api/v2/sms/send"
```

---

## 📱 Arkessel SMS Setup

### Getting Arkessel API Key

1. **Create an Arkessel Account**
   - Visit [https://arkesel.com](https://arkesel.com)
   - Sign up for an account
   - Verify your email

2. **Get Your API Key**
   - Log into your Arkessel dashboard
   - Navigate to **Settings** → **API Keys**
   - Copy your API key

3. **Configure Sender ID**
   - In your Arkessel dashboard, go to **Sender IDs**
   - Request a sender ID (max 11 characters, e.g., "datafast")
   - Wait for approval (usually within 24 hours)

### Environment Variables for SMS

```env
ARKESSEL_API_KEY="your-api-key-here"
ARKESSEL_SENDER_ID="datafast"
ARKESSEL_SMS_URL="https://sms.arkesel.com/api/v2/sms/send"
```

### SMS Features

The system supports:
- **Password Reset OTP**: 6-digit code sent via SMS
- **Phone Verification**: OTP for account verification
- **Multi-channel Delivery**: Can send to both email and phone simultaneously

### Phone Number Formatting

Phone numbers are automatically formatted:
- `0244123456` → `233244123456`
- `244123456` → `233244123456`
- `233244123456` → `233244123456` (no change)

---

## 📧 SMTP Email Setup

### Popular SMTP Providers

#### Gmail
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"  # Use App Password, not regular password
```

**Setup Steps for Gmail:**
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account Settings > Security > App passwords
3. Generate an app password for "Mail"
4. Use the generated 16-character password as `SMTP_PASS`

#### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
```

#### SendGrid (Recommended for Production)
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

#### Mailgun
```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-mailgun-username"
SMTP_PASS="your-mailgun-password"
```

#### Custom SMTP Server
```env
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-password"
SMTP_FROM="datafast <noreply@yourdomain.com>"
```

---

## 🔐 Password Reset Flow

When a user requests a password reset:

1. **User enters email OR phone number**
2. **System detects the type** (email or phone)
3. **Generates 6-digit OTP** (expires in 10 minutes)
4. **Sends OTP via both channels** if user has both email and phone:
   - Email: Professional HTML template via SMTP
   - SMS: Text message via Arkessel
5. **User enters OTP** to verify identity
6. **User creates new password**

---

## 🧪 Testing

### Test Password Reset

```bash
# Request OTP via email
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"identifier": "test@example.com"}'

# Request OTP via phone
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"identifier": "0244123456"}'
```

### Test Email Only

```bash
curl -X POST http://localhost:3000/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

---

## ⚠️ Fallback Behavior

### If SMTP is not configured:
- Email content is logged to console (development)
- Returns success to prevent email enumeration attacks
- Reset code visible in server logs

### If Arkessel is not configured:
- SMS content is logged to console
- Returns success to prevent phone enumeration
- Reset code visible in server logs

---

## 🛡️ Security Notes

- Never commit credentials to version control
- Use app passwords instead of regular passwords
- Use dedicated email/SMS services for production
- Implement rate limiting for reset requests
- Monitor sending for abuse
- OTP expires after 10 minutes
- Only one active OTP per user at a time

---

## 🔧 Troubleshooting

### SMTP Issues

1. **Authentication Failed**
   - Check username/password
   - Ensure 2FA is enabled for Gmail
   - Use app password for Gmail

2. **Connection Timeout**
   - Check SMTP host and port
   - Verify firewall settings
   - Try different ports (25, 465, 587)

3. **SSL/TLS Errors**
   - Set `SMTP_SECURE="true"` for port 465
   - Set `SMTP_SECURE="false"` for ports 25, 587

### Arkessel SMS Issues

1. **Missing API Key Error**
   - Verify `ARKESSEL_API_KEY` is set
   - Check for typos in the key

2. **Invalid Sender ID**
   - Ensure sender ID is approved
   - Maximum 11 characters
   - Only alphanumeric characters

3. **Failed to Send**
   - Check Arkessel account balance
   - Verify phone number format
   - Check Arkessel dashboard for logs

---

## 📦 Production Recommendations

### Email Services
- **SendGrid**: 100 emails/day free
- **Mailgun**: 5,000 emails/month free
- **AWS SES**: Pay per use

### SMS Services
- **Arkessel**: Ghana-focused, reliable for West Africa
- Top-up balance regularly
- Monitor delivery rates

### Best Practices
- Monitor email/SMS delivery rates
- Set up bounce handling
- Follow CAN-SPAM and GDPR guidelines
- Implement proper email authentication (SPF, DKIM, DMARC)
