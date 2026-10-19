const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =                           process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  console.error('Missing Supabase project URL.');
}
if (!SUPABASE_ANON_KEY) {
  console.error('Missing Supabase public anon/publishable key.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY; admin database actions will not work.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,                          persistSession: false
      }
    })
  : null;
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
  frameguard: { action: 'deny' }
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting: hulinda OTP dhidi ya matumizi mabaya na kunawa credits za Brevo.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Maombi mengi ya OTP. Subiri dakika 15 kisha ujaribu tena.' }
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Maombi mengi mno. Subiri kidogo.' }
});

app.use(express.json({
  limit: '3mb',
  verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); }
}));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/api', apiLimiter);
function apiError(res, status, message) {
  return res.status(status).json({ success: false, error: message });                               }
                                                  function missingPaymentReviewMetadata(error) {
                                                    return error?.code === '42703' &&
                                                      /rejection_reason|reviewed_by|reviewed_at/i.test(String(error.message || ''));
                                                  }
                                                  function normalizePaymentReviewMetadata(payment) {
                                                    return {
                                                      ...payment,
                                                      rejection_reason: payment.rejection_reason || payment.failure_reason || null,
                                                      reviewed_at: payment.reviewed_at || null
                                                    };
                                                  }
                                                  function missingSmsReminderPreference(error) {
                                                    return error?.code === '42703' &&
                                                      /sms_reminders_(enabled|consent_at)/i.test(String(error.message || ''));
                                                  }
                                                  function missingPaymentType(error) {
                                                    return error?.code === '42703' &&
                                                      /payment_type/i.test(String(error.message || ''));
                                                  }
                                                  function missingTable(error, name) {
                                                    return error?.code === '42P01' ||
                                                      (error?.code === '42703' && new RegExp(name, 'i').test(String(error.message || '')));
                                                  }
                                                  function parsePagination(req, defaultSize = 50, maxSize = 200) {
                                                    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
                                                    const requested = Number.parseInt(req.query?.pageSize, 10);
                                                    const size = Number.isFinite(requested) ? requested : defaultSize;
                                                    const pageSize = Math.min(maxSize, Math.max(1, size));
                                                    const from = (page - 1) * pageSize;
                                                    return { page, pageSize, from, to: from + pageSize - 1 };
                                                  }
                                                  function cleanSearch(value, max = 80) {
                                                    return String(value || '').trim().slice(0, max);
                                                  }
                                                  // Hutumia RPC ya aggregation (inapopatikana) ili takwimu ziwe sahihi kwa data kubwa.
                                                  // Ikikosekana, inarudi kwenye hesabu ya JS ili mfumo usivunjike.
                                                  async function aggregateOrCount(fnName, args, countBuilder) {
                                                    const { data, error } = await supabase.rpc(fnName, args);
                                                    if (!error && data) return data;
                                                    if (error && process.env.NODE_ENV !== 'test') {
                                                      console.warn(`RPC ${fnName} haipatikani; kutumia hesabu ya JS:`, error.message);
                                                    }
                                                    return countBuilder();
                                                  }
                                                  function tanzaniaDate(date = new Date()) {
                                                    const parts = new Intl.DateTimeFormat('en-CA', {
                                                      timeZone: 'Africa/Dar_es_Salaam',
                                                      year: 'numeric',
                                                      month: '2-digit',
                                                      day: '2-digit'
                                                    }).formatToParts(date);
                                                    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
                                                    return `${values.year}-${values.month}-${values.day}`;
                                                  }
                                                  function daysBetweenDates(from, to) {
                                                    return Math.round(
                                                      (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
                                                      86400000
                                                    );
                                                  }
                                                  function reminderTypeForDate(dueDate, today) {
                                                    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ''))) return null;
                                                    const daysUntilDue = daysBetweenDates(today, dueDate);
                                                    if (daysUntilDue === 3) return 'due_soon';
                                                    if (daysUntilDue === 0) return 'due_today';
                                                    if (daysUntilDue < 0 && Math.abs(daysUntilDue) % 7 === 0) return 'overdue';
                                                    return null;
                                                  }
                                                  function normalizeTanzaniaPhone(value) {
                                                    let phone = String(value || '').replace(/[\s()+.-]/g, '');
                                                    if (/^0\d{9}$/.test(phone)) phone = '255' + phone.slice(1);
                                                    else if (/^\d{9}$/.test(phone)) phone = '255' + phone;
                                                    return /^255\d{9}$/.test(phone) ? phone : null;
                                                  }
                                                  function matchesCronSecret(received, expected) {
                                                    const actual = Buffer.from(String(received || ''));
                                                    const wanted = Buffer.from(String(expected || ''));
                                                    return actual.length === wanted.length && actual.length > 0 &&
                                                      crypto.timingSafeEqual(actual, wanted);
                                                  }
                                                  function missingReminderSchema(error) {
                                                    return error?.code === '42P01' ||
                                                      (error?.code === '42703' && /sms_reminders_enabled/i.test(String(error.message || '')));
                                                  }
                                                  async function reserveReminder(contributionId, reminderType, scheduledFor) {
                                                    const key = { contribution_id: contributionId, reminder_type: reminderType, scheduled_for: scheduledFor };
                                                    const now = new Date();
                                                    const { data: existing, error: lookupError } = await supabase
                                                      .from('payment_reminder_logs')
                                                      .select('id, status, attempts, updated_at')
                                                      .match(key)
                                                      .maybeSingle();
                                                    if (lookupError) throw lookupError;

                                                    if (!existing) {
                                                      const { data, error } = await supabase
                                                        .from('payment_reminder_logs')
                                                        .insert({ ...key, status: 'sending', attempts: 1, updated_at: now.toISOString() })
                                                        .select('id')
                                                        .maybeSingle();
                                                      if (error?.code === '23505') return null;
                                                      if (error) throw error;
                                                      return data?.id || null;
                                                    }

                                                    if (existing.status === 'sent') return null;
                                                    const staleBefore = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
                                                    let update = supabase
                                                      .from('payment_reminder_logs')
                                                      .update({
                                                        status: 'sending',
                                                        attempts: Number(existing.attempts || 0) + 1,
                                                        error: null,
                                                        updated_at: now.toISOString()
                                                      })
                                                      .eq('id', existing.id)
                                                      .eq('status', existing.status)
                                                      .eq('updated_at', existing.updated_at);
                                                    if (existing.status === 'sending') update = update.lt('updated_at', staleBefore);
                                                    const { data, error } = await update.select('id').maybeSingle();
                                                    if (error) throw error;
                                                    return data?.id || null;
                                                  }
                                                  async function readReminderRows(buildQuery) {
                                                    const pageSize = 1000;
                                                    const rows = [];
                                                    for (let offset = 0; offset <= 100000; offset += pageSize) {
                                                      const { data, error } = await buildQuery()
                                                        .range(offset, offset + pageSize - 1);
                                                      if (error) throw error;
                                                      const page = data || [];
                                                      rows.push(...page);
                                                      if (page.length < pageSize) return rows;
                                                    }
                                                    throw new Error('Reminder query exceeded the supported 100,000-row limit.');
                                                  }
                                                  async function sendBeemReminder(phone, message) {
                                                    const apiKey = process.env.BEEM_API_KEY;
                                                    const secretKey = process.env.BEEM_SECRET_KEY;
                                                    const sourceAddress = process.env.BEEM_SOURCE_ADDR;
                                                    if (!apiKey || !secretKey || !sourceAddress) {
                                                      throw new Error('BEEM_API_KEY, BEEM_SECRET_KEY na BEEM_SOURCE_ADDR lazima ziwekwe.');
                                                    }

                                                    const response = await axios.post(
                                                      'https://apisms.beem.africa/v1/send',
                                                      {
                                                        source_addr: sourceAddress,
                                                        encoding: 0,
                                                        schedule_time: '',
                                                        message,
                                                        recipients: [{ recipient_id: '1', dest_addr: phone }]
                                                      },
                                                      {
                                                        headers: {
                                                          Authorization: 'Basic ' + Buffer.from(`${apiKey}:${secretKey}`).toString('base64'),
                                                          'Content-Type': 'application/json'
                                                        },
                                                        timeout: 15000
                                                      }
                                                    );
                                                    const result = response.data || {};
                                                    return String(result.request_id || result.message_id || result.id || '');
                                                  }
                                                  function ready(req, res, next) {
  if (!supabase) {                                    return apiError(res, 503, 'Supabase haijawekwa vizuri kwenye server.');
  }
  next();
}
                                                  async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';                                                     const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()                          : '';
                                                      if (!token) {
      return apiError(res, 401, 'Ingia kwenye akaunti yako kwanza.');
    }
                                                      const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {                         return apiError(res, 401, 'Session imeisha. Ingia tena.');
    }
    req.user = data.user;                             next();                                         } catch (error) {
    console.error('Authentication error:', error.message);
    return apiError(res, 401, 'Imeshindikana kuthibitisha akaunti.');
  }
}
async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await supabase              .from('profiles')
      .select('id, full_name, phone, role, is_approved, is_banned')
      .eq('id', req.user.id)                            .maybeSingle();

    if (error) {                                        console.error('Admin profile error:', error.message);                                               return apiError(res, 500, 'Imeshindikana kuthibitisha ruhusa za admin.');                         }
    if (!data || data.role !== 'admin' || data.is_banned) {
      return apiError(res, 403, 'Huna ruhusa ya kutumia Admin Panel.');
    }
    req.profile = data;
    next();
  } catch (error) {
    console.error('Admin authorization error:', error.message);
    return apiError(res, 500, 'Hitilafu ya kuthibitisha ruhusa.');
  }
}


