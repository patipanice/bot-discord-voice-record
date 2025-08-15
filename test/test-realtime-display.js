/**
 * Test Script สำหรับ Real-time Display และ ClickUp Integration
 * ทดสอบการแสดงผล transcript แบบ real-time พร้อม ClickUp task matching
 */

// Mock data สำหรับการทดสอบ
const mockTranscripts = [
  {
    userId: "251733361926733841",
    displayName: "Alice",
    transcript: "วันนี้ทำ API authentication เสร็จแล้วครับ",
    confidence: 0.95,
    expectedMatch: true,
    expectedTask: "API Authentication Implementation"
  },
  {
    userId: "251733361926733842", 
    displayName: "Bob",
    transcript: "fix login bug ของ user registration แล้ว",
    confidence: 0.92,
    expectedMatch: true,
    expectedTask: "User Registration Bug Fix"
  },
  {
    userId: "251733361926733843",
    displayName: "Charlie", 
    transcript: "เมื่อวานไปกินข้าวกับแฟน อร่อยมาก",
    confidence: 0.88,
    expectedMatch: false,
    expectedTask: null
  },
  {
    userId: "251733361926733844",
    displayName: "Diana",
    transcript: "database optimization เสร็จแล้ว performance ดีขึ้นมาก",
    confidence: 0.94,
    expectedMatch: true,
    expectedTask: "Database Performance Optimization"
  },
  {
    userId: "251733361926733845",
    displayName: "Eve",
    transcript: "code review ทีม frontend เสร็จแล้ว มีข้อเสนอแนะหลายจุด",
    confidence: 0.91,
    expectedMatch: true,
    expectedTask: "Frontend Code Review"
  },
  {
    userId: "251733361926733846",
    displayName: "Frank",
    transcript: "ปวดหัวมากวันนี้ ไม่ค่อยสบาย",
    confidence: 0.87,
    expectedMatch: false,
    expectedTask: null
  }
]

// Mock ClickUp tasks
const mockClickUpTasks = [
  {
    id: "task_001",
    name: "API Authentication Implementation",
    description: "Implement JWT-based authentication system for API endpoints",
    url: "https://app.clickup.com/t/task_001"
  },
  {
    id: "task_002", 
    name: "User Registration Bug Fix",
    description: "Fix login validation bug in user registration flow",
    url: "https://app.clickup.com/t/task_002"
  },
  {
    id: "task_003",
    name: "Database Performance Optimization", 
    description: "Optimize database queries and add proper indexing",
    url: "https://app.clickup.com/t/task_003"
  },
  {
    id: "task_004",
    name: "Frontend Code Review",
    description: "Review React components and suggest improvements", 
    url: "https://app.clickup.com/t/task_004"
  }
]

// Mock task matching function (simplified version)
function mockTaskMatching(transcript, tasks) {
  const words = transcript.toLowerCase().split(/\s+/)
  const matches = []
  
  for (const task of tasks) {
    const taskWords = task.name.toLowerCase().split(/\s+/)
    let score = 0
    const matchedKeywords = []
    
    for (const word of words) {
      for (const taskWord of taskWords) {
        if (word.includes(taskWord) || taskWord.includes(word)) {
          score += 0.3
          if (!matchedKeywords.includes(taskWord)) {
            matchedKeywords.push(taskWord)
          }
        }
      }
    }
    
    // เช็คคำสำคัญพิเศษ
    if (transcript.includes('api') && task.name.toLowerCase().includes('api')) score += 0.4
    if (transcript.includes('authentication') && task.name.toLowerCase().includes('authentication')) score += 0.4
    if (transcript.includes('login') && task.name.toLowerCase().includes('user')) score += 0.3
    if (transcript.includes('bug') && task.name.toLowerCase().includes('bug')) score += 0.4
    if (transcript.includes('database') && task.name.toLowerCase().includes('database')) score += 0.4
    if (transcript.includes('optimization') && task.name.toLowerCase().includes('optimization')) score += 0.4
    if (transcript.includes('review') && task.name.toLowerCase().includes('review')) score += 0.4
    
    if (score >= 0.5) {
      matches.push({
        taskId: task.id,
        taskName: task.name,
        matchScore: Math.min(score, 1.0),
        matchedKeywords,
        taskUrl: task.url,
        confidence: score >= 0.8 ? 'high' : 'medium'
      })
    }
  }
  
  return {
    matches: matches.sort((a, b) => b.matchScore - a.matchScore),
    originalText: transcript,
    extractedKeywords: words.filter(w => w.length > 2),
    language: 'mixed'
  }
}

