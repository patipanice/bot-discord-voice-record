export interface TranscriptData {
  userId: string
  transcript: string
  confidence: number
  timestamp: string
}

export interface TranscriptDisplayData extends TranscriptData {
  displayName: string
  hasTaskMatch: boolean
  taskMatch?: any
}

export interface SessionTranscript {
  userId: string
  transcript: string
  confidence: number
  timestamp: string
}

export interface TranscriptValidationResult {
  isValid: boolean
  reason?: string
}