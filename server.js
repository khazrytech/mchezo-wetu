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

// 1. Angalia kama Admin wa Kwanza Yupo (Lock Signup Logic)
app.get('/api/system/status', async (req, res) => {
    try {
        const { data: profs } = await supabase.from('profiles').select('id, is_admin').eq('is_admin', true);
        const hasAdmin = profs && profs.length > 0;
        res.json({ allowSignup: !hasAdmin });
    } catch (e) {
        res.json({ allowSignup: false });
    }
});

// 2. Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Tafadhali jaza taarifa zote.' });
        }

        let targetEmail = identifier.trim();

        let authResult = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
        });

        if (authResult.error) {
            let matchedEmail = null;
            const { data: profs } = await supabase.from('profiles').select('email, full_name, phone').limit(200);

            if (profs && profs.length > 0) {
                const found = profs.find(p => 
                    (p.full_name && p.full_name.toLowerCase().trim() === targetEmail.toLowerCase()) ||
                    (p.phone && p.phone.trim() === targetEmail) ||
                    (p.email && p.email.toLowerCase().includes(targetEmail.toLowerCase()))
                );
                if (found) matchedEmail = found.email;
            }

            if (matchedEmail) {
                authResult = await supabase.auth.signInWithPassword({
                    email: matchedEmail,
                    password: password
                });
            }
        }

        if (authResult.error || !authResult.data.session) {
            return res.status(400).json({ error: 'Kuingia kimeshindikana. Hakiki nenosiri au taarifa zako.' });
        }

        const user = authResult.data.user;

        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        // Auto-assign first user as SuperAdmin if no profiles exist
        if (!profile) {
            const { data: allP } = await supabase.from('profiles').select('id');
            const isFirst = !allP || allP.length === 0;

            profile = {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                phone: user.user_metadata?.phone || '',
                is_approved: true,
                is_admin: isFirst,
                is_banned: false
            };
            await supabase.from('profiles').upsert([profile]);
        }

        if (profile.is_banned) {
            return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
        }

        res.json({ 
            token: authResult.data.session.access_token, 
            user: { ...user, is_admin: profile.is_admin } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Signup Endpoint (Disables if Admin exists)
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { data: existingAdmins } = await supabase.from('profiles').select('id').eq('is_admin', true);
        
        const isFirstUser = !existingAdmins || existingAdmins.length === 0;

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
                is_approved: isFirstUser,
                is_admin: isFirstUser,
                is_banned: false
            }]);
        }

        res.json({ message: 'Usajili umefanikiwa. Subiri uthibitisho.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Verification Check ya Admin Guard
app.get('/api/admin/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Unauthorised' });
        const token = authHeader.split(' ')[1];

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid Token' });

        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();

        if (!profile || !profile.is_admin) {
            return res.status(403).json({ error: 'Sio Admin' });
        }

        res.json({ isAdmin: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Admin User Management List
app.get('/api/admin/users', async (req, res) => {
    try {
        let { data: profiles } = await supabase.from('profiles').select('*');
        res.json(profiles || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Add User via Admin Panel
app.post('/api/admin/add-user', async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;
        const { data, error } = await supabase.auth.signUp({
            email,
            password: 'User@123456',
            options: { data: { full_name: fullName, phone } }
        });

        if (data.user) {
            await supabase.from('profiles').upsert([{
                id: data.user.id,
                email: email,
                full_name: fullName,
                phone: phone || '',
                is_approved: true,
                is_admin: false,
                is_banned: false
            }]);
        }

        res.json({ success: true, message: 'Mwanachama ameongezwa.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Toggle Admin status or Ban status
app.post('/api/admin/action', async (req, res) => {
    try {
        const { userId, action } = req.body;
        let updateData = {};
        if (action === 'approve') updateData = { is_approved: true };
        if (action === 'ban') updateData = { is_banned: true };
        if (action === 'unban') updateData = { is_banned: false };
        if (action === 'make_admin') updateData = { is_admin: true };
        if (action === 'remove_admin') updateData = { is_admin: false };

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
            is_admin: profile?.is_admin || false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log(`[SERVER RUNNING]: Port ${PORT}`));
