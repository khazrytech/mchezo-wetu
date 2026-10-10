const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder-key'
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// API zote za mfumo zinabaki salama nyuma ya pazia
app.get('/api/admin/users', async (req, res) => {
    try {
        let { data: profiles } = await supabase.from('profiles').select('*');
        res.json(profiles || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/action', async (req, res) => {
    try {
        const { userId, action } = req.body;
        let updateData = {};
        if (action === 'approve') updateData = { is_approved: true };
        if (action === 'ban') updateData = { is_banned: true };
        if (action === 'unban') updateData = { is_banned: false };

        await supabase.from('profiles').update(updateData).eq('id', userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// HAPA NDIPO KILA KITU KINAFUNGUKA DIRECT BILA LOGIN PAGE:
// 1. Ukitembelea link kuu (/), inafungua dashboard moja kwa moja
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// 2. Ukitembelea /admin-login au /admin, inafungua admin panel moja kwa moja
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// 3. Dashboard ya wanachama
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.listen(PORT, () => console.log(`[SERVER RUNNING]: Port ${PORT}`));
