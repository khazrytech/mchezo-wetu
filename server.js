const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/user/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Hakuna Token' });
        const token = authHeader.split(' ')[1];

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Token sio sahihi' });

        let fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];

        res.json({
            id: user.id,
            email: user.email,
            full_name: fullName,
            phone: user.user_metadata?.phone || user.phone || 'Imeunganishwa'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/stats', async (req, res) => {
    res.json({
        myContribution: 0,
        totalContribution: 0,
        totalMembers: 1,
        activeContributors: 0,
        pendingMembers: 1,
        groupName: "Mchezo Wetu Enterprise",
        progress: 0
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
