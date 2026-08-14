function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function homeParts(response) {
  var envelope = objectValue(response);
  var bootstrap = objectValue(envelope.bootstrap);
  var actor = objectValue(bootstrap.actor);
  var scope = objectValue(bootstrap.scope);
  var assurance = objectValue(actor.assurance);
  var accountsEnvelope = objectValue(envelope.accounts);
  return {
    actor: actor,
    scope: scope,
    assurance: assurance,
    accounts: Array.isArray(accountsEnvelope.items) ? accountsEnvelope.items : [],
  };
}

function accountCents(response, type) {
  var account = homeParts(response).accounts.find(function (item) {
    return item && item.type === type && Number.isFinite(Number(item.balanceCents));
  });
  return account ? Number(account.balanceCents) : null;
}

function maskEmployeeNo(value) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length <= 4) return '****';
  return text.slice(0, 2) + '****' + text.slice(-2);
}

function memberSummary(response) {
  var parts = homeParts(response);
  return {
    memberName: typeof parts.actor.displayName === 'string' ? parts.actor.displayName : '',
    employeeNo: typeof parts.actor.employeeNo === 'string' ? parts.actor.employeeNo : '',
    departmentName: typeof parts.actor.departmentName === 'string' ? parts.actor.departmentName : '',
    enterpriseName: typeof parts.scope.enterpriseName === 'string' ? parts.scope.enterpriseName : '',
    mallName: typeof parts.scope.mallName === 'string' ? parts.scope.mallName : '',
    phoneVerified: parts.assurance.phoneVerified === true,
    welfareCents: accountCents(response, 'welfare'),
    mealCents: accountCents(response, 'meal'),
  };
}

function memberCard(response) {
  var member = memberSummary(response);
  if (!member.memberName && !member.employeeNo) return null;
  return {
    memberName: member.memberName,
    enterpriseName: member.enterpriseName,
    level: member.phoneVerified ? '已认证会员' : '待认证',
    maskedNo: maskEmployeeNo(member.employeeNo),
    phoneVerified: member.phoneVerified,
    status: 'active',
  };
}

module.exports = {
  homeParts: homeParts,
  accountCents: accountCents,
  memberSummary: memberSummary,
  memberCard: memberCard,
};