// ADMIN OTP AUTH ROUTES - MCHEZO WETU
const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || 'hackertrick1997@gmail.com'
).trim().toLowerCase();

const publicAuthClient = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

async function findAdminAuthUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page, perPage: 500
    });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(u => (u.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < 500) break;
  }
  return null;
}

async function checkAdminProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, is_banned')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function sendAdminOtp(email) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || ADMIN_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Mchezo Wetu';

  if (!brevoApiKey) throw new Error('BREVO_API_KEY haijawekwa Render.');

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email
  });

  if (error) throw error;

  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error('Supabase haikutoa OTP.');

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject: 'Admin OTP - Mchezo Wetu',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033">
          <h2>Mchezo Wetu Admin</h2>
          <p>OTP yako ya kuingia kwenye eneo la msimamizi:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px">${String(otp)}</div>
          <p>Usimpe mtu mwingine namba hii.</p>
          <p>Kama hukuomba kuingia, puuza ujumbe huu.</p>
        </div>`
    },
    {
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );
}


// Rekebisha profile ya admin mkuu kwa email iliyowekwa kwenye server.
// Hii hairuhusu email nyingine kujipandisha kuwa admin.
async function ensurePrimaryAdminProfile(user) {
  if (!user ||
      String(user.email || '').trim().toLowerCase() !== ADMIN_EMAIL) {
    throw new Error('Akaunti hii si admin mkuu aliyeruhusiwa.');
  }

  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id, role, is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: 'Mchezo Wetu Admin',
        role: 'admin'
      })
      .eq('id', user.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: 'Mchezo Wetu Admin',
        role: 'admin',
        is_banned: false
      });

    if (error) throw error;
  }
}

app.get('/api/admin/auth/status', ready, async (req, res) => {
  try {
    const user = await findAdminAuthUser(ADMIN_EMAIL);
    if (!user) {
      return res.json({
        success: true,
        setupAllowed: false,
        adminEmail: ADMIN_EMAIL,
        message: 'Akaunti ya admin haipo Supabase Auth.'
      });
    }

    await ensurePrimaryAdminProfile(user);
    const profile = await checkAdminProfile(user.id);
    const allowed = profile?.role === 'admin' &&
      !profile?.is_banned &&
      user.app_metadata?.admin_password_set !== true;

    return res.json({ success: true, setupAllowed: allowed, adminEmail: ADMIN_EMAIL });
  } catch (error) {
    console.error('Admin status error:', error.message);
    return apiError(res, 500, 'Imeshindikana kukagua hali ya admin.');
  }
});

app.post('/api/admin/auth/setup', otpLimiter, ready, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (email !== ADMIN_EMAIL) {
      return apiError(res, 403, 'Email hii hairuhusiwi kuwa admin.');
    }
    if (password.length < 10 || password.length > 128) {
      return apiError(res, 400, 'Password iwe na herufi angalau 10.');
    }

    const user = await findAdminAuthUser(ADMIN_EMAIL);
    if (!user) {
      return apiError(res, 404,
        'Tengeneza kwanza akaunti hii kwenye Supabase Authentication: ' + ADMIN_EMAIL);
    }

    await ensurePrimaryAdminProfile(user);
    const profile = await checkAdminProfile(user.id);
    if (!profile || profile.role !== 'admin' || profile.is_banned) {
      return apiError(res, 403,
        'Akaunti hii haina role ya admin kwenye profiles.');
    }

    if (user.app_metadata?.admin_password_set === true) {
      return apiError(res, 409,
        'Password ya admin tayari imewekwa. Tumia login au reset kwa njia salama.');
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: {
        ...(user.app_metadata || {}),
        admin_password_set: true
      }
    });

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Password ya admin imewekwa.'
    });
  } catch (error) {
    console.error('Admin setup error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuweka password ya admin.');
  }
});

app.post('/api/admin/auth/send-otp', otpLimiter, ready, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (email !== ADMIN_EMAIL) {
      return apiError(res, 403, 'Email hii hairuhusiwi kuingia admin.');
    }
    if (!password) {
      return apiError(res, 400, 'Weka password ya admin.');
    }
    if (!publicAuthClient) {
      return apiError(res, 503, 'Supabase public key haijawekwa Render.');
    }

    const user = await findAdminAuthUser(email);
    if (!user) return apiError(res, 401, 'Akaunti ya admin haipo Supabase.');

    await ensurePrimaryAdminProfile(user);
    const profile = await checkAdminProfile(user.id);
    if (!profile || profile.role !== 'admin' || profile.is_banned) {
      return apiError(res, 403, 'Akaunti hii haina ruhusa ya admin.');
    }

    if (user.app_metadata?.admin_password_set !== true) {
      return apiError(res, 403, 'Weka password ya admin kwanza.');
    }

    // Hakiki password kupitia Supabase Auth.
    const { error: loginError } =
      await publicAuthClient.auth.signInWithPassword({ email, password });

    if (loginError) {
      return apiError(res, 401, 'Password si sahihi.');
    }

    await sendAdminOtp(email);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, message: 'OTP imetumwa kwenye email.' });
  } catch (error) {
    console.error('Admin send OTP error:', error.response?.data || error.message);
    return apiError(res, 502,
      'Imeshindikana kutuma OTP. Kagua Brevo API key, sender na Render Logs.');
  }
});

app.post('/api/admin/auth/verify-otp', otpLimiter, ready, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();

    if (email !== ADMIN_EMAIL) {
      return apiError(res, 403, 'Email hii hairuhusiwi kuingia admin.');
    }
    if (!/^\d{6}$/.test(token)) {
      return apiError(res, 400, 'OTP lazima iwe na tarakimu 6.');
    }
    if (!publicAuthClient) {
      return apiError(res, 503, 'Supabase public key haijawekwa Render.');
    }

    const user = await findAdminAuthUser(email);
    if (!user) return apiError(res, 401, 'Akaunti ya admin haipo.');

    await ensurePrimaryAdminProfile(user);
    const profile = await checkAdminProfile(user.id);
    if (!profile || profile.role !== 'admin' || profile.is_banned) {
      return apiError(res, 403, 'Akaunti hii haina ruhusa ya admin.');
    }

    const { data, error } = await publicAuthClient.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      console.warn('Admin OTP rejected:', error?.message || 'No session');
      return apiError(res, 401, 'OTP si sahihi au muda wake umeisha. Omba OTP mpya.');
    }

    // Hakikisha session iliyothibitishwa ni ya admin aliyeidhinishwa.
    if (data.user?.id !== user.id) {
      return apiError(res, 403, 'Session hii si ya akaunti ya admin.');
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (error) {
    console.error('Admin verify OTP error:', error.message);
    return apiError(res, 500, 'Hitilafu wakati wa kuthibitisha OTP.');
  }
});

// END ADMIN OTP AUTH ROUTES

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    app: 'Mchezo Wetu',
    status: 'online'
  });
});

app.get('/api/config', (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return apiError(res, 503, 'Supabase public configuration haijawekwa.');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({                                          supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    smsRemindersConfigured: Boolean(
      process.env.BEEM_API_KEY &&
      process.env.BEEM_SECRET_KEY &&
      process.env.BEEM_SOURCE_ADDR &&
      process.env.REMINDER_CRON_SECRET
    )
  });
});

app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email === ADMIN_EMAIL) {
    return apiError(res, 403, 'Tumia ukurasa wa admin kuingia.');
  }
  const signup = req.body?.signup === true;
  const full_name = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();

  if (!email || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(res, 400, 'Weka barua pepe sahihi.');
  }

  if (signup && !full_name) {
    return apiError(res, 400, 'Jina kamili linahitajika.');
  }

  if (!supabase) {
    return apiError(res, 503, 'Supabase admin haijawekwa kwenye server.');
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'hackertrick1997@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Mchezo Wetu';

  if (!brevoApiKey) {
    return apiError(res, 500, 'BREVO_API_KEY haijawekwa kwenye server.');
  }

  try {
    // Supabase ndiyo inayozalisha na kuhifadhi OTP ya kuthibitisha.
    const options = signup
      ? {
          type: 'signup',
          email,
          options: { data: { full_name, phone } }
        }
      : {
          type: 'magiclink',
          email
        };

    const { data, error } = await supabase.auth.admin.generateLink(options);

    if (error) {
      console.error('OTP generation error:', error.message);
      return apiError(
        res,
        400,
        signup
          ? 'Usajili umeshindikana. Hakikisha email hii haijasajiliwa tayari.'
          : 'Imeshindikana kuanzisha kuingia. Hakikisha akaunti ipo.'
      );
    }

    const otp = data?.properties?.email_otp;

    if (!otp) {
      console.error('Supabase did not return email_otp.');
      return apiError(res, 500, 'Supabase haikutoa OTP. Jaribu tena.');
    }

    const greeting = signup
      ? full_name.replace(/[<>]/g, '')
      : 'Mwanachama';

    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [{ email }],
        subject: 'OTP yako ya Mchezo Wetu',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;color:#172033;max-width:520px;margin:auto">
            <h2>Mchezo Wetu</h2>
            <p>Habari ${greeting},</p>
            <p>Tumia namba hii kuthibitisha akaunti yako:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px 0">${otp}</div>
            <p>Usimshirikishe mtu mwingine namba hii.</p>
            <p>Kama hukuomba OTP hii, puuza ujumbe huu.</p>
          </div>
        `
      },
      {
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    res.setHeader('Cache-Control', 'no-store');

    return res.json({
      success: true,
      otpType: signup ? 'signup' : 'magiclink',
      message: 'OTP imetumwa kupitia Brevo.'
    });
  } catch (error) {
    console.error(
      'OTP/Brevo error:',
      error.response?.data || error.message
    );

    return apiError(
      res,
      502,
      'Imeshindikana kutuma OTP. Hakiki sender email na Brevo API key.'
    );
  }
});


