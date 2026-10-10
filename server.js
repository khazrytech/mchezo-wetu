const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// 1. Endpoint ya Taarifa za Mtumiaji na Uhakiki wa Approval/Ban
app.get('/api/user/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Hairuhusiwi' });
        const token = authHeader.split(' ')[1];
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Token si sahihi' });

        // Angalia kwenye profiles table kama yupo na hali yake
        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) {
            // Unda profile ya awali ikiwa haipo
            const newProf = {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                phone: user.user_metadata?.phone || '07XXXXXXXX',
                is_approved: false,
                is_banned: false,
                role: 'member'
            };
            await supabase.from('profiles').insert([newProf]);
            profile = newProf;
        }

        if (profile.is_banned) {
            return res.status(403).json({ error: 'Akaunti yako imepigwa marufuku (Banned).' });
        }

        if (!profile.is_approved) {
            return res.status(403).json({ error: 'Akaunti yako inasubiri idhini (Pending Approval) kutoka kwa Admin.' });
        }

        res.json({
            id: user.id,
            email: user.email,
            full_name: profile.full_name,
            phone: profile.phone,
            role: profile.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Takwimu za Dashboard
app.get('/api/user/stats', async (req, res) => {
    res.json({
        dailyContribution: 2000,
        dailyTarget: 6000,
        totalCollectedToday: 4000,
        progress: 67,
        paidToday: 18,
        pendingToday: 7,
        totalMembers: 25,
        groupName: "Mchezo Wetu Digital Hub"
    });
});

// 3. Admin: Orodha ya Wanachama Wote
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Admin: Approve / Ban Wanachama
app.post('/api/admin/action', async (req, res) => {
    try {
        const { userId, action } = req.body; // action: 'approve', 'ban', 'unban'
        let updateData = {};
        if (action === 'approve') updateData = { is_approved: true };
        if (action === 'ban') updateData = { is_banned: true };
        if (action === 'unban') updateData = { is_banned: false };

        const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
        if (error) throw error;

        res.json({ success: true, message: `Hatua ya '${action}' imefanikiwa.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Frontend Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => {
    console.log(`[SERVER RUNNING]: Port ${PORT}`);
});
