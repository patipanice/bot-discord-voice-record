import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, Client } from 'discord.js'
import { TaskMatch } from '../task-matcher'
import { ClickUpButtonComponents } from '../types/clickup.types'
import { SessionTranscript } from '../types/transcript.types'

export class DiscordService {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  /**
   * สร้าง embed สำหรับ real-time transcript display
   */
  public createTranscriptEmbed(
    displayName: string,
    transcript: string,
    confidence: number,
    hasTaskMatch: boolean = false
  ): EmbedBuilder {
    const timestamp = new Date().toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    return new EmbedBuilder()
      .setAuthor({
        name: `${displayName} • ${timestamp}`,
        iconURL: `https://cdn.discordapp.com/avatars/avatar.png`
      })
      .setDescription(`🎤 "${transcript}"`)
      .setColor(hasTaskMatch ? 0x007acc : 0x00ff00)
      .setTimestamp()
      .addFields({
        name: 'ความแม่นยำ',
        value: `${(confidence * 100).toFixed(1)}%`,
        inline: true
      })
  }

  /**
   * เพิ่ม ClickUp fields ให้ embed
   */
  public addClickUpFields(embed: EmbedBuilder, match: TaskMatch): EmbedBuilder {
    embed.addFields({
      name: '🎯 ClickUp Task Match',
      value: `**${match.taskName}**\nความมั่นใจ: ${(match.matchScore * 100).toFixed(1)}% (${match.confidence})\n[ดู Task ใน ClickUp](${match.taskUrl})`,
      inline: false
    })

    if (match.matchedKeywords.length > 0) {
      embed.addFields({
        name: '🔍 Keywords ที่จับได้',
        value: match.matchedKeywords.join(', '),
        inline: true
      })
    }

    return embed
  }

  /**
   * สร้าง action buttons สำหรับ ClickUp task
   */
  public createTaskActionButtons(match: TaskMatch): ClickUpButtonComponents {
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`complete_task_${match.taskId}`)
          .setLabel('✅ Mark Complete')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`progress_task_${match.taskId}`)
          .setLabel('📝 Set To Do')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ignore_match_${match.taskId}`)
          .setLabel('❌ Ignore')
          .setStyle(ButtonStyle.Secondary)
      )

    return { components: [buttons] }
  }

  /**
   * สร้าง embed สำหรับแสดงผล task action result
   */
  public createTaskActionEmbed(
    success: boolean,
    taskName: string | undefined,
    action: string,
    userName: string,
    message: string
  ): EmbedBuilder {
    const color = success ? 
      (action === 'complete' ? 0x00ff00 : 0x0099ff) : 0xff0000

    const title = success ? 
      (action === 'complete' ? '✅ Task Completed!' : 
       action === 'progress' ? '🔄 Task Updated!' : 
       '👍 Task Ignored') : '❌ Error'

    const description = taskName && success ? 
      `Task **${taskName}** ${action === 'complete' ? 'ได้รับการอัปเดทเป็น Complete' : 'ได้รับการอัปเดทเป็น To Do'} โดย ${userName}` :
      message

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
  }

  /**
   * สร้าง session summary embed
   */
  public createSessionSummaryEmbed(totalTranscripts: number): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📋 สรุปการประชุม')
      .setDescription(`**${totalTranscripts}** ข้อความที่บันทึกไว้`)
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({ 
        text: 'Voice Recorder Bot',
        iconURL: this.client.user?.displayAvatarURL()
      })
  }

  /**
   * สร้าง task matching suggestion embed
   */
  public createTaskMatchEmbed(
    email: string,
    userDisplayName: string,
    transcripts: string[],
    topMatch: TaskMatch
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🎯 Task Match Found!')
      .setDescription(`**${userDisplayName}** (${email})`)
      .addFields({
        name: '🗣️ สิ่งที่พูด',
        value: transcripts.slice(0, 3).map(t => `"${t}"`).join('\n') + (transcripts.length > 3 ? `\n... และอีก ${transcripts.length - 3} ข้อความ` : ''),
        inline: false
      })
      .addFields({
        name: '📋 Task ที่เข้าใจที่สุด',
        value: `**${topMatch.taskName}**\nความมั่นใจ: ${(topMatch.matchScore * 100).toFixed(1)}% (${topMatch.confidence})\n[ดู Task ใน ClickUp](${topMatch.taskUrl})`,
        inline: false
      })
      .addFields({
        name: '🔍 Keywords ที่จับได้',
        value: topMatch.matchedKeywords.join(', ') || 'ไม่มี',
        inline: true
      })
      .setColor(topMatch.confidence === 'high' ? 0x00ff00 : 0xffa500)
      .setTimestamp()
      .setFooter({
        text: 'ClickUp Task Matching',
        iconURL: this.client.user?.displayAvatarURL()
      })
  }

  /**
   * แปลง userId เป็น display name
   */
  public async getUserDisplayName(userId: string, guild: any): Promise<string> {
    try {
      const member = await guild.members.fetch(userId)
      return member.displayName || member.user.username
    } catch (error) {
      return `User-${userId.slice(-4)}`
    }
  }

  /**
   * ส่ง transcript message พร้อม ClickUp integration
   */
  public async sendTranscriptMessage(
    channel: TextChannel,
    embed: EmbedBuilder,
    buttons?: ClickUpButtonComponents
  ): Promise<void> {
    const messageOptions: any = { embeds: [embed] }
    
    if (buttons && buttons.components.length > 0) {
      messageOptions.components = buttons.components
    }
    
    await channel.send(messageOptions)
  }
}