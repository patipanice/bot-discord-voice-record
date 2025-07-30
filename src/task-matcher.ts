// Task Matching System สำหรับ Daily Standup
// จับคำสำคัญจากการพูดและ match กับ ClickUp tasks

export interface TaskMatch {
  taskId: string
  taskName: string
  matchScore: number
  matchedKeywords: string[]
  taskUrl: string
  confidence: 'high' | 'medium' | 'low'
}

export interface MatchingResult {
  matches: TaskMatch[]
  originalText: string
  extractedKeywords: string[]
  language: 'th' | 'en' | 'mixed'
}

// Keyword mapping สำหรับ Daily Standup conversations
const STANDUP_KEYWORDS: Record<string, string[]> = {
  // Authentication & User Management
  'auth': ['authentication', 'user', 'login', 'signin', 'account', 'profile'],
  'login': ['authentication', 'signin', 'user', 'account'],
  'user': ['authentication', 'account', 'profile', 'management'],
  'account': ['user', 'profile', 'authentication'],
  'profile': ['user', 'account', 'management'],
  
  // API & Backend
  'api': ['endpoint', 'backend', 'service', 'rest', 'server'],
  'endpoint': ['api', 'backend', 'service', 'rest'],
  'backend': ['api', 'server', 'service', 'database'],
  'server': ['backend', 'api', 'service', 'deployment'],
  'service': ['api', 'backend', 'server', 'microservice'],
  
  // Database
  'database': ['db', 'data', 'storage', 'mysql', 'mongo', 'sql'],
  'db': ['database', 'data', 'storage', 'sql'],
  'data': ['database', 'storage', 'db', 'model'],
  'sql': ['database', 'query', 'data', 'mysql'],
  
  // Frontend & UI
  'frontend': ['ui', 'dashboard', 'interface', 'component', 'react'],
  'dashboard': ['ui', 'frontend', 'interface', 'admin'],
  'ui': ['frontend', 'interface', 'component', 'design'],
  'interface': ['ui', 'frontend', 'design', 'component'],
  'component': ['ui', 'frontend', 'react', 'vue'],
  
  // Testing
  'test': ['testing', 'unit', 'integration', 'qa', 'spec'],
  'testing': ['test', 'unit', 'integration', 'qa'],
  'unit': ['test', 'testing', 'spec', 'jest'],
  'integration': ['test', 'testing', 'e2e'],
  
  // Development & General
  'feature': ['functionality', 'implementation', 'development'],
  'bug': ['fix', 'issue', 'error', 'debug', 'problem'],
  'fix': ['bug', 'issue', 'error', 'debug', 'repair'],
  'deploy': ['deployment', 'release', 'production', 'staging'],
  'optimization': ['performance', 'optimize', 'improve', 'enhance'],
  
  // Status keywords (การบอกสถานะ)
  'เสร็จ': ['done', 'complete', 'finished', 'completed'],
  'ทำ': ['doing', 'working', 'develop', 'implement'],
  'จะทำ': ['todo', 'will do', 'planning', 'next'],
  'กำลังทำ': ['doing', 'working', 'in progress', 'developing']
}

// คำที่ไม่สำคัญ (stop words) ที่ควรตัดออก
const STOP_WORDS = [
  // ไทย
  'วันนี้', 'เมื่อวาน', 'พรุ่งนี้', 'แล้ว', 'ครับ', 'ค่ะ', 'นะ', 'อ่ะ', 'เอ่อ',
  'คือ', 'ที่', 'แล้วก็', 'ด้วย', 'ไป', 'มา', 'ให้', 'กับ', 'ใน', 'ของ',
  // อังกฤษ
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'today', 'yesterday', 'tomorrow', 'now', 'then', 'will', 'going', 'gonna'
]

