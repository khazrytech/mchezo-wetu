const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const otpStore = new Map();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Resend HTTP API Email Engine (Port 443 HTTPS - Works 100% on Render Free Tier)
async function sendEmailViaHTTP(toEmail, otpCode, title = "Admin Verification") {
    const resendApiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : null;

    if (resendApiKey) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'Mchezo Wetu Fintech <onboarding@resend.dev>',
                    to: [toEmail],
                    subject: `🔑 ${otpCode} - Kodi yako ya ${title}`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; background-color: #030712; color: #ffffff; border-radius: 20px; max-width: 480px; margin: auto; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <span style="background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.3); color: #60a5fa; padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px;">● MCHEZO WETU FINTECH</span>
                                <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin-top: 16px;">Uhakiki wa Utawala (Admin)</h2>
                            </div>
                            <p style="color: #9ca3af; font-size: 14px; text-align: center;">Kodi yako ya siri ya OTP ni:</p>
                            <div style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(16, 185, 129, 0.1)); border: 1px solid rgba(59, 130, 246, 0.3); padding: 20px; border-radius: 16px; text-align: center; margin: 24px 0;">
                                <span style="font-size: 36px; font-weight: 900; color: #10b981; letter-spacing: 8px; font-family: monospace;">${otpCode}</span>
                            </div>
                            <p style="color: #6b7280; font-size: 12px; text-align: center;">Muda wa matumizi ni dakika 5. Usiigawie mtu yeyote kwa sababu za kiusalama.</p>
                        </div>
                    `
                })
            });

            const data = await response.json();
            if (response.ok) {
                console.log(`[RESEND EMAIL SUCCESS] ID: ${data.id} -> Sent to: ${toEmail}`);
            } else {
                console.error(`[RESEND EMAIL ERROR]`, data);
            }
        } catch (err) {
            console.error(`[RESEND HTTP ERROR]`, err.message);
        }
    } else {
        console.log(`\n==========================================\n[SERVER LOG OTP FOR ${toEmail}]: ${otpCode}\n==========================================\n`);
    }
}

// 1. ANGALIA KAMA KUNA ADMIN TAYARI KWENYE SUPABASE
app.get('/api/admin/check-exists', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'admin');
        if (error) throw error;
        res.json({ success: true, exists: data && data.length > 0 });
    } catch (err) {
        res.json({ success: false, exists: false, message: err.message });
    }
});

// 2. USAJILI WA ADMIN - INSTANT RESPONSE
app.post('/api/admin/register-send-otp', async (req, res) => {
    try {
        const { fullName, phone, email, password } = req.body;

        const { data: existingAdmin } = await supabase.from('users').select('*').eq('role', 'admin');
        if (existingAdmin && existingAdmin.length > 0) {
            return res.json({ success: false, message: 'Admin yupo tayari kwenye mfumo! Tafadhali ingia.' });
        }

        if (!fullName || !email || !password) {
            return res.json({ success: false, message: 'Tafadhali jaza jina, email na nenosiri.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const otpCode = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        otpStore.set(cleanEmail, {
            code: otpCode,
            expiresAt,
            type: 'ADMIN_REGISTER',
            payload: { fullName, phone: phone || '', email: cleanEmail, password }
        });

        // Tuma kupitia HTTP API
        sendEmailViaHTTP(cleanEmail, otpCode, "Usajili wa Msimamizi");

        return res.json({ 
            success: true, 
            email: cleanEmail,
            message: `OTP Code sent to ${cleanEmail}` 
        });
    } catch (err) {
        return res.json({ success: false, message: 'Hitilafu ya Seva: ' + err.message });
    }
});

// 3. THIBITISHA EMAIL OTP NA SAAJILI ADMIN KWENYE SUPABASE
app.post('/api/admin/register-verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const record = otpStore.get(cleanEmail);

        if (!record || record.type !== 'ADMIN_REGISTER') {
            return res.json({ success: false, message: 'Ombi la OTP halipatikani au limeisha.' });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(cleanEmail);
            return res.json({ success: false, message: 'Muda wa OTP umeisha. Omba tena.' });
        }

        if (record.code !== otp.toString().trim()) {
            return res.json({ success: false, message: 'OTP uliyoingiza si sahihi.' });
        }

        const { fullName, phone, password } = record.payload;
        const adminUser = {
            full_name: fullName,
            phone: phone || '0000000000',
            email: cleanEmail,
            password,
            member_number: 'MW-ADMIN-01',
            role: 'admin',
            status: 'approved',
            date_registered: new Date().toLocaleDateString('sw-TZ')
        };

        const { error } = await supabase.from('users').insert([adminUser]);
        if (error) {
            return res.json({ success: false, message: 'Hitilafu ya Supabase: ' + error.message });
        }

        otpStore.delete(cleanEmail);
        return res.json({ success: true, message: 'Usajili wa Admin umefanikiwa!' });
    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// 4. LOGIN YA ADMIN - INSTANT RESPONSE
app.post('/api/admin/login-send-otp', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const { data: users } = await supabase.from('users').select('*').eq('role', 'admin');
        if (!users || users.length === 0) {
            return res.json({ success: false, message: 'Hakuna Admin aliyesajiliwa bado.' });
        }

        const admin = users.find(u => 
            (u.email.toLowerCase() === identifier.toLowerCase() || u.phone === identifier || u.full_name.toLowerCase() === identifier.toLowerCase()) && 
            u.password === password
        );

        if (!admin) {
            return res.json({ success: false, message: 'Taarifa za Admin si sahihi.' });
        }

        const otpCode = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        otpStore.set(admin.email, {
            code: otpCode,
            expiresAt,
            type: 'ADMIN_LOGIN',
            email: admin.email
        });

        sendEmailViaHTTP(admin.email, otpCode, "Kuingia Msimamizi");

        return res.json({ 
            success: true, 
            email: admin.email,
            message: `OTP Code sent to ${admin.email}` 
        });
    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// 5. THIBITISHA EMAIL OTP YA LOGIN YA ADMIN
app.post('/api/admin/login-verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const record = otpStore.get(cleanEmail);

        if (!record || record.type !== 'ADMIN_LOGIN') {
            return res.json({ success: false, message: 'Ombi la OTP halipatikani.' });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(cleanEmail);
            return res.json({ success: false, message: 'Muda wa OTP umeisha.' });
        }

        if (record.code !== otp.toString().trim()) {
            return res.json({ success: false, message: 'OTP uliyoingiza si sahihi.' });
        }

        otpStore.delete(cleanEmail);
        return res.json({ success: true, message: 'Umekaribishwa Msimamizi!' });
    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// MANAGE USERS & ANNOUNCEMENTS
app.get('/api/admin/users', async (req, res) => {
    const { data: users, error } = await supabase.from('users').select('*').order('id', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });

    const formatted = users.map(u => ({
        fullName: u.full_name,
        phone: u.phone,
        email: u.email,
        memberNumber: u.member_number,
        role: u.role || 'member',
        status: u.status,
        dateRegistered: u.date_registered || 'Leo'
    }));
    res.json({ success: true, users: formatted });
});

app.post('/api/admin/approve', async (req, res) => {
    const { phone } = req.body;
    const { data, error } = await supabase.from('users').update({ status: 'approved' }).eq('phone', phone).select();
    if (error || !data || data.length === 0) return res.json({ success: false, message: 'Imeshindikana kuidhinisha.' });
    res.json({ success: true, message: 'Mwanachama amethibitishwa!' });
});

app.get('/api/announcements', async (req, res) => {
    const { data: announcements } = await supabase.from('announcements').select('*').order('id', { ascending: false });
    res.json({ success: true, announcements: announcements || [] });
});

app.post('/api/announcements', async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) return res.json({ success: false, message: 'Kichwa na ujumbe vinahitajika.' });

    const newAnn = { title, message, date: new Date().toLocaleDateString('sw-TZ') };
    const { error } = await supabase.from('announcements').insert([newAnn]);
    if (error) return res.json({ success: false, message: 'Imeshindikana kutuma.' });

    res.json({ success: true, message: 'Tangazo limetumwa kwa wanachama!' });
});

app.listen(PORT, () => {
    console.log(`Server inaendelea kwenye port ${PORT}`);
});