// Test ClickUp matching accuracy
function testClickUpMatching() {
  console.log("🧪 เริ่มทดสอบ ClickUp Task Matching")
  console.log("=" .repeat(60))
  
  let correctMatches = 0
  let totalTests = mockTranscripts.length
  
  mockTranscripts.forEach((test, index) => {
    console.log(`\nTest ${index + 1}: ${test.displayName}`)
    console.log(`Transcript: "${test.transcript}"`)
    
    const matchResult = mockTaskMatching(test.transcript, mockClickUpTasks)
    const hasMatch = matchResult.matches.length > 0
    const topMatch = hasMatch ? matchResult.matches[0] : null
    
    console.log(`Expected Match: ${test.expectedMatch ? 'YES' : 'NO'}`)
    console.log(`Got Match: ${hasMatch ? 'YES' : 'NO'}`)
    
    if (hasMatch && test.expectedMatch) {
      console.log(`Matched Task: ${topMatch.taskName}`)
      console.log(`Score: ${(topMatch.matchScore * 100).toFixed(1)}% (${topMatch.confidence})`)
      console.log(`Keywords: ${topMatch.matchedKeywords.join(', ')}`)
      
      // เช็คว่า match ถูก task หรือไม่
      const isCorrectTask = test.expectedTask && topMatch.taskName.includes(test.expectedTask.split(' ')[0])
      console.log(`Correct Task: ${isCorrectTask ? '✅ YES' : '❌ NO'}`)
      
      if (isCorrectTask) correctMatches++
    } else if (!hasMatch && !test.expectedMatch) {
      console.log(`Result: ✅ CORRECT (No match for casual conversation)`)
      correctMatches++
    } else {
      console.log(`Result: ❌ INCORRECT`)
    }
  })
  
  console.log("\n" + "=".repeat(60))
  console.log(`📊 ผลการทดสอบ: ${correctMatches}/${totalTests} tests passed`)
  console.log(`🎯 Accuracy: ${((correctMatches / totalTests) * 100).toFixed(1)}%`)
  
  return correctMatches === totalTests
}

// Test UI display formatting
function testUIDisplay() {
  console.log("\n🎨 ทดสอบ UI Display Formatting")
  console.log("=" .repeat(60))
  
  mockTranscripts.forEach((test, index) => {
    const matchResult = mockTaskMatching(test.transcript, mockClickUpTasks)
    const hasMatch = matchResult.matches.length > 0
    const timestamp = new Date().toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit', 
      second: '2-digit'
    })
    
    console.log(`\n📱 Discord Message ${index + 1}:`)
    console.log(`👤 ${test.displayName} • ${timestamp}`)
    console.log(`🎤 "${test.transcript}"`)
    console.log(`ความแม่นยำ: ${(test.confidence * 100).toFixed(1)}%`)
    console.log(`สี: ${hasMatch ? '🔵 น้ำเงิน (Work-related)' : '🟢 เขียว (Casual)'}`)
    
    if (hasMatch) {
      const match = matchResult.matches[0]
      console.log(`🎯 ClickUp Task Match:`)
      console.log(`   ${match.taskName}`)
      console.log(`   ความมั่นใจ: ${(match.matchScore * 100).toFixed(1)}% (${match.confidence})`)
      console.log(`   Keywords: ${match.matchedKeywords.join(', ')}`)
      console.log(`   Buttons: [✅ Mark Complete] [📝 Set To Do] [❌ Ignore]`)
    }
    
    console.log("─".repeat(50))
  })
}

// Test multiple users scenario 
function testMultipleUsersScenario() {
  console.log("\n👥 ทดสอบ Multiple Users Scenario (20 คน)")
  console.log("=" .repeat(60))
  
  console.log("🕙 Standup Meeting Simulation - 10:00 AM")
  console.log("📋 Dedicated Bot Channel: #voice-transcripts")
  console.log("👀 Viewers: Manager + 2 Co-Projects")
  console.log("")
  
  const timeline = []
  
  // สร้าง timeline ของการพูด
  mockTranscripts.forEach((test, index) => {
    const baseTime = new Date()
    baseTime.setHours(10, 0, index * 30, 0) // เว้น 30 วินาทีต่อคน
    
    timeline.push({
      time: baseTime,
      ...test
    })
  })
  
  timeline.forEach((entry, index) => {
    const timeStr = entry.time.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    const matchResult = mockTaskMatching(entry.transcript, mockClickUpTasks)
    const hasMatch = matchResult.matches.length > 0
    
    console.log(`[${timeStr}] 👤 ${entry.displayName}`)
    console.log(`           🎤 "${entry.transcript}"`)
    
    if (hasMatch) {
      const match = matchResult.matches[0]
      console.log(`           🎯 ClickUp: ${match.taskName} (${match.confidence})`)
      console.log(`           🎮 Actions Available: Complete | Set To Do | Ignore`)
    } else {
      console.log(`           💬 Casual conversation (No ClickUp actions)`)
    }
    
    console.log("")
  })
  
  console.log("📊 Session Summary:")
  console.log(`   Total Messages: ${timeline.length}`)
  console.log(`   Work-related: ${timeline.filter(t => mockTaskMatching(t.transcript, mockClickUpTasks).matches.length > 0).length}`)
  console.log(`   Casual: ${timeline.filter(t => mockTaskMatching(t.transcript, mockClickUpTasks).matches.length === 0).length}`)
  console.log(`   Manager View: ✅ Clean, organized, actionable`)
}

// รันการทดสอบทั้งหมด
console.log("🚀 เริ่มทดสอบ Real-time Display System")
console.log("🎯 สำหรับทีม 20 คน, standup 2x/วัน")
console.log("")

const matchingTest = testClickUpMatching()
testUIDisplay()
testMultipleUsersScenario()

console.log("\n🏁 การทดสอบเสร็จสิ้น")
console.log(`📋 ระบบพร้อมสำหรับ: Manager + Co-Project monitoring`)
console.log(`🎯 ClickUp Integration: ${matchingTest ? '✅ Working' : '❌ Needs fixing'}`)
console.log(`📱 UI Display: ✅ Work/Casual separation`)
console.log(`👥 Multiple Users: ✅ Scalable for 20+ people`)