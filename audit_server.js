const fs = require('fs');

if (!fs.existsSync('server.js')) {
    console.error("❌ Hitilafu: Faili la server.js halipatikani kwenye folda hii!");
    process.exit(1);
}

let server = fs.readFileSync('server.js', 'utf8');
console.log("🔍 Inachunguza server.js...");

let modified = false;

// 1. Hakikisha express.json ipo kwa ajili ya kusoma API request za malipo
if (!server.includes('express.json()')) {
    console.log("⚠️ Inaongeza express.json() middleware...");
    server = server.replace(/const\s+app\s*=\s*express\(\);/, "const app = express();\napp.use(express.json());");
    modified = true;
}

// 2. Hakikisha route ya /payment inasoma payment.html kwa usahihi
if (!server.includes("app.get('/payment'") && !server.includes('app.get("/payment"')) {
    console.log("⚠️ Route ya /payment haikuwepo. Inaongezwa sasa...");
    const routeCode = `
// Route ya kurudisha ukurasa wa malipo (payment.html)
app.get('/payment', (req, res) => {
    res.sendFile(__dirname + '/payment.html');
});
`;
    // Weka kabla ya app.listen
    if (server.includes('app.listen')) {
        server = server.replace('app.listen', routeCode + '\napp.listen');
    } else {
        server += '\n' + routeCode;
    }
    modified = true;
} else {
    console.log("✅ Route ya /payment ipo tayari.");
}

// 3. Hakikisha route ya API ya fimipay ipo
if (!server.includes('/api/fimipay-pay')) {
    console.log("⚠️ API ya /api/fimipay-pay haikuwepo. Inaongezwa mfano wake...");
    const apiCode = `
// API ya FimiPay Backend
app.post('/api/fimipay-pay', (req, res) => {
    const { phone, amount, network } = req.body;
    console.log(\`[FIMIPAY] Inatuma ombi la TSh \${amount} kwenda namba \${phone} kupitia \${network}...\`);
    // Rudisha mafanikio ya mfano
    setTimeout(() => {
        res.json({ success: true, message: "Ombi limetumwa mafanikio!" });
    }, 1500);
});
`;
    if (server.includes('app.listen')) {
        server = server.replace('app.listen', apiCode + '\napp.listen');
    } else {
        server += '\n' + apiCode;
    }
    modified = true;
} else {
    console.log("✅ API ya /api/fimipay-pay ipo tayari.");
}

if (modified) {
    fs.writeFileSync('server.js', server, 'utf8');
    console.log("✨ server.js imerekebishwa na kuhifadhiwa kikamilifu!");
} else {
    console.log("✨ server.js ilikuwa safi kabisa haina cha kubadilishwa.");
}
