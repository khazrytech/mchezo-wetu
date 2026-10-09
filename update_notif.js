const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const proNotificationScript = `
<script>
async function openNotificationsModal() {
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
        \`).join('') : '<div style="text-align:center; color:#94a3b8; padding:20px;">Hakuna taarifa mpya kwa sasa.</div>';

        let modal = document.getElementById('announcementModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'announcementModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.85); backdrop-filter:blur(12px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;';
            document.body.appendChild(modal);
        }
        modal.innerHTML = \`
            <div style="background:rgba(15,23,42,0.96); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:20px; width:100%; max-width:400px; max-height:80vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h3 style="font-size:15px; font-weight:900; color:#fff; margin:0;">Taarifa na Matangazo</h3>
                    <button onclick="document.getElementById('announcementModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer;">✕</button>
                </div>
                <div>\${content}</div>
            </div>
        \`;
        modal.style.display = 'flex';
    } catch(e) { console.error(e); }
}

window.addEventListener('DOMContentLoaded', () => {
    const bell = document.querySelector('.fa-bell') || document.querySelector('[onclick*="notification"]');
    if (bell) {
        const btn = bell.closest('button') || bell;
        btn.setAttribute('onclick', 'openNotificationsModal()');
    }
});
</script>
`;

if (html.includes('</body>')) {
    html = html.replace('</body>', proNotificationScript + '\n</body>');
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("MAFANIKIO: Sehemu ya arifa imeboreshwa na kuwa ya Pro!");
} else {
    console.log("HITILAFU: Haikuweza kupata mwisho wa faili.");
}
