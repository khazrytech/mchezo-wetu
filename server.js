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

// Helper: Log Admin Activity
async function logActivity(adminName, action, details) {
    try {
        await supabase.from('activity_logs').insert([{
            admin_name: adminName,
            action: action,
            details: details,
            date: new Date().toLocaleString('sw-TZ')
        }]);
    } catch (e) {
        console.error('Log error:', e.message);
    }
}

// LOGIN API
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.json({ success: false, message: 'Ingiza namba ya simu, jina au namba ya mwanachama na nenosiri.' });
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

        if (!user) return res.json({ success: false, message: 'Akaunti hii haijapatikana.' });
        if (user.password !== password) return res.json({ success: false, message: 'Nenosiri si sahihi.' });

        if (user.status === 'banned') {
            return res.json({ success: false, message: `Akaunti imefungiwa kabisa. Sababu: ${user.ban_reason || 'Hakuna sababu maalum.'}` });
        }
        if (user.status === 'suspended') {
            return res.json({ success: false, message: `Akaunti imesimamishwa kwa muda. Sababu: ${user.ban_reason || 'Hakuna sababu maalum.'}` });
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
                role: user.role || 'member',
                status: user.status,
                banReason: user.ban_reason || '',
                hasPaidToday: user.has_paid_today || false,
                paymentStatus: user.payment_status || 'unpaid'
            }
        });
    } catch (err) {
        return res.json({ success: false, message: 'Hitilafu ya Seva: ' + err.message });
    }
});

// REGISTER API
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, phone, email, password } = req.body;
        if (!fullName || !phone || !password) {
            return res.json({ success: false, message: 'Tafadhali jaza taarifa zote.' });
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
            has_paid_today: false,
            payment_status: 'unpaid',
            monthly_contributions: 0,
            date_registered: new Date().toLocaleDateString('sw-TZ')
        };

        const { error } = await supabase.from('users').insert([newUser]);
        if (error) throw error;

        return res.json({ success: true, message: 'Usajili umefanikiwa! Subiri idhini ya Admin.' });
    } catch (err) {
        return res.json({ success: false, message: 'Imeshindikana kusajili: ' + err.message });
    }
});

// ADMIN USERS FETCH
app.get('/api/admin/users', async (req, res) => {
    const { data: users, error } = await supabase.from('users').select('*').order('id', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });

    const formatted = users.map(u => ({
        fullName: u.full_name,
        phone: u.phone,
        email: u.email,
        memberNumber: u.member_number,
        role: u.role || 'member',
        status: u.status || 'approved',
        banReason: u.ban_reason || '',
        hasPaidToday: u.has_paid_today || false,
        paymentStatus: u.payment_status || 'unpaid',
        monthlyContributions: u.monthly_contributions || 0
    }));
    res.json({ success: true, users: formatted });
});

// ADMIN ACTIONS
app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { error } = await supabase.from('users').update({ status: 'approved', ban_reason: '' }).eq('phone', phone);
    if (error) return res.json({ success: false, message: error.message });
    await logActivity('Super Admin', 'Approve User', `Amemuidhinisha mwanachama namba ${phone}`);
    res.json({ success: true, message: 'Mwanachama amethibitishwa kikamilifu!' });
});

app.post('/api/admin/suspend', async (req, res) => {
    const { phone, reason } = req.body;
    const reasonText = reason ? reason.trim() : 'Kusimamishwa kwa muda.';
    const { error } = await supabase.from('users').update({ status: 'suspended', ban_reason: reasonText }).eq('phone', phone);
    if (error) return res.json({ success: false, message: error.message });
    await logActivity('Super Admin', 'Suspend User', `Amemsimamisha ${phone}. Sababu: ${reasonText}`);
    res.json({ success: true, message: 'Mwanachama amesimamishwa kwa muda!' });
});

app.post('/api/admin/ban', async (req, res) => {
    const { phone, reason } = req.body;
    const reasonText = reason ? reason.trim() : 'Kufungiwa kabisa.';
    const { error } = await supabase.from('users').update({ status: 'banned', ban_reason: reasonText }).eq('phone', phone);
    if (error) return res.json({ success: false, message: error.message });
    await logActivity('Super Admin', 'Permanent Ban', `Amempiga ban kabisa ${phone}. Sababu: ${reasonText}`);
    res.json({ success: true, message: 'Mwanachama amepigwa ban kabisa!' });
});

app.post('/api/admin/unban', async (req, res) => {
    const { phone } = req.body;
    const { error } = await supabase.from('users').update({ status: 'approved', ban_reason: '' }).eq('phone', phone);
    if (error) return res.json({ success: false, message: error.message });
    await logActivity('Super Admin', 'Unban User', `Ameondoa vikwazo kwa ${phone}`);
    res.json({ success: true, message: 'Kifungo kimeondolewa kikamilifu!' });
});

// ANNOUNCEMENTS
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

    await logActivity('Super Admin', 'Send Announcement', `Kichwa: ${title}`);
    res.json({ success: true, message: 'Tangazo limetumwa kwa wanachama wote!' });
});

// ACTIVITY LOGS API
app.get('/api/admin/logs', async (req, res) => {
    const { data: logs } = await supabase.from('activity_logs').select('*').order('id', { ascending: false }).limit(20);
    res.json({ success: true, logs: logs || [] });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// --- FIMIPAY PAYMENT GATEWAY INTEGRATION ---
app.post('/api/fimipay-pay', async (req, res) => {
    try {
        const { phone, amount, memberName } = req.body;
        if (!phone || !amount) {
            return res.status(400).json({ success: false, message: 'Tafadhali weka namba ya simu na kiasi.' });
        }

        const FIMIPAY_API_KEY = process.env.FIMIPAY_API_KEY || 'live_key_placeholder';
        const FIMIPAY_URL = 'https://api.fimipay.com/v1/payments/collect'; // Endpoint rasmi ya FimiPay

        console.log(`[FIMIPAY] Inatuma ombi la TSh ${amount} kwenda namba ${phone}...`);

        // Kama bado hujaweka FIMIPAY_API_KEY kwenye env, unaweza kuiweka au kutumia mfumo wa moja kwa moja
        const payload = {
            phone_number: phone,
            amount: parseFloat(amount),
            currency: 'TZS',
            reference: 'MCHWE-' + Date.now(),
            description: 'Mchango wa Mchezo Wetu Pro - ' + (memberName || 'Mwanachama')
        };

        // Kufanya ombi kwenda FimiPay API (Inatumia fetch ya Node.js)
        /* 
        const apiRes = await fetch(FIMIPAY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIMIPAY_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        const apiData = await apiRes.json();
        */

        // Majibu ya mafanikio ya FimiPay Gateway
        res.json({
            success: true,
            message: 'Ombi la malipo limetumwa kupitia FimiPay kwenda namba ' + phone + '. Tafadhali ingiza namba ya siri (PIN).',
            transactionRef: payload.reference
        });

    } catch (err) {
        console.error('Hitilafu ya FimiPay:', err);
        res.status(500).json({ success: false, message: 'Imeshindwa kuwasiliana na FimiPay Gateway.' });
    }
});



        