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
        status: 'pending',
        memberNumber: null,
        createdAt: new Date().toLocaleString()
    };

    users.push(newUser);
    res.json({ success: true, message: 'Ombi lako limetumwa kwa mafanikio!', user: newUser });
});

// 2. Admin kupata data zote za mfumo
app.get('/api/admin/data', (req, res) => {
    res.json({
        users,
        transactions,
        announcements,
        groupStats
    });
});

// 3. Admin ku-approve mwanachama
app.post('/api/admin/approve/:id', (req, res) => {
    const userId = req.params.id;
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ success: false, message: 'Mwanachama hajapatikana.' });
    }

    user.status = 'approved';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    user.memberNumber = `MW-${new Date().getFullYear()}-${randomNum}`;

    res.json({ success: true, message: 'Mwanachama amekubaliwa kikamilifu!', user });
});

// 4. Admin ku-reject mwanachama
app.post('/api/admin/reject/:id', (req, res) => {
    const userId = req.params.id;
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Ombi halijapatikana.' });
    }

    users.splice(index, 1);
    res.json({ success: true, message: 'Ombi limekataliwa na kufutwa.' });
});

// 5. Admin kuongeza Miamala / Rekodi
app.post('/api/admin/transaction', (req, res) => {
    const { type, amount, member } = req.body;
    if (!type || !amount || !member) {
        return res.status(400).json({ success: false, message: 'Jaza taarifa zote za muamala.' });
    }
    const numAmount = parseFloat(amount);
    transactions.unshift({
        id: Date.now(),
        type,
        amount: numAmount,
        member,
        date: new Date().toISOString().split('T')[0]
    });
    groupStats.balance += numAmount;
    groupStats.total += numAmount;

    res.json({ success: true, message: 'Muamala umehifadhiwa kikamilifu!', groupStats, transactions });
});

// 6. Admin kutuma Tangazo
app.post('/api/admin/announcement', (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Jaza kichwa na ujumbe wa tangazo.' });
    }
    announcements.unshift({
        id: Date.now(),
        title,
        message,
        date: new Date().toISOString().split('T')[0]
    });
    res.json({ success: true, message: 'Tangazo limetumwa kwa wanachama wote!', announcements });
});

// 7. Kuingia kwenye mfumo (Sign In)
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Tafadhali jaza taarifa zako zote.' });
    }

    const cleanInput = identifier.trim().toLowerCase();

    const user = users.find(u => {
        const matchIdentifier = 
            u.phone.toLowerCase() === cleanInput || 
            u.fullName.toLowerCase() === cleanInput || 
            (u.memberNumber && u.memberNumber.toLowerCase() === cleanInput);
            
        return matchIdentifier && u.password === password;
    });

    if (!user) {
        return res.status(400).json({ success: false, message: 'Taarifa si sahihi. Angalia namba, jina au password.' });
    }

    if (user.status !== 'approved') {
        return res.status(403).json({ 
            success: false, 
            pending: true,
            message: 'Akaunti yako bado iko kwenye mchakato wa kusubiri idhini (Pending Approval) kutoka kwa Msimamizi.' 
        });
    }

    res.json({ success: true, message: 'Umeingia kwa mafanikio!', user });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
