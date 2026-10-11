const express = require('express');               const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

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
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');         res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');                    next();
});
app.use(express.json({ limit: '20kb' }));         app.use(express.urlencoded({ extended: false, limit: '20kb' }));
function apiError(res, status, message) {
  return res.status(status).json({ success: false, error: message });                               }
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


// ADMIN OTP AUTH ROUTES - MCH EZO WETU
const ADMIN_EMAIL = 'hackertrick1997@gmail.com';

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
        message: 'Akaunti ya admin haipo Supabase Auth.'
      });
    }

    await ensurePrimaryAdminProfile(user);
    const profile = await checkAdminProfile(user.id);
    const allowed = profile?.role === 'admin' &&
      !profile?.is_banned &&
      user.app_metadata?.admin_password_set !== true;

    return res.json({ success: true, setupAllowed: allowed });
  } catch (error) {
    console.error('Admin status error:', error.message);
    return apiError(res, 500, 'Imeshindikana kukagua hali ya admin.');
  }
});

app.post('/api/admin/auth/setup', ready, async (req, res) => {
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

app.post('/api/admin/auth/send-otp', ready, async (req, res) => {
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

app.post('/api/admin/auth/verify-otp', ready, async (req, res) => {
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
    supabaseAnonKey: SUPABASE_ANON_KEY              });
});

app.post('/api/auth/send-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email === 'hackertrick1997@gmail.com') {
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
      otpType: 'email',
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


app.post('/api/auth/verify-otp', async (req, res) => {
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
      type: 'email'
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
  let { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_approved, is_banned, created_at')
    .eq('id', req.user.id)
    .maybeSingle();
                                                    if (error) {
    console.error('Profile query error:', error.message);                                               return apiError(res, 500, 'Imeshindikana kupata profile.');                                       }


  if (!data) {
    // Profile haipo: tengeneza rekodi ya mwanachama huyu pekee.
    const metadata = req.user.user_metadata || {};
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: req.user.id,
        full_name: String(metadata.full_name || '').trim() || null,
        phone: String(metadata.phone || '').trim() || null,
        role: 'user',
        is_approved: false,
        is_banned: false
      })
      .select('id, full_name, phone, role, is_approved, is_banned, created_at')
      .single();

    if (createError) {
      // Inawezekana rekodi iliundwa kwa wakati mmoja na ombi jingine.
      const retry = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, is_approved, is_banned, created_at')
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

  if (data.is_banned) {
    return apiError(res, 403, 'Akaunti yako imesimamishwa. Wasiliana na admin.');
  }
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

    if (fullName.length < 2 || fullName.length > 100) {
      return apiError(res, 400, 'Jina liwe na herufi 2 hadi 100.');
    }
    if (phone.length > 30) {
      return apiError(res, 400, 'Namba ya simu si sahihi.');
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
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', req.user.id)
      .select('id, full_name, phone, role, is_approved, is_banned, created_at')
      .single();

    if (error) throw error;

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, profile: data });
  } catch (error) {
    console.error('Profile update error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhifadhi profile. Kagua columns za profiles.');
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
      .limit(50);
                                                      if (contributionError) throw contributionError;

    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('id, contribution_id, amount, reference, method, status, created_at, verified_at')
      .eq('user_id', req.user.id)                       .order('created_at', { ascending: false })
      .limit(50);
    if (paymentError) throw paymentError;

    const allContributions = contributions || [];
    const allPayments = payments || [];
    const paid = allPayments
      .filter(p => p.status === 'verified')
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
        paid,                                             pending,
        assigned: due,                                    balance: Math.max(0, due - paid)                },
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

    if (error) throw error;

    res.status(201).json({                              success: true,
      message: 'Ombi limepokelewa. Malipo yanasubiri kuthibitishwa na admin.',
      payment: data                                   });
  } catch (error) {                                   console.error('Payment submission error:', error.message);
    return apiError(res, 500, 'Imeshindikana kutuma ombi la malipo.');                                }
});

app.get('/api/admin/summary', ready, requireUser, requireAdmin, async (req, res) => {                 try {
    const [usersResult, paymentsResult, contributionsResult] = await Promise.all([
      supabase.from('profiles').select('id, is_approved, is_banned, role'),
      supabase.from('payments').select('id, amount, status, created_at'),
      supabase.from('contributions').select('id, amount, status')
    ]);
    for (const result of [usersResult, paymentsResult, contributionsResult]) {
      if (result.error) throw result.error;           }
                                                      const users = usersResult.data || [];
    const payments = paymentsResult.data || [];       const contributions = contributionsResult.data || [];
    res.setHeader('Cache-Control', 'no-store');       res.json({
      success: true,                                    stats: {
        users: users.length,
        active: users.filter(u => u.is_approved && !u.is_banned).length,
        blocked: users.filter(u => u.is_banned).length,
        admins: users.filter(u => u.role === 'admin').length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        verifiedPayments: payments.filter(p => p.status === 'verified').length,
        rejectedPayments: payments.filter(p => p.status === 'rejected').length,
        verifiedAmount: payments
          .filter(p => p.status === 'verified')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0),
        pendingAmount: payments
          .filter(p => p.status === 'pending')              .reduce((sum, p) => sum + Number(p.amount || 0), 0),
        assignedContributions: contributions                .filter(c => c.status !== 'cancelled')
          .reduce((sum, c) => sum + Number(c.amount || 0), 0)
      }                                               });
  } catch (error) {
    console.error('Admin summary error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata takwimu za admin.');
  }
});
                                                  app.get('/api/admin/users', ready, requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_approved, is_banned, created_at')
    .order('created_at', { ascending: false })        .limit(500);
                                                    if (error) {
    console.error('Admin users error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata wanachama.');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, users: data || [] }); });
                                                  app.post('/api/admin/users/:id/action', ready, requireUser, requireAdmin, async (req, res) => {       const userId = req.params.id;
  const action = String(req.body.action || '');
  const allowed = ['approve', 'ban', 'unban'];

  if (!allowed.includes(action)) {
    return apiError(res, 400, 'Kitendo hakitambuliki.');
  }

  if (userId === req.user.id && action === 'ban') {
    return apiError(res, 400, 'Huwezi kusimamisha akaunti yako mwenyewe.');
  }
  const updates = {                                   approve: { is_approved: true },
    ban: { is_banned: true },                         unban: { is_banned: false }
  };
  const { data, error } = await supabase              .from('profiles')
    .update(updates[action])                          .eq('id', userId)
    .select('id')                                     .maybeSingle();
                                                    if (error) {
    console.error('Admin user action error:', error.message);
    return apiError(res, 500, 'Imeshindikana kubadilisha akaunti.');
  }
  if (!data) return apiError(res, 404, 'Mwanachama hajapatikana.');
                                                    await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `user_${action}`,
    target_id: userId,                                details: {}                                     });
  res.json({ success: true, message: 'Mabadiliko yamehifadhiwa.' });                                });