app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const token = String(req.body?.token || '').trim();
  const type = String(req.body?.type || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(res, 400, 'Weka barua pepe sahihi.');
  }

  if (!/^\d{6}$/.test(token)) {
    return apiError(res, 400, 'OTP lazima iwe na tarakimu 6.');
  }

  if (!['signup', 'magiclink', 'email'].includes(type)) {
    return apiError(res, 400, 'Aina ya OTP si sahihi. Omba OTP mpya.');
  }

  if (!supabase) {
    return apiError(res, 503, 'Supabase admin haijawekwa kwenye server.');
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    });

    if (error) {
      console.warn('OTP verification rejected:', {
        code: error.code || null,
        status: error.status || null,
        message: error.message
      });
      return apiError(
        res,
        400,
        'OTP si sahihi, imetumika au muda wake umeisha. Omba OTP mpya.'
      );
    }

    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      return apiError(res, 401, 'Session haikupatikana. Omba OTP mpya.');
    }

    if (type === 'signup') {
      const verifiedUser = data.user;
      if (!verifiedUser?.id) {
        return apiError(res, 401, 'Akaunti iliyothibitishwa haikupatikana. Jaribu tena.');
      }

      const { data: existingProfile, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', verifiedUser.id)
        .maybeSingle();
      if (lookupError) {
        console.error('Signup profile lookup error:', lookupError.message);
        return apiError(res, 500, 'Imeshindikana kuandaa akaunti kwa idhini ya admin.');
      }

      if (!existingProfile) {
        const metadata = verifiedUser.user_metadata || {};
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: verifiedUser.id,
            full_name: String(metadata.full_name || '').trim() || null,
            phone: String(metadata.phone || '').trim() || null,
            role: 'user',
            is_approved: false,
            is_banned: false
          });

        if (profileError) {
          const retry = await supabase
            .from('profiles')
            .select('id')
            .eq('id', verifiedUser.id)
            .maybeSingle();
          if (retry.error || !retry.data) {
            console.error('Signup profile creation error:', profileError.message);
            return apiError(res, 500, 'Usajili umethibitishwa lakini akaunti haikuandaliwa kwa idhini. Wasiliana na admin.');
          }
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (err) {
    console.error('OTP verification error:', err.message);
    return apiError(res, 500, 'Hitilafu ya server wakati wa kuthibitisha OTP.');
  }
});

app.get('/api/me', ready, requireUser, async (req, res) => {
  const profileColumns = 'id, full_name, phone, role, is_approved, is_banned, created_at';
  const reminderColumns = ', sms_reminders_enabled, sms_reminders_consent_at';
  let reminderPreferenceAvailable = true;
  let result = await supabase
    .from('profiles')
    .select(profileColumns + reminderColumns)
    .eq('id', req.user.id)
    .maybeSingle();
  if (missingSmsReminderPreference(result.error)) {
    reminderPreferenceAvailable = false;
    console.warn('SMS reminder preference migration is not applied; reminders remain disabled.');
    result = await supabase.from('profiles')
      .select(profileColumns)
      .eq('id', req.user.id)
      .maybeSingle();
  }
  let { data, error } = result;
  if (error) {
    console.error('Profile query error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata profile.');
  }


  if (!data) {
    // Profile haipo: tengeneza rekodi ya mwanachama huyu pekee.
    const metadata = req.user.user_metadata || {};
    const createQuery = supabase
      .from('profiles')
      .insert({
        id: req.user.id,
        full_name: String(metadata.full_name || '').trim() || null,
        phone: String(metadata.phone || '').trim() || null,
        role: 'user',
        is_approved: false,
        is_banned: false
      });
    const { data: created, error: createError } = await createQuery
      .select(profileColumns + (reminderPreferenceAvailable ? reminderColumns : ''))
      .single();

    if (createError) {
      // Inawezekana rekodi iliundwa kwa wakati mmoja na ombi jingine.
      const retry = await supabase
        .from('profiles')
        .select(profileColumns + (reminderPreferenceAvailable ? reminderColumns : ''))
        .eq('id', req.user.id)
        .maybeSingle();

      if (retry.error || !retry.data) {
        console.error('Profile creation error:', createError.message);
        return apiError(
          res, 500,
          'Profile haipo na imeshindikana kuundwa. Kagua jedwali profiles na columns zake kwenye Supabase.'
        );
      }

      data = retry.data;
    } else {
      data = created;
    }
  }

  data.sms_reminders_enabled = reminderPreferenceAvailable && data.sms_reminders_enabled === true;
  data.sms_reminders_available = reminderPreferenceAvailable;
  if (data.is_banned) {
    return apiError(res, 403, 'Akaunti yako imesimamishwa. Wasiliana na admin.');
  }
                                                    data.avatar_url = req.user.user_metadata?.avatar_url || null;
  res.setHeader('Cache-Control', 'no-store');
  res.json({                                          success: true,
    user: {
      id: req.user.id,
      email: req.user.email
    },
    profile: data
  });
});

app.patch('/api/me/profile', ready, requireUser, async (req, res) => {
  try {
    const fullName = String(req.body?.full_name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const reminderPreferenceProvided = Object.hasOwn(req.body || {}, 'sms_reminders_enabled');
    const smsRemindersEnabled = req.body?.sms_reminders_enabled;

    if (fullName.length < 2 || fullName.length > 100) {
      return apiError(res, 400, 'Jina liwe na herufi 2 hadi 100.');
    }
    if (phone.length > 30) {
      return apiError(res, 400, 'Namba ya simu si sahihi.');
    }
    if (reminderPreferenceProvided && typeof smsRemindersEnabled !== 'boolean') {
      return apiError(res, 400, 'Chaguo la ukumbusho wa SMS si sahihi.');
    }
    if (smsRemindersEnabled && !normalizeTanzaniaPhone(phone)) {
      return apiError(res, 400, 'Weka namba sahihi ya Tanzania kwenye wasifu kabla ya kuwasha SMS.');
    }

    const { data: current, error: currentError } = await supabase
      .from('profiles')
      .select('id, is_banned, role')
      .eq('id', req.user.id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return apiError(res, 404, 'Profile haipo. Toka kisha ingia tena.');
    }
    if (current.is_banned) {
      return apiError(res, 403, 'Akaunti yako imesimamishwa.');
    }

    // User anaweza kubadilisha jina na simu yake tu.
    // Role, idhini na hali ya kufungiwa haviwezi kubadilishwa hapa.
    const updates = { full_name: fullName, phone: phone || null };
    if (reminderPreferenceProvided) {
      updates.sms_reminders_enabled = smsRemindersEnabled;
      if (smsRemindersEnabled) updates.sms_reminders_consent_at = new Date().toISOString();
    }
    let updateQuery = supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, full_name, phone, role, is_approved, is_banned, created_at' +
        (reminderPreferenceProvided ? ', sms_reminders_enabled, sms_reminders_consent_at' : ''))
      .single();
    let { data, error } = await updateQuery;
    if (missingSmsReminderPreference(error)) {
      return apiError(res, 503, 'Washa SMS baada ya kuendesha payment reminder migration kwenye Supabase.');
    }

    if (error) throw error;
    data.sms_reminders_available = true;

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, profile: data });
  } catch (error) {
    console.error('Profile update error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhifadhi profile. Kagua columns za profiles.');
  }
});


