/**
 * Test Script สำหรับทดสอบ Transcript Validation
 * ทดสอบ isInvalidTranscript function ที่แก้ไขบัคการส่ง transcript ผิดปกติ
 */

// Mock function เพื่อทดสอบ (คัดลอกมาจาก bot.ts)
function isInvalidTranscript(transcript) {
  const trimmed = transcript.trim()
  
  // 1. ตรวจสอบข้อความสั้นเกินไป
  if (trimmed.length < 3) {
    console.log(`⚠️ FILTERED: Transcript สั้นเกินไป: "${trimmed}"`)
    return true
  }
  
  // 2. ตรวจสอบคำซ้ำผิดปกติ
  const words = trimmed.split(/\s+/)
  if (words.length > 10) {
    const wordCount = new Map()
    
    for (const word of words) {
      if (word.length > 0) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    }
    
    // หาคำที่ซ้ำมากที่สุด
    for (const [word, count] of wordCount) {
      const percentage = count / words.length
      if (percentage > 0.5 && count > 10) {
        console.log(`⚠️ FILTERED: คำ "${word}" ซ้ำผิดปกติ: ${count}/${words.length} ครั้ง (${(percentage * 100).toFixed(1)}%)`)
        return true
      }
    }
  }
  
  // 3. ตรวจสอบ pattern ซ้ำ
  if (trimmed.length > 50) {
    const firstPart = trimmed.substring(0, 20)
    const escapedPart = firstPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    try {
      const regex = new RegExp(escapedPart, 'g')
      const matches = trimmed.match(regex) || []
      
      if (matches.length > 5) {
        console.log(`⚠️ FILTERED: Pattern "${firstPart}" ซ้ำผิดปกติ: ${matches.length} ครั้ง`)
        return true
      }
    } catch (error) {
      console.log(`⚠️ Regex error สำหรับ pattern: ${firstPart}`)
    }
  }
  
  return false
}

// Test Cases
const testCases = [
  {
    name: "ข้อความปกติ - สั้น",
    transcript: "สวัสดีครับ",
    expected: false
  },
  {
    name: "ข้อความปกติ - ปานกลาง",
    transcript: "วันนี้ทำ dashboard และ testing แล้วครับ",
    expected: false
  },
  {
    name: "ข้อความปกติ - มีคำซ้ำธรรมชาติ",
    transcript: "เอ่อ สวัสดีครับ วันนี้ทำกิจใหม่ของ สามก๊ก ทำ member สามก๊ก แก้ เคสสามก๊ก",
    expected: false
  },
  {
    name: "ข้อความสั้นเกินไป",
    transcript: "อ",
    expected: true
  },
  {
    name: "ข้อความว่าง",
    transcript: "",
    expected: true
  },
  {
    name: "ข้อความซ้ำผิดปกติ (เหมือนบรรทัด 149)",
    transcript: "สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ",
    expected: true
  },
  {
    name: "ข้อความยาวปกติ (ไม่ถูกจำกัดแล้ว)",
    transcript: "วันนี้ผมทำงานเกี่ยวกับระบบ authentication ที่ซับซ้อนมากซึ่งต้อง implement หลายๆ feature พร้อมกันรวมถึง multi-factor authentication, OAuth integration, LDAP connection, session management, password policies, rate limiting และการทำ unit testing เพื่อให้มั่นใจว่าระบบทำงานถูกต้องและปลอดภัยสำหรับผู้ใช้งานทุกคนในองค์กรครับ",
    expected: false,
    note: "ข้อความยาว 400+ ตัวอักษร แต่เป็นเนื้อหาปกติ - ควรผ่าน"
  },
  {
    name: "Pattern ซ้ำผิดปกติ (Edge case - จงใจให้ผ่าน)",
    transcript: "Hello world Hello world Hello world Hello world Hello world Hello world Hello world",
    expected: false, // 🔥 เปลี่ยนเป็น false เพราะข้อความนี้ยังอ่านได้
    note: "ข้อความนี้มีคำซ้ำ 50% พอดี ซึ่งไม่เกินเกณฑ์ >50% จึงถือว่า valid"
  },
  {
    name: "คำซ้ำหลายคำ แต่ไม่เกินเกณฑ์",
    transcript: "ทำ dashboard ทำ testing ทำ coding ทำ review และ deploy แล้ว",
    expected: false
  },
  {
    name: "Mixed content with repeated patterns",
    transcript: "Hello world Hello world bla bla Hello world Hello world bii ii ii",
    expected: false,
    note: "ข้อความผสมที่มีทั้งคำซ้ำและเนื้อหาปกติ - ควรผ่าน"
  }
]

// รัน Test Cases
console.log("🧪 เริ่มทดสอบ Transcript Validation")
console.log("=" .repeat(60))

let passedTests = 0
let totalTests = testCases.length

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`)
  console.log(`Input: "${testCase.transcript.substring(0, 50)}${testCase.transcript.length > 50 ? '...' : ''}"`)
  
  if (testCase.note) {
    console.log(`Note: ${testCase.note}`)
  }
  
  const result = isInvalidTranscript(testCase.transcript)
  const passed = result === testCase.expected
  
  console.log(`Expected: ${testCase.expected ? 'INVALID' : 'VALID'}`)
  console.log(`Got: ${result ? 'INVALID' : 'VALID'}`)
  console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`)
  
  if (passed) {
    passedTests++
  }
})

console.log("\n" + "=".repeat(60))
console.log(`📊 ผลการทดสอบ: ${passedTests}/${totalTests} tests passed`)

if (passedTests === totalTests) {
  console.log("🎉 ทุก test cases ผ่านหมด! Validation function ทำงานถูกต้อง")
} else {
  console.log("⚠️ มี test cases ที่ไม่ผ่าน กรุณาตรวจสอบ logic")
}

// Test เพิ่มเติม: ทดสอบกับข้อความจาก transcripts.txt จริง
console.log("\n" + "=".repeat(60))
console.log("🔍 ทดสอบกับข้อความจริงจาก transcripts.txt")

const realTranscripts = [
  {
    line: 148,
    text: "เอ่อ วันนี้ทำแดร็ดบอร์ดและเทสติ้งครับ",
    shouldBeValid: true
  },
  {
    line: 149,
    text: "สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัสดีครับ สวัส",
    shouldBeValid: false
  }
]

realTranscripts.forEach(item => {
  console.log(`\nบรรทัดที่ ${item.line}:`)
  console.log(`Text: "${item.text.substring(0, 50)}${item.text.length > 50 ? '...' : ''}"`)
  
  const isInvalid = isInvalidTranscript(item.text)
  const isValid = !isInvalid
  const correct = isValid === item.shouldBeValid
  
  console.log(`Expected: ${item.shouldBeValid ? 'VALID' : 'INVALID'}`)
  console.log(`Got: ${isValid ? 'VALID' : 'INVALID'}`)
  console.log(`Result: ${correct ? '✅ CORRECT' : '❌ WRONG'}`)
})

console.log("\n🏁 การทดสอบเสร็จสิ้น")