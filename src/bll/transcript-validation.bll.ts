export class TranscriptValidationBLL {
  /**
   * ตรวจสอบว่า transcript ผิดปกติหรือไม่
   * Pure business logic สำหรับ validation rules
   */
  public validateTranscript(transcript: string): { isValid: boolean, reason?: string } {
    const trimmed = transcript.trim()
    
    // 1. ตรวจสอบข้อความสั้นเกินไป
    if (trimmed.length < 3) {
      return { 
        isValid: false, 
        reason: `Transcript สั้นเกินไป: "${trimmed}"` 
      }
    }
    
    // 2. ตรวจสอบคำซ้ำผิดปกติ
    const words = trimmed.split(/\s+/)
    if (words.length > 10) {
      const wordCount = new Map<string, number>()
      
      for (const word of words) {
        if (word.length > 0) {
          wordCount.set(word, (wordCount.get(word) || 0) + 1)
        }
      }
      
      // หาคำที่ซ้ำมากที่สุด
      for (const [word, count] of wordCount) {
        const percentage = count / words.length
        if (percentage > 0.5 && count > 10) {
          return { 
            isValid: false, 
            reason: `คำ "${word}" ซ้ำผิดปกติ: ${count}/${words.length} ครั้ง (${(percentage * 100).toFixed(1)}%)` 
          }
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
          return { 
            isValid: false, 
            reason: `Pattern "${firstPart}" ซ้ำผิดปกติ: ${matches.length} ครั้ง` 
          }
        }
      } catch (error) {
        console.log(`⚠️ Regex error สำหรับ pattern: ${firstPart}`)
      }
    }
    
    return { isValid: true }
  }

  /**
   * ตรวจสอบ duplicate transcript ในเซสชัน
   */
  public isDuplicateInSession(
    userId: string,
    transcript: string,
    sessionTranscripts: Array<{userId: string, transcript: string}>
  ): boolean {
    return sessionTranscripts.some(
      item => item.userId === userId && item.transcript === transcript
    )
  }
}