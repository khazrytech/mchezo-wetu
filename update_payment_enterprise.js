const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const enterprisePaymentModal = `
<script>
function openFimiPayModal() {
    let modal = document.getElementById('fimiPayModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fimiPayModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.9); backdrop-filter:blur(18px); z-index:9999999; display:flex; align-items:center; justify-content:center; padding:15px;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = \`
        <div style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:26px; padding:22px; width:100%; max-width:410px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.85); font-family:inherit;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:32px; height:32px; background:linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:14px;">⚡</div>
                    <div>
                        <h3 style="font-size:15px; font-weight:900; color:#fff; margin:0;">Lipa Mchango Salama</h3>
                        <p style="font-size:10px; color:#94a3b8; margin:0;">Chagua mtandao na uweke namba</p>
                    </div>
                </div>
                <button onclick="document.getElementById('fimiPayModal').style.display='none'" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>

            <!-- Mitandao mikubwa yenye Nembo Halisi -->
            <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700;">CHAGUA MTANDAO WA SIMU</label>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:16px;" id="networkSelector">
                <div onclick="selectNetwork('mpesa', this)" class="net-card selected" style="background:rgba(234,179,8,0.1); border:2px solid #eab308; border-radius:12px; padding:8px 4px; text-align:center; cursor:pointer; transition:all 0.2s;">
                    <div style="font-size:11px; font-weight:900; color:#facc15;">M-Pesa</div>
                    <div style="font-size:8px; color:#94a3b8;">Vodacom</div>
                </div>
                <div onclick="selectNetwork('airtel', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:12px; padding:8px 4px; text-align:center; cursor:pointer; transition:all 0.2s;">
                    <div style="font-size:11px; font-weight:900; color:#f87171;">Airtel</div>
                    <div style="font-size:8px; color:#94a3b8;">Money</div>
                </div>
                <div onclick="selectNetwork('tigo', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:12px; padding:8px 4px; text-align:center; cursor:pointer; transition:all 0.2s;">
                    <div style="font-size:11px; font-weight:900; color:#60a5fa;">Tigo</div>
                    <div style="font-size:8px; color:#94a3b8;">Pesa</div>
                </div>
                <div onclick="selectNetwork('halopesa', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:12px; padding:8px 4px; text-align:center; cursor:pointer; transition:all 0.2s;">
                    <div style="font-size:11px; font-weight:900; color:#34d399;">Halo</div>
                    <div style="font-size:8px; color:#94a3b8;">Pesa</div>
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">Kiasi cha kulipa</label>
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 14px; color:#34d399; font-weight:900; font-size:16px; letter-spacing:0.5px;">
                    TSh 2,000
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:4px;">📱 Namba ya simu ya malipo</label>
                <input type="tel" id="fimiPhone" placeholder="07XX XXX XXX" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px 14px; color:#fff; font-size:14px; outline:none;" />
            </div>

            <button id="fimiPayBtn" onclick="submitEnterprisePayment()" style="width:100%; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:14px; padding:13px; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 10px 20px -5px rgba(16,185,129,0.4); transition:all 0.3s ease;">
                🔒 Lipa TSh 2,000 Sasa
            </button>

            <div id="fimiStatusMsg" style="margin-top:12px; font-size:11px; text-align:center; color:#cbd5e1; line-height:1.4; min-height:22px;"></div>
        </div>
    \`;
    modal.style.display = 'flex';
}

let selectedNetwork = 'mpesa';
function selectNetwork(net, el) {
    selectedNetwork = net;
    document.querySelectorAll('.net-card').forEach(c => {
        c.style.background = 'rgba(255,255,255,0.03)';
        c.style.borderColor = 'rgba(255,255,255,0.08)';
    });
    el.style.background = 'rgba(16,185,129,0.1)';
    el.style.borderColor = '#10b981';
}

async function submitEnterprisePayment() {
    const phoneInput = document.getElementById('fimiPhone');
    const payBtn = document.getElementById('fimiPayBtn');
    const statusMsg = document.getElementById('fimiStatusMsg');
    const phone = phoneInput.value.trim();

    // Uhakiki wa Namba ya Simu
    const phoneRegex = /^(06|07)\d{8}$/;
    if (!phone || !phoneRegex.test(phone.replace(/\s+/g, ''))) {
        statusMsg.style.color = '#ef4444';
        statusMsg.innerText = '❌ Namba si sahihi. Tumia muundo wa 07XX XXX XXX.';
        return;
    }

    // Kuzuia mwanachama kuanzisha malipo mara mbili (Anti-double payment lock)
    payBtn.disabled = true;
    payBtn.style.opacity = '0.5';
    payBtn.style.cursor = 'not-allowed';

    statusMsg.style.color = '#60a5fa';
    statusMsg.innerText = '⏳ Inaandaa malipo kupitia ' + selectedNetwork.toUpperCase() + '...';

    setTimeout(async () => {
        try {
            statusMsg.innerText = '📲 Thibitisha malipo kwenye simu yako (' + phone + ').';
            
            const res = await fetch('/api/fimipay-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, amount: "2000", network: selectedNetwork })
            });
            const data = await res.json();

            if (data.success) {
                statusMsg.style.color = '#34d399';
                statusMsg.innerText = '✅ Malipo yamefanikiwa!';
            } else {
                statusMsg.style.color = '#facc15';
                statusMsg.innerText = '🟡 Malipo yanasubiri uthibitisho kwenye simu yako.';
            }
        } catch (err) {
            statusMsg.style.color = '#ef4444';
            statusMsg.innerText = '❌ Malipo yameshindwa — Jaribu tena.';
        } finally {
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
    html = html.replace('</body>', enterprisePaymentModal + '\n</body>');
    fs.writeFileSync('dashboard.html', html, 'utf8');
    console.log("MAFANIKIO: Muonekano wa malipo umebadilishwa kuwa wa kitaalamu!");
}