app.post('/api/me/profile/avatar', ready, requireUser, async (req, res) => {
  try {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      .exec(String(req.body?.image || ''));
    if (!m) return apiError(res, 400, 'Chagua picha JPG, PNG au WEBP.');

    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length || bytes.length > 1800000)
      return apiError(res, 413, 'Picha ni kubwa sana. Punguza ukubwa wake.');

    const bucket = 'avatars';
    const created = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: '2MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    if (created.error) {
      const existing = await supabase.storage.getBucket(bucket);
      if (existing.error) throw created.error;
    }

    const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
    const path = req.user.id + '/profile-' + Date.now() + '.' + ext;
    const upload = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: m[1], upsert: true, cacheControl: '3600'
    });
    if (upload.error) throw upload.error;

    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const updated = await supabase.auth.admin.updateUserById(req.user.id, {
      user_metadata: { ...(req.user.user_metadata || {}), avatar_url: url }
    });
    if (updated.error) throw updated.error;

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, avatar_url: url });
  } catch (error) {
    console.error('Avatar upload error:', error.message);
    return apiError(res, 500, 'Picha haikupakiwa. Kagua SUPABASE_SERVICE_ROLE_KEY na Supabase Storage.');
  }
});

app.get('/api/members', ready, requireUser, async (req, res) => {
  try {
    const { page, pageSize, from, to } = parsePagination(req, 500, 500);
    const q = cleanSearch(req.query.q).replace(/[%,()]/g, ' ');

    let query = supabase.from('profiles')
      .select('id, full_name, created_at', { count: 'exact' })
      .neq('role', 'admin')
      .order('created_at', { ascending: true });
    if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const auth = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (auth.error) throw auth.error;
    const avatars = Object.fromEntries(
      (auth.data.users || []).map(u => [u.id, u.user_metadata?.avatar_url || null])
    );
    const members = (data || []).map(u => ({
      id: u.id,
      full_name: u.full_name || 'Mwanachama',
      avatar_url: avatars[u.id] || null
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      count: members.length,
      total: Number.isFinite(count) ? count : members.length,
      page,
      pageSize,
      members
    });
  } catch (error) {
    console.error('Members endpoint error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata orodha ya wanachama.');
  }
});


app.get('/api/dashboard', ready, requireUser, async (req, res) => {
  try {                                               const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, is_approved, is_banned')
      .eq('id', req.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return apiError(res, 404, 'Profile haijapatikana.');
    if (profile.is_banned) return apiError(res, 403, 'Akaunti imesimamishwa.');

    const { data: contributions, error: contributionError } = await supabase
      .from('contributions')
      .select('id, title, amount, due_date, status, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1000);
                                                      if (contributionError) throw contributionError;

    const paymentSelectBase = 'id, contribution_id, amount, reference, method, status, created_at, verified_at, failure_reason';
    // Hujaribu seti kamili ya columns, kisha kupunguza taratibu kama migration haijafanyika.
    const paymentColumnSets = [
      paymentSelectBase + ', rejection_reason, reviewed_at, payment_type, proof_url',
      paymentSelectBase + ', rejection_reason, reviewed_at, payment_type',
      paymentSelectBase + ', payment_type',
      paymentSelectBase
    ];
    let paymentResult = null;
    for (const cols of paymentColumnSets) {
      paymentResult = await supabase
        .from('payments')
        .select(cols)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (!paymentResult.error) break;
      if (!missingPaymentReviewMetadata(paymentResult.error) &&
          !missingPaymentType(paymentResult.error) &&
          !missingTable(paymentResult.error, 'proof_url')) break;
      console.warn('payments: kutumia seti nyepesi ya columns —', paymentResult.error.message);
    }
    const { data: payments, error: paymentError } = paymentResult;
    if (paymentError) throw paymentError;

    const allContributions = contributions || [];
    const allPayments = (payments || []).map(normalizePaymentReviewMetadata);
    const paid = allPayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const contributionPaid = allPayments
      .filter(p => p.status === 'verified' && p.payment_type !== 'game_fee')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                                                      const pending = allPayments
      .filter(p => p.status === 'pending')              .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const due = allContributions
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    res.setHeader('Cache-Control', 'no-store');
    res.json({                                          success: true,
      profile,
      stats: {
        paid, contributionPaid,                           pending,
        assigned: due,                                    balance: Math.max(0, due - contributionPaid) },
      contributions: allContributions,
      payments: allPayments
    });                                             } catch (error) {
    console.error('Dashboard error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupakia dashboard.');
  }                                               });
                                                  app.post('/api/payments', ready, requireUser, async (req, res) => {                                   try {
    const amount = Number(req.body.amount);           const reference = String(req.body.reference || '').trim();
    const method = String(req.body.method || '').trim();
    const contributionId = req.body.contributionId || null;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {                                  return apiError(res, 400, 'Kiasi cha malipo si sahihi.');
    }
    if (reference.length < 4 || reference.length > 100) {
      return apiError(res, 400, 'Weka reference sahihi ya muamala.');
    }

    const allowedMethods = ['mobile_money', 'bank', 'cash'];                                            if (!allowedMethods.includes(method)) {
      return apiError(res, 400, 'Chagua njia sahihi ya malipo.');
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')                                 .select('id, is_banned, is_approved')
      .eq('id', req.user.id)                            .maybeSingle();
                                                      if (profileError) throw profileError;
    if (!profile || profile.is_banned) {                return apiError(res, 403, 'Akaunti yako hairuhusiwi kutuma malipo.');                             }
    if (!profile.is_approved) {
      return apiError(res, 403, 'Akaunti yako inasubiri kuidhinishwa na admin.');
    }
                                                      if (contributionId) {
      const { data: contribution, error: contributionError } = await supabase
        .from('contributions')                            .select('id, user_id, amount, status')
        .eq('id', contributionId)                         .eq('user_id', req.user.id)
        .maybeSingle();

      if (contributionError) throw contributionError;
      if (!contribution || contribution.status === 'cancelled') {
        return apiError(res, 400, 'Mchango haujapatikana.');
      }
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {                                    return apiError(res, 409, 'Reference hii tayari imetumika.');
    }

    const { data, error } = await supabase
      .from('payments')                                 .insert({
        user_id: req.user.id,
        contribution_id: contributionId,
        amount,
        reference,                                        method,
        status: 'pending'
      })
      .select('id, amount, reference, method, status, created_at')                                        .single();

    if (error) {
      // 23505 = ukiukaji wa unique index ya reference (inaweza kutokea kwa mbio za wakati mmoja).
      if (error.code === '23505') {
        return apiError(res, 409, 'Reference hii tayari imetumika.');
      }
      throw error;
    }

    res.status(201).json({                              success: true,
      message: 'Ombi limepokelewa. Malipo yanasubiri kuthibitishwa na admin.',
      payment: data                                   });
  } catch (error) {                                   console.error('Payment submission error:', error.message);
    return apiError(res, 500, 'Imeshindikana kutuma ombi la malipo.');                                }
});

// Hesabu ya akiba (fallback) kama RPC ya aggregation haijasanikishwa kwenye Supabase.
async function computeAdminStatsFromTables() {
  const [usersResult, paymentsResult, contributionsResult] = await Promise.all([
    supabase.from('profiles').select('id, is_approved, is_banned, role'),
    supabase.from('payments').select('id, amount, status, created_at'),
    supabase.from('contributions').select('id, amount, status')
  ]);
  for (const result of [usersResult, paymentsResult, contributionsResult]) {
    if (result.error) throw result.error;
  }
  const allUsers = usersResult.data || [];
  const users = allUsers.filter(u => u.role !== 'admin');
  const payments = paymentsResult.data || [];
  const contributions = contributionsResult.data || [];
  return {
    users: users.length,
    active: users.filter(u => u.is_approved && !u.is_banned).length,
    blocked: users.filter(u => u.is_banned).length,
    admins: allUsers.filter(u => u.role === 'admin').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    verifiedPayments: payments.filter(p => p.status === 'verified').length,
    rejectedPayments: payments.filter(p => p.status === 'rejected').length,
    verifiedAmount: payments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    pendingAmount: payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    assignedContributions: contributions
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0)
  };
}

app.get('/api/admin/summary', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const stats = await aggregateOrCount('admin_summary_stats', {}, computeAdminStatsFromTables);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Admin summary error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata takwimu za admin.');
  }
});

app.get('/api/admin/users', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, from, to } = parsePagination(req, 500, 1000);
    const q = cleanSearch(req.query.q).replace(/[%,()]/g, ' ');
    const status = cleanSearch(req.query.status, 20).toLowerCase();

    let query = supabase.from('profiles')
      .select('id, full_name, phone, role, is_approved, is_banned, created_at', { count: 'exact' })
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    if (status === 'pending') query = query.eq('is_approved', false).eq('is_banned', false);
    else if (status === 'approved') query = query.eq('is_approved', true).eq('is_banned', false);
    else if (status === 'banned') query = query.eq('is_banned', true);
    if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const auth = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (auth.error) throw auth.error;
    const avatars = Object.fromEntries(
      (auth.data.users || []).map(u => [u.id, u.user_metadata?.avatar_url || null])
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      total: Number.isFinite(count) ? count : (data || []).length,
      page,
      pageSize,
      users: (data || []).map(u => ({ ...u, avatar_url: avatars[u.id] || null }))
    });
  } catch (error) {
    console.error('Admin users error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata wanachama.');
  }
});

