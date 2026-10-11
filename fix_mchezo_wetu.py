from pathlib import Path
import re
import sys

root = Path.home() / "mchezo-wetu"
server_file = root / "server.js"

if not server_file.exists():
    sys.exit("HITILAFU: server.js haipo kwenye ~/mchezo-wetu")

server = server_file.read_text()

# Hifadhi nakala ya awali mara moja tu.
backup = root / "server.js.before-admin-fix"
if not backup.exists():
    backup.write_text(server)

if "ADMIN OTP AUTH ROUTES - MCH EZO WETU" in server:
    sys.exit("Patch hii tayari ipo kwenye server.js. Hakuna kilichobadilishwa.")

marker = "app.get('/api/health'"
if marker not in server:
    sys.exit("HITILAFU: Sijaona route ya /api/health. Hakuna kilichobadilishwa.")

routes = r"""
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
"""

server = server.replace(marker, routes + "\n" + marker, 1)

# Admin login lazima iwe ukurasa wa kuingia, si dashboard yenyewe.
old_admin_route = "app.get('/admin', (req, res) => {\n  res.sendFile(path.join(__dirname, 'admin.html')); });"
if old_admin_route in server:
    server = server.replace(
        old_admin_route,
        """app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});""",
        1
    )
elif "app.get('/admin/dashboard'" not in server:
    server = re.sub(
        r"app\.get\('/admin',\s*\(req,\s*res\)\s*=>\s*\{\s*res\.sendFile\(path\.join\(__dirname,\s*'admin\.html'\)\);\s*\}\);?",
        """app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});""",
        server,
        count=1
    )

# Zuia admin email kutumia OTP ya kawaida ya mwanachama.
member_marker = "app.post('/api/auth/send-otp', async (req, res) => {"
if member_marker in server:
    start = server.index(member_marker)
    email_marker = "  const signup = req.body?.signup === true;"
    pos = server.find(email_marker, start)
    if pos != -1:
        insertion = """  if (email === 'hackertrick1997@gmail.com') {
    return apiError(res, 403, 'Tumia ukurasa wa admin kuingia.');
  }
"""
        if insertion.strip() not in server[start:pos + len(email_marker) + 300]:
            server = server[:pos] + insertion + server[pos:]

# Wanachama ambao hawajaidhinishwa wasitume malipo.
payment_marker = "if (!profile || profile.is_banned) {"
if payment_marker in server:
    server = server.replace(
        payment_marker,
        """if (!profile || profile.is_banned) {""",
        1
    )
    after = """if (!profile || profile.is_banned) {                return apiError(res, 403, 'Akaunti yako hairuhusiwi kutuma malipo.');                             }"""
    if after in server and "profile.is_approved" not in server[server.index(after):server.index(after)+500]:
        server = server.replace(
            after,
            after + """
    if (!profile.is_approved) {
      return apiError(res, 403, 'Akaunti yako inasubiri kuidhinishwa na admin.');
    }""",
            1
        )

server_file.write_text(server)
print("Patch imeandikwa kwenye server.js")
print("Backup: server.js.before-admin-fix")
