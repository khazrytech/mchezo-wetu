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

// 1. API ya Login
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

            if (!matchedEmail) {
                try {
                    const { data: { users } } = await supabase.auth.admin.listUsers();
                    if (users) {
                        const u = users.find(usr => 
                            usr.email.toLowerCase().includes(targetEmail.toLowerCase()) ||
                            usr.user_metadata?.full_name?.toLowerCase() === targetEmail.toLowerCase() ||
                            usr.user_metadata?.phone === targetEmail ||
                            usr.email.split('@')[0].toLowerCase() === targetEmail.toLowerCase()
                        );
                        if (u) matchedEmail = u.email;
                    }
                } catch (e) {}
            }

            if (matchedEmail) {
                authResult = await supabase.auth.signInWithPassword({
                    email: matchedEmail,
                    password: password
                });
            }
        }

        if (authResult.error || !authResult.data.session) {
            return res.status(400).json({ error: 'Kuingia kimeshindikana. Hakiki nenosiri au jina/email yako.' });
        }

        const user = authResult.data.user;

        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) {
            if (profile.is_banned) {
                return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
            }
            if (!profile.is_approved) {
                return res.status(403).json({ error: 'Akaunti yako inasubiri idhini (Approval) kutoka kwa Admin.' });
            }
        }

        res.json({ token: authResult.data.session.access_token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. API ya Signup
app.post('/api/auth/signup', async (req, res) => {
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
                is_banned: false
            }]);
        }

        res.json({ message: 'Usajili umefanikiwa.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin: Orodha ya Wanachama (Soma kutoka profiles + auth)
app.get('/api/admin/users', async (req, res) => {
    try {
        let { data: profiles, error } = await supabase.from('profiles').select('*');
        
        if (error || !profiles || profiles.length === 0) {
            try {
                const { data: { users } } = await supabase.auth.admin.listUsers();
                if (users && users.length > 0) {
                    profiles = users.map(u => ({
                        id: u.id,
                        email: u.email,
                        full_name: u.user_metadata?.full_name || u.email.split('@')[0],
                        phone: u.user_metadata?.phone || '07XXXXXXXX',
                        is_approved: true,
                        is_banned: false
                    }));
                }
            } catch (e) {}
        }

        res.json(profiles || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Admin: Hifadhi Mwanachama Mpya Kutoka Kadi ya Modal
app.post('/api/admin/add-user', async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;
        const tempPassword = 'User@123456';

        const { data, error } = await supabase.auth.signUp({
            email,
            password: tempPassword,
            options: { data: { full_name: fullName, phone } }
        });

        if (data.user) {
            await supabase.from('profiles').upsert([{
                id: data.user.id,
                email: email,
                full_name: fullName,
                phone: phone || '',
                is_approved: true,
                is_banned: false
            }]);
        }

        res.json({ success: true, message: 'Mwanachama amehifadhiwa vizuri!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Admin: Approve / Ban Action
app.post('/api/admin/action', async (req, res) => {
    try {
        const { userId, action } = req.body;
        let updateData = {};
        if (action === 'approve') updateData = { is_approved: true };
        if (action === 'ban') updateData = { is_banned: true };
        if (action === 'unban') updateData = { is_banned: false };

        const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
        if (error) throw error;

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

        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        res.json({
            id: user.id,
            email: user.email,
            full_name: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
            phone: profile?.phone || user.user_metadata?.phone || '07XXXXXXXX'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log(`[SERVER RUNNING]: Port ${PORT}`));
