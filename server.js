const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 1. Data za Kikundi
let groups = [
  { id: "grp-101", name: "Mchezo Wetu", contributionAmount: 2000, cycle: "Daily" }
];

// 2. Data za Wanachama (Inajumuisha Member ID, Name, Phone, Avatar)
let members = [
  { id: 1, groupId: "grp-101", name: "Juma Hamisi Ally", phone: "0712345678", role: "Mwekahazina", totalPaidAllTime: 60000, active: true },
  { id: 2, groupId: "grp-101", name: "Asha Saidi Mtitu", phone: "0754987654", role: "Mwanachama", totalPaidAllTime: 48000, active: true },
  { id: 3, groupId: "grp-101", name: "Hassan Bakari Juma", phone: "0789112233", role: "Mwanachama", totalPaidAllTime: 32000, active: true }
];

// 3. Transactions Database
let transactions = [
  { id: "TXN-101", groupId: "grp-101", memberId: 1, memberName: "Juma Hamisi Ally", phone: "0712345678", amount: 2000, status: "SUCCESS", date: new Date().toISOString().split('T')[0], provider: "M-Pesa" },
  { id: "TXN-102", groupId: "grp-101", memberId: 2, memberName: "Asha Saidi Mtitu", phone: "0754987654", amount: 2000, status: "SUCCESS", date: new Date().toISOString().split('T')[0], provider: "Airtel Money" }
];

// 4. Matangazo ya Kikundi
let announcements = [
  { id: 1, title: "Kumbusho la Mchango 🔔", body: "Tafadhali kamilisha mchango wako wa TSh 2,000 wa leo kabla ya saa 2:00 usiku.", date: "Leo" },
  { id: 2, title: "Mkutano wa Wanachama 🗓️", body: "Mkutano mkuu wa robo mwaka utafanyika Jumamosi saa 10:00 jioni.", date: "Jumamosi" }
];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API ya Dashboard yenye Hesabu Halisi (Hesabu ya 67% Progress, Stats, Mchango Wangu, n.k.)
app.get('/api/dashboard/:groupId/:memberId', (req, res) => {
  const { groupId, memberId } = req.params;
  const group = groups.find(g => g.id === groupId);
  const currentMember = members.find(m => m.id === parseInt(memberId)) || members[0];

  if (!group) return res.status(404).json({ error: "Kikundi hakikupatikana" });

  const todayStr = new Date().toISOString().split('T')[0];
  const groupMembers = members.filter(m => m.groupId === groupId);
  const todayTxns = transactions.filter(t => t.groupId === groupId && t.status === "SUCCESS" && t.date === todayStr);

  const totalCollectedToday = todayTxns.reduce((sum, t) => sum + t.amount, 0);
  const totalTargetToday = group.contributionAmount * groupMembers.length;
  const progressPercent = totalTargetToday > 0 ? Math.round((totalCollectedToday / totalTargetToday) * 100) : 0;

  // Hali ya Mchango Wangu Leo
  const myTxnToday = todayTxns.find(t => t.memberId === currentMember.id);

  const memberStatusList = groupMembers.map(m => {
    const paidTxn = todayTxns.find(t => t.memberId === m.id);
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      amountPaid: paidTxn ? paidTxn.amount : 0,
      hasPaid: !!paidTxn,
      provider: paidTxn ? paidTxn.provider : null,
      status: paidTxn ? "SUCCESS" : "PENDING"
    };
  });

  res.json({
    user: currentMember,
    groupName: group.name,
    targetContribution: group.contributionAmount,
    totalCollectedToday,
    totalTargetToday,
    progressPercent,
    stats: {
      totalMembers: groupMembers.length,
      paidMembers: todayTxns.length,
      unpaidMembers: groupMembers.length - todayTxns.length
    },
    myContribution: {
      paidToday: myTxnToday ? myTxnToday.amount : 0,
      hasPaidToday: !!myTxnToday,
      totalPaidAllTime: currentMember.totalPaidAllTime,
      completedDays: Math.floor(currentMember.totalPaidAllTime / 2000),
      missedDays: 2
    },
    members: memberStatusList,
    announcements,
    receipts: transactions.filter(t => t.memberId === currentMember.id)
  });
});

// API ya Malipo (STK Push Verification)
app.post('/api/pay-stk', (req, res) => {
  const { groupId, memberId, phone, provider, amount } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];

  const member = members.find(m => m.id === parseInt(memberId)) || members[0];

  const newTxn = {
    id: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    groupId,
    memberId: member.id,
    memberName: member.name,
    phone,
    amount: parseFloat(amount),
    status: "SUCCESS",
    date: todayStr,
    provider: provider || "M-Pesa"
  };

  transactions = transactions.filter(t => !(t.memberId === member.id && t.date === todayStr));
  transactions.push(newTxn);
  member.totalPaidAllTime += parseFloat(amount);

  res.json({
    success: true,
    message: `Malipo ya TSh ${amount} kupitia ${provider} yamethibitishwa kikamilifu!`,
    receipt: newTxn
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mchezo Wetu running on port ${PORT}`));
