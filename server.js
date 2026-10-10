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

// 1. User Signup (Inatuma OTP kupitia Supabase Auth / Resend API)
app.post('/api/auth/signup-user', async (req, res) => {
    try {
        const { email, password, fullName, phone } = req.body;
        const { data, error } = await supabase.auth.signUp({
            email, password, options: { data: { full_name: fullName, phone } }
        });

        if (error) return res.status(400).json({ error: error.message });

        if (data.user) {
            await supabase.from('profiles').upsert([{
                id: data.user.id,
                email: email,
                full_name: fullName,
                phone: phone || '',
                is_approved: false,
                is_admin: false,
                is_banned: false
            }]);
        }

        res.json({ success: true, message: 'OTP imetumwa kwenye barua pepe yako. Tafadhali thibitisha.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. User Login (Kuthibitisha kama kashawekewa OTP na Ameidhinishwa na Admin)
app.post('/api/auth/login-user', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        let targetEmail = identifier.trim();

        let authResult = await supabase.auth.signInWithPassword({ email: targetEmail, password });

        if (authResult.error) {
            const { data: profs } = await supabase.from('profiles').select('email, full_name, phone').limit(200);
            if (profs) {
                const found = profs.find(p => 
                    (p.full_name && p.full_name.toLowerCase().trim() === targetEmail.toLowerCase()) ||
                    (p.phone && p.phone.trim() === targetEmail) ||
                    (p.email && p.email.toLowerCase().includes(targetEmail.toLowerCase()))
                );
                if (found) targetEmail = found.email;
            }
            authResult = await supabase.auth.signInWithPassword({ email: targetEmail, password });
        }

        if (authResult.error || !authResult.data.session) {
            return res.status(400).json({ error: 'Kuingia kimeshindikana. Hakiki nenosiri au email yako.' });
        }

        const user = authResult.data.user;
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        if (profile?.is_admin) {
            return res.status(403).json({ error: 'Akaunti hii ni ya Admin! Tumia Admin Portal.' });
        }

        if (profile?.is_banned) {
            return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
        }

        if (!profile?.is_approved) {
            return res.status(403).json({ 
                error: 'Akaunti yako imesajiliwa na OTP imethibitishwa, lakini bado inasubiri idhini (Approval) ya Admin.',
                pendingApproval: true 
            });
        }

        res.json({ token: authResult.data.session.access_token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin Login
app.post('/api/auth/login-admin', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        let targetEmail = identifier.trim();

        let authResult = await supabase.auth.signInWithPassword({ email: targetEmail, password });

        if (authResult.error) {
            const { data: profs } = await supabase.from('profiles').select('email, full_name, phone').limit(200);
            if (profs) {
                const found = profs.find(p => 
                    (p.full_name && p.full_name.toLowerCase().trim() === targetEmail.toLowerCase()) ||
                    (p.phone && p.phone.trim() === targetEmail) ||
                    (p.email && p.email.toLowerCase().includes(targetEmail.toLowerCase()))
                );
                if (found) targetEmail = found.email;
            }
            authResult = await supabase.auth.signInWithPassword({ email: targetEmail, password });
        }

        if (authResult.error || !authResult.data.session) {
            return res.status(400).json({ error: 'Ingia ya Admin imeshindikana.' });
        }

        const user = authResult.data.user;
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Huruhusiwi! Akaunti hii sio ya Admin.' });
        }

        res.json({ token: authResult.data.session.access_token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Guard Verify
app.get('/api/admin/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Unauthorised' });
        const token = authHeader.split(' ')[1];

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid Token' });

        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (!profile || !profile.is_admin) return res.status(403).json({ error: 'Sio Admin' });

        res.json({ isAdmin: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

app.get('/api/user/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Hairuhusiwi' });
        const token = authHeader.split(' ')[1];
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Token si sahihi' });

        let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

        res.json({
            id: user.id,
            email: user.email,
            full_name: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
            phone: profile?.phone || user.user_metadata?.phone || '07XXXXXXXX',
            is_approved: profile?.is_approved || false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log(`[SERVER RUNNING]: Port ${PORT}`));
