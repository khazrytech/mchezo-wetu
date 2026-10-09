const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let users = [];
let transactions = [
    { id: 1, type: 'Mchango', amount: 50000, member: 'Mwanachama Mfano', date: '2026-10-08' }
];
let announcements = [
    { id: 1, title: 'Karibu Mchezo Wetu', message: 'Mfuko umeanza rasmi.', date: '2026-10-01' }
];
let groupStats = {
    balance: 245000,
    total: 1250000,
    thisMonth: 340000,
    loans: 45000
};

// 1. Usajili wa mwanachama mpya
app.post('/api/register', (req, res) => {
    const { fullName, phone, email, password } = req.body;
    
    if (!fullName || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Tafadhali jaza nafasi zote muhimu.' });
    }

    const existingUser = users.find(u => u.phone === phone);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Namba hii ya simu imesajiliwa tayari.' });
    }

    const newUser = {
        id: Date.now().toString(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : 'Hakuna',
        password,
        status: 'pending', // pending, approved, suspended
        memberNumber: null,
        createdAt: new Date().toLocaleString()
    };

    users.push(newUser);
    res.json({ success: true, message: 'Ombi lako limetumwa kwa mafanikio!', user: newUser });
});

// 2. Kuangalia hali ya ombi (Status Check) kwa ajili ya Live Update kwenye Pending Screen
app.post('/api/check-status', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.status(404).json({ success: false, message: 'Mtumiaji hajapatikana.' });
    }
    res.json({
        success: true,
        status: user.status,
        memberNumber: user.memberNumber,
        fullName: user.fullName
    });
});

// 3. Admin kupata data zote
app.get('/api/admin/data', (req, res) => {
    res.json({ users, transactions, announcements, groupStats });
});

// 4. Admin ku-approve mwanachama
app.post('/api/admin/approve/:id', (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Mwanachama hajapatikana.' });

    user.status = 'approved';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    user.memberNumber = `MW-${new Date().getFullYear()}-${randomNum}`;
    res.json({ success: true, message: 'Mwanachama amekubaliwa kikamilifu!', user });
});

// 5. Admin ku-reject / kufuta ombi
app.post('/api/admin/reject/:id', (req, res) => {
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Ombi halijapatikana.' });

    users.splice(index, 1);
    res.json({ success: true, message: 'Ombi limeondolewa.' });
});

// 6. Admin kusimamisha (Suspend) au Kuruhusu (Unsuspend)
app.post('/api/admin/suspend/:id', (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Mwanachama hajapatikana.' });

    if (user.status === 'suspended') {
        user.status = 'approved';
        res.json({ success: true, message: 'Mwanachama amerejeshwa!' });
    } else {
        user.status = 'suspended';
        res.json({ success: true, message: 'Mwanachama amesimamishwa!' });
    }
});

// 7. Login ya Mwanachama
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Jaza taarifa zote.' });

    const cleanInput = identifier.trim().toLowerCase();
    const user = users.find(u => {
        const match = u.phone.toLowerCase() === cleanInput || 
                      u.fullName.toLowerCase() === cleanInput || 
                      (u.memberNumber && u.memberNumber.toLowerCase() === cleanInput);
        return match && u.password === password;
    });

    if (!user) return res.status(400).json({ success: false, message: 'Taarifa si sahihi. Angalia namba, jina au password.' });

    if (user.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Akaunti yako imesimamishwa kwa muda na Msimamizi.' });
    }

    if (user.status !== 'approved') {
        return res.status(403).json({ success: false, pending: true, message: 'Akaunti yako bado inasubiri idhini.' });
    }

    res.json({ success: true, message: 'Umeingia kwa mafanikio!', user });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
