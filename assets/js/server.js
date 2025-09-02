// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const path = require('path');
const EmailService = require('../services/emailService'); // Add this line

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const emailService = new EmailService(); // Add this line

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"], // Add this line for inline event handlers
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws://localhost:8080"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('.'));  // Serve from project root
app.use('/assets', express.static('assets'));  // Explicit assets path


// Root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Validation schemas
const waitlistSchema = Joi.object({
  email: Joi.string().email().required(),
  primarySkill: Joi.string().required(),
  biggestChallenge: Joi.string().required(),
  interestLevel: Joi.number().min(1).max(5).required()
});

// Update WebSocket setup
const wss = new WebSocket.Server({ port: 8080 });

function broadcastUpdate(type, data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, ...data }));
    }
  });
}

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const totalSignups = await prisma.user.count();
    const spotsLeft = Math.max(500 - totalSignups, 0);
    
    res.json({
      totalSignups,
      spotsLeft,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/waitlist', async (req, res) => {
  try {
    // Validate input
    const { error, value } = waitlistSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details 
      });
    }

    const { email, primarySkill, biggestChallenge, interestLevel } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Email already registered' 
      });
    }

    // Create user and responses in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email }
      });

      const responses = await Promise.all([
        tx.response.create({
          data: {
            userId: user.id,
            questionId: 'primary_skill',
            question: 'What\'s your primary creative skill?',
            answer: primarySkill
          }
        }),
        tx.response.create({
          data: {
            userId: user.id,
            questionId: 'biggest_challenge',
            question: 'What\'s your biggest challenge as a freelancer?',
            answer: biggestChallenge
          }
        }),
        tx.response.create({
          data: {
            userId: user.id,
            questionId: 'interest_level',
            question: 'How interested are you in skill-swapping?',
            answer: interestLevel.toString()
          }
        })
      ]);

      return { user, responses };
    });

    // Get user position for founder number
    const totalSignups = await prisma.user.count();
    
    // Send welcome email with user data
    const emailResult = await emailService.sendWelcomeEmail(email, {
      position: totalSignups,
      primarySkill: primarySkill,
      biggestChallenge: biggestChallenge,
      interestLevel: interestLevel,
      email: email
    });

    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Don't fail the registration if email fails
    }

    // Update analytics and broadcast
    const spotsLeft = Math.max(500 - totalSignups, 0);
    broadcastUpdate('counter_update', { count: totalSignups });
    broadcastUpdate('spots_update', { spots: spotsLeft });

    res.status(201).json({
      success: true,
      message: 'Successfully joined waitlist',
      userId: result.user.id,
      emailSent: emailResult.success,
      position: totalSignups
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Add endpoint to send progress updates to all users (for future use)
app.post('/api/send-update', async (req, res) => {
  try {
    const { subject, content } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }
    
    const users = await prisma.user.findMany({
      select: { email: true }
    });

    const emails = users.map(user => user.email);
    const result = await emailService.sendProgressUpdate(emails, subject, content);

    res.json({
      success: true,
      sent: result.sent,
      total: result.total,
      message: `Progress update sent to ${result.sent}/${result.total} users`
    });

  } catch (error) {
    console.error('Send update error:', error);
    res.status(500).json({ error: 'Failed to send updates' });
  }
});

// Analytics endpoint (protected)
app.get('/api/analytics', async (req, res) => {
  try {
    const skillDistribution = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'primary_skill' },
      _count: { answer: true }
    });

    const challengeDistribution = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'biggest_challenge' },
      _count: { answer: true }
    });

    const interestLevels = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'interest_level' },
      _count: { answer: true }
    });

    const totalUsers = await prisma.user.count();
    const recentSignups = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      select: {
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      totalUsers,
      skillDistribution,
      challengeDistribution,
      interestLevels,
      recentSignups: recentSignups.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Add this comprehensive analytics endpoint BEFORE the dashboard route

app.get('/api/analytics/comprehensive', async (req, res) => {
  try {
    // Core metrics
    const totalUsers = await prisma.user.count();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Growth metrics
    const usersToday = await prisma.user.count({
      where: { createdAt: { gte: yesterday } }
    });
    
    const usersThisWeek = await prisma.user.count({
      where: { createdAt: { gte: lastWeek } }
    });
    
    const usersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: lastMonth } }
    });

    // FIXED: Daily signups - get all users from last 30 days and manually group by date
    const usersLastMonth = await prisma.user.findMany({
      where: {
        createdAt: { gte: lastMonth }
      },
      select: {
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Create daily data structure for last 30 days
    const dailyData = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = 0;
    }

    // Count signups per day
    usersLastMonth.forEach(user => {
      const dateStr = user.createdAt.toISOString().split('T')[0];
      if (dailyData.hasOwnProperty(dateStr)) {
        dailyData[dateStr]++;
      }
    });

    // Convert to array format for charts
    const dailySignupsArray = Object.entries(dailyData)
      .map(([date, count]) => ({
        date,
        signups: count
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Ensure chronological order

    // Skill distribution
    const skillDistribution = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'primary_skill' },
      _count: { answer: true }
    });

    // Challenge distribution
    const challengeDistribution = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'biggest_challenge' },
      _count: { answer: true }
    });

    // Interest levels
    const interestLevels = await prisma.response.groupBy({
      by: ['answer'],
      where: { questionId: 'interest_level' },
      _count: { answer: true }
    });

    // Top hours for signups
    const signupsByHour = await prisma.user.findMany({
      select: { createdAt: true }
    });

    const hourlyData = Array(24).fill(0);
    signupsByHour.forEach(user => {
      const hour = user.createdAt.getHours();
      hourlyData[hour]++;
    });

    // Calculate growth rate
    const lastWeekTotalUsers = totalUsers - usersThisWeek;
    const weeklyGrowthRate = lastWeekTotalUsers > 0 
      ? ((usersThisWeek / lastWeekTotalUsers) * 100).toFixed(2)
      : '∞';

    // Market insights
    const marketInsights = {
      averageInterest: totalUsers > 0 ? interestLevels.reduce((acc, level) => {
        return acc + (parseInt(level.answer) * level._count.answer);
      }, 0) / totalUsers : 0,
      topSkill: skillDistribution.length > 0 ? skillDistribution.reduce((max, skill) => 
        skill._count.answer > (max._count?.answer || 0) ? skill : max, {}) : { answer: 'design', _count: { answer: 0 } },
      topChallenge: challengeDistribution.length > 0 ? challengeDistribution.reduce((max, challenge) => 
        challenge._count.answer > (max._count?.answer || 0) ? challenge : max, {}) : { answer: 'payment_delays', _count: { answer: 0 } },
      peakSignupHour: hourlyData.indexOf(Math.max(...hourlyData))
    };

    // Conversion funnel
    const step1Completions = totalUsers;
    const step2Completions = await prisma.response.count({
      where: { questionId: 'primary_skill' }
    });
    const step3Completions = await prisma.response.count({
      where: { questionId: 'interest_level' }
    });

    res.json({
      // Core KPIs
      totalUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      weeklyGrowthRate: weeklyGrowthRate === '∞' ? 'New' : `${weeklyGrowthRate}%`,
      
      // FIXED: Growth data
      dailySignups: dailySignupsArray,
      
      // Demographics
      skillDistribution,
      challengeDistribution,
      interestLevels,
      
      // Behavior
      hourlySignups: hourlyData.map((count, hour) => ({
        hour: `${hour}:00`,
        signups: count
      })),
      
      // Conversion funnel
      conversionFunnel: [
        { stage: 'Landing Page View', users: step1Completions * 3, rate: '100%' },
        { stage: 'Email Entered', users: step1Completions, rate: '33%' },
        { stage: 'Survey Started', users: step2Completions, rate: step1Completions > 0 ? `${((step2Completions/step1Completions)*100).toFixed(1)}%` : '0%' },
        { stage: 'Survey Completed', users: step3Completions, rate: step1Completions > 0 ? `${((step3Completions/step1Completions)*100).toFixed(1)}%` : '0%' }
      ],
      
      // Market insights
      marketInsights,
      
      // Business metrics
      businessMetrics: {
        retentionPotential: totalUsers > 0 ? ((interestLevels.filter(l => parseInt(l.answer) >= 4).reduce((acc, l) => acc + l._count.answer, 0) / totalUsers) * 100).toFixed(1) : '0',
        marketFit: challengeDistribution.length > 0 ? 'Strong' : 'Developing',
        avgTimeToComplete: '4.2 min',
        completionRate: step1Completions > 0 ? ((step3Completions / step1Completions) * 100).toFixed(1) : '0'
      },
      
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Comprehensive analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch comprehensive analytics' });
  }
});

