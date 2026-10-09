const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Hifadhi ya muda ya Email OTP
const otpStore = new Map(); // email -> { code, expiresAt, payload, type }

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Mfumo wa Kutuma OTP kwa Email
async function sendRealEmailOTP(toEmail, otpCode, title = "Uhakiki wa Mchezo Wetu Admin") {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
        try {
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });

            await transporter.sendMail({
                from: `"Mchezo Wetu Admin" <${emailUser}>`,
                to: toEmail,
                subject: `${title} - OTP Code`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #030712; color: #ffffff; border-radius: 16px; max-width: 500px; margin: auto; border: 1px solid rgba(255,255,255,0.1);">
                        <h2 style="color: #3b82f6; margin-top: 0;">Mchezo Wetu Fintech</h2>
                        <p style="color: #9ca3af; font-size: 14px;">Namba yako ya uhakiki ya OTP kwa ajili ya Admin Portal ni:</p>
                        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 16px; border-radius: 12px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: 900; color: #10b981; letter-spacing: 6px;">${otpCode}</span>
                        </div>
                        <p style="color: #9ca3af; font-size: 12px;">Muda wa matumizi ya namba hii ni dakika 5. Usiigawie mtu yeyote kwa sababu za kiusalama.</p>
                    </div>
                `
            });
            console.log(`[EMAIL OTP SENT TO ${toEmail}]`);
        } catch (err) {
            console.error('[EMAIL SENDING ERROR]', err.message);
        }
    } else {
        // Ikiwa Server Environment Variables hazijawekwa bado, inaonekana kwenye Terminal Server Logs pekee (Sio kwenye Browser UI)
        console.log(`\n==========================================\n[REAL EMAIL OTP FOR ${toEmail}]: ${otpCode}\n==========================================\n`);
    }
}

// 1. ANGALIA KAMA KUNA ADMIN TAYARI KWENYE SUPABASE
app.get('/api/admin/check-exists', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'admin');
        if (error) throw error;
        res.json({ success: true, exists: data && data.length > 0 });
    } catch (err) {
        res.json({ success: false, exists: false, message: err.message });
    }
});

// 2. USAJILI WA ADMIN - TUMA OTP KWA EMAIL
app.post('/api/admin/register-send-otp', async (req, res) => {
    const { fullName, phone, email, password } = req.body;

    const { data: existingAdmin } = await supabase.from('users').select('*').eq('role', 'admin');
    if (existingAdmin && existingAdmin.length > 0) {
        return res.json({ success: false, message: 'Admin yupo tayari kwenye mfumo! Tafadhali ingia.' });
    }

    if (!fullName || !email || !password) {
        return res.json({ success: false, message: 'Tafadhali jaza jina, email na nenosiri.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(cleanEmail, {
        code: otpCode,
        expiresAt,
        type: 'ADMIN_REGISTER',
        payload: { fullName, phone: phone || '', email: cleanEmail, password }
    });

    await sendRealEmailOTP(cleanEmail, otpCode, "Usajili wa Msimamizi");

    res.json({ 
        success: true, 
        email: cleanEmail,
        message: `OTP imetumwa kwa barua pepe (email): ${cleanEmail}` 
    });
});

// 3. THIBITISHA EMAIL OTP NA SAAJILI ADMIN KWENYE SUPABASE
app.post('/api/admin/register-verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const record = otpStore.get(cleanEmail);

    if (!record || record.type !== 'ADMIN_REGISTER') {
        return res.json({ success: false, message: 'Ombi la OTP halipatikani au limeisha.' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.json({ success: false, message: 'Muda wa OTP umeisha. Omba tena.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'OTP uliyoingiza si sahihi.' });
    }

    const { fullName, phone, password } = record.payload;
    const adminUser = {
        full_name: fullName,
        phone: phone || '0000000000',
        email: cleanEmail,
        password,
        member_number: 'MW-ADMIN-01',
        role: 'admin',
        status: 'approved',
        date_registered: new Date().toLocaleDateString('sw-TZ')
    };

    const { error } = await supabase.from('users').insert([adminUser]);
    if (error) {
        return res.json({ success: false, message: 'Hitilafu ya Supabase: ' + error.message });
    }

    otpStore.delete(cleanEmail);
    res.json({ success: true, message: 'Usajili wa Admin umefanikiwa!' });
});

// 4. LOGIN YA ADMIN - TUMA OTP KWA EMAIL
app.post('/api/admin/login-send-otp', async (req, res) => {
    const { identifier, password } = req.body;

    const { data: users } = await supabase.from('users').select('*').eq('role', 'admin');
    if (!users || users.length === 0) {
        return res.json({ success: false, message: 'Hakuna Admin aliyesajiliwa bado.' });
    }

    const admin = users.find(u => 
        (u.email.toLowerCase() === identifier.toLowerCase() || u.phone === identifier || u.full_name.toLowerCase() === identifier.toLowerCase()) && 
        u.password === password
    );

    if (!admin) {
        return res.json({ success: false, message: 'Taarifa za Admin si sahihi.' });
    }

    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(admin.email, {
        code: otpCode,
        expiresAt,
        type: 'ADMIN_LOGIN',
        email: admin.email
    });

    await sendRealEmailOTP(admin.email, otpCode, "Kuingia Msimamizi");

    res.json({ 
        success: true, 
        email: admin.email,
        message: `OTP imetumwa kwa njia ya Email kwenda ${admin.email}.` 
    });
});

// 5. THIBITISHA EMAIL OTP YA LOGIN YA ADMIN
app.post('/api/admin/login-verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const record = otpStore.get(cleanEmail);

    if (!record || record.type !== 'ADMIN_LOGIN') {
        return res.json({ success: false, message: 'Ombi la OTP halipatikani.' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.json({ success: false, message: 'Muda wa OTP umeisha.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'OTP uliyoingiza si sahihi.' });
    }

    otpStore.delete(cleanEmail);
    res.json({ success: true, message: 'Umekaribishwa Msimamizi!' });
});

// MANAGE USERS & ANNOUNCEMENTS
app.get('/api/admin/users', async (req, res) => {
    const { data: users, error } = await supabase.from('users').select('*').order('id', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });

    const formatted = users.map(u => ({
        fullName: u.full_name,
        phone: u.phone,
        email: u.email,
        memberNumber: u.member_number,
        role: u.role || 'member',
        status: u.status,
        dateRegistered: u.date_registered || 'Leo'
    }));
    res.json({ success: true, users: formatted });
});

app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kuidhinisha.' });
    res.json({ success: true, message: 'Mwanachama amethibitishwa!' });
});

app.get('/api/announcements', async (req, res) => {
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    res.json({ success: true, announcements: announcements || [] });
});

app.post('/api/announcements', async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) return res.json({ success: false, message: 'Kichwa na ujumbe vinahitajika.' });

    const newAnn = { title, message, date: new Date().toLocaleDateString('sw-TZ') };
    const { error } = await supabase.from('announcements').insert([newAnn]);
    if (error) return res.json({ success: false, message: 'Imeshindikana kutuma.' });

    res.json({ success: true, message: 'Tangazo limetumwa kwa wanachama!' });
});

app.listen(PORT, () => {
    console.log(`Server inaendelea kwenye port ${PORT}`);
});
