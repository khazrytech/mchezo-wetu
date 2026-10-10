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

// API ya Login inayoshughulikia Jina, Member ID, Phone, au Email
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Jaza taarifa zote.' });
        }

        let targetEmail = identifier;

        // Kama identifier haina @ (mfano: ni Baraka makoi, member_id, au phone)
        if (!identifier.includes('@')) {
            // Tafuta kwenye profiles table
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('email')
                .or(`full_name.ilike.%${identifier}%,phone.eq.${identifier},member_id.eq.${identifier}`)
                .maybeSingle();

            if (prof && prof.email) {
                targetEmail = prof.email;
            } else {
                // Kama haipatikani moja kwa moja, jaribu kama format ya gmail ya zamani
                targetEmail = identifier.toLowerCase().replace(/\s+/g, '') + '@gmail.com';
            }
        }

        // Fanya login Supabase Auth kwa kutumia email tuliyopata
        const { data, error } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
        });

        if (error || !data.session) {
            return res.status(400).json({ error: 'Kuingia kimeshindikana. Angalia jina/email au nenosiri lako.' });
        }

        // Uhakiki wa Approval na Ban
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profile) {
            if (profile.is_banned) {
                return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
            }
            if (!profile.is_approved) {
                return res.status(403).json({ error: 'Akaunti yako inasubiri idhini (Approval) kutoka kwa Admin.' });
            }
        }

        res.json({ token: data.session.access_token, user: data.user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API ya Signup
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

// Get Logged In User
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
            .single();

        res.json({
            id: user.id,
            email: user.email,
            full_name: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
            phone: profile?.phone || user.user_metadata?.phone || 'Imeunganishwa'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Users List
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Approve/Ban Action
app.post('/api/admin/action', async (req, res) => {
    try {
        const { userId, action } = req.body;
        let updateData = {};
        if (action === 'approve') updateData = { is_approved: true };
        if (action === 'ban') updateData = { is_banned: true };
        if (action === 'unban') updateData = { is_banned: false };

        const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
        if (error) throw error;

        res.json({ success: true, message: `Action ${action} successful.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => {
    console.log(`[SERVER RUNNING]: Port ${PORT}`);
});