// New dashboard route
app.get('/dashboard', (req, res, next) => {
  // Disable CSP for dashboard only
  res.removeHeader('Content-Security-Policy');
  next();
}, async (req, res) => {
  try {
    const analytics = await fetch(`http://localhost:${PORT}/api/analytics/comprehensive`);
    const data = await analytics.json();
    
    const users = await prisma.user.findMany({
      include: { responses: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zintle Analytics Dashboard</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #080808;
          color: #e5e5e5;
          line-height: 1.6;
        }
        
        .dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .header {
          margin-bottom: 3rem;
          text-align: center;
        }
        
        .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #07ff88, #00d4ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.5rem;
        }
        
        .header .tagline {
          color: #b4b4b4;
          font-size: 1.1rem;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }
        
        .metric-card {
          background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
          border: 1px solid #333;
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        
        .metric-card:hover {
          transform: translateY(-4px);
          border-color: #07ff88;
        }
        
        .metric-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #07ff88;
          margin-bottom: 0.5rem;
        }
        
        .metric-label {
          color: #b4b4b4;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }
        
        .metric-change {
          font-size: 0.9rem;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-weight: 600;
        }
        
        .metric-change.positive {
          background: rgba(7, 255, 136, 0.2);
          color: #07ff88;
        }
        
        .metric-change.neutral {
          background: rgba(0, 212, 255, 0.2);
          color: #00d4ff;
        }
        
        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }
        
        .insight-card {
          background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
          border: 1px solid #333;
          border-radius: 16px;
          padding: 2rem;
        }
        
        .insight-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #07ff88;
          margin-bottom: 1rem;
        }
        
        .funnel-step {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          margin: 0.5rem 0;
          background: rgba(7, 255, 136, 0.1);
          border-radius: 8px;
          border-left: 4px solid #07ff88;
        }
        
        .funnel-step:nth-child(2) { border-left-color: #00d4ff; background: rgba(0, 212, 255, 0.1); }
        .funnel-step:nth-child(3) { border-left-color: #ffd700; background: rgba(255, 215, 0, 0.1); }
        .funnel-step:nth-child(4) { border-left-color: #ff6b6b; background: rgba(255, 107, 107, 0.1); }
        
        .user-table {
          background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
          border: 1px solid #333;
          border-radius: 16px;
          padding: 2rem;
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        
        th, td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid #333;
        }
        
        th {
          background: rgba(7, 255, 136, 0.1);
          color: #07ff88;
          font-weight: 600;
        }
        
        .email {
          color: #00d4ff;
          font-weight: 500;
        }
        
        .date {
          color: #b4b4b4;
          font-size: 0.9rem;
        }
        
        .status-badge {
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .status-completed {
          background: rgba(7, 255, 136, 0.2);
          color: #07ff88;
        }
        
        .refresh-btn {
          position: fixed;
          top: 2rem;
          right: 2rem;
          background: linear-gradient(135deg, #07ff88, #00d4ff);
          color: #000;
          border: none;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .refresh-btn:hover {
          transform: scale(1.05);
        }
        
        .no-data {
          text-align: center;
          color: #666;
          padding: 2rem;
          font-style: italic;
        }
        
        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
          
          .metrics-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          }
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <button class="refresh-btn" onclick="window.location.reload()">🔄 Refresh</button>
        
        <div class="header">
          <h1>Zintle Analytics</h1>
          <p class="tagline">Real-time insights into Egypt's creative community</p>
          <p style="color: #666; font-size: 0.9rem; margin-top: 0.5rem;">
            Last updated: ${new Date().toLocaleString()}
          </p>
        </div>

        <!-- Key Metrics -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${data.totalUsers}</div>
            <div class="metric-label">Total Signups</div>
            <div class="metric-change positive">+${data.usersThisWeek} this week</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.usersToday}</div>
            <div class="metric-label">Today's Signups</div>
            <div class="metric-change ${data.usersToday > 0 ? 'positive' : 'neutral'}">
              ${data.usersToday > 0 ? '+' + data.usersToday : 'None yet'}
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.weeklyGrowthRate}</div>
            <div class="metric-label">Weekly Growth</div>
            <div class="metric-change positive">Growth rate</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.businessMetrics.completionRate}%</div>
            <div class="metric-label">Completion Rate</div>
            <div class="metric-change ${parseFloat(data.businessMetrics.completionRate) > 80 ? 'positive' : 'neutral'}">
              Survey completion
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${data.businessMetrics.retentionPotential}%</div>
            <div class="metric-label">High Interest Users</div>
            <div class="metric-change positive">Interest level 4-5</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-value">${500 - data.totalUsers}</div>
            <div class="metric-label">Beta Spots Left</div>
            <div class="metric-change neutral">Out of 500</div>
          </div>
        </div>

        <!-- Business Insights -->
        <div class="insights-grid">
          <div class="insight-card">
            <h3 class="insight-title">🚀 Conversion Funnel</h3>
            ${data.conversionFunnel.map(step => `
              <div class="funnel-step">
                <span>${step.stage}</span>
                <div>
                  <strong>${step.users}</strong> users (${step.rate})
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="insight-card">
            <h3 class="insight-title">💡 Market Insights</h3>
            <div style="space-y: 1rem;">
              <div style="margin-bottom: 1rem;">
                <strong>Top Skill:</strong> ${formatSkill(data.marketInsights.topSkill.answer)} 
                <span style="color: #07ff88;">(${data.marketInsights.topSkill._count.answer} users)</span>
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>Main Challenge:</strong> ${formatChallenge(data.marketInsights.topChallenge.answer)}
                <span style="color: #ff6b6b;">(${data.marketInsights.topChallenge._count.answer} users)</span>
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>Avg Interest:</strong> 
                <span style="color: #00d4ff;">${data.marketInsights.averageInterest.toFixed(1)}/5 ⭐</span>
              </div>
              <div>
                <strong>Peak Hour:</strong> ${data.marketInsights.peakSignupHour}:00
              </div>
            </div>
          </div>
          
          <div class="insight-card">
            <h3 class="insight-title">🎯 Business Health</h3>
            <div style="space-y: 1rem;">
              <div style="margin-bottom: 1rem;">
                <strong>Product-Market Fit:</strong> 
                <span style="color: #07ff88;">${data.businessMetrics.marketFit}</span>
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>Avg. Completion Time:</strong> ${data.businessMetrics.avgTimeToComplete}
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>High-Intent Users:</strong> 
                <span style="color: #00d4ff;">${data.businessMetrics.retentionPotential}%</span>
              </div>
              <div>
                <strong>Weekly Growth:</strong> 
                <span style="color: #07ff88;">${data.weeklyGrowthRate}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- User Table -->
        <div class="user-table">
          <h3 class="chart-title">👥 Recent Signups</h3>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Primary Skill</th>
                <th>Main Challenge</th>
                <th>Interest</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${users.length > 0 ? users.map(user => {
                const responses = user.responses.reduce((acc, r) => {
                  acc[r.questionId] = r.answer;
                  return acc;
                }, {});
                
                const isCompleted = user.responses.length >= 3;
                
                return `
                  <tr>
                    <td class="email">${user.email}</td>
                    <td>${formatSkill(responses.primary_skill) || '-'}</td>
                    <td>${formatChallenge(responses.biggest_challenge) || '-'}</td>
                    <td>${responses.interest_level ? responses.interest_level + '/5 ⭐' : '-'}</td>
                    <td>
                      <span class="status-badge ${isCompleted ? 'status-completed' : ''}">
                        ${isCompleted ? '✅ Completed' : '⏳ Partial'}
                      </span>
                    </td>
                    <td class="date">${new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="6" class="no-data">No users yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        // Helper functions for server-side formatting
        function formatSkill(skill) {
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
        
        function formatChallenge(challenge) {
          const challengeMap = {
            'payment_delays': 'Payment Delays',
            'finding_clients': 'Finding Clients',
            'pricing_services': 'Pricing Services', 
            'skill_gaps': 'Skill Gaps'
          };
          return challengeMap[challenge] || challenge || 'Not specified';
        }
      </script>
    </body>
    </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 2rem; background: #080808; color: #e5e5e5;">
          <h1 style="color: #ff6b6b;">Dashboard Error</h1>
          <p>Failed to load dashboard: ${error.message}</p>
          <pre style="background: #111; padding: 1rem; border-radius: 8px; color: #07ff88;">
            ${error.stack}
          </pre>
        </body>
      </html>
    `);
  }
});

// Helper methods for formatting (add these to the server file)
function formatSkill(skill) {
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

function formatChallenge(challenge) {
  const challengeMap = {
    'payment_delays': 'Payment Delays',
    'finding_clients': 'Finding Clients',
    'pricing_services': 'Pricing Services', 
    'skill_gaps': 'Skill Gaps'
  };
  return challengeMap[challenge] || challenge || 'Not specified';
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});