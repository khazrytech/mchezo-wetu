const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let users = [];

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
        email: email ? email.trim() : '',
        password,
        status: 'pending',
        memberNumber: null,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    res.json({ success: true, message: 'Usajili umefanikiwa! Subiri idhini (approval) kutoka kwa Msimamizi.' });
});

// 2. Admin kuona orodha ya wanachama wote
app.get('/api/admin/users', (req, res) => {
    res.json(users);
});

// 3. Admin ku-approve mwanachama na kumpa namba ya uanachama
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

// 4. Kuingia kwenye mfumo (Inaruhusu Simu, Jina, au Namba ya Mwanachama + Password)
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
        return res.status(400).json({ success: false, message: 'Taarifa si sahihi. Tumia Namba ya Simu, Jina, au Namba ya Mwanachama na Password.' });
    }

    if (user.status !== 'approved') {
        return res.status(403).json({ 
            success: false, 
            message: 'Akaunti yako bado haijaidhinishwa na Msimamizi (Pending Approval).' 
        });
    }

    res.json({ success: true, message: 'Umeingia kwa mafanikio!', user });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
