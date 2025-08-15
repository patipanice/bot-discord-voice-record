import { TaskMatch, MatchingResult } from '../task-matcher'
import { ActionRowBuilder, ButtonBuilder } from 'discord.js'

export interface ClickUpIntegrationConfig {
  enabled: boolean
  tasks: Array<{id: string, name: string, description?: string, url: string}>
}

export interface TaskMatchResult {
  hasMatch: boolean
  matches: TaskMatch[]
  topMatch?: TaskMatch
}

export interface ClickUpButtonComponents {
  components: ActionRowBuilder<ButtonBuilder>[]
}

export interface TaskActionResult {
  success: boolean
  taskName?: string
  message: string
}

export { TaskMatch, MatchingResult }