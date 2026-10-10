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

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Tafadhali jaza taarifa zote.' });
        }

        let targetEmail = identifier.trim();

        // 1. Jaribu kuingia na kile kilichoandikwa
        let authResult = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
        });

        // 2. Kama kimeshindikana na si email kamili, tafuta email kupitia profiles au listUsers
        if (authResult.error) {
            let matchedEmail = null;

            // Search profiles table
            const { data: prof } = await supabase
                .from('profiles')
                .select('email')
                .or(`full_name.ilike.%${targetEmail}%,phone.eq.${targetEmail}`)
                .maybeSingle();

            if (prof && prof.email) {
                matchedEmail = prof.email;
            } else {
                // Search via Supabase Admin Auth API
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
                } catch (e) {
                    console.log("Admin listUsers failed/not supported with anon key");
                }
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

        // Check Approval and Ban
        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profile) {
            if (profile.is_banned) {
                return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
            }
            if (!profile.is_approved) {
                return res.status(403).json({ error: 'Akaunti yako inasubiri idhini (Approval) ya Admin.' });
            }
        }

        res.json({ token: authResult.data.session.access_token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log(`[SERVER RUNNING]: Port ${PORT}`));
