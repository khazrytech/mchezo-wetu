const fs = require('fs');
let html = fs.readFileSync('dashboard.html', 'utf8');

const markerStart = '<!-- START FIMIPAY MODAL -->';
const markerEnd = '<!-- END FIMIPAY MODAL -->';

const perfectModalContent = `
${markerStart}
<style>
@keyframes fadeInOverlay { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes bounceIcon { from { transform: translateY(0); } to { transform: translateY(-8px); } }
</style>
<script>
function openFimiPayModal() {
    let modal = document.getElementById('fimiPayModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fimiPayModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(2,6,23,0.92); backdrop-filter:blur(20px); z-index:9999999; display:flex; align-items:center; justify-content:center; padding:12px; overflow-y:auto;';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = \`
        <div style="background:rgba(15,23,42,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:28px; padding:20px; width:100%; max-width:420px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.9); font-family:inherit; max-height:92vh; overflow-y:auto; position:relative;">
            
            <!-- Animated Pro Status Overlay -->
            <div id="proStatusOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.98); backdrop-filter:blur(18px); z-index:200; border-radius:28px; flex-direction:column; align-items:center; justify-content:center; padding:30px; text-align:center; animation: fadeInOverlay 0.3s ease-out forwards;">
                <div id="overlayIcon" style="font-size:50px; margin-bottom:15px; animation: bounceIcon 0.6s infinite alternate;">⏳</div>
                <h3 id="overlayTitle" style="font-size:18px; font-weight:900; color:#fff; margin:0 0 8px 0;">Inaandaa malipo...</h3>
                <p id="overlayDesc" style="font-size:12px; color:#94a3b8; margin:0; line-height:1.5;">Tafadhali subiri kidogo wakati tunaunganisha na mtandao.</p>
                <div id="overlaySpinner" style="width:38px; height:38px; border:3px solid rgba(255,255,255,0.1); border-top:3px solid #10b981; border-radius:50%; animation: spin 1s linear infinite; margin-top:20px;"></div>
                <button id="overlayCloseBtn" onclick="resetPaymentModal()" style="display:none; margin-top:25px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:10px 24px; border-radius:12px; font-weight:800; font-size:13px; cursor:pointer;">Funga / Jaribu Tena</button>
            </div>

            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; background:linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:16px; box-shadow:0 0 15px rgba(59,130,246,0.5);">⚡</div>
                    <div>
                        <h3 style="font-size:16px; font-weight:900; color:#fff; margin:0;">Lipa Mchango Salama</h3>
                        <p style="font-size:11px; color:#94a3b8; margin:2px 0 0 0;">Chagua mtandao na uweke namba yako ya simu</p>
                    </div>
                </div>
                <button onclick="document.getElementById('fimiPayModal').style.display='none'" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>

            <!-- Kiasi Card -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                    <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">Kiasi cha kulipa</div>
                    <div style="font-size:18px; font-weight:900; color:#34d399;">TSh 2,000</div>
                </div>
                <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); padding:6px 10px; border-radius:10px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:12px;">🛡️</span>
                    <span style="font-size:10px; font-weight:700; color:#34d399;">Malipo salama<br><span style="font-size:8px; color:#94a3b8; font-weight:400;">kwa kupitia FimiPay</span></span>
                </div>
            </div>

            <!-- Chagua Mtandao -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:800; color:#fff; margin-bottom:4px;">Chagua Mtandao</div>
                <div style="font-size:10px; color:#94a3b8; margin-bottom:8px;">Tumia namba yako ya simu ya mtandao uliyopo</div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;" id="networkSelector">
                    <div onclick="selectNetwork('mpesa', 'M-Pesa (Vodacom)', this)" class="net-card selected" style="background:rgba(234,179,8,0.12); border:2px solid #eab308; border-radius:14px; padding:10px 4px; text-align:center; cursor:pointer;">
                        <div style="font-size:11px; font-weight:900; color:#facc15;">M-Pesa</div>
                        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Vodacom</div>
                    </div>
                    <div onclick="selectNetwork('airtel', 'Airtel Money', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 4px; text-align:center; cursor:pointer;">
                        <div style="font-size:11px; font-weight:900; color:#f87171;">Airtel</div>
                        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Money</div>
                    </div>
                    <div onclick="selectNetwork('tigo', 'Tigo Pesa', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 4px; text-align:center; cursor:pointer;">
                        <div style="font-size:11px; font-weight:900; color:#60a5fa;">Tigo</div>
                        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Pesa</div>
                    </div>
                    <div onclick="selectNetwork('halopesa', 'HaloPesa', this)" class="net-card" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 4px; text-align:center; cursor:pointer;">
                        <div style="font-size:11px; font-weight:900; color:#34d399;">Halo</div>
                        <div style="font-size:8px; color:#94a3b8; margin-top:2px;">Pesa</div>
                    </div>
                </div>
            </div>

            <!-- Namba ya Simu yenye +255 Box -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:800; color:#fff; margin-bottom:4px;">Namba ya simu ya malipo</div>
                <div style="font-size:10px; color:#94a3b8; margin-bottom:8px;">Weka namba yako ya simu (Mf. 07XXXXXXXX)</div>
                <div style="display:flex; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; overflow:hidden; align-items:center;">
                    <div style="padding:12px 14px; background:rgba(255,255,255,0.04); border-right:1px solid rgba(255,255,255,0.08); color:#cbd5e1; font-weight:700; font-size:13px; display:flex; align-items:center; gap:4px;">
                        +255 <span>▾</span>
                    </div>
                    <input type="tel" id="fimiPhone" oninput="validatePhone()" placeholder="0712 345 678" style="width:100%; background:transparent; border:none; padding:12px 14px; color:#fff; font-size:14px; outline:none; font-weight:600;" />
                    <div id="phoneCheckIcon" style="padding-right:14px; font-size:16px; display:none;">✅</div>
                </div>
                <div id="phoneStatusText" style="margin-top:6px; font-size:11px; color:#94a3b8;"></div>
            </div>

            <!-- Muhtasari wa Malipo -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:12px 14px; margin-bottom:16px;">
                <div style="font-size:11px; font-weight:800; color:#fff; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <span>📄</span> Muhtasari wa malipo
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                    <span style="color:#94a3b8;">Kiasi cha kulipa</span>
                    <span style="color:#34d399; font-weight:800;">TSh 2,000</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                    <span style="color:#94a3b8;">Mtandao</span>
                    <span id="summaryNetwork" style="color:#facc15; font-weight:700;">M-Pesa (Vodacom)</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                    <span style="color:#94a3b8;">Namba</span>
                    <span id="summaryPhone" style="color:#fff; font-weight:700;">-</span>
                </div>
            </div>

            <!-- Kitufe cha Kulipa -->
            <button id="fimiPayBtn" onclick="submitEnterprisePayment()" style="width:100%; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:14px; padding:14px; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 10px 25px -5px rgba(16,185,129,0.5); display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>🔒</span> Lipa TSh 2,000 Sasa <span>→</span>
            </button>

            <!-- Footer Logo -->
            <div style="margin-top:16px; text-align:center; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px; font-size:10px; color:#64748b;">
                🛡️ Malipo yako yanalindwa na FimiPay &nbsp;|&nbsp; <b style="color:#38bdf8;">FimiPay</b>
            </div>
        </div>
    \`;
    modal.style.display = 'flex';
}

let selectedNetworkCode = 'mpesa';
let selectedNetworkName = 'M-Pesa (Vodacom)';

function selectNetwork(code, name, el) {
    selectedNetworkCode = code;
    selectedNetworkName = name;
    document.querySelectorAll('.net-card').forEach(c => {
        c.style.background = 'rgba(255,255,255,0.03)';
        c.style.borderColor = 'rgba(255,255,255,0.08)';
    });
    el.style.background = 'rgba(234,179,8,0.12)';
    el.style.borderColor = '#eab308';
    document.getElementById('summaryNetwork').innerText = name;
}

function validatePhone() {
    const phoneInput = document.getElementById('fimiPhone');
    const statusText = document.getElementById('phoneStatusText');
    const checkIcon = document.getElementById('phoneCheckIcon');
    const summaryPhone = document.getElementById('summaryPhone');
    
    let val = phoneInput.value.replace(/\\D/g, '');
    summaryPhone.innerText = val ? '0' + val : '-';

    // Uhakiki sahihi unaokubali tarakimu 10 zinazoanza na 06 au 07 (pamoja na kama mtumiaji ameweka bila 0 au na 0)
    if (val.length === 9 && (val.startsWith('6') || val.startsWith('7'))) {
        val = '0' + val;
        phoneInput.value = val;
    }

    const phoneRegex = /^0(6|7)\d{8}$/;
    if (phoneRegex.test(val)) {
        statusText.style.color = '#34d399';
        statusText.innerText = '✅ Namba sahihi, endelea na malipo';
        checkIcon.style.display = 'block';
    } else if (val.length > 0) {
        statusText.style.color = '#f87171';
        statusText.innerText = '⚠️ Weka namba sahihi ya simu (07XXXXXXXX)';
        checkIcon.style.display = 'none';
    } else {
        statusText.innerText = '';
        checkIcon.style.display = 'none';
    }
}

function resetPaymentModal() {
    const overlay = document.getElementById('proStatusOverlay');
    if (overlay) overlay.style.display = 'none';
    const payBtn = document.getElementById('fimiPayBtn');
    if (payBtn) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
        payBtn.style.cursor = 'pointer';
    }
}

async function submitEnterprisePayment() {
    const phoneInput = document.getElementById('fimiPhone');
    const payBtn = document.getElementById('fimiPayBtn');
    let phone = phoneInput.value.trim().replace(/\\D/g, '');
    if (phone.length === 9) phone = '0' + phone;

    const phoneRegex = /^0(6|7)\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
        alert('Tafadhali ingiza namba sahihi ya simu kabla ya kulipa.');
        return;
    }

    payBtn.disabled = true;
    payBtn.style.opacity = '0.5';

    const overlay = document.getElementById('proStatusOverlay');
    const overlayIcon = document.getElementById('overlayIcon');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayDesc = document.getElementById('overlayDesc');
    const overlaySpinner = document.getElementById('overlaySpinner');
    const overlayCloseBtn = document.getElementById('overlayCloseBtn');

    overlay.style.display = 'flex';
    overlayIcon.innerText = '⏳';
    overlayTitle.innerText = 'Inaandaa malipo...';
    overlayDesc.innerText = 'Tafadhali subiri tunaanzisha muunganisho wa ' + selectedNetworkName + '.';
    overlaySpinner.style.display = 'block';
    overlayCloseBtn.style.display = 'none';

    setTimeout(async () => {
        try {
            overlayIcon.innerText = '📲';
            overlayTitle.innerText = 'Thibitisha malipo';
            overlayDesc.innerText = 'Tafadhali weka PIN ya simu yako (' + phone + ') kwenye prompt itakayotokea.';

            const res = await fetch('/api/fimipay-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, amount: '2000', network: selectedNetworkCode })
            });
            const data = await res.json();

            if (data.success) {
                overlayIcon.innerText = '✅';
                overlayTitle.innerText = 'Malipo yamefanikiwa!';
                overlayDesc.innerText = 'Asante! Mchango wako wa TSh 2,000 umepokelewa kikamilifu.';
                overlaySpinner.style.display = 'none';
                overlayCloseBtn.style.display = 'block';
                overlayCloseBtn.innerText = 'Funga Dirisha';
                overlayCloseBtn.onclick = function() {
                    document.getElementById('fimiPayModal').style.display = 'none';
                    location.reload();
                };
            } else {
                overlayIcon.innerText = '🟡';
                overlayTitle.innerText = 'Inasubiri Uthibitisho';
                overlayDesc.innerText = data.message || 'Ombi limetumwa. Tafadhali thibitisha kwenye simu yako.';
                overlaySpinner.style.display = 'none';
                overlayCloseBtn.style.display = 'block';
            }
        } catch (err) {
            overlayIcon.innerText = '❌';
            overlayTitle.innerText = 'Malipo yameshindwa';
            overlayDesc.innerText = 'Kulikuwa na tatizo la mawasiliano. Tafadhali jaribu tena.';
            overlaySpinner.style.display = 'none';
            overlayCloseBtn.style.display = 'block';
        }
    }, 2000);
}
</script>
${markerEnd}
`;

if (html.includes(markerStart) && html.includes(markerEnd)) {
    const startIndex = html.indexOf(markerStart);
    const endIndex = html.indexOf(markerEnd) + markerEnd.length;
    html = html.substring(0, startIndex) + perfectModalContent + html.substring(endIndex);
} else {
    if (html.includes('</body>')) {
        html = html.replace('</body>', perfectModalContent + '\n</body>');
    } else {
        html += perfectModalContent;
    }
}

fs.writeFileSync('dashboard.html', html, 'utf8');
console.log("MAFANIKIO: Muonekano kamili umewekwa na tatizo la namba limerekebishwa kikamilifu!");
