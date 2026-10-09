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
        email: email ? email.trim() : 'Hakuna',
        password,
        status: 'pending',
        memberNumber: null,
        createdAt: new Date().toLocaleString()
    };

    users.push(newUser);
    res.json({ success: true, message: 'Ombi lako limetumwa kwa mafanikio!', user: newUser });
});

// 2. Admin kuona orodha ya wanachama wote
app.get('/api/admin/users', (req, res) => {
    res.json(users);
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

// 4. Admin ku-reject / kufuta ombi la mwanachama
app.post('/api/admin/reject/:id', (req, res) => {
    const userId = req.params.id;
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Ombi halijapatikana.' });
    }

    users.splice(index, 1);
    res.json({ success: true, message: 'Ombi limekataliwa na kufutwa.' });
});

// 5. Kuingia kwenye mfumo (Sign In)
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