// Pattern สำหรับจับสถานะงาน
const STATUS_PATTERNS = {
  completed: [
    /(.+)(เสร็จ|done|finished|complete)/i,
    /(เสร็จ|done|finished|complete)(.+)/i,
    /ทำ(.+)เสร็จ/i
  ],
  inProgress: [
    /กำลังทำ(.+)/i,
    /ทำ(.+)อยู่/i,
    /(working on|doing)(.+)/i
  ],
  todo: [
    /วันนี้จะทำ(.+)/i,
    /จะทำ(.+)/i,
    /(will do|going to)(.+)/i,
    /ต่อไปจะ(.+)/i
  ],
  blocked: [
    /(.+)(ติด|stuck|blocked)/i,
    /มีปัญหา(.+)/i,
    /(.+)(ไม่ได้|can't|cannot)/i
  ]
}

export class TaskMatcher {
  /**
   * หาคำสำคัญจากข้อความ
   */
  extractKeywords(text: string): string[] {
    // แปลงเป็นตัวเล็กและตัดช่องว่างส่วนเกิน
    const cleanText = text.toLowerCase().trim()
    
    // แยกคำ (รองรับทั้งไทยและอังกฤษ)
    const words = cleanText.split(/[\s,.\-_!?]+/).filter(word => word.length > 0)
    
    // ตัด stop words ออก
    const filteredWords = words.filter(word => !STOP_WORDS.includes(word))
    
    // หาคำที่อยู่ใน keyword mapping
    const keywords: string[] = []
    
    for (const word of filteredWords) {
      // เช็คว่าคำนี้เป็น keyword หรือไม่
      if (STANDUP_KEYWORDS[word]) {
        keywords.push(word)
      }
      
      // เช็คว่าคำนี้อยู่ใน synonym list หรือไม่
      for (const [mainKeyword, synonyms] of Object.entries(STANDUP_KEYWORDS)) {
        if (synonyms.includes(word) && !keywords.includes(mainKeyword)) {
          keywords.push(mainKeyword)
        }
      }
    }
    
    return [...new Set(keywords)] // ลบ duplicate
  }

  /**
   * วิเคราะห์สถานะของงานจากข้อความ
   */
  detectStatus(text: string): 'completed' | 'inProgress' | 'todo' | 'blocked' | 'unknown' {
    const cleanText = text.toLowerCase()
    
    // เช็คแต่ละ pattern
    for (const [status, patterns] of Object.entries(STATUS_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(cleanText)) {
          return status as any
        }
      }
    }
    
    return 'unknown'
  }

  /**
   * คำนวณความคล้ายคลึงระหว่าง 2 string (Levenshtein distance)
   */
  calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    
    // ถ้าเหมือนกันเป๊ะ
    if (s1 === s2) return 1.0
    
    // ถ้า string หนึ่งว่าง
    if (s1.length === 0) return s2.length === 0 ? 1.0 : 0.0
    if (s2.length === 0) return 0.0
    
    // คำนวณ Levenshtein distance
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null))
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1,     // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    const maxLen = Math.max(s1.length, s2.length)
    return (maxLen - matrix[s2.length][s1.length]) / maxLen
  }

  /**
   * ค้นหา keywords ในข้อความ (support partial matching)
   */
  findKeywordMatches(text: string, keywords: string[]): Array<{keyword: string, score: number}> {
    const matches: Array<{keyword: string, score: number}> = []
    const cleanText = text.toLowerCase()
    
    for (const keyword of keywords) {
      const cleanKeyword = keyword.toLowerCase()
      
      // Exact match
      if (cleanText.includes(cleanKeyword)) {
        matches.push({ keyword, score: 1.0 })
        continue
      }
      
      // Fuzzy matching กับทุกคำในข้อความ
      const textWords = cleanText.split(/[\s,.-_!?]+/)
      let bestScore = 0
      
      for (const word of textWords) {
        if (word.length < 2) continue
        
        const similarity = this.calculateSimilarity(word, cleanKeyword)
        if (similarity > bestScore) {
          bestScore = similarity
        }
        
        // เช็ค partial match
        if (word.includes(cleanKeyword) || cleanKeyword.includes(word)) {
          const partialScore = Math.min(word.length, cleanKeyword.length) / Math.max(word.length, cleanKeyword.length)
          if (partialScore > bestScore) {
            bestScore = partialScore
          }
        }
      }
      
      // เพิ่มเข้า matches ถ้า score > threshold
      if (bestScore >= 0.6) {
        matches.push({ keyword, score: bestScore })
      }
    }
    
    return matches.sort((a, b) => b.score - a.score)
  }

  /**
   * คำนวณ match score ระหว่างข้อความกับ task
   */
  calculateTaskMatchScore(
    speechText: string, 
    taskName: string, 
    taskDescription: string = '',
    extractedKeywords: string[]
  ): {score: number, matchedKeywords: string[]} {
    const combinedTaskText = `${taskName} ${taskDescription}`.toLowerCase()
    const matchedKeywords: string[] = []
    let totalScore = 0
    
    // คำนวณ score จาก keywords
    for (const keyword of extractedKeywords) {
      // หา synonyms ของ keyword นี้
      const synonyms = STANDUP_KEYWORDS[keyword] || []
      const allKeywords = [keyword, ...synonyms]
      
      // หา matches ใน task text
      const matches = this.findKeywordMatches(combinedTaskText, allKeywords)
      
      if (matches.length > 0) {
        const bestMatch = matches[0]
        matchedKeywords.push(keyword)
        
        // Weight: Task name = 70%, Description = 30%
        const nameMatches = this.findKeywordMatches(taskName.toLowerCase(), allKeywords)
        const descMatches = this.findKeywordMatches(taskDescription.toLowerCase(), allKeywords)
        
        const nameScore = nameMatches.length > 0 ? nameMatches[0].score : 0
        const descScore = descMatches.length > 0 ? descMatches[0].score : 0
        
        const weightedScore = (nameScore * 0.7) + (descScore * 0.3)
        totalScore += weightedScore
      }
    }
    
    // Normalize score
    const normalizedScore = extractedKeywords.length > 0 
      ? Math.min(totalScore / extractedKeywords.length, 1.0)
      : 0
    
    return {
      score: normalizedScore,
      matchedKeywords
    }
  }

  /**
   * หา confidence level จาก score
   */
  getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.8) return 'high'
    if (score >= 0.5) return 'medium'
    return 'low'
  }

  /**
   * จับภาษาที่ใช้ในข้อความ
   */
  detectLanguage(text: string): 'th' | 'en' | 'mixed' {
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length
    
    if (thaiChars > 0 && englishChars > 0) return 'mixed'
    if (thaiChars > englishChars) return 'th'
    if (englishChars > 0) return 'en'
    return 'mixed'
  }
}

