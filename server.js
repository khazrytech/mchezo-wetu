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

// ADMIN LOGIN ENDPOINT
app.post('/api/admin/login', (req, res) => {
    const { identifier, password } = req.body;
    // Nenosiri la default la Admin: admin / admin123
    if ((identifier === 'admin' || identifier === '0700000000') && password === 'admin123') {
        return res.json({ success: true, message: 'Karibu Super Admin!' });
    }
    res.json({ success: false, message: 'Taarifa za Admin si sahihi!' });
});

// USER REGISTER
app.post('/api/register', async (req, res) => {
    const { fullName, phone, email, password, ref } = req.body;
    if (!fullName || !phone || !password) {
        return res.json({ success: false, message: 'Tafadhali jaza jina, namba ya simu na password.' });
    }

    const { data: existing } = await supabase.from('users').select('*').eq('phone', phone).single();
    if (existing) {
        return res.json({ success: false, message: 'Namba hii ya simu imeshasajiliwa tayari.' });
    }

    const memberNumber = `MW-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser = {
        full_name: fullName,
        phone,
        email: email || '',
        password,
        member_number: memberNumber,
        referred_by: ref || 'Direct',
        status: 'pending',
        date_registered: new Date().toLocaleDateString('sw-TZ')
    };

    const { error } = await supabase.from('users').insert([newUser]);
    if (error) {
        return res.json({ success: false, message: 'Hitilafu kwenye Database: ' + error.message });
    }

    res.json({ success: true, message: 'Ombi lako limetumwa kwa Msimamizi.', memberNumber });
});

// CHECK STATUS
app.post('/api/check-status', async (req, res) => {
    const { phone } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('phone', phone).single();
    if (!user) {
        return res.json({ success: false, message: 'Mtumiaji hapatikani.' });
    }
    res.json({ success: true, status: user.status, fullName: user.full_name, memberNumber: user.member_number });
});

// USER LOGIN
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    
    const { data: users } = await supabase.from('users').select('*');
    if (!users) return res.json({ success: false, message: 'Hitilafu ya kurejesha taarifa.' });

    const user = users.find(u => 
        (u.phone === identifier || u.full_name.toLowerCase() === identifier.toLowerCase() || u.member_number === identifier) && 
        u.password === password
    );

    if (!user) {
        return res.json({ success: false, message: 'Taarifa si sahihi. Angalia namba, jina au password.' });
    }

    if (user.status !== 'approved') {
        return res.json({ success: false, pending: true, message: 'Akaunti yako bado haijathibitishwa na Msimamizi.' });
    }

    const safeUser = {
        fullName: user.full_name,
        phone: user.phone,
        email: user.email,
        memberNumber: user.member_number,
        status: user.status
    };

    res.json({ success: true, message: 'Umekaribishwa kwenye mfumo!', user: safeUser });
});

// ADMIN USERS FETCH
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

// ADMIN APPROVE
app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) {
        return res.json({ success: false, message: 'Imeshindikana kuidhinisha mwanachama.' });
    }
    res.json({ success: true, message: `Mwanachama amethibitishwa rasmi!` });
});

// ANNOUNCEMENTS
app.get('/api/announcements', async (req, res) => {
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    res.json({ success: true, announcements: announcements || [] });
});

app.post('/api/announcements', async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
        return res.json({ success: false, message: 'Kichwa cha habari na ujumbe vinahitajika.' });
    }
    const newAnn = {
        title,
        message,
        date: new Date().toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    };
    const { error } = await supabase.from('announcements').insert([newAnn]);
    if (error) {
        return res.json({ success: false, message: 'Imeshindikana kutuma tangazo.' });
    }
    res.json({ success: true, message: 'Tangazo limetumwa na kuhifadhiwa kwenye arifa za wanachama.' });
});

app.listen(PORT, () => {
    console.log(`Server inaendelea kwenye port ${PORT}`);
});
