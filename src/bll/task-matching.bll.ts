import { matchTasksWithSpeech, TaskMatch } from '../task-matcher'
import { TaskMatchResult } from '../types/clickup.types'

export class TaskMatchingBLL {
  /**
   * ตรวจสอบว่า transcript match กับ tasks หรือไม่
   * Pure business logic - ไม่ขึ้นกับ external services
   */
  public matchTranscriptWithTasks(
    transcript: string, 
    tasks: Array<{id: string, name: string, description?: string, url: string}>
  ): TaskMatchResult {
    if (tasks.length === 0) {
      return { hasMatch: false, matches: [] }
    }

    const matchResult = matchTasksWithSpeech(transcript, tasks)
    const goodMatches = matchResult.matches.filter(match => 
      match.confidence === 'high' || match.confidence === 'medium'
    )

    if (goodMatches.length > 0) {
      const topMatch = goodMatches[0]
      console.log(`🎯 Found task match: ${topMatch.taskName}`)
      
      return {
        hasMatch: true,
        matches: goodMatches,
        topMatch
      }
    }

    return { hasMatch: false, matches: [] }
  }

  /**
   * จัดกลุ่ม transcripts ตาม userId และทำ task matching
   */
  public processSessionTaskMatching(
    sessionTranscripts: Array<{userId: string, transcript: string}>,
    userMapping: Record<string, string>, // userId -> email
    tasks: Array<{id: string, name: string, description?: string, url: string}>
  ): Map<string, {email: string, transcripts: string[], matches: TaskMatch[]}> {
    const results = new Map<string, {email: string, transcripts: string[], matches: TaskMatch[]}>()
    
    // รวบรวม transcripts ของแต่ละ user ที่มี mapping
    const userTranscripts = new Map<string, string[]>()
    
    for (const transcript of sessionTranscripts) {
      const email = userMapping[transcript.userId]
      if (email) {
        if (!userTranscripts.has(email)) {
          userTranscripts.set(email, [])
        }
        userTranscripts.get(email)!.push(transcript.transcript)
      }
    }
    
    // ประมวลผลแต่ละ user
    for (const [email, transcripts] of userTranscripts) {
      const combinedTranscript = transcripts.join(' ')
      const matchResult = this.matchTranscriptWithTasks(combinedTranscript, tasks)
      
      if (matchResult.hasMatch && matchResult.matches) {
        results.set(email, {
          email,
          transcripts,
          matches: matchResult.matches
        })
      }
    }
    
    return results
  }
}