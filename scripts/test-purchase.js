// Test script for data purchase
// Usage: node scripts/test-purchase.js <planId> <phoneNumber>

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'cal.caleb43@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

async function testPurchase(planId, phoneNumber) {
  try {
    console.log('🔍 Testing data purchase...');
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`📦 Plan ID: ${planId}`);
    console.log(`🌐 Base URL: ${BASE_URL}\n`);

    // Step 1: Get session (sign in)
    console.log('1️⃣ Signing in...');
    const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        redirect: 'false',
        json: 'true'
      })
    });

    if (!signInRes.ok) {
      console.error('❌ Sign in failed. Please check credentials.');
      console.log('💡 Tip: Set TEST_EMAIL and TEST_PASSWORD environment variables');
      return;
    }

    // Get cookies from response
    const cookies = signInRes.headers.get('set-cookie');
    if (!cookies) {
      console.error('❌ No session cookie received. Please sign in via browser first.');
      console.log('💡 Tip: Open http://localhost:3000/auth/signin and sign in, then copy your session cookie');
      return;
    }

    // Extract session token (simplified - in real scenario, use proper cookie parsing)
    const sessionCookie = cookies.split(';')[0];

    // Step 2: Get available plans
    console.log('2️⃣ Fetching available data plans...');
    const plansRes = await fetch(`${BASE_URL}/api/data-plans`, {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (!plansRes.ok) {
      console.error('❌ Failed to fetch data plans');
      return;
    }

    const plansData = await plansRes.json();
    const plans = plansData.data || [];

    if (plans.length === 0) {
      console.error('❌ No data plans available');
      return;
    }

    console.log(`✅ Found ${plans.length} data plans:`);
    plans.slice(0, 5).forEach(plan => {
      console.log(`   - ${plan.name} (${plan.network}): ${plan.dataAmount}MB - ₵${plan.effectivePrice || plan.price} [ID: ${plan.id}]`);
    });

    // Use provided planId or first available plan
    const selectedPlan = planId 
      ? plans.find(p => p.id === planId) 
      : plans[0];

    if (!selectedPlan) {
      console.error(`❌ Plan with ID ${planId} not found`);
      return;
    }

    console.log(`\n📦 Selected Plan: ${selectedPlan.name} (${selectedPlan.network})`);
    console.log(`   Data: ${selectedPlan.dataAmount}MB`);
    console.log(`   Price: ₵${selectedPlan.effectivePrice || selectedPlan.price}`);

    // Step 3: Check wallet balance
    console.log('\n3️⃣ Checking wallet balance...');
    const summaryRes = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: {
        'Cookie': sessionCookie
      }
    });

    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const balance = summary.data?.walletBalance || 0;
      const price = Number(selectedPlan.effectivePrice || selectedPlan.price);
      console.log(`💰 Wallet Balance: ₵${balance}`);
      
      if (balance < price) {
        console.error(`❌ Insufficient balance. Need ₵${price}, have ₵${balance}`);
        console.log('💡 Tip: Top up your wallet first via /dashboard/wallet');
        return;
      }
    }

    // Step 4: Make purchase
    console.log('\n4️⃣ Making purchase...');
    const purchaseRes = await fetch(`${BASE_URL}/api/orders/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        planId: selectedPlan.id,
        phoneNumber: phoneNumber
      })
    });

    const purchaseData = await purchaseRes.json();
    
    if (purchaseRes.ok && purchaseData.success) {
      console.log('✅ Purchase successful!');
      console.log(`📋 Reference: ${purchaseData.reference}`);
      console.log(`\n📊 Check order status at: ${BASE_URL}/dashboard/orders`);
    } else {
      console.error('❌ Purchase failed:');
      console.error(`   Error: ${purchaseData.error || 'Unknown error'}`);
      console.error(`   Status: ${purchaseRes.status}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Get command line arguments
const planId = process.argv[2];
const phoneNumber = process.argv[3] || '0240894485';

if (!phoneNumber) {
  console.error('Usage: node scripts/test-purchase.js [planId] [phoneNumber]');
  console.error('Example: node scripts/test-purchase.js "" 0240894485');
  process.exit(1);
}

testPurchase(planId, phoneNumber);