app.get('/api/admin/contributions', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, from, to } = parsePagination(req, 500, 1000);
    const status = cleanSearch(req.query.status, 20).toLowerCase();
    const userId = cleanSearch(req.query.user_id, 64);
    const q = cleanSearch(req.query.q).replace(/[%,()]/g, ' ');

    let query = supabase
      .from('contributions')
      .select('id, user_id, title, amount, due_date, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status === 'cancelled') query = query.eq('status', 'cancelled');
    else if (status === 'active') query = query.neq('status', 'cancelled');
    if (userId) query = query.eq('user_id', userId);
    if (q) query = query.ilike('title', `%${q}%`);
    const { data: rows, error, count } = await query.range(from, to);

    if (error) throw error;
    const userIds = [...new Set((rows || []).map(row => row.user_id).filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const result = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    const profileMap = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      total: Number.isFinite(count) ? count : (rows || []).length,
      page,
      pageSize,
      contributions: (rows || []).map(row => ({
        ...row,
        profile: profileMap[row.user_id] || null
      }))
    });
  } catch (error) {
    console.error('Admin contributions error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata michango.');
  }
});

app.post('/api/admin/contributions', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const userId = String(req.body?.user_id || '').trim();
    const title = String(req.body?.title || '').trim();
    const amount = Number(req.body?.amount);
    const dueDate = req.body?.due_date ? String(req.body.due_date) : null;

    if (!userId) return apiError(res, 400, 'Chagua mwanachama.');
    if (title.length < 2 || title.length > 120) {
      return apiError(res, 400, 'Jina la mchango liwe na herufi 2 hadi 120.');
    }
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) {
      return apiError(res, 400, 'Kiasi kiwe kati ya TSh 100 na TSh 100,000,000.');
    }
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
        Number.isNaN(Date.parse(dueDate + 'T00:00:00Z')) ||
        new Date(dueDate + 'T00:00:00Z').toISOString().slice(0, 10) !== dueDate)) {
      return apiError(res, 400, 'Tarehe ya mwisho si sahihi.');
    }

    const { data: member, error: memberError } = await supabase
      .from('profiles')
      .select('id, role, is_banned')
      .eq('id', userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member || member.role === 'admin' || member.is_banned) {
      return apiError(res, 400, 'Mwanachama hayupo au akaunti imesimamishwa.');
    }

    const { data, error } = await supabase
      .from('contributions')
      .insert({ user_id: userId, title, amount, due_date: dueDate })
      .select('id, user_id, title, amount, due_date, status, created_at')
      .single();
    if (error) throw error;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, contribution: data });
  } catch (error) {
    console.error('Admin contribution creation error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuunda mchango.');
  }
});

app.patch('/api/admin/contributions/:id', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const amount = Number(req.body?.amount);
    const dueDate = req.body?.due_date ? String(req.body.due_date) : null;

    if (title.length < 2 || title.length > 120) {
      return apiError(res, 400, 'Jina la mchango liwe na herufi 2 hadi 120.');
    }
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000) {
      return apiError(res, 400, 'Kiasi kiwe kati ya TSh 100 na TSh 100,000,000.');
    }
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
        Number.isNaN(Date.parse(dueDate + 'T00:00:00Z')) ||
        new Date(dueDate + 'T00:00:00Z').toISOString().slice(0, 10) !== dueDate)) {
      return apiError(res, 400, 'Tarehe ya mwisho si sahihi.');
    }

    const { data, error } = await supabase
      .from('contributions')
      .update({ title, amount, due_date: dueDate })
      .eq('id', req.params.id)
      .neq('status', 'cancelled')
      .select('id, user_id, title, amount, due_date, status, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(res, 404, 'Mchango haujapatikana au tayari umeghairiwa.');
    return res.json({ success: true, contribution: data });
  } catch (error) {
    console.error('Admin contribution update error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhifadhi mabadiliko ya mchango.');
  }
});

app.post('/api/admin/contributions/:id/cancel', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contributions')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .neq('status', 'cancelled')
      .select('id, status')
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(res, 404, 'Mchango haujapatikana au tayari umeghairiwa.');
    return res.json({ success: true, contribution: data });
  } catch (error) {
    console.error('Admin contribution cancellation error:', error.message);
    return apiError(res, 500, 'Imeshindikana kughairi mchango.');
  }
});

app.post('/api/cron/payment-reminders', ready, async (req, res) => {
  const expectedSecret = process.env.REMINDER_CRON_SECRET;
  if (!expectedSecret || !matchesCronSecret(req.headers.authorization?.replace(/^Bearer\s+/i, ''), expectedSecret)) {
    return apiError(res, 401, 'Ruhusa ya ratiba ya vikumbusho si sahihi.');
  }
  if (!process.env.BEEM_API_KEY || !process.env.BEEM_SECRET_KEY || !process.env.BEEM_SOURCE_ADDR) {
    return apiError(res, 503, 'Huduma ya SMS haijawekwa vizuri kwenye server.');
  }

  const today = tanzaniaDate();
  try {
    const profiles = await readReminderRows(() => supabase
      .from('profiles')
      .select('id, phone')
      .eq('sms_reminders_enabled', true)
      .eq('is_approved', true)
      .eq('is_banned', false)
      .order('id', { ascending: true }));
    if (!profiles?.length) return res.json({ success: true, date: today, sent: 0, failed: 0, skipped: 0 });

    const memberIds = profiles.map(profile => profile.id);
    const contributions = [];
    for (let offset = 0; offset < memberIds.length; offset += 100) {
      const batch = memberIds.slice(offset, offset + 100);
      const memberContributions = await readReminderRows(() => supabase
        .from('contributions')
        .select('id, user_id, title, amount, due_date, status')
        .in('user_id', batch)
        .neq('status', 'cancelled')
        .not('due_date', 'is', null)
        .order('id', { ascending: true }));
      contributions.push(...memberContributions);
    }

    const payments = [];
    const contributionIds = contributions.map(contribution => contribution.id);
    for (let offset = 0; offset < contributionIds.length; offset += 100) {
      const batch = contributionIds.slice(offset, offset + 100);
      const contributionPayments = await readReminderRows(() => supabase
        .from('payments')
        .select('contribution_id, amount, payment_type')
        .eq('status', 'verified')
        .in('contribution_id', batch)
        .order('id', { ascending: true }));
      payments.push(...contributionPayments);
    }

    const membersById = new Map(profiles.map(profile => [profile.id, profile]));
    const paidByContribution = new Map();
    for (const payment of payments || []) {
      if (payment.payment_type === 'game_fee') continue;
      const paymentAmount = Number(payment.amount || 0);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) continue;
      const id = payment.contribution_id;
      paidByContribution.set(id, (paidByContribution.get(id) || 0) + paymentAmount);
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const contribution of contributions || []) {
      const reminderType = reminderTypeForDate(contribution.due_date, today);
      if (!reminderType) continue;
      const member = membersById.get(contribution.user_id);
      const phone = normalizeTanzaniaPhone(member?.phone);
      const amount = Number(contribution.amount || 0);
      const balance = Math.max(0, amount - (paidByContribution.get(contribution.id) || 0));
      if (!member || !phone || !Number.isFinite(amount) || amount <= 0 || balance <= 0) {
        skipped++;
        continue;
      }

      let reminderId;
      try {
        reminderId = await reserveReminder(contribution.id, reminderType, today);
      } catch (error) {
        console.error('Payment reminder reservation error:', error.message);
        failed++;
        continue;
      }
      if (!reminderId) {
        skipped++;
        continue;
      }

      const message = reminderType === 'due_soon'
        ? `Mchezo Wetu: Salio la mchango wa ${contribution.title || 'kikundi'} ni TSh ${balance.toLocaleString('en-US')}; mwisho ${contribution.due_date}. Lipa kwa wakati.`
        : reminderType === 'due_today'
          ? `Mchezo Wetu: Leo ndiyo mwisho wa kulipa salio la TSh ${balance.toLocaleString('en-US')} kwa ${contribution.title || 'kikundi'}.`
          : `Mchezo Wetu: Salio la TSh ${balance.toLocaleString('en-US')} kwa ${contribution.title || 'kikundi'} limechelewa. Tafadhali lipa au wasiliana na msimamizi.`;
      let providerMessageId;
      try {
        providerMessageId = await sendBeemReminder(phone, message);
      } catch (error) {
        const reason = String(error.response?.data?.message || error.message || 'SMS imeshindwa kutumwa.').slice(0, 500);
        const { error: updateError } = await supabase
          .from('payment_reminder_logs')
          .update({ status: 'failed', error: reason, updated_at: new Date().toISOString() })
          .eq('id', reminderId);
        if (updateError) console.error('Payment reminder failure log error:', updateError.message);
        console.error('Payment reminder delivery error:', reason);
        failed++;
        continue;
      }

      const sentAt = new Date().toISOString();
      const { error: sentLogError } = await supabase
        .from('payment_reminder_logs')
        .update({
          status: 'sent',
          provider_message_id: providerMessageId || null,
          error: null,
          sent_at: sentAt,
          updated_at: sentAt
        })
        .eq('id', reminderId);
      if (sentLogError) {
        console.error('SMS sent but reminder log could not be updated:', sentLogError.message);
        failed++;
        continue;
      }
      sent++;
    }

    return res.json({ success: true, date: today, sent, failed, skipped });
  } catch (error) {
    if (missingReminderSchema(error)) {
      console.error('Payment reminder migration is not applied:', error.message);
      return apiError(res, 503, 'Migration ya vikumbusho vya SMS haijaendeshwa kwenye Supabase.');
    }
    console.error('Payment reminder scheduler error:', error.message);
    return apiError(res, 500, 'Imeshindikana kutuma vikumbusho vya SMS.');
  }
});

