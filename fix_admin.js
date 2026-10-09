const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// 1. Rekebisha padding ya chini kwenye admin dashboard ili isifunikwe na nav bar
const bottomFixCSS = `
<style>
.main-content, .container, body { padding-bottom: 140px !important; }
</style>
`;
if (!html.includes("padding-bottom: 140px")) {
    if (html.includes("</head>")) {
        html = html.replace("</head>", bottomFixCSS + "\n</head>");
    } else {
        html += bottomFixCSS;
    }
}

// 2. Rekebisha kitufe cha notifications kionyeshe orodha ya matangazo halisi kutoka API
const adminNotifScript = `
<script>
async function handleAdminNotifications() {
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        const anns = data.success ? data.announcements : [];
        
        let content = anns.length > 0 ? anns.map(a => \`
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; margin-bottom:10px;">
                <div style="font-size:13px; font-weight:900; color:#fff; margin-bottom:4px;">📢 \${a.title}</div>
                <div style="font-size:12px; color:#94a3b8; line-height:1.4;">\${a.message}</div>
                <div style="font-size:9px; color:#60a5fa; margin-top:6px;">Tarehe: \${a.date || "Leo"}</div>
            </div>
        \`).join('') : '<div style="text-align:center; color:#94a3b8; padding:20px;">Hakuna matangazo yaliyotumwa bado.</div>';

        let modal = document.getElementById('adminNotifModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'adminNotifModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.85); backdrop-filter:blur(12px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;';
            document.body.appendChild(modal);
        }
        modal.innerHTML = \`
            <div style="background:rgba(15,23,42,0.96); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:20px; width:100%; max-width:400px; max-height:80vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h3 style="font-size:15px; font-weight:900; color:#fff; margin:0;">Matangazo Yaliyotumwa</h3>
                    <button onclick="document.getElementById('adminNotifModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer;">✕</button>
                </div>
                <div>\${content}</div>
            </div>
        \`;
        modal.style.display = 'flex';
    } catch(e) {
        console.error(e);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const notifEls = document.querySelectorAll('.fa-bell, [onclick*="notification"], [onclick*="Alert"]');
    notifEls.forEach(el => {
        const btn = el.closest('button') || el;
        btn.setAttribute('onclick', 'handleAdminNotifications()');
    });
});
</script>
`;

if (html.includes('</body>')) {
    html = html.replace('</body>', adminNotifScript + '\n</body>');
}

fs.writeFileSync('admin.html', html, 'utf8');
console.log("MAFANIKIO: admin.html imerekebishwa kikamilifu!");
