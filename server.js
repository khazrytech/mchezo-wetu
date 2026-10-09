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

app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.json({ success: false, message: 'Ingiza namba ya simu, jina au no. ya mwanachama na nenosiri.' });
        }

        const cleanId = identifier.trim().toLowerCase();
        const { data: users, error } = await supabase.from('users').select('*');
        if (error) return res.json({ success: false, message: 'Hitilafu ya Supabase: ' + error.message });

        const user = users.find(u => 
            (u.phone && u.phone.trim().toLowerCase() === cleanId) ||
            (u.email && u.email.trim().toLowerCase() === cleanId) ||
            (u.full_name && u.full_name.trim().toLowerCase() === cleanId) ||
            (u.member_number && u.member_number.trim().toLowerCase() === cleanId)
        );

        if (!user) return res.json({ success: false, message: 'Akaunti hii haijapatikana. Tafadhali jisajili kwanza.' });
        if (user.password !== password) return res.json({ success: false, message: 'Nenosiri uliloingiza si sahihi.' });

        if (user.status === 'banned') {
            const reason = user.ban_reason ? user.ban_reason : 'Akaunti imefungiwa kabisa na Admin.';
            return res.json({ success: false, message: `Akaunti yako imefungiwa kabisa (Banned). Sababu: ${reason}` });
        }

        if (user.status === 'suspended') {
            const reason = user.ban_reason ? user.ban_reason : 'Akaunti imesimamishwa kwa muda.';
            return res.json({ success: false, message: `Akaunti yako imesimamishwa kwa muda (Suspended). Sababu: ${reason}` });
        }

        if (user.status !== 'approved') {
            return res.json({ success: false, message: 'Akaunti yako bado inasubiri kuidhinishwa na Admin.' });
        }

        return res.json({ 
            success: true, 
            message: 'Umekaribishwa!',
            user: {
                fullName: user.full_name,
                phone: user.phone,
                email: user.email,
                memberNumber: user.member_number,
                role: user.role,
                status: user.status,
                banReason: user.ban_reason || ''
            }
        });
    } catch (err) {
        return res.json({ success: false, message: 'Hitilafu ya Seva: ' + err.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, phone, email, password } = req.body;
        if (!fullName || !phone || !password) {
            return res.json({ success: false, message: 'Tafadhali jaza majina, namba ya simu na nenosiri.' });
        }

        const { data: existing } = await supabase.from('users').select('*').eq('phone', phone.trim());
        if (existing && existing.length > 0) {
            return res.json({ success: false, message: 'Namba hii ya simu imeshasajiliwa tayari.' });
        }

        const memberNumber = 'MW-' + Math.floor(1000 + Math.random() * 9000);
        const newUser = {
            full_name: fullName.trim(),
            phone: phone.trim(),
            email: email ? email.trim() : '',
            password: password,
            member_number: memberNumber,
            role: 'member',
            status: 'pending',
            ban_reason: '',
            date_registered: new Date().toLocaleDateString('sw-TZ')
        };

        const { error } = await supabase.from('users').insert([newUser]);
        if (error) throw error;

        return res.json({ success: true, message: 'Usajili umefanikiwa! Subiri idhini ya Admin.' });
    } catch (err) {
        return res.json({ success: false, message: 'Imeshindikana kusajili: ' + err.message });
    }
});

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
        banReason: u.ban_reason || '',
        dateRegistered: u.date_registered || 'Leo'
    }));
    res.json({ success: true, users: formatted });
});

app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved', ban_reason: '' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kuidhinisha.' });
    res.json({ success: true, message: 'Mwanachama amethibitishwa kikamilifu!' });
});

app.post('/api/admin/suspend', async (req, res) => {
    const { phone, reason } = req.body;
    const reasonText = reason ? reason.trim() : 'Akaunti imesimamishwa kwa muda.';
    
    const { data, error } = await supabase.from('users').update({ status: 'suspended', ban_reason: reasonText }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kusimamisha mwanachama.' });
    res.json({ success: true, message: `Mwanachama amesimamishwa kwa muda! Sababu: ${reasonText}` });
});

app.post('/api/admin/ban', async (req, res) => {
    const { phone, reason } = req.body;
    const reasonText = reason ? reason.trim() : 'Akaunti imefungiwa kabisa.';
    
    const { data, error } = await supabase.from('users').update({ status: 'banned', ban_reason: reasonText }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kumfungia mwanachama.' });
    res.json({ success: true, message: `Mwanachama amepigwa ban kabisa! Sababu: ${reasonText}` });
});

app.post('/api/admin/unban', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved', ban_reason: '' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kuondoa kifungo.' });
    res.json({ success: true, message: 'Vikwazo vyote vimeondolewa! Mwanachama yupo huru sasa.' });
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
    if (error) return res.json({ success: false, message: 'Imeshindikana kutuma tangazo.' });

    res.json({ success: true, message: 'Tangazo limetumwa kwa wanachama wote!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
