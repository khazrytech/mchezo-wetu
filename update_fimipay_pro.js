const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const proFimiPayModalScript = `
<script>
function openFimiPayModal() {
    let modal = document.getElementById('fimiPayModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fimiPayModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.88); backdrop-filter:blur(16px); z-index:9999999; display:flex; align-items:center; justify-content:center; padding:15px;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = \`
        <div style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:24px; padding:20px; width:100%; max-width:380px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8); font-family:inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
                <h3 style="font-size:15px; font-weight:900; color:#fff; margin:0; display:flex; align-items:center; gap:6px;">⚡ FimiPay Gateway</h3>
                <button onclick="document.getElementById('fimiPayModal').style.display='none'" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:30px; height:30px; border-radius:50%; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>

            <!-- Logos & Badges za Mitandao ya Simu -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:8px 12px; margin-bottom:14px;">
                <span style="font-size:10px; color:#94a3b8; font-weight:700;">MITANDAO:</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <span style="background:rgba(234,179,8,0.15); color:#facc15; font-size:9px; font-weight:800; padding:3px 6px; border-radius:6px;">M-Pesa</span>
                    <span style="background:rgba(239,68,68,0.15); color:#f87171; font-size:9px; font-weight:800; padding:3px 6px; border-radius:6px;">Airtel</span>
                    <span style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:9px; font-weight:800; padding:3px 6px; border-radius:6px;">Tigo</span>
                    <span style="background:rgba(16,185,129,0.15); color:#34d399; font-size:9px; font-weight:800; padding:3px 6px; border-radius:6px;">HaloPesa</span>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">Kiasi cha kulipa</label>
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 14px; color:#34d399; font-weight:900; font-size:15px;">
                    TSh 2,000
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">📱 Namba ya simu</label>
                <input type="tel" id="fimiPhone" placeholder="07XX XXX XXX" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:11px 14px; color:#fff; font-size:13px; outline:none;" />
            </div>

            <button id="fimiPayBtn" onclick="submitFimiPay()" style="width:100%; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border:none; border-radius:12px; padding:12px; font-weight:900; font-size:13px; cursor:pointer; box-shadow:0 10px 20px -5px rgba(37,99,235,0.4); transition:all 0.3s ease;">
                🔒 Lipa TSh 2,000 Sasa
            </button>

            <div id="fimiStatusMsg" style="margin-top:12px; font-size:11px; text-align:center; color:#cbd5e1; line-height:1.4; min-height:22px;"></div>
        </div>
    \`;
    modal.style.display = 'flex';
}

async function submitFimiPay() {
    const phoneInput = document.getElementById('fimiPhone');
    const payBtn = document.getElementById('fimiPayBtn');
    const statusMsg = document.getElementById('fimiStatusMsg');
    const phone = phoneInput.value.trim();
    const amount = "2000";

    // Uhakiki wa Namba ya Simu (Lazima ianze na 06 au 07 na kuwa na tarakimu 10)
    const phoneRegex = /^(06|07)\d{8}$/;
    if (!phone || !phoneRegex.test(phone.replace(/\s+/g, ''))) {
        statusMsg.style.color = '#ef4444';
        statusMsg.innerText = '❌ Namba si sahihi. Tumia muundo wa 07XX XXX XXX.';
        return;
    }

    // Kuzuia mwanachama kuanzisha malipo mara mbili (Kufunga kitufe kwa muda)
    payBtn.disabled = true;
    payBtn.style.opacity = '0.5';
    payBtn.style.cursor = 'not-allowed';

    // Hatua ya 1: Inaandaa malipo
    statusMsg.style.color = '#60a5fa';
    statusMsg.innerText = '⏳ Inaandaa malipo...';

    setTimeout(async () => {
        try {
            statusMsg.innerText = '📲 Thibitisha malipo kwenye simu yako.';
            
            const res = await fetch('/api/fimipay-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, amount })
            });
            const data = await res.json();

            if (data.success) {
                statusMsg.style.color = '#34d399';
                statusMsg.innerText = '✅ Malipo yamefanikiwa!';
            } else {
                statusMsg.style.color = '#facc15';
                statusMsg.innerText = '🟡 Malipo yanasubiri uthibitisho.';
            }
        } catch (err) {
            statusMsg.style.color = '#ef4444';
            statusMsg.innerText = '❌ Malipo yameshindwa — Jaribu tena.';
        } finally {
            // Rejesha kitufe baada ya sekunde chache
            setTimeout(() => {
                payBtn.disabled = false;
                payBtn.style.opacity = '1';
                payBtn.style.cursor = 'pointer';
            }, 5000);
        }
    }, 1500);
}

window.addEventListener('DOMContentLoaded', () => {
    const payBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('LIPA'));
    if (payBtn) {
        payBtn.onclick = function(e) {
            e.preventDefault();
            openFimiPayModal();
        };
    }
});
</script>
`;

if (html.includes('</body>')) {
    html = html.replace('</body>', proFimiPayModalScript + '\n</body>');
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("MAFANIKIO: FimiPay Pro Modal imewekwa kikamilifu kwenye dashboard.html!");
}