app.post('/api/admin/users/:id/action', ready, requireUser, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const action = String(req.body?.action || '');
  const allowed = ['approve', 'ban', 'unban'];

  if (!allowed.includes(action)) {
    return apiError(res, 400, 'Kitendo hakitambuliki.');
  }
  if (userId === req.user.id && action === 'ban') {
    return apiError(res, 400, 'Huwezi kusimamisha akaunti yako mwenyewe.');
  }
  try {
    const updates = {
      approve: { is_approved: true },
      ban: { is_banned: true },
      unban: { is_banned: false }
    };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates[action])
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Admin user action error:', error.message);
      return apiError(res, 500, 'Imeshindikana kubadilisha akaunti.');
    }
    if (!data) return apiError(res, 404, 'Mwanachama hajapatikana.');

    await insertAudit(req.user.id, `user_${action}`, userId, {});

    // Arifa ya barua pepe kwa mwanachama (haizuidii jibu).
    if (action === 'approve' || action === 'ban') {
      void memberEmailById(userId).then(email => {
        if (!email) return;
        if (action === 'approve') {
          return sendMemberEmail(email, 'Akaunti yako imeidhinishwa - Mchezo Wetu',
            '<p>Akaunti yako imeidhinishwa. Sasa unaweza kuingia na kuwasilisha malipo.</p>');
        }
        return sendMemberEmail(email, 'Akaunti yako imesimamishwa - Mchezo Wetu',
          '<p>Akaunti yako imesimamishwa. Wasiliana na msimamizi wa kikundi.</p>');
      });
    }

    return res.json({ success: true, message: 'Mabadiliko yamehifadhiwa.' });
  } catch (error) {
    console.error('Admin user action exception:', error.message);
    return apiError(res, 500, 'Hitilafu wakati wa kubadilisha akaunti.');
  }
});

app.get('/api/admin/payments', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, from, to } = parsePagination(req, 500, 1000);
    const status = cleanSearch(req.query.status, 20).toLowerCase();
    const userId = cleanSearch(req.query.user_id, 64);
    const q = cleanSearch(req.query.q).replace(/[%,()]/g, ' ');

    const baseCols = 'id, user_id, contribution_id, amount, reference, method, status, created_at, verified_at, failure_reason';
    const fullCols = baseCols + ', rejection_reason, reviewed_at';

    const build = (cols) => {
      let query = supabase
        .from('payments')
        .select(cols, { count: 'exact' })
        .order('created_at', { ascending: false });
      if (['pending', 'verified', 'rejected'].includes(status)) query = query.eq('status', status);
      if (userId) query = query.eq('user_id', userId);
      if (q) query = query.ilike('reference', `%${q}%`);
      return query.range(from, to);
    };

    // Hujaribu seti kamili ya columns, kisha kupunguza taratibu kama migration haijafanyika.
    const columnSets = [
      fullCols + ', proof_url',
      fullCols,
      baseCols
    ];
    let result = null;
    for (const cols of columnSets) {
      result = await build(cols);
      if (!result.error) break;
      if (!missingPaymentReviewMetadata(result.error) && !missingTable(result.error, 'proof_url')) break;
      console.warn('payments: kutumia seti nyepesi ya columns —', result.error.message);
    }
    const { data: rows, error, count } = result;
    if (error) {
      console.error('Admin payments error:', error);
      return apiError(res, 500, 'Imeshindikana kupata malipo. Kagua schema ya jedwali payments kwenye Supabase.');
    }

    const payments = rows || [];
    const userIds = [...new Set(payments.map(x => x.user_id).filter(Boolean))];
    let profiles = [];

    if (userIds.length) {
      const profileResult = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      if (profileResult.error) {
        throw profileResult.error;
      }
      profiles = profileResult.data || [];
    }

    const profileMap = Object.fromEntries(profiles.map(x => [x.id, x]));
    const enriched = payments.map(payment => ({
      ...normalizePaymentReviewMetadata(payment),
      profiles: profileMap[payment.user_id] || null
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      total: Number.isFinite(count) ? count : payments.length,
      page,
      pageSize,
      payments: enriched
    });
  } catch (err) {
    console.error('Admin payments exception:', err);
    return apiError(res, 500, 'Hitilafu wakati wa kupata malipo.');
  }
});

// Mchezo Wetu: admin payment review
app.post('/api/admin/payments/:id/review', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id;
    const action = String(req.body?.action || '').toLowerCase();
    const reason = String(req.body?.reason || '').trim();

    if (!paymentId || !['verify', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'Payment ID au action si sahihi.'
      });
    }
    if (action === 'reject' && (reason.length < 3 || reason.length > 500)) {
      return apiError(res, 400, 'Andika sababu ya kukataa (herufi 3 hadi 500).');
    }

    const newStatus = action === 'verify' ? 'verified' : 'rejected';

    let reviewResult = await supabase
      .from('payments')
      .update({
        status: newStatus,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        verified_at: action === 'verify' ? new Date().toISOString() : null,
        rejection_reason: action === 'reject' ? reason : null
      })
      .eq('id', paymentId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (missingPaymentReviewMetadata(reviewResult.error)) {
      console.warn('Payment review metadata migration is not applied; saving the review reason in failure_reason.');
      reviewResult = await supabase
        .from('payments')
        .update({
          status: newStatus,
          verified_at: action === 'verify' ? new Date().toISOString() : null,
          failure_reason: action === 'reject' ? reason : null
        })
        .eq('id', paymentId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
    }
    const { data, error } = reviewResult;
    if (error) {
      console.error('Payment review error:', error);
      return apiError(res, 500, 'Imeshindikana kuhakiki malipo. Kagua schema ya jedwali payments kwenye Supabase.');
    }

    if (!data) {
      return res.status(409).json({
        error: 'Malipo hayapo au tayari yameshakaguliwa.'
      });
    }

    await insertAudit(req.user.id, `payment_${action}`, paymentId, {
      reference: data.reference || null,
      reason: action === 'reject' ? reason : null
    });

    // Arifa ya barua pepe kwa mwanachama (haizuidii jibu).
    if (data.user_id) {
      void memberEmailById(data.user_id).then(email => {
        if (!email) return;
        const amountLabel = 'TSh ' + Number(data.amount || 0).toLocaleString('en-US');
        if (action === 'verify') {
          return sendMemberEmail(email, 'Malipo yako yamethibitishwa - Mchezo Wetu',
            `<p>Malipo yako ya ${amountLabel} (reference ${String(data.reference || '').replace(/[<>]/g, '')}) yamethibitishwa. Asante.</p>`);
        }
        return sendMemberEmail(email, 'Malipo yako yamekataliwa - Mchezo Wetu',
          `<p>Malipo yako ya ${amountLabel} hayakuthibitishwa. Sababu: ${reason.replace(/[<>]/g, '')}</p>`);
      });
    }

    return res.json({
      success: true,
      message: action === 'verify'
        ? 'Malipo yamethibitishwa.'
        : 'Malipo yamekataliwa.',
      payment: data
    });
  } catch (error) {
    console.error('Payment review exception:', error);
    return res.status(500).json({
      error: 'Hitilafu ya ndani wakati wa kuhakiki malipo.'
    });
  }
});

// ===== KUMBUKUMBU YA VITENDO (audit) =====
async function insertAudit(actorId, action, targetId, details = {}) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_id: actorId,
    action,
    target_id: targetId || null,
    details
  });
  if (error) console.error('Audit log error:', error.message);
}

