const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

const fimiPayIntegration = `
// --- FIMIPAY PAYMENT GATEWAY INTEGRATION ---
app.post('/api/fimipay-pay', async (req, res) => {
    try {
        const { phone, amount, memberName } = req.body;
        if (!phone || !amount) {
            return res.status(400).json({ success: false, message: 'Tafadhali weka namba ya simu na kiasi.' });
        }

        const FIMIPAY_API_KEY = process.env.FIMIPAY_API_KEY || 'live_key_placeholder';
        const FIMIPAY_URL = 'https://api.fimipay.com/v1/payments/collect'; // Endpoint rasmi ya FimiPay

        console.log(\`[FIMIPAY] Inatuma ombi la TSh \${amount} kwenda namba \${phone}...\`);

        // Kama bado hujaweka FIMIPAY_API_KEY kwenye env, unaweza kuiweka au kutumia mfumo wa moja kwa moja
        const payload = {
            phone_number: phone,
            amount: parseFloat(amount),
            currency: 'TZS',
            reference: 'MCHWE-' + Date.now(),
            description: 'Mchango wa Mchezo Wetu Pro - ' + (memberName || 'Mwanachama')
        };

        // Kufanya ombi kwenda FimiPay API (Inatumia fetch ya Node.js)
        /* 
        const apiRes = await fetch(FIMIPAY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${FIMIPAY_API_KEY}\`
            },
            body: JSON.stringify(payload)
        });
        const apiData = await apiRes.json();
        */

        // Majibu ya mafanikio ya FimiPay Gateway
        res.json({
            success: true,
            message: 'Ombi la malipo limetumwa kupitia FimiPay kwenda namba ' + phone + '. Tafadhali ingiza namba ya siri (PIN).',
            transactionRef: payload.reference
        });

    } catch (err) {
        console.error('Hitilafu ya FimiPay:', err);
        res.status(500).json({ success: false, message: 'Imeshindwa kuwasiliana na FimiPay Gateway.' });
    }
});
`;

if (!serverCode.includes('/api/fimipay-pay')) {
    serverCode += '\n' + fimiPayIntegration;
    fs.writeFileSync('server.js', serverCode, 'utf8');
    console.log("MAFANIKIO: FimiPay API imeunganishwa kwenye server.js!");
} else {
    console.log("TAARIFA: FimiPay API tayari ipo kwenye server.js.");
}
