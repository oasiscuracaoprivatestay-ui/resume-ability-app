// Scratch test for Phase 14 logic, storage isolation, and score non-mutation

// Mock localStorage for Node
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

// Mock window and navigator
(global as any).window = {
  matchMedia: (q: string) => ({ matches: false }),
  addEventListener: () => {},
  removeEventListener: () => {},
  atob: (s: string) => Buffer.from(s, 'base64').toString('binary')
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      serviceWorker: undefined
    },
    writable: true,
    configurable: true
  });
} catch (e) {
  // if already defined
}

async function runTests() {
  console.log('=== PHASE 14 AUTOMATED LOGIC TESTS ===\n');

  // 1. Test pushSubscriptionStorage
  const { loadPushSubscriptionState, savePushSubscriptionState, clearPushSubscriptionState } = await import('../src/utils/pushSubscriptionStorage');
  
  console.log('Test 1: Push Subscription Storage defaults');
  const initial = loadPushSubscriptionState();
  if (initial.isPushEnabled === false && initial.endpoint === null) {
    console.log('  ✓ Initial state is unsubscribed with null endpoint');
  } else {
    throw new Error('Initial state incorrect: ' + JSON.stringify(initial));
  }

  console.log('Test 2: Saving push subscription state');
  savePushSubscriptionState({
    version: 1,
    isPushEnabled: true,
    endpoint: 'https://push.example.com/sub/12345',
    p256dh: 'BNcR...',
    auth: 'tBH...',
    syncedToServer: true,
    lastSyncedAt: Date.now(),
    lastError: null
  });
  const saved = loadPushSubscriptionState();
  if (saved.isPushEnabled && saved.endpoint === 'https://push.example.com/sub/12345') {
    console.log('  ✓ Saved state matches expected values');
  } else {
    throw new Error('Saved state incorrect: ' + JSON.stringify(saved));
  }

  console.log('Test 3: Clearing push subscription state');
  clearPushSubscriptionState();
  const cleared = loadPushSubscriptionState();
  if (!cleared.isPushEnabled && cleared.endpoint === null) {
    console.log('  ✓ Cleared state correctly resets fields');
  } else {
    throw new Error('Cleared state incorrect');
  }

  // 4. Test urlBase64ToUint8Array
  console.log('Test 4: Base64 VAPID Key to Uint8Array Conversion');
  const { urlBase64ToUint8Array } = await import('../src/utils/pushNotifications');
  // standard base64url string
  const sampleKey = 'BCTh7i4oB7qI1Y47qj5z8mJ7sL0g';
  const uint8 = urlBase64ToUint8Array(sampleKey);
  if (uint8 instanceof Uint8Array && uint8.length > 0) {
    console.log('  ✓ Successfully converted base64url to Uint8Array (' + uint8.length + ' bytes)');
  } else {
    throw new Error('urlBase64ToUint8Array conversion failed');
  }

  // 5. Test PWA Standalone Detection
  console.log('Test 5: PWA Standalone Detection');
  const { isStandaloneMode, isIOS } = await import('../src/utils/pwaSupport');
  if (isStandaloneMode() === false && isIOS() === false) {
    console.log('  ✓ Correctly returns false for desktop browser mock');
  } else {
    throw new Error('pwaSupport returned true unexpectedly');
  }

  // 6. Test Score isolation - Push subscription & reminder triggers must NEVER mutate score
  console.log('Test 6: Strict Score Isolation (0 points for reminders/push)');
  const { calculateDailyResumeAbilityScore } = await import('../src/utils/dailyScore');
  const emptyInputs = {
    checkIns: [],
    slips: [],
    recommits: [],
    inControlEvents: [],
    commitEvents: [],
    reviewEvents: [],
    dietVerifications: []
  };
  const scoreBefore = calculateDailyResumeAbilityScore(emptyInputs);
  // Simulate push subscription and reminders stored in localStorage
  savePushSubscriptionState({
    version: 1,
    isPushEnabled: true,
    endpoint: 'https://push.example.com/sub/999',
    p256dh: 'test',
    auth: 'test',
    syncedToServer: true,
    lastSyncedAt: Date.now(),
    lastError: null
  });
  store['sda_reminder_settings_v1'] = JSON.stringify({
    enabled: true,
    checkInReminders: true,
    dietReminders: true,
    whyReminders: true,
    slipperyZoneReminders: true
  });
  const scoreAfter = calculateDailyResumeAbilityScore(emptyInputs);
  if (scoreBefore.score === 0 && scoreAfter.score === 0 && scoreBefore.rawPoints === 0 && scoreAfter.rawPoints === 0) {
    console.log('  ✓ Daily Resume-Ability score is strictly 0 - push & reminders have 0 score points');
  } else {
    throw new Error('Score was affected! Expected 0, got: ' + scoreAfter.score);
  }

  // 7. Verify Reset All Stats preservation
  console.log('Test 7: Reset All Stats does NOT wipe push or reminder settings');
  const { resetAllStats } = await import('../src/utils/resetStats');
  resetAllStats();
  const pushPreserved = loadPushSubscriptionState();
  const reminderPreserved = store['sda_reminder_settings_v1'];
  if (pushPreserved.isPushEnabled === true && reminderPreserved !== undefined) {
    console.log('  ✓ Push subscription and reminder settings are preserved across Reset All Stats');
  } else {
    throw new Error('Push or reminder settings were cleared by stats reset!');
  }

  console.log('\nALL 7 TESTS PASSED SUCCESSFULLY! ✓\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