// Export utility functions
export const taskMatcher = new TaskMatcher()

export function extractKeywordsFromSpeech(speechText: string): string[] {
  return taskMatcher.extractKeywords(speechText)
}

export function matchTasksWithSpeech(
  speechText: string,
  tasks: Array<{id: string, name: string, description?: string, url: string}>
): MatchingResult {
  const extractedKeywords = taskMatcher.extractKeywords(speechText)
  const language = taskMatcher.detectLanguage(speechText)
  const matches: TaskMatch[] = []
  
  for (const task of tasks) {
    const { score, matchedKeywords } = taskMatcher.calculateTaskMatchScore(
      speechText,
      task.name,
      task.description || '',
      extractedKeywords
    )
    
    // เพิ่มเข้า matches ถ้า score > threshold
    if (score >= 0.3) {
      matches.push({
        taskId: task.id,
        taskName: task.name,
        matchScore: score,
        matchedKeywords,
        taskUrl: task.url,
        confidence: taskMatcher.getConfidenceLevel(score)
      })
    }
  }
  
  // เรียงตาม score จากสูงไปต่ำ
  matches.sort((a, b) => b.matchScore - a.matchScore)
  
  return {
    matches: matches.slice(0, 5), // เอาแค่ top 5
    originalText: speechText,
    extractedKeywords,
    language
  }
}