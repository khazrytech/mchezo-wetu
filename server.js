const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required Supabase environment variables.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

function apiError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function ready(req, res, next) {
  if (!supabase) {
    return apiError(res, 503, 'Supabase haijawekwa vizuri kwenye server.');
  }
  next();
}

async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : '';

    if (!token) {
      return apiError(res, 401, 'Ingia kwenye akaunti yako kwanza.');
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return apiError(res, 401, 'Session imeisha. Ingia tena.');
    }

    req.user = data.user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return apiError(res, 401, 'Imeshindikana kuthibitisha akaunti.');
  }
}

async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, is_approved, is_banned')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Admin profile error:', error.message);
      return apiError(res, 500, 'Imeshindikana kuthibitisha ruhusa za admin.');
    }

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
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
});

app.get('/api/me', ready, requireUser, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_approved, is_banned, created_at')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) {
    console.error('Profile query error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata profile.');
  }

  if (!data) {
    return apiError(res, 404, 'Profile haijapatikana. Jaribu kuingia tena.');
  }

  if (data.is_banned) {
    return apiError(res, 403, 'Akaunti yako imesimamishwa. Wasiliana na admin.');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email
    },
    profile: data
  });
});

app.get('/api/dashboard', ready, requireUser, async (req, res) => {
  try {
    const { data: profile, error: profileError } = await supabase
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
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (paymentError) throw paymentError;

    const allContributions = contributions || [];
    const allPayments = payments || [];
    const paid = allPayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pending = allPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const due = allContributions
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      profile,
      stats: {
        paid,
        pending,
        assigned: due,
        balance: Math.max(0, due - paid)
      },
      contributions: allContributions,
      payments: allPayments
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupakia dashboard.');
  }
});

app.post('/api/payments', ready, requireUser, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const reference = String(req.body.reference || '').trim();
    const method = String(req.body.method || '').trim();
    const contributionId = req.body.contributionId || null;

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      return apiError(res, 400, 'Kiasi cha malipo si sahihi.');
    }

    if (reference.length < 4 || reference.length > 100) {
      return apiError(res, 400, 'Weka reference sahihi ya muamala.');
    }

    const allowedMethods = ['mobile_money', 'bank', 'cash'];
    if (!allowedMethods.includes(method)) {
      return apiError(res, 400, 'Chagua njia sahihi ya malipo.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_banned, is_approved')
      .eq('id', req.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || profile.is_banned) {
      return apiError(res, 403, 'Akaunti yako hairuhusiwi kutuma malipo.');
    }

    if (contributionId) {
      const { data: contribution, error: contributionError } = await supabase
        .from('contributions')
        .select('id, user_id, amount, status')
        .eq('id', contributionId)
        .eq('user_id', req.user.id)
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
    if (duplicate) {
      return apiError(res, 409, 'Reference hii tayari imetumika.');
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: req.user.id,
        contribution_id: contributionId,
        amount,
        reference,
        method,
        status: 'pending'
      })
      .select('id, amount, reference, method, status, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Ombi limepokelewa. Malipo yanasubiri kuthibitishwa na admin.',
      payment: data
    });
  } catch (error) {
    console.error('Payment submission error:', error.message);
    return apiError(res, 500, 'Imeshindikana kutuma ombi la malipo.');
  }
});

app.get('/api/admin/summary', ready, requireUser, requireAdmin, async (req, res) => {
  try {
    const [usersResult, paymentsResult, contributionsResult] = await Promise.all([
      supabase.from('profiles').select('id, is_approved, is_banned, role'),
      supabase.from('payments').select('id, amount, status, created_at'),
      supabase.from('contributions').select('id, amount, status')
    ]);

    for (const result of [usersResult, paymentsResult, contributionsResult]) {
      if (result.error) throw result.error;
    }

    const users = usersResult.data || [];
    const payments = paymentsResult.data || [];
    const contributions = contributionsResult.data || [];

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      stats: {
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
          .filter(p => p.status === 'pending')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0),
        assignedContributions: contributions
          .filter(c => c.status !== 'cancelled')
          .reduce((sum, c) => sum + Number(c.amount || 0), 0)
      }
    });
  } catch (error) {
    console.error('Admin summary error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata takwimu za admin.');
  }
});

app.get('/api/admin/users', ready, requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_approved, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Admin users error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata wanachama.');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, users: data || [] });
});

app.post('/api/admin/users/:id/action', ready, requireUser, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const action = String(req.body.action || '');
  const allowed = ['approve', 'ban', 'unban'];

  if (!allowed.includes(action)) {
    return apiError(res, 400, 'Kitendo hakitambuliki.');
  }

  if (userId === req.user.id && action === 'ban') {
    return apiError(res, 400, 'Huwezi kusimamisha akaunti yako mwenyewe.');
  }

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

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `user_${action}`,
    target_id: userId,
    details: {}
  });

  res.json({ success: true, message: 'Mabadiliko yamehifadhiwa.' });
});

app.get('/api/admin/payments', ready, requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, contribution_id, amount, reference, method, status, created_at, verified_at, profiles(full_name, phone)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Admin payments error:', error.message);
    return apiError(res, 500, 'Imeshindikana kupata malipo.');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, payments: data || [] });
});

app.post('/api/admin/payments/:id/review', ready, requireUser, requireAdmin, async (req, res) => {
  const paymentId = req.params.id;
  const action = String(req.body.action || '');

  if (!['verify', 'reject'].includes(action)) {
    return apiError(res, 400, 'Kitendo cha malipo si sahihi.');
  }

  const { data: payment, error: findError } = await supabase
    .from('payments')
    .select('id, status, user_id, amount, reference')
    .eq('id', paymentId)
    .maybeSingle();

  if (findError) {
    console.error('Payment lookup error:', findError.message);
    return apiError(res, 500, 'Imeshindikana kupata muamala.');
  }

  if (!payment) return apiError(res, 404, 'Muamala haujapatikana.');
  if (payment.status !== 'pending') {
    return apiError(res, 409, 'Muamala huu tayari umeshafanyiwa uamuzi.');
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected';
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: newStatus,
      verified_at: action === 'verify' ? new Date().toISOString() : null,
      verified_by: req.user.id
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle();

  if (error) {
    console.error('Payment review error:', error.message);
    return apiError(res, 500, 'Imeshindikana kuhifadhi uamuzi wa malipo.');
  }

  if (!data) {
    return apiError(res, 409, 'Muamala umebadilika. Pakia upya ukurasa.');
  }

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `payment_${newStatus}`,
    target_id: payment.user_id,
    details: {
      payment_id: payment.id,
      reference: payment.reference,
      amount: payment.amount
    }
  });

  res.json({ success: true, message: `Muamala ${newStatus === 'verified' ? 'umethibitishwa' : 'umekataliwa'}.` });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(__dirname, {
  index: false,
  dotfiles: 'deny'
}));

app.use('/api', (req, res) => apiError(res, 404, 'API haijapatikana.'));
app.use((req, res) => res.status(404).send('Ukurasa haujapatikana.'));

app.listen(PORT, () => {
  console.log(`Mchezo Wetu server running on port ${PORT}`);
});
