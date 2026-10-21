const { summarize } = require('./controllers/subscriptionController');

function testSubscriptionSummarization() {
  console.log('Testing subscription summarization and serialization...');

  const now = new Date();
  const mockSub = {
    _id: '673f4e19bcf86cd799439011',
    user: '507f1f77bcf86cd799439022',
    plan: {
      _id: '673f4e19bcf86cd799439099',
      name: 'Gold Membership',
      description: 'Access to verified premium maids',
      price: 999,
      durationDays: 30,
      features: ['Priority support', 'Unlimited maid contacts'],
      isActive: true,
    },
    planName: 'Gold Membership',
    price: 999,
    originalPrice: 1499,
    durationDays: 30,
    startsAt: new Date(now.getTime() - 2 * 86400000), // started 2 days ago
    expiresAt: new Date(now.getTime() + 28 * 86400000), // expires in 28 days
    createdAt: new Date(now.getTime() - 2 * 86400000),
    updatedAt: new Date(now.getTime() - 2 * 86400000),
  };

  const summary = summarize([mockSub], now);
  console.log('Summary output:');
  console.log('- current planName:', summary.current?.planName);
  console.log('- current name:', summary.current?.name);
  console.log('- current status:', summary.current?.status);
  console.log('- current daysLeft:', summary.current?.daysLeft);
  console.log('- current plan features:', summary.current?.plan?.features);
  console.log('- activePlan exists:', Boolean(summary.activePlan));

  if (
    summary.current?.planName === 'Gold Membership' &&
    summary.current?.name === 'Gold Membership' &&
    summary.current?.status === 'active' &&
    summary.current?.daysLeft === 28 &&
    Array.isArray(summary.current?.plan?.features) &&
    summary.activePlan !== null
  ) {
    console.log('✅ Active subscription test PASSED!');
  } else {
    console.error('❌ Active subscription test FAILED!');
    process.exit(1);
  }

  // Test expired subscription fallback
  const mockExpiredSub = {
    _id: '673f4e19bcf86cd799439012',
    user: '507f1f77bcf86cd799439022',
    planName: 'Silver Plan',
    price: 499,
    durationDays: 30,
    startsAt: new Date(now.getTime() - 60 * 86400000),
    expiresAt: new Date(now.getTime() - 30 * 86400000),
    createdAt: new Date(now.getTime() - 60 * 86400000),
  };

  const expiredSummary = summarize([mockExpiredSub], now);
  console.log('\nExpired summary output:');
  console.log('- current planName:', expiredSummary.current?.planName);
  console.log('- current status:', expiredSummary.current?.status);
  console.log('- activePlan is null:', expiredSummary.activePlan === null);
  console.log('- latestPlan exists:', Boolean(expiredSummary.latestPlan));

  if (
    expiredSummary.current?.planName === 'Silver Plan' &&
    expiredSummary.current?.status === 'expired' &&
    expiredSummary.activePlan === null &&
    expiredSummary.latestPlan?.planName === 'Silver Plan'
  ) {
    console.log('✅ Expired subscription fallback test PASSED!');
  } else {
    console.error('❌ Expired subscription fallback test FAILED!');
    process.exit(1);
  }
}

testSubscriptionSummarization();
