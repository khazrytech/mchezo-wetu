const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const fimiPayModalScript = `
<script>
function openFimiPayModal() {
    let modal = document.getElementById('fimiPayModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fimiPayModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.88); backdrop-filter:blur(16px); z-index:9999999; display:flex; align-items:center; justify-content:center; padding:20px;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = \`
        <div style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:28px; padding:24px; width:100%; max-width:400px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <h3 style="font-size:16px; font-weight:900; color:#fff; margin:0;">⚡ Lipa kupitia FimiPay</h3>
                <button onclick="document.getElementById('fimiPayModal').style.display='none'" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:6px;">Namba ya Simu (M-Pesa / Tigo / Airtel)</label>
                <input type="tel" id="fimiPhone" placeholder="07xxxxxxxx" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px; color:#fff; font-size:14px; outline:none;" />
            </div>
            <div style="margin-bottom:18px;">
                <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:6px;">Kiasi cha Mchango (TSh)</label>
                <input type="text" id="fimiAmount" value="2000" readonly style="width:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px; color:#34d399; font-weight:800; font-size:14px;" />
            </div>
            <button onclick="submitFimiPay()" style="width:100%; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border:none; border-radius:14px; padding:14px; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 10px 20px -5px rgba(37,99,235,0.4);">Lipa Sasa kupitia FimiPay</button>
            <div id="fimiStatusMsg" style="margin-top:12px; font-size:12px; text-align:center; color:#cbd5e1;"></div>
        </div>
    \`;
    modal.style.display = 'flex';
}

async function submitFimiPay() {
    const phone = document.getElementById('fimiPhone').value;
    const amount = document.getElementById('fimiAmount').value;
    const statusMsg = document.getElementById('fimiStatusMsg');

    if (!phone || phone.length < 10) {
        statusMsg.style.color = '#ef4444';
        statusMsg.innerText = 'Tafadhali ingiza namba sahihi ya simu.';
        return;
    }

    statusMsg.style.color = '#60a5fa';
    statusMsg.innerText = 'Inawasiliana na FimiPay Gateway...';

    try {
        const res = await fetch('/api/fimipay-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, amount })
        });
        const data = await res.json();
        if (data.success) {
            statusMsg.style.color = '#34d399';
            statusMsg.innerText = data.message;
        } else {
            statusMsg.style.color = '#ef4444';
            statusMsg.innerText = data.message || 'Imeshindikana kufanya malipo.';
        }
    } catch (err) {
        statusMsg.style.color = '#ef4444';
        statusMsg.innerText = 'Hitilafu ya mtandao na FimiPay.';
    }
}

// Unganisha na kitufe cha kulipa kwenye dashboard
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
    html = html.replace('</body>', fimiPayModalScript + '\n</body>');
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("MAFANIKIO: dashboard.html imesasishwa na FimiPay modal!");
}
