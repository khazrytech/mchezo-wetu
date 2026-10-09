const fs = require('fs');

// 1. Hakikisha server.js inasoma faili la dashboard.html moja kwa moja kutoka diski (filesystem)
if (fs.existsSync('server.js')) {
    let server = fs.readFileSync('server.js', 'utf8');
    // Kama server haisomi dashboard.html kwenye route ya root, tunaisahihisha
    if (!server.includes('res.sendFile') || !server.includes('dashboard.html')) {
        console.log("Inarekebisha server.js kusoma dashboard.html halisi...");
        // Badilisha au ongeza route inayosoma dashboard.html moja kwa moja
        server = server.replace(/app\.get\('\/',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?\};/g, `
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});
        `);
        fs.writeFileSync('server.js', server, 'utf8');
    }
}

// 2. Hakikisha dashboard.html ina namba ya simu inayokubali namba zote za Tigo, Vodacom, Airtel, HaloPesa bila masharti magumu
if (fs.existsSync('dashboard.html')) {
    let html = fs.readFileSync('dashboard.html', 'utf8');
    
    // Tunaboresha kazi ya validatePhone iwe rahisi na isiyosumbua
    const looseValidationScript = `
    <script>
    function validatePhone() {
        const phoneInput = document.getElementById('fimiPhone');
        const statusText = document.getElementById('phoneStatusText');
        const checkIcon = document.getElementById('phoneCheckIcon');
        const summaryPhone = document.getElementById('summaryPhone');
        
        let val = phoneInput.value.replace(/\\D/g, '');
        summaryPhone.innerText = val ? '0' + val.replace(/^0+/, '') : '-';

        // Ruhusu namba yoyote yenye tarakimu 9 au 10 inayoanza na 6 au 7
        if (val.length >= 9 && (val.startsWith('6') || val.startsWith('7') || val.startsWith('06') || val.startsWith('07'))) {
            if (val.length === 9) val = '0' + val;
            if (statusText) {
                statusText.style.color = '#34d399';
                statusText.innerText = '✅ Namba sahihi, endelea na malipo';
            }
            if (checkIcon) checkIcon.style.display = 'block';
        } else {
            if (statusText) {
                statusText.style.color = '#f87171';
                statusText.innerText = '⚠️ Weka namba sahihi ya simu (Mf. 07XXXXXXXX)';
            }
            if (checkIcon) checkIcon.style.display = 'none';
        }
    }
    </script>
    `;

    if (!html.includes('function validatePhone')) {
        if (html.includes('</body>')) {
            html = html.replace('</body>', looseValidationScript + '\n</body>');
        } else {
            html += looseValidationScript;
        }
        fs.writeFileSync('dashboard.html', html, 'utf8');
        console.log("Uhakiki wa namba umerahisishwa kwenye dashboard.html!");
    }
}
console.log("Kila kitu kimesafishwa na kiko tayari!");
