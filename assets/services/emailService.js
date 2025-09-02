const { Resend } = require('resend');
require('dotenv').config();

class EmailService {
  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    // Use a verified email for development
    this.fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'; // Resend's verified sender
    this.fromName = process.env.FROM_NAME || 'Zintle Team';
    this.isConfigured = !!process.env.RESEND_API_KEY;
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    console.log('📧 Email service initialized:', this.isConfigured ? 'ACTIVE' : 'DEMO MODE');
    console.log('📧 From email:', this.fromEmail);
  }

  async sendWelcomeEmail(userEmail, userData = {}) {
    // If no API key configured, just log and return success for development
    if (!this.isConfigured) {
      console.log('📧 WELCOME EMAIL (Demo Mode):');
      console.log('   To:', userEmail);
      console.log('   Founder #:', userData.position);
      console.log('   Skill:', userData.primarySkill);
      console.log('   Challenge:', userData.biggestChallenge);
      console.log('   Interest:', userData.interestLevel + '/5');
      return { success: true, message: 'Email logged (demo mode)' };
    }

    try {
      const emailData = {
        from: this.isDevelopment 
          ? 'onboarding@resend.dev'  // Use Resend's verified sender for dev
          : `${this.fromName} <${this.fromEmail}>`,
        to: [userEmail],
        subject: '🚀 Welcome to Zintle\'s Private Beta!',
        html: this.generateWelcomeEmailHTML(userData),
        text: this.generateWelcomeEmailText(userData)
      };

      console.log('📧 Sending email with data:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject
      });

      const { data, error } = await this.resend.emails.send(emailData);

      if (error) {
        console.error('❌ Resend error:', error);
        
        // If domain not verified, try with onboarding@resend.dev
        if (error.message?.includes('domain is not verified')) {
          console.log('🔄 Retrying with Resend\'s verified sender...');
          
          const retryData = {
            ...emailData,
            from: 'onboarding@resend.dev'
          };
          
          const { data: retryResult, error: retryError } = await this.resend.emails.send(retryData);
          
          if (retryError) {
            return { success: false, error: retryError.message || retryError };
          }
          
          console.log(`✅ Welcome email sent to ${userEmail} (via Resend sender)`);
          return { success: true, data: retryResult };
        }
        
        return { success: false, error: error.message || error };
      }

      console.log(`✅ Welcome email sent to ${userEmail}`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  generateWelcomeEmailHTML(userData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Zintle</title>
      <style>
        @font-face {
          font-family: "Brasika Display";
          src: url("https://your-domain.com/assets/fonts/BrasikaDisplayRegular/BrasikaDisplayRegular.otf") format("opentype");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #e5e5e5;
          background-color: #080808;
          margin: 0;
          padding: 20px;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
          border-radius: 20px;
          border: 1px solid #333;
          overflow: hidden;
        }
        .email-header {
          background: linear-gradient(135deg, #3533cd 0%, #5d5be3 50%, #07ff88 100%);
          padding: 40px;
          text-align: center;
          color: #fff;
          position: relative;
        }
        .email-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 80%, rgba(7, 255, 136, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(93, 91, 227, 0.4) 0%, transparent 50%);
          pointer-events: none;
        }
        .logo-container {
          position: relative;
          z-index: 2;
          margin-bottom: 16px;
        }
        .logo {
          height: 48px;
          width: auto;
          filter: brightness(0) invert(1);
          margin-bottom: 12px;
        }
        .brand-name {
          font-family: "Brasika Display", "Inter", sans-serif;
          font-size: 36px;
          font-weight: 400;
          margin-bottom: 8px;
          letter-spacing: -1px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .tagline {
          font-size: 14px;
          font-weight: 600;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        .email-body {
          padding: 40px;
          background: 
            radial-gradient(circle at 25% 75%, rgba(53, 51, 205, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 75% 25%, rgba(7, 255, 136, 0.05) 0%, transparent 40%);
        }
        .welcome-title {
          font-family: "Brasika Display", "Inter", sans-serif;
          font-size: 32px;
          font-weight: 400;
          background: linear-gradient(135deg, #e5e5e5 0%, #3533cd 50%, #5d5be3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 16px;
          text-align: center;
        }
        .founder-badge {
          background: linear-gradient(135deg, #3533cd, #5d5be3);
          color: #fff;
          padding: 16px 32px;
          border-radius: 50px;
          font-weight: 700;
          font-size: 18px;
          display: block;
          text-align: center;
          max-width: 300px;
          margin: 24px auto;
          box-shadow: 0 8px 32px rgba(53, 51, 205, 0.4);
          border: 1px solid rgba(7, 255, 136, 0.2);
        }
        .greeting {
          font-size: 18px;
          margin: 32px 0 24px 0;
          color: #e5e5e5;
        }
        .main-text {
          font-size: 16px;
          margin-bottom: 32px;
          color: #b4b4b4;
          line-height: 1.7;
        }
        .main-text strong {
          color: #3533cd;
          font-weight: 700;
        }
        .dev-notice {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin: 24px 0;
          color: #ffc107;
          font-size: 14px;
          text-align: center;
        }
        .benefits-section {
          margin: 40px 0;
        }
        .benefits-title {
          font-family: "Brasika Display", "Inter", sans-serif;
          font-size: 24px;
          font-weight: 400;
          background: linear-gradient(135deg, #3533cd 0%, #5d5be3 70%, #07ff88 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 24px;
          text-align: center;
        }
        .benefit {
          display: flex;
          align-items: flex-start;
          margin: 20px 0;
          padding: 20px;
          background: 
            linear-gradient(135deg, rgba(53, 51, 205, 0.1) 0%, rgba(93, 91, 227, 0.05) 100%);
          border-radius: 16px;
          border-left: 4px solid #3533cd;
          border: 1px solid rgba(53, 51, 205, 0.2);
        }
        .benefit-icon {
          font-size: 24px;
          margin-right: 16px;
          margin-top: 4px;
          color: #3533cd;
          min-width: 32px;
        }
        .benefit-content {
          flex: 1;
        }
        .benefit-title {
          font-weight: 700;
          color: #e5e5e5;
          margin-bottom: 6px;
          font-size: 16px;
        }
        .benefit-desc {
          font-size: 14px;
          color: #b4b4b4;
          line-height: 1.5;
        }
        .cta-section {
          text-align: center;
          margin: 40px 0;
          padding: 32px;
          background: 
            linear-gradient(135deg, rgba(53, 51, 205, 0.08) 0%, rgba(7, 255, 136, 0.05) 100%);
          border-radius: 20px;
          border: 1px solid rgba(53, 51, 205, 0.3);
        }
        .cta-text {
          font-size: 16px;
          color: #b4b4b4;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #3533cd, #5d5be3);
          color: #fff;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 4px 20px rgba(53, 51, 205, 0.4);
          border: 1px solid rgba(7, 255, 136, 0.3);
          transition: all 0.3s ease;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(53, 51, 205, 0.6);
        }
        .footer {
          background: 
            linear-gradient(135deg, #0a0a0a 0%, rgba(53, 51, 205, 0.1) 100%);
          padding: 32px 40px;
          text-align: center;
          border-top: 1px solid #333;
        }
        .footer-brand {
          font-family: "Brasika Display", "Inter", sans-serif;
          font-weight: 400;
          background: linear-gradient(135deg, #3533cd 0%, #07ff88 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
          font-size: 16px;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-link {
          color: #3533cd;
          text-decoration: none;
          margin: 0 16px;
          font-weight: 600;
          transition: color 0.3s ease;
        }
        .social-link:hover {
          color: #07ff88;
        }
        .footer-text {
          color: #888;
          font-size: 13px;
          margin-top: 16px;
        }
        .profile-info {
          background: rgba(53, 51, 205, 0.1);
          border: 1px solid rgba(53, 51, 205, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
        }
        .profile-info h4 {
          color: #3533cd;
          font-weight: 700;
          margin-bottom: 12px;
          text-align: center;
        }
        .profile-item {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 8px 0;
          border-bottom: 1px solid rgba(53, 51, 205, 0.2);
        }
        .profile-item:last-child {
          border-bottom: none;
        }
        .profile-label {
          color: #b4b4b4;
          font-weight: 500;
        }
        .profile-value {
          color: #e5e5e5;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div class="logo-container">
            <img src="https://your-domain.com/assets/img/logo-web.svg" alt="Zintle" class="logo">
            <div class="brand-name">Zintle</div>
            <div class="tagline">Skills Without Borders</div>
          </div>
        </div>
        
        <div class="email-body">
          <h1 class="welcome-title">Welcome to the Future!</h1>
          
          <div class="founder-badge">
            🎉 You're Founder #${userData.position || 'XX'}
          </div>
          
          ${this.isDevelopment ? `
          <div class="dev-notice">
            📧 Development Mode: This email was sent using Resend's test environment
          </div>
          ` : ''}
          
          <p class="greeting">Hey there, creative innovator! 👋</p>
          
          <p class="main-text">
            You've just secured your spot in <strong>Egypt's first AI-powered skill-swapping marketplace</strong>. 
            You're not just early; you're <strong>foundational</strong>. Your insights will directly shape how 
            creative work gets done in Egypt and beyond.
          </p>

          ${userData.primarySkill || userData.biggestChallenge || userData.interestLevel ? `
          <div class="profile-info">
            <h4>Your Founder Profile</h4>
            ${userData.primarySkill ? `
            <div class="profile-item">
              <span class="profile-label">Primary Skill:</span>
              <span class="profile-value">${this.formatSkill(userData.primarySkill)}</span>
            </div>
            ` : ''}
            ${userData.biggestChallenge ? `
            <div class="profile-item">
              <span class="profile-label">Main Challenge:</span>
              <span class="profile-value">${this.formatChallenge(userData.biggestChallenge)}</span>
            </div>
            ` : ''}
            ${userData.interestLevel ? `
            <div class="profile-item">
              <span class="profile-label">Interest Level:</span>
              <span class="profile-value">${userData.interestLevel}/5 ⭐</span>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="benefits-section">
            <h3 class="benefits-title">What's Next for You</h3>

            <div class="benefit">
              <div class="benefit-icon">⚡</div>
              <div class="benefit-content">
                <div class="benefit-title">First Access to Beta</div>
                <div class="benefit-desc">Experience Zintle before anyone else when we launch. Shape the platform with your feedback.</div>
              </div>
            </div>

            <div class="benefit">
              <div class="benefit-icon">🎁</div>
              <div class="benefit-content">
                <div class="benefit-title">100 Free Credits</div>
                <div class="benefit-desc">Start trading skills immediately with no barriers. No Egyptian pounds required.</div>
              </div>
            </div>

            <div class="benefit">
              <div class="benefit-icon">👑</div>
              <div class="benefit-content">
                <div class="benefit-title">Lifetime Founder Status</div>
                <div class="benefit-desc">Permanent recognition in our community with exclusive founder badge and benefits.</div>
              </div>
            </div>
          </div>

          <div class="cta-section">
            <p class="cta-text">
              Follow our journey and be the first to know about major updates, 
              exclusive previews, and beta launch announcements.
            </p>
            <a href="https://www.instagram.com/zintleco/" class="cta-button">
              Follow Our Journey →
            </a>
          </div>
        </div>

        <div class="footer">
          <div class="footer-brand">Skills without borders. Growth without limits.</div>
          <div class="social-links">
            <a href="https://www.instagram.com/zintleco/" class="social-link">Instagram</a>
            <a href="mailto:hello@zintle.co" class="social-link">Contact Us</a>
          </div>
          <div class="footer-text">© 2025 Zintle — Made in Egypt</div>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  generateWelcomeEmailText(userData) {
    return `
Welcome to Zintle's Private Beta!

Hey there, creative innovator! 👋

You've just secured your spot in Egypt's first AI-powered skill-swapping marketplace. You're Founder #${userData.position || 'XX'} in our founding community!

Your Profile:
• Primary Skill: ${this.formatSkill(userData.primarySkill)}
• Biggest Challenge: ${this.formatChallenge(userData.biggestChallenge)}
• Interest Level: ${userData.interestLevel || 'N/A'}/5

What's Next:
⚡ First Access to Beta - Experience Zintle before anyone else
🎁 100 Free Credits - Start trading skills immediately  
👑 Lifetime Founder Status - Permanent community recognition
🚀 Direct Impact - Your feedback shapes our development

We'll keep you updated on our progress and reach out for exclusive feedback sessions.

Follow our journey: https://www.instagram.com/zintleco/
Contact us: hello@zintle.co

Skills without borders. Growth without limits.
- The Zintle Team

© 2025 Zintle. Made in Egypt.
You're receiving this because you joined our private beta waitlist.
    `;
  }

  formatSkill(skill) {
    const skillMap = {
      'design': 'Graphic Design',
      'development': 'Web Development', 
      'photography': 'Photography',
      'writing': 'Content Writing',
      'marketing': 'Digital Marketing',
      'video': 'Video Production',
      'other': 'Other'
    };
    return skillMap[skill] || skill || 'Not specified';
  }

  formatChallenge(challenge) {
    const challengeMap = {
      'payment_delays': 'Payment Delays',
      'finding_clients': 'Finding Clients',
      'pricing_services': 'Pricing Services', 
      'skill_gaps': 'Skill Gaps'
    };
    return challengeMap[challenge] || challenge || 'Not specified';
  }

  // Method for future progress updates
  async sendProgressUpdate(emails, subject, content) {
    if (!this.isConfigured) {
      console.log('📧 Progress update would be sent to:', emails.length, 'recipients');
      return { success: true, sent: emails.length };
    }

    const results = [];
    const batchSize = 50; // Conservative batch size for Resend

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.resend.emails.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: batch,
          subject: subject,
          html: this.generateUpdateHTML(subject, content),
          text: content.replace(/<[^>]*>/g, '') // Strip HTML for text version
        });

        if (error) {
          console.error('Batch send error:', error);
          results.push(...batch.map(email => ({ email, success: false, error: error.message })));
        } else {
          console.log('Batch sent successfully to', batch.length, 'recipients');
          results.push(...batch.map(email => ({ email, success: true })));
        }
      } catch (error) {
        console.error('Batch send failed:', error);
        results.push(...batch.map(email => ({ email, success: false, error: error.message })));
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success).length;
    return { success: true, sent: successful, total: emails.length, results };
  }

  generateUpdateHTML(subject, content) {
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #080808; color: #e5e5e5;">
      <div style="background: linear-gradient(135deg, #111 0%, #1a1a1a 100%); padding: 40px; border-radius: 20px; border: 1px solid #333;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 28px; font-weight: 700; color: #07ff88; margin-bottom: 8px;">
            Zintle
          </div>
          <div style="font-size: 14px; color: #00d4ff; text-transform: uppercase; letter-spacing: 1px;">
            Progress Update
          </div>
        </div>
        <h2 style="color: #e5e5e5; margin-bottom: 24px; font-size: 24px;">${subject}</h2>
        <div style="line-height: 1.7; color: #b4b4b4; font-size: 16px;">
          ${content}
        </div>
        <div style="margin-top: 40px; text-align: center; border-top: 1px solid #333; padding-top: 24px;">
          <p style="color: #888; font-size: 14px; margin: 0;">© 2025 Zintle — Made in Egypt</p>
        </div>
      </div>
    </div>
    `;
  }
}

module.exports = EmailService;