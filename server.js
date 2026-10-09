const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

let users = [];

let announcements = [
    { title: "Karibu Mchezo Wetu", message: "Nawasalimu wote, karibuni kwenye mfumo mpya wa kidijitali wa kikundi.", date: "09 Oktoba 2026" }
];

app.post('/api/register', (req, res) => {
    const { fullName, phone, email, password } = req.body;
    if (!fullName || !phone || !password) {
        return res.json({ success: false, message: 'Tafadhali jaza jina, namba ya simu na password.' });
    }
    const existing = users.find(u => u.phone === phone);
    if (existing) {
        return res.json({ success: false, message: 'Namba hii ya simu imeshasajiliwa tayari.' });
    }

    const memberNumber = `MW-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser = {
        fullName,
        phone,
        email: email || '',
        password,
        memberNumber,
        status: 'pending'
    };
    users.push(newUser);
    res.json({ success: true, message: 'Ombi lako limetumwa kwa Msimamizi.', memberNumber });
});

app.post('/api/check-status', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.json({ success: false, message: 'Mtumiaji hapatikani.' });
    }
    res.json({ success: true, status: user.status, fullName: user.fullName, memberNumber: user.memberNumber });
});

app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    const user = users.find(u => 
        (u.phone === identifier || u.fullName.toLowerCase() === identifier.toLowerCase() || u.memberNumber === identifier) && 
        u.password === password
    );

    if (!user) {
        return res.json({ success: false, message: 'Taarifa si sahihi. Angalia namba, jina au password.' });
    }

    if (user.status !== 'approved') {
        return res.json({ success: false, pending: true, message: 'Akaunti yako bado haijathibitishwa na Msimamizi.' });
    }

    res.json({ success: true, message: 'Umekaribishwa kwenye mfumo!', user });
});

// ADMIN ENDPOINTS (Kusoma na kuidhinisha wanachama wapya)
app.get('/api/admin/users', (req, res) => {
    res.json({ success: true, users });
});

app.post('/api/admin/approve', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.json({ success: false, message: 'Mtumiaji hapatikani kwenye mfumo.' });
    }
    user.status = 'approved';
    res.json({ success: true, message: `Mwanachama ${user.fullName} amethibitishwa rasmi!` });
});

app.get('/api/announcements', (req, res) => {
    res.json({ success: true, announcements });
});

app.post('/api/announcements', (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
        return res.json({ success: false, message: 'Kichwa cha habari na ujumbe vinahitajika.' });
    }
    const newAnn = {
        title,
        message,
        date: new Date().toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    };
    announcements.unshift(newAnn);
    res.json({ success: true, message: 'Tangazo limetumwa na kuhifadhiwa kwenye arifa za wanachama.' });
});

app.listen(PORT, () => {
    console.log(`Server inaendelea kwenye port ${PORT}`);
});
