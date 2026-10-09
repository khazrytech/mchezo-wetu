const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Hifadhi ya muda ya OTP kwenye Seva
const otpStore = new Map(); // phone -> { code, expiresAt, payload, type }

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

// 2. ADMIN REGISTRATION - TUMA OTP (MARA YA KWANZA TU)
app.post('/api/admin/register-send-otp', async (req, res) => {
    const { fullName, phone, email, password } = req.body;

    // Hakikisha hakuna admin tayari
    const { data: existingAdmin } = await supabase.from('users').select('*').eq('role', 'admin');
    if (existingAdmin && existingAdmin.length > 0) {
        return res.json({ success: false, message: 'Admin yupo tayari kwenye mfumo! Tafadhali ingia (Login).' });
    }

    if (!fullName || !phone || !password) {
        return res.json({ success: false, message: 'Tafadhali jaza jina, namba ya simu na nenosiri.' });
    }

    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(phone, {
        code: otpCode,
        expiresAt,
        type: 'ADMIN_REGISTER',
        payload: { fullName, phone, email: email || '', password }
    });

    console.log(`[ADMIN SETUP OTP] OTP ya Usajili wa Admin (${phone}): ${otpCode}`);

    res.json({ 
        success: true, 
        message: `OTP ya usajili imetumwa kwa namba ${phone}.`, 
        demoOtp: otpCode 
    });
});

// 3. THIBITISHA OTP YA USAJILI WA ADMIN NA HIFADHI SUPABASE
app.post('/api/admin/register-verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    const record = otpStore.get(phone);

    if (!record || record.type !== 'ADMIN_REGISTER') {
        return res.json({ success: false, message: 'Ombi la OTP halipatikani au limeisha.' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return res.json({ success: false, message: 'Muda wa OTP umeisha. Omba tena.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'OTP si sahihi. Angalia vizuri.' });
    }

    const { fullName, email, password } = record.payload;
    const adminUser = {
        full_name: fullName,
        phone,
        email,
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

    otpStore.delete(phone);
    res.json({ success: true, message: 'Usajili wa Admin umefanikiwa! Sasa unaweza kuingia.' });
});

// 4. ADMIN LOGIN - TUMA OTP YA KUINGIA
app.post('/api/admin/login-send-otp', async (req, res) => {
    const { identifier, password } = req.body;

    const { data: users } = await supabase.from('users').select('*').eq('role', 'admin');
    if (!users || users.length === 0) {
        return res.json({ success: false, message: 'Hakuna Admin aliyesajiliwa bado.' });
    }

    const admin = users.find(u => 
        (u.phone === identifier || u.email === identifier || u.full_name.toLowerCase() === identifier.toLowerCase()) && 
        u.password === password
    );

    if (!admin) {
        return res.json({ success: false, message: 'Taarifa za Admin si sahihi.' });
    }

    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(admin.phone, {
        code: otpCode,
        expiresAt,
        type: 'ADMIN_LOGIN',
        phone: admin.phone
    });

    console.log(`[ADMIN LOGIN OTP] OTP ya Admin (${admin.phone}): ${otpCode}`);

    res.json({ 
        success: true, 
        phone: admin.phone,
        message: `OTP ya kuingia imetumwa kwa ${admin.phone}.`, 
        demoOtp: otpCode 
    });
});

// 5. THIBITISHA OTP YA LOGIN YA ADMIN
app.post('/api/admin/login-verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    const record = otpStore.get(phone);

    if (!record || record.type !== 'ADMIN_LOGIN') {
        return res.json({ success: false, message: 'Ombi la OTP halipatikani.' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return res.json({ success: false, message: 'Muda wa OTP umeisha.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'OTP si sahihi.' });
    }

    otpStore.delete(phone);
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