// Hutuma barua pepe kwa mwanachama (haitazuia jibu la API hata ikishindwa).
async function sendMemberEmail(email, subject, html) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !email) return;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || ADMIN_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Mchezo Wetu';
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:520px;margin:auto">
        <h2>Mchezo Wetu</h2>${html}</div>`
    }, {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 15000
    });
  } catch (error) {
    console.error('Member email error:', error.response?.data || error.message);
  }
}

async function memberEmailById(userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error('Member email lookup error:', error.message);
    return null;
  }
  return data?.user?.email || null;
}

app.get('/api/admin/audit-logs', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, from, to } = parsePagination(req, 100, 200);
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, target_id, details, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      if (missingTable(error, 'audit_logs')) {
        return res.json({ success: true, total: 0, page, pageSize, logs: [] });
      }
      throw error;
    }
    const actorIds = [...new Set((data || []).map(row => row.actor_id).filter(Boolean))];
    let actorNames = {};
    if (actorIds.length) {
      const profiles = await supabase.from('profiles').select('id, full_name').in('id', actorIds);
      if (!profiles.error) {
        actorNames = Object.fromEntries((profiles.data || []).map(x => [x.id, x.full_name]));
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      total: Number.isFinite(count) ? count : (data || []).length,
      page,
      pageSize,
      logs: (data || []).map(row => ({ ...row, actor_name: actorNames[row.actor_id] || null }))
    });
  } catch (error) {
    console.error('Audit logs error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata kumbukumbu za vitendo.');
  }
});

// ===== MATANGAZO (announcements) =====
app.get('/api/announcements', ready, requireUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (missingTable(error, 'announcements')) {
        return res.json({ success: true, announcements: [] });
      }
      throw error;
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, announcements: data || [] });
  } catch (error) {
    console.error('Announcements list error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata matangazo.');
  }
});

app.get('/api/admin/announcements', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, is_active, created_by, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      if (missingTable(error, 'announcements')) {
        return res.json({ success: true, announcements: [] });
      }
      throw error;
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, announcements: data || [] });
  } catch (error) {
    console.error('Admin announcements error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata matangazo.');
  }
});

app.post('/api/admin/announcements', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const isActive = req.body?.is_active === false ? false : true;

    if (title.length < 3 || title.length > 120) {
      return apiError(res, 400, 'Kichwa cha tangazo kiwe na herufi 3 hadi 120.');
    }
    if (body.length < 3 || body.length > 2000) {
      return apiError(res, 400, 'Maudhui ya tangazo yawe na herufi 3 hadi 2000.');
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({ title, body, is_active: isActive, created_by: req.user.id })
      .select('id, title, body, is_active, created_at')
      .single();
    if (error) {
      if (missingTable(error, 'announcements')) {
        return apiError(res, 503, 'Jedwali la matangazo halijasanikishwa. Endesha migration ya Supabase.');
      }
      throw error;
    }

    await insertAudit(req.user.id, 'announcement_created', data.id, { title });
    return res.status(201).json({ success: true, announcement: data });
  } catch (error) {
    console.error('Announcement create error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuunda tangazo.');
  }
});

app.patch('/api/admin/announcements/:id', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const updates = {};
    if (Object.hasOwn(req.body || {}, 'title')) {
      const title = String(req.body.title || '').trim();
      if (title.length < 3 || title.length > 120) {
        return apiError(res, 400, 'Kichwa cha tangazo kiwe na herufi 3 hadi 120.');
      }
      updates.title = title;
    }
    if (Object.hasOwn(req.body || {}, 'body')) {
      const body = String(req.body.body || '').trim();
      if (body.length < 3 || body.length > 2000) {
        return apiError(res, 400, 'Maudhui ya tangazo yawe na herufi 3 hadi 2000.');
      }
      updates.body = body;
    }
    if (Object.hasOwn(req.body || {}, 'is_active')) {
      updates.is_active = req.body.is_active === true;
    }
    if (!Object.keys(updates).length) {
      return apiError(res, 400, 'Hakuna mabadiliko yaliyotumwa.');
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, title, body, is_active, updated_at')
      .maybeSingle();
    if (error) {
      if (missingTable(error, 'announcements')) {
        return apiError(res, 503, 'Jedwali la matangazo halijasanikishwa.');
      }
      throw error;
    }
    if (!data) return apiError(res, 404, 'Tangazo halipatikani.');
    await insertAudit(req.user.id, 'announcement_updated', data.id, {});
    return res.json({ success: true, announcement: data });
  } catch (error) {
    console.error('Announcement update error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhifadhi tangazo.');
  }
});

app.delete('/api/admin/announcements/:id', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();
    if (error) {
      if (missingTable(error, 'announcements')) {
        return apiError(res, 503, 'Jedwali la matangazo halijasanikishwa.');
      }
      throw error;
    }
    if (!data) return apiError(res, 404, 'Tangazo halipatikani.');
    await insertAudit(req.user.id, 'announcement_deleted', data.id, {});
    return res.json({ success: true, message: 'Tangazo limefutwa.' });
  } catch (error) {
    console.error('Announcement delete error:', error.message);
    return apiError(res, 500, 'Imeshindikana kufuta tangazo.');
  }
});

// ===== MAELEZO YA MWANACHAMA MMOJA (admin) =====
app.get('/api/admin/members/:id', ready, requireUser, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || '').trim();
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, is_approved, is_banned, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return apiError(res, 404, 'Mwanachama hajapatikana.');

    const [contributionsResult, paymentsResult, authUser] = await Promise.all([
      supabase
        .from('contributions')
        .select('id, title, amount, due_date, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('payments')
        .select('id, contribution_id, amount, reference, method, status, created_at, verified_at, failure_reason')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.auth.admin.getUserById(userId)
    ]);
    if (contributionsResult.error) throw contributionsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const contributions = contributionsResult.data || [];
    const payments = paymentsResult.data || [];
    const paid = payments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const assigned = contributions
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      profile,
      stats: { paid, pending, assigned, balance: Math.max(0, assigned - paid) },
      contributions,
      payments,
      avatar_url: authUser?.data?.user?.user_metadata?.avatar_url || null
    });
  } catch (error) {
    console.error('Admin member detail error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata taarifa za mwanachama.');
  }
});

// ===== VITENDO KWA WANACHAMA WENGI (bulk) =====
app.post('/api/admin/users/bulk-action', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const action = String(req.body?.action || '').toLowerCase();
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map(String).filter(Boolean))].slice(0, 500)
      : [];

    if (!['approve', 'ban', 'unban'].includes(action)) {
      return apiError(res, 400, 'Kitendo hakitambuliki.');
    }
    if (!ids.length) {
      return apiError(res, 400, 'Chagua wanachama angalau mmoja.');
    }
    const targets = ids.filter(id => !(id === req.user.id && action === 'ban'));
    if (!targets.length) {
      return apiError(res, 400, 'Hakuna mwanachama sahihi uliyechagua.');
    }

    const updates = {
      approve: { is_approved: true },
      ban: { is_banned: true },
      unban: { is_banned: false }
    };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates[action])
      .in('id', targets)
      .neq('role', 'admin')
      .select('id');
    if (error) throw error;

    await insertAudit(req.user.id, `user_bulk_${action}`, targets[0] || null, { ids: targets });
    return res.json({ success: true, updated: (data || []).length });
  } catch (error) {
    console.error('Admin bulk user action error:', error.message);
    return apiError(res, 500, 'Imeshindikana kutekeleza kitendo kwa wanachama.');
  }
});

app.post('/api/admin/payments/bulk-review', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const action = String(req.body?.action || '').toLowerCase();
    const reason = String(req.body?.reason || '').trim();
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map(String).filter(Boolean))].slice(0, 500)
      : [];

    if (!['verify', 'reject'].includes(action)) {
      return apiError(res, 400, 'Kitendo hakitambuliki.');
    }
    if (!ids.length) {
      return apiError(res, 400, 'Chagua malipo angalau moja.');
    }
    if (action === 'reject' && (reason.length < 3 || reason.length > 500)) {
      return apiError(res, 400, 'Andika sababu ya kukataa (herufi 3 hadi 500).');
    }

    const newStatus = action === 'verify' ? 'verified' : 'rejected';
    const now = new Date().toISOString();
    const runUpdate = (payload) => supabase
      .from('payments')
      .update(payload)
      .in('id', ids)
      .eq('status', 'pending')
      .select('id');

    let result = await runUpdate({
      status: newStatus,
      reviewed_by: req.user.id,
      reviewed_at: now,
      verified_at: action === 'verify' ? now : null,
      rejection_reason: action === 'reject' ? reason : null
    });
    if (missingPaymentReviewMetadata(result.error)) {
      result = await runUpdate({
        status: newStatus,
        verified_at: action === 'verify' ? now : null,
        failure_reason: action === 'reject' ? reason : null
      });
    }
    if (result.error) throw result.error;

    await insertAudit(req.user.id, `payment_bulk_${action}`, ids[0] || null, {
      ids: (result.data || []).map(row => row.id),
      reason: action === 'reject' ? reason : null
    });
    return res.json({ success: true, updated: (result.data || []).length });
  } catch (error) {
    console.error('Admin bulk payment review error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhakiki malipo yaliyochaguliwa.');
  }
});

// ===== UTHIBITISHO WA MALIPO (picha ya risiti) =====
app.post('/api/payments/:id/proof', ready, requireUser, async (req, res) => {
  try {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      .exec(String(req.body?.image || ''));
    if (!match) return apiError(res, 400, 'Chagua picha JPG, PNG au WEBP.');

    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > 1800000) {
      return apiError(res, 413, 'Picha ni kubwa sana. Punguza ukubwa wake.');
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, user_id, status')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!payment) return apiError(res, 404, 'Malipo hayapatikani.');
    if (payment.status !== 'pending') {
      return apiError(res, 409, 'Huwezi kuongeza uthibitisho kwenye malipo yaliyokwisha hakikiwa.');
    }

    const bucket = 'payment-proofs';
    const created = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: '2MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    if (created.error) {
      const existing = await supabase.storage.getBucket(bucket);
      if (existing.error) throw created.error;
    }

    const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
    const path = req.user.id + '/' + payment.id + '-' + Date.now() + '.' + ext;
    const upload = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: match[1], upsert: true, cacheControl: '3600'
    });
    if (upload.error) throw upload.error;

    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const update = await supabase
      .from('payments')
      .update({ proof_url: url })
      .eq('id', payment.id)
      .eq('user_id', req.user.id)
      .select('id, proof_url')
      .maybeSingle();
    if (update.error) {
      if (missingTable(update.error, 'proof_url')) {
        return apiError(res, 503, 'Column ya proof_url haipo. Endesha migration ya Supabase.');
      }
      throw update.error;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, proof_url: url, payment: update.data });
  } catch (error) {
    console.error('Payment proof upload error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupakia uthibitisho wa malipo.');
  }
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signup', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'manifest.webmanifest'));
});

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

app.get('/app-pwa.js', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'app-pwa.js'));
});

app.get('/offline.html', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'offline.html'));
});

const PWA_ICONS = {
  '/pwa-icon.svg': 'image/svg+xml',
  '/pwa-icon-maskable.svg': 'image/svg+xml',
  '/pwa-icon-192.png': 'image/png',
  '/pwa-icon-512.png': 'image/png',
  '/pwa-icon-maskable-512.png': 'image/png'
};

app.get(Object.keys(PWA_ICONS), (req, res) => {
  const type = PWA_ICONS[req.path];
  if (!type) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(type);
  res.sendFile(path.join(__dirname, path.basename(req.path)));
});

app.get(['/mchezo-wetu-logo.svg', '/admin/mchezo-wetu-logo.svg'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('image/svg+xml');
  res.sendFile(path.join(__dirname, 'mchezo-wetu-logo.svg'));
});

app.post('/api/payments/sonicpesa', ready, requireUser, async (req, res) => {
  try {
    const apiKey = process.env.SONICPESA_API_KEY;
    if (!apiKey) return apiError(res, 503, 'SonicPesa API key haijawekwa.');

    const amount = Number(req.body.amount);
    let phone = String(req.body.phone || '').replace(/[\s()+-]/g, '');
    if (phone.startsWith('0')) phone = '255' + phone.slice(1);

    const channel = String(req.body.channel || '').toUpperCase();
    const paymentType = String(req.body.paymentType || '');
    const contributionId = req.body.contributionId || null;

    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000)
      return apiError(res, 400, 'Kiasi si sahihi.');
    if (!/^255\d{9}$/.test(phone))
      return apiError(res, 400, 'Tumia namba ya Tanzania, mfano 255712345678.');
    if (!['MPESA','MIXX','AIRTELMONEY','HALOPESA'].includes(channel))
      return apiError(res, 400, 'Chagua mtandao sahihi.');
    if (!['contribution','game_fee'].includes(paymentType))
      return apiError(res, 400, 'Chagua aina ya malipo.');

    const { data: profile, error: pe } = await supabase
      .from('profiles')
      .select('id,full_name,is_banned,is_approved')
      .eq('id', req.user.id).maybeSingle();

    if (pe) throw pe;
    if (!profile || profile.is_banned || !profile.is_approved)
      return apiError(res, 403, 'Akaunti yako inahitaji kuidhinishwa na admin.');
    if (!req.user.email)
      return apiError(res, 400, 'Akaunti yako haina email.');

    if (contributionId) {
      const { data: c, error: ce } = await supabase
        .from('contributions').select('id,status,user_id')
        .eq('id', contributionId).eq('user_id', req.user.id).maybeSingle();
      if (ce) throw ce;
      if (!c || c.status === 'cancelled')
        return apiError(res, 400, 'Mchango haupatikani.');
    }

    const reference = 'MW-' + Date.now() + '-' +
      crypto.randomBytes(4).toString('hex').toUpperCase();

    const { data: payment, error: ie } = await supabase.from('payments').insert({
      user_id: req.user.id,
      contribution_id: contributionId,
      amount, reference, method: 'mobile_money', status: 'pending',
      provider: 'sonicpesa', payment_type: paymentType,
      phone, channel, provider_status: 'PENDING'
    }).select('id').single();

    if (ie) throw ie;

    try {
      const r = await axios.post(
        'https://api.sonicpesa.com/api/v1/payment/create_order',
        {
          buyer_email: req.user.email,
          buyer_name: profile.full_name || req.user.email,
          buyer_phone: phone,
          amount,
          currency: 'TZS'
        },
        {
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
          timeout: 15000
        }
      );

      const d = r.data || {};
      const order = d.data || {};
      if (String(d.status || '').toLowerCase() !== 'success' || !order.order_id) {
        await supabase.from('payments').update({
          status: 'rejected', provider_status: 'ORDER_FAILED',
          failure_reason: String(d.message || 'Order creation failed').slice(0,300)
        }).eq('id', payment.id);
        return apiError(res, 502, 'SonicPesa haikukubali ombi la malipo.');
      }

      const { error: ue } = await supabase.from('payments').update({
        sonicpesa_order_id: String(order.order_id),
        provider_status: String(order.payment_status || order.status || 'PENDING')
      }).eq('id', payment.id);
      if (ue) throw ue;

      return res.status(201).json({
        success: true,
        message: 'Ombi limetumwa. Fuata maelekezo kwenye simu yako.',
        payment: { id: payment.id, reference, order_id: order.order_id, amount, status: 'pending' }
      });
    } catch (e) {
      console.error('SonicPesa create-order error:', e.response?.data || e.message);
      await supabase.from('payments').update({
        status: 'rejected', provider_status: 'ORDER_FAILED',
        failure_reason: String(e.message || 'Provider error').slice(0,300)
      }).eq('id', payment.id);
      return apiError(res, 502, 'Ombi la SonicPesa limeshindwa. Kagua Render Logs.');
    }
  } catch (e) {
    console.error('SonicPesa route error:', e.message);
    if (e.code === '42501' && /payments/i.test(String(e.message || ''))) {
      return apiError(
        res,
        503,
        'Supabase imekataa ruhusa ya kuandika malipo. Admin akague grants za service_role kwenye public.payments.'
      );
    }
    return apiError(res, 500, 'Hitilafu ya kuanzisha malipo.');
  }
});

app.post('/webhook/sonicpesa', async (req, res) => {
  try {
    const secret = process.env.SONICPESA_API_SECRET;
    if (!supabase || !secret) return res.status(503).send('Webhook not configured');

    const sig = String(req.headers['x-sonicpesa-signature'] || '').replace(/^sha256=/i,'');
    if (!req.rawBody || !/^[a-f0-9]{64}$/i.test(sig))
      return res.status(401).send('Invalid signature');

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest();
    const received = Buffer.from(sig, 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected))
      return res.status(401).send('Invalid signature');

    const b = req.body || {};
    const orderId = String(b.order_id || '');
    if (!orderId) return res.status(400).send('Missing order_id');

    const { data: p, error: pe } = await supabase.from('payments')
      .select('id,amount,status').eq('sonicpesa_order_id', orderId).maybeSingle();
    if (pe) throw pe;
    if (!p) return res.status(200).send('Unknown order ignored');
    if (p.status === 'verified') return res.status(200).send('Already processed');

    if (String(b.currency || '').toUpperCase() !== 'TZS' ||
        Number(b.amount) !== Number(p.amount))
      return res.status(400).send('Amount or currency mismatch');

    if (b.event === 'payment.completed' && String(b.status).toUpperCase() === 'SUCCESS') {
      const { error } = await supabase.from('payments').update({
        status: 'verified', verified_at: new Date().toISOString(),
        provider_status: 'SUCCESS',
        provider_transid: b.transid ? String(b.transid) : null
      }).eq('id', p.id).eq('status','pending');
      if (error) throw error;
    } else if (
      ['payment.failed','payment.cancelled'].includes(String(b.event)) ||
      ['REJECTED','CANCELLED','USERCANCELLED'].includes(String(b.status).toUpperCase())
    ) {
      const { error } = await supabase.from('payments').update({
        status: 'rejected',
        provider_status: String(b.status || b.event),
        failure_reason: String(b.event || 'Payment failed')
      }).eq('id', p.id).eq('status','pending');
      if (error) throw error;
    }
    return res.status(200).send('OK');
  } catch (e) {
    console.error('SonicPesa webhook error:', e.message);
    return res.status(500).send('Webhook processing failed');
  }
});


app.use('/api', (req, res) => apiError(res, 404, 'API haijapatikana.'));

app.use((req, res) => res.status(404).send('Ukurasa haujapatikana.'));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Mchezo Wetu server running on port ${PORT}`);
  });
}

module.exports = app;
