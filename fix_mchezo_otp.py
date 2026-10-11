from pathlib import Path
import re
import shutil

p = Path("index.html")
s = p.read_text()

form_start = s.find('<form id="authForm">')
form_end = s.find('</form>', form_start)

script_start = s.find('<script>\nlet client, signup=false;')
script_end = s.find('</script>', script_start)

if min(form_start, form_end, script_start, script_end) < 0:
    raise SystemExit(
        "ERROR: Muundo wa index.html hautambuliki. "
        "Hakuna kilichobadilishwa."
    )

shutil.copy2(p, "index.html.before-otp")

new_form = '''<form id="authForm">
      <div class="field" id="nameField" hidden>
        <label for="fullName">Jina kamili</label>
        <input id="fullName" autocomplete="name" maxlength="100">
      </div>
      <div class="field" id="phoneField" hidden>
        <label for="phone">Namba ya simu</label>
        <input id="phone" autocomplete="tel" maxlength="30" placeholder="+255...">
      </div>
      <div class="field">
        <label for="email">Barua pepe</label>
        <input id="email" type="email" autocomplete="email"
          required maxlength="254" placeholder="jina@example.com">
      </div>
      <div class="field" id="otpField" hidden>
        <label for="otp">Namba ya OTP iliyotumwa kwenye email</label>
        <input id="otp" inputmode="numeric" autocomplete="one-time-code"
          pattern="[0-9]{6}" minlength="6" maxlength="6"
          placeholder="Ingiza tarakimu 6">
      </div>
      <button class="btn" id="submitBtn" type="submit">Tuma OTP kwenye email</button>
    </form>'''

new_script = r'''<script>
let client = null;
let signup = false;
let otpSent = false;

const $ = id => document.getElementById(id);

function message(text, type = 'ok') {
  const n = $('notice');
  n.textContent = text;
  n.className = 'notice show ' + type;
}

function clearMessage() {
  $('notice').textContent = '';
  $('notice').className = 'notice';
}

function resetOtpStage() {
  otpSent = false;
  $('email').readOnly = false;
  $('otpField').hidden = true;
  $('otp').required = false;
  $('otp').value = '';
  $('nameField').hidden = !signup;
  $('phoneField').hidden = !signup;
  $('submitBtn').disabled = false;
  $('submitBtn').textContent = 'Tuma OTP kwenye email';
}

function setMode(value) {
  signup = value;
  resetOtpStage();

  $('heading').textContent = signup
    ? 'Fungua akaunti mpya'
    : 'Karibu tena 👋';

  $('description').textContent = signup
    ? 'Jaza taarifa zako. Tutatuma OTP kwenye email yako.'
    : 'Ingiza email yako ili upokee OTP ya kuingia.';

  $('switchBtn').textContent = signup
    ? 'Tayari una akaunti? Ingia'
    : 'Huna akaunti? Jisajili';

  clearMessage();
}

async function init() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    const c = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw Error(c.error || 'Server haijatoa mipangilio ya Supabase.');
    }

    const url = c.supabaseUrl || c.url || c.SUPABASE_URL;
    const key = c.supabaseAnonKey || c.supabasePublishableKey ||
      c.anonKey || c.publishableKey || c.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw Error('Supabase URL au public key haipo kwenye Render.');
    }

    if (!window.supabase) {
      throw Error('Supabase library haijapakia. Jaribu refresh.');
    }

    client = window.supabase.createClient(url, key);

    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (data.session) {
      location.replace('/dashboard');
      return;
    }

    message('Tayari. Ingiza email yako ili uanze.', 'ok');
  } catch (e) {
    console.error('Auth init:', e);
    message(
      'Mfumo haujaanza: ' + (e.message || 'Kosa lisilojulikana'),
      'error'
    );
  }
}

$('switchBtn').addEventListener('click', () => setMode(!signup));

$('authForm').addEventListener('submit', async e => {
  e.preventDefault();

  if (!client) {
    message('Mfumo haujawa tayari. Refresh ukurasa ujaribu tena.', 'error');
    return;
  }

  const btn = $('submitBtn');
  btn.disabled = true;
  clearMessage();

  try {
    const email = $('email').value.trim().toLowerCase();

    if (!email) throw Error('Weka barua pepe sahihi.');

    if (!otpSent) {
      let full_name = '';
      let phone = '';

      if (signup) {
        full_name = $('fullName').value.trim();
        phone = $('phone').value.trim();

        if (!full_name) throw Error('Weka jina lako kamili.');
      }

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: signup,
          data: signup ? { full_name, phone } : undefined
        }
      });

      if (error) throw error;

      otpSent = true;
      $('email').readOnly = true;
      $('otpField').hidden = false;
      $('otp').required = true;
      $('nameField').hidden = true;
      $('phoneField').hidden = true;
      $('otp').focus();
      btn.textContent = 'Thibitisha OTP';

      message(
        'Ombi limepokelewa. Angalia email yako pamoja na Spam/Junk, ' +
        'kisha weka OTP ya tarakimu 6 hapa.',
        'ok'
      );
      return;
    }

    const token = $('otp').value.trim();

    if (!/^[0-9]{6}$/.test(token)) {
      throw Error('OTP lazima iwe na tarakimu 6.');
    }

    const { data, error } = await client.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) throw error;

    if (!data.session) {
      throw Error(
        'OTP imepokelewa lakini session haijapatikana. Jaribu tena.'
      );
    }

    message('Uthibitisho umefanikiwa. Inafungua akaunti yako...', 'ok');
    location.replace('/dashboard');
  } catch (err) {
    console.error('OTP error:', err);
    message(err.message || 'OTP imeshindikana. Jaribu tena.', 'error');
  } finally {
    btn.disabled = false;
  }
});

init();
</script>'''

s = s[:form_start] + new_form + s[form_end + len('</form>'):]

# Ondoa kitufe cha kurejesha nenosiri: mfumo huu unatumia OTP, si password.
s = re.sub(
    r'\s*<button class="switch" id="forgotBtn"[^>]*>.*?</button>',
    '',
    s,
    flags=re.S
)

script_end += len(new_form) - (form_end + len('</form>') - form_start)
# Tafuta tena script kwa kuwa urefu wa HTML umebadilika.
script_start = s.find('<script>\nlet client, signup=false;')
script_end = s.find('</script>', script_start)

if script_start < 0 or script_end < 0:
    raise SystemExit("ERROR: Script ya zamani haijapatikana; nakala ya awali ipo.")

s = s[:script_start] + new_script + s[script_end + len('</script>'):]

# Hakikisha hakuna script za ziada baada ya HTML.
end_html = s.lower().find('</html>')
if end_html >= 0:
    s = s[:end_html + len('</html>')] + '\n'

p.write_text(s)
print("OK: Login sasa inatumia OTP na inline messages.")
print("Backup: index.html.before-otp")
