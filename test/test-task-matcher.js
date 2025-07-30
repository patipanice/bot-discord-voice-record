// ทดสอบ Task Matching Algorithm
const { matchTasksWithSpeech, extractKeywordsFromSpeech } = require('../dist/task-matcher.js');

// Sample tasks จาก ClickUp ที่เราสร้างไว้
const SAMPLE_TASKS = [
  {
    id: '86b5y86vn',
    name: 'User Authentication System',
    description: 'Implement complete user authentication with login, register, and logout functionality',
    url: 'https://app.clickup.com/t/86b5y86vn'
  },
  {
    id: '86b5y86y2',
    name: 'Login Feature Implementation',
    description: 'Create login form and authentication logic for user access',
    url: 'https://app.clickup.com/t/86b5y86y2'
  },
  {
    id: '86b5y8707',
    name: 'Database Integration',
    description: 'Setup database connection and create user models and queries',
    url: 'https://app.clickup.com/t/86b5y8707'
  },
  {
    id: '86b5y8729',
    name: 'API Endpoint Development',
    description: 'Build REST API endpoints for user management and data access',
    url: 'https://app.clickup.com/t/86b5y8729'
  },
  {
    id: '86b5y873z',
    name: 'Frontend Dashboard',
    description: 'Create user dashboard with profile management and settings',
    url: 'https://app.clickup.com/t/86b5y873z'
  }
];

// Test cases จำลองการพูดใน Daily Standup
const TEST_SPEECHES = [
  "วันนี้ทำ user auth ครับ",
  "login feature เสร็จแล้ว",
  "เมื่อวานทำ database เสร็จ",
  "กำลังทำ api endpoint อยู่",
  "dashboard ทำเสร็จแล้วครับ",
  "วันนี้จะทำ authentication system",
  "มีปัญหากับ database connection",
  "unit test เสร็จแล้ว",
  "จะ deploy api วันนี้"
];

function testTaskMatching() {
  console.log('🧪 ทดสอบ Task Matching Algorithm\n');
  
  TEST_SPEECHES.forEach((speech, index) => {
    console.log(`\n📋 Test Case ${index + 1}: "${speech}"`);
    console.log('=' .repeat(50));
    
    // Extract keywords
    const keywords = extractKeywordsFromSpeech(speech);
    console.log(`🔍 Keywords ที่พบ: [${keywords.join(', ')}]`);
    
    // Match with tasks
    const result = matchTasksWithSpeech(speech, SAMPLE_TASKS);
    console.log(`🌐 ภาษา: ${result.language}`);
    console.log(`📝 Keywords สกัด: [${result.extractedKeywords.join(', ')}]`);
    
    if (result.matches.length > 0) {
      console.log(`\n🎯 Top Matches:`);
      result.matches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.taskName}`);
        console.log(`      Score: ${(match.matchScore * 100).toFixed(1)}% (${match.confidence})`);
        console.log(`      Keywords: [${match.matchedKeywords.join(', ')}]`);
        console.log(`      URL: ${match.taskUrl}`);
      });
    } else {
      console.log('❌ ไม่พบ Task ที่ตรงกัน');
    }
  });
  
  // Summary
  console.log('\n📊 สรุปผลการทดสอบ:');
  console.log('=' .repeat(50));
  
  let totalMatches = 0;
  let highConfidenceMatches = 0;
  
  TEST_SPEECHES.forEach(speech => {
    const result = matchTasksWithSpeech(speech, SAMPLE_TASKS);
    if (result.matches.length > 0) {
      totalMatches++;
      if (result.matches[0].confidence === 'high') {
        highConfidenceMatches++;
      }
    }
  });
  
  console.log(`✅ Total test cases: ${TEST_SPEECHES.length}`);
  console.log(`🎯 Cases with matches: ${totalMatches}/${TEST_SPEECHES.length} (${(totalMatches/TEST_SPEECHES.length*100).toFixed(1)}%)`);
  console.log(`🔥 High confidence matches: ${highConfidenceMatches}/${totalMatches} (${totalMatches > 0 ? (highConfidenceMatches/totalMatches*100).toFixed(1) : 0}%)`);
  
  console.log('\n🚀 Task Matching Algorithm พร้อมใช้งาน!');
}

// เรียกใช้ฟังก์ชันทดสอบ
if (require.main === module) {
  testTaskMatching();
}

module.exports = { testTaskMatching, SAMPLE_TASKS, TEST_SPEECHES };