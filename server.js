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

// Hifadhi ya muda ya OTP (In-Memory OTP Store)
const otpStore = new Map(); // phone -> { code, expiresAt, payload }
const adminOtpStore = new Map(); // adminIdentifier -> { code, expiresAt }

// Zalisha namba 6 za OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. TUMA OTP KWA MWANACHAMA WAKATI WA USAJILI
app.post('/api/send-user-otp', async (req, res) => {
    const { fullName, phone, email, password, ref } = req.body;

    if (!fullName || !phone || !password) {
        return res.json({ success: false, message: 'Tafadhali jaza jina, namba ya simu na nenosiri.' });
    }

    // Angalia kama namba tayari ipo
    const { data: existing } = await supabase.from('users').select('*').eq('phone', phone).single();
    if (existing) {
        return res.json({ success: false, message: 'Namba hii ya simu imeshasajiliwa tayari.' });
    }

    const otpCode = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Inakaa dakika 5

    // Hifadhi data na OTP kwenye kumbukumbu ya muda
    otpStore.set(phone, {
        code: otpCode,
        expiresAt,
        payload: { fullName, phone, email: email || '', password, ref: ref || 'Direct' }
    });

    console.log(`[OTP DISPATCH] OTP ya usajili wa ${fullName} (${phone}) ni: ${otpCode}`);

    // Hapa tunaweza kuunganisha SMS Gateway (k.m. Beem Africa) au kuionyesha kwenye Response
    res.json({ 
        success: true, 
        message: `OTP imetumwa kwa namba ${phone}. (Demo OTP: ${otpCode})`,
        demoOtp: otpCode 
    });
});

// 2. THIBITISHA OTP NA HIFADHI KWENYE SUPABASE (PENDING ADMIN APPROVAL)
app.post('/api/verify-user-otp', async (req, res) => {
    const { phone, otp } = req.body;

    const record = otpStore.get(phone);
    if (!record) {
        return res.json({ success: false, message: 'Hukutuma maombi ya OTP au muda umeisha.' });
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return res.json({ success: false, message: 'Muda wa OTP umeisha. Omba OTP mpya.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'Namba ya OTP si sahihi. Angalia vizuri.' });
    }

    // OTP NI SAHIHI! Sasa tunahifadhi kwenye Supabase
    const { fullName, email, password, ref } = record.payload;
    const memberNumber = `MW-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = {
        full_name: fullName,
        phone,
        email,
        password,
        member_number: memberNumber,
        referred_by: ref,
        status: 'pending',
        date_registered: new Date().toLocaleDateString('sw-TZ')
    };

    const { error } = await supabase.from('users').insert([newUser]);
    if (error) {
        return res.json({ success: false, message: 'Hitilafu kwenye Database: ' + error.message });
    }

    // Futa OTP iliyokwisha tumika
    otpStore.delete(phone);

    res.json({ 
        success: true, 
        message: 'OTP imethibitishwa! Ombi lako limetumwa kwa Msimamizi ili uidhinishwe.', 
        memberNumber 
    });
});

// 3. ADMIN LOGIN - STEP 1: TUMA OTP YA ADMIN
app.post('/api/admin/send-otp', (req, res) => {
    const { identifier, password } = req.body;

    if ((identifier === 'admin' || identifier === '0700000000') && password === 'admin123') {
        const adminOtp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        adminOtpStore.set(identifier, { code: adminOtp, expiresAt });

        console.log(`[ADMIN OTP] OTP ya Msimamizi ni: ${adminOtp}`);

        return res.json({ 
            success: true, 
            message: `OTP ya Admin imetumwa. (Demo OTP: ${adminOtp})`,
            demoOtp: adminOtp 
        });
    }

    res.json({ success: false, message: 'Taarifa za Msimamizi si sahihi!' });
});

// 4. ADMIN LOGIN - STEP 2: THIBITISHA OTP YA ADMIN
app.post('/api/admin/verify-otp', (req, res) => {
    const { identifier, otp } = req.body;

    const record = adminOtpStore.get(identifier);
    if (!record) {
        return res.json({ success: false, message: 'Ombi la Admin OTP halipatikani au limeisha muda.' });
    }

    if (Date.now() > record.expiresAt) {
        adminOtpStore.delete(identifier);
        return res.json({ success: false, message: 'Muda wa OTP umeisha. Jaribu kuingia tena.' });
    }

    if (record.code !== otp.toString().trim()) {
        return res.json({ success: false, message: 'OTP ya Admin si sahihi!' });
    }

    adminOtpStore.delete(identifier);
    res.json({ success: true, message: 'Karibu Super Admin!' });
});

// ADMIN ENDPOINTS KUCHOTA NA KUIDHINISHA
app.get('/api/admin/users', async (req, res) => {
    const { data: users, error } = await supabase.from('users').select('*').order('id', { ascending: false });
    if (error) {
        return res.json({ success: false, message: error.message });
    }
    const formattedUsers = users.map(u => ({
        fullName: u.full_name,
        phone: u.phone,
        email: u.email,
        memberNumber: u.member_number,
        status: u.status,
        dateRegistered: u.date_registered || 'Leo'
    }));
    res.json({ success: true, users: formattedUsers });
});

app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) {
        return res.json({ success: false, message: 'Imeshindikana kuidhinisha mwanachama.' });
    }
    res.json({ success: true, message: `Mwanachama amethibitishwa rasmi!` });
});

// USER CHECK STATUS & LOGIN
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    const { data: users } = await supabase.from('users').select('*');
    if (!users) return res.json({ success: false, message: 'Hitilafu ya kurejesha taarifa.' });

    const user = users.find(u => 
        (u.phone === identifier || u.full_name.toLowerCase() === identifier.toLowerCase() || u.member_number === identifier) && 
        u.password === password
    );

    if (!user) {
        return res.json({ success: false, message: 'Taarifa si sahihi.' });
    }

    if (user.status !== 'approved') {
        return res.json({ success: false, pending: true, message: 'Akaunti yako bado haijathibitishwa na Msimamizi.' });
    }

    res.json({ success: true, message: 'Umekaribishwa kwenye mfumo!', user: { fullName: user.full_name, phone: user.phone, memberNumber: user.member_number } });
});

app.get('/api/announcements', async (req, res) => {
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    res.json({ success: true, announcements: announcements || [] });
});

app.post('/api/announcements', async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) return res.json({ success: false, message: 'Jaza kichwa na ujumbe.' });

    const newAnn = { title, message, date: new Date().toLocaleDateString('sw-TZ') };
    const { error } = await supabase.from('announcements').insert([newAnn]);
    if (error) return res.json({ success: false, message: 'Imeshindikana kutuma.' });

    res.json({ success: true, message: 'Tangazo limetumwa!' });
});

app.listen(PORT, () => {
    console.log(`Server inaendelea kwenye port ${PORT}`);
});
