const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const absoluteFixScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    // Ondoa kabisa jumbe za zamani za chini kama zipo
    setInterval(() => {
        document.querySelectorAll('div, span, p').forEach(el => {
            if (el.textContent && el.textContent.includes('Mfumo uko salama') && el.style.position === 'fixed') {
                el.remove();
            }
        });
    }, 300);

    // Tafuta kengele ya notification na uweke kitendakazi kipya safi
    const bell = document.querySelector('.fa-bell') || document.querySelector('[onclick*="notif"]') || document.querySelector('button:has(.fa-bell)');
    if (bell) {
        const btn = bell.closest('button') || bell;
        btn.removeAttribute('onclick');
        
        btn.onclick = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const res = await fetch('/api/announcements');
                const data = await res.json();
                const anns = data.success && data.announcements ? data.announcements : [];
                
                let content = anns.length > 0 ? anns.map(a => \`
                    <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:14px; margin-bottom:12px;">
                        <div style="font-size:14px; font-weight:900; color:#fff; margin-bottom:6px;">📢 \${a.title}</div>
                        <div style="font-size:12px; color:#cbd5e1; line-height:1.5;">\${a.message}</div>
                        <div style="font-size:10px; color:#60a5fa; margin-top:8px;">Tarehe: \${a.date || "Leo"}</div>
                    </div>
                \`).join('') : '<div style="text-align:center; color:#94a3b8; padding:30px; font-size:13px;">Hakuna matangazo mapya yaliyotumwa na admin kwa sasa.</div>';

                let modal = document.getElementById('masterProModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'masterProModal';
                    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.85); backdrop-filter:blur(16px); z-index:9999999; display:flex; align-items:center; justify-content:center; padding:20px;';
                    document.body.appendChild(modal);
                }
                modal.innerHTML = \`
                    <div style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:28px; padding:24px; width:100%; max-width:420px; max-height:85vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                            <h3 style="font-size:16px; font-weight:900; color:#fff; margin:0;">📢 Matangazo ya Admin</h3>
                            <button onclick="document.getElementById('masterProModal').style.display='none'" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                        </div>
                        <div>\${content}</div>
                    </div>
                \`;
                modal.style.display = 'flex';
            } catch(err) {
                console.error('Hitilafu:', err);
            }
        };
    }
});
</script>
`;

if (html.includes('</body>')) {
    html = html.replace('</body>', absoluteFixScript + '\n</body>');
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("MAFANIKIO: dashboard.html imerekebishwa kikamilifu!");
}
