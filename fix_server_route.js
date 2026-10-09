const fs = require('fs');

if (fs.existsSync('server.js')) {
    let server = fs.readFileSync('server.js', 'utf8');
    
    // Angalia kama route ya /payment ipo, kama haipo au haisomi payment.html tunaongeza
    if (!server.includes("app.get('/payment'")) {
        const paymentRoute = `
app.get('/payment', (req, res) => {
    res.sendFile(__dirname + '/payment.html');
});
        `;
        server += "\n" + paymentRoute;
        fs.writeFileSync('server.js', server, 'utf8');
        console.log("Route ya /payment imeongezwa kwenye server.js!");
    } else {
        console.log("Route ya /payment ipo tayari kwenye server.js.");
    }
}
