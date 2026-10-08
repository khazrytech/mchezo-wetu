const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

let groups = [
  { id: "grp-101", name: "Mchezo Wetu", contributionAmount: 20000, cycle: "Monthly" }
];

let members = [
  { id: 1, groupId: "grp-101", name: "Juma Hamisi Ally", phone: "0712345678", role: "Treasurer" },
  { id: 2, groupId: "grp-101", name: "Asha Saidi Mtitu", phone: "0754987654", role: "Member" },
  { id: 3, groupId: "grp-101", name: "Hassan Bakari Juma", phone: "0789112233", role: "Member" }
];

let transactions = [
  { id: "TXN-001", groupId: "grp-101", memberName: "Juma Hamisi Ally", amount: 20000, status: "SUCCESS", date: "2026-10-01" },
  { id: "TXN-002", groupId: "grp-101", memberName: "Asha Saidi Mtitu", amount: 20000, status: "SUCCESS", date: "2026-10-02" }
];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/dashboard/:groupId', (req, res) => {
  const groupId = req.params.groupId;
  const group = groups.find(g => g.id === groupId);

  if (!group) return res.status(404).json({ error: "Kikundi hakikupatikana" });

  const groupMembers = members.filter(m => m.groupId === groupId);
  const groupTxns = transactions.filter(t => t.groupId === groupId && t.status === "SUCCESS");

  const totalCollected = groupTxns.reduce((sum, t) => sum + t.amount, 0);

  const memberStatusList = groupMembers.map(member => {
    const paidTxn = groupTxns.find(t => t.memberName === member.name);
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      amountPaid: paidTxn ? paidTxn.amount : 0,
      hasPaid: !!paidTxn
    };
  });

  res.json({
    groupName: group.name,
    targetContribution: group.contributionAmount,
    totalCollected,
    members: memberStatusList
  });
});

app.post('/api/pay-stk', (req, res) => {
  const { groupId, memberName, phone, amount } = req.body;

  if (!phone || !amount || !memberName) {
    return res.status(400).json({ error: "Tafadhali jaza taarifa zote sahihi." });
  }

  const newTxn = {
    id: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    groupId: groupId,
    memberName: memberName,
    amount: parseFloat(amount),
    status: "SUCCESS",
    date: new Date().toISOString().split('T')[0]
  };

  transactions = transactions.filter(t => !(t.groupId === groupId && t.memberName === memberName));
  transactions.push(newTxn);

  res.json({
    message: "STK Push imethibitishwa! Mfumo umeweka tiki ya kijani kiotomatiki kwenye Mchezo Wetu.",
    transaction: newTxn
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mchezo Wetu una-run kwenye port ${PORT}`);
});