app.get('/api/admin/payments', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('payments')
      .select('id, user_id, contribution_id, amount, reference, method, status, created_at, verified_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Admin payments error:', error);
      return apiError(res, 500, 'Imeshindikana kupata malipo. Kagua Render Logs.');
    }

    const payments = rows || [];
    const userIds = [...new Set(payments.map(x => x.user_id).filter(Boolean))];
    let profiles = [];

    if (userIds.length) {
      const result = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      if (result.error) {
        console.error('Payment profiles lookup error:', result.error);
      } else {
        profiles = result.data || [];
      }
    }

    const profileMap = Object.fromEntries(profiles.map(x => [x.id, x]));
    const enriched = payments.map(payment => ({
      ...payment,
      profiles: profileMap[payment.user_id] || null
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, payments: enriched });
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

    if (!paymentId || !['verify', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'Payment ID au action si sahihi.'
      });
    }

    const newStatus = action === 'verify' ? 'verified' : 'rejected';

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: newStatus
      })
      .eq('id', paymentId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Payment review error:', error);
      return res.status(500).json({
        error: 'Imeshindikana kuhakiki malipo.',
        details: error.message
      });
    }

    if (!data) {
      return res.status(409).json({
        error: 'Malipo hayapo au tayari yameshakaguliwa.'
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
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});
                                                  app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
                                                  app.use('/api', (req, res) => apiError(res, 404, 'API haijapatikana.'));                            app.use((req, res) => res.status(404).send('Ukurasa haujapatikana.'));
                                                  app.listen(PORT, () => {
  console.log(`Mchezo Wetu server running on port ${PORT}`);                                        });
