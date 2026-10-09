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
        fullName,
        phone,
        email: email || '',
        password,
        status: 'pending', // inaanza ikiwa pending
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

// 4. Kuingia kwenye mfumo (Sign In)
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);

    if (!user) {
        return res.status(400).json({ success: false, message: 'Namba ya simu au neno la siri si sahihi.' });
    }

    if (user.status !== 'approved') {
        return res.status(403).json({ 
            success: false, 
            message: 'Akaunti yako bado haijaidhinishwa na Msimamizi. Tafadhali subiri approval.' 
        });
    }

    res.json({ success: true, message: 'Umeingia kwa mafanikio!', user });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
