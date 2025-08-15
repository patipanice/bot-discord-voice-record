import { SessionTranscript } from '../types/transcript.types'

export class SessionManagementBLL {
  /**
   * จัดกลุ่ม transcripts ตาม userId
   */
  public groupTranscriptsByUser(
    sessionTranscripts: SessionTranscript[]
  ): Map<string, SessionTranscript[]> {
    const groupedTranscripts = new Map<string, SessionTranscript[]>()
    
    for (const item of sessionTranscripts) {
      if (!groupedTranscripts.has(item.userId)) {
        groupedTranscripts.set(item.userId, [])
      }
      groupedTranscripts.get(item.userId)!.push({
        transcript: item.transcript,
        confidence: item.confidence,
        timestamp: item.timestamp,
        userId: item.userId
      })
    }
    
    return groupedTranscripts
  }

  /**
   * สร้างข้อมูลสรุปการประชุม
   */
  public createSessionSummary(
    sessionTranscripts: SessionTranscript[],
    maxFields: number = 20
  ): {
    totalTranscripts: number,
    groupedTranscripts: Map<string, SessionTranscript[]>,
    hasMore: boolean,
    additionalCount: number
  } {
    const groupedTranscripts = this.groupTranscriptsByUser(sessionTranscripts)
    const hasMore = sessionTranscripts.length > maxFields
    const additionalCount = hasMore ? sessionTranscripts.length - maxFields : 0

    return {
      totalTranscripts: sessionTranscripts.length,
      groupedTranscripts,
      hasMore,
      additionalCount
    }
  }

  /**
   * ตรวจสอบว่าควรเพิ่ม transcript เข้า session หรือไม่
   */
  public shouldAddToSession(
    userId: string,
    transcript: string,
    isRecording: boolean,
    sessionTranscripts: SessionTranscript[]
  ): { shouldAdd: boolean, reason?: string } {
    if (!isRecording) {
      return { shouldAdd: false, reason: 'ไม่ได้กำลังบันทึก' }
    }

    // ตรวจสอบ duplicate
    const isDuplicate = sessionTranscripts.some(
      item => item.userId === userId && item.transcript === transcript
    )

    if (isDuplicate) {
      return { shouldAdd: false, reason: 'ข้อความซ้ำในเซสชัน' }
    }

    return { shouldAdd: true }
  }
}