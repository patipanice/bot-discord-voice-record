/**
 * Real Discord Bot Integration Test
 * ทดสอบจริงๆ กับ Discord bot ตัวจริง - ไม่ใช่ mock
 * เชื่อมต่อ Discord จริง, ส่งคำสั่งจริง, ทดสอบการบันทึกเสียงจริง
 */

const { Client, GatewayIntentBits, VoiceChannel } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

class RealDiscordBotTester {
  constructor() {
    this.testClient = null;
    this.testGuildId = null;
    this.testVoiceChannelId = null;
    this.testTextChannelId = null;
    this.botUserId = null;
    this.testResults = [];
    
    console.log('🤖 เริ่มต้น Real Discord Bot Integration Tester');
    console.log('⚠️  ต้องใช้ Discord Token และ Channel ID จริง!');
  }

  // เริ่มต้น Test Client
  async initializeTestClient() {
    console.log('\n📱 เริ่มต้น Test Discord Client...');
    
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('❌ ไม่พบ DISCORD_TOKEN ใน .env');
    }
    
    this.testClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    return new Promise((resolve, reject) => {
      this.testClient.once('ready', () => {
        console.log(`✅ Test Client logged in as ${this.testClient.user.tag}`);
        resolve();
      });

      this.testClient.on('error', (error) => {
        console.error('❌ Discord Client Error:', error);
        reject(error);
      });

      this.testClient.login(process.env.DISCORD_TOKEN);
    });
  }

  // ค้นหา Test Channels
  async findTestChannels() {
    console.log('\n🔍 ค้นหา Test Channels...');
    
    const guilds = this.testClient.guilds.cache;
    console.log(`📋 พบ ${guilds.size} Guilds`);
    
    for (const [guildId, guild] of guilds) {
      console.log(`🏠 Guild: ${guild.name} (${guildId})`);
      
      // ค้นหา Voice Channels
      const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2);
      console.log(`  🎙️  Voice Channels (${voiceChannels.size}):`);
      voiceChannels.forEach(channel => {
        console.log(`    - ${channel.name} (${channel.id})`);
      });
      
      // ค้นหา Text Channels
      const textChannels = guild.channels.cache.filter(channel => channel.type === 0);
      console.log(`  💬 Text Channels (${textChannels.size}):`);
      textChannels.forEach(channel => {
        console.log(`    - ${channel.name} (${channel.id})`);
      });
      
      // เลือก Guild แรก
      if (!this.testGuildId) {
        this.testGuildId = guildId;
        
        // เลือก Voice Channel แรก
        if (voiceChannels.size > 0) {
          this.testVoiceChannelId = voiceChannels.first().id;
        }
        
        // เลือก Text Channel แรก (หรือหาที่ชื่อ 'bot-test')
        const botTestChannel = textChannels.find(ch => ch.name.includes('bot') || ch.name.includes('test'));
        this.testTextChannelId = botTestChannel ? botTestChannel.id : textChannels.first()?.id;
      }
    }
    
    console.log('\n📍 Test Configuration:');
    console.log(`  Guild ID: ${this.testGuildId}`);
    console.log(`  Voice Channel ID: ${this.testVoiceChannelId}`);
    console.log(`  Text Channel ID: ${this.testTextChannelId}`);
    
    if (!this.testGuildId || !this.testVoiceChannelId || !this.testTextChannelId) {
      throw new Error('❌ ไม่พบ Channels ที่จำเป็นสำหรับการทดสอบ');
    }
  }

  // ทดสอบส่งข้อความไป Discord
  async testSendMessage(message) {
    console.log(`\n💬 ทดสอบส่งข้อความ: "${message}"`);
    
    try {
      const channel = await this.testClient.channels.fetch(this.testTextChannelId);
      const sentMessage = await channel.send(message);
      
      console.log(`✅ ส่งข้อความสำเร็จ: ${sentMessage.id}`);
      return sentMessage;
    } catch (error) {
      console.error('❌ ไม่สามารถส่งข้อความได้:', error);
      return null;
    }
  }

  // ทดสอบคำสั่ง Bot
  async testBotCommand(command, expectedResponse = null) {
    console.log(`\n🤖 ทดสอบคำสั่ง Bot: "${command}"`);
    
    const startTime = Date.now();
    
    // ส่งคำสั่ง
    const commandMessage = await this.testSendMessage(command);
    if (!commandMessage) {
      this.testResults.push({
        command,
        success: false,
        error: 'ไม่สามารถส่งคำสั่งได้',
        duration: Date.now() - startTime
      });
      return false;
    }
    
    // รอ response (5 วินาที)
    console.log('⏳ รอ response จาก Bot...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout - ไม่ได้รับ response จาก Bot');
        this.testResults.push({
          command,
          success: false,
          error: 'Timeout - ไม่ได้รับ response',
          duration: Date.now() - startTime
        });
        resolve(false);
      }, 5000);

      // Listen for messages
      const messageHandler = (message) => {
        // ตรวจสอบว่าเป็น response จาก Bot
        if (message.author.bot && message.channel.id === this.testTextChannelId) {
          clearTimeout(timeout);
          
          console.log(`✅ ได้รับ response จาก Bot: "${message.content}"`);
          
          // เก็บ Bot User ID
          if (!this.botUserId) {
            this.botUserId = message.author.id;
            console.log(`🤖 Bot User ID: ${this.botUserId}`);
          }
          
          this.testResults.push({
            command,
            success: true,
            response: message.content,
            duration: Date.now() - startTime
          });
          
          this.testClient.off('messageCreate', messageHandler);
          resolve(true);
        }
      };

      this.testClient.on('messageCreate', messageHandler);
    });
  }

  // ทดสอบคำสั่งพื้นฐาน
  async testBasicCommands() {
    console.log('\n🔧 ทดสอบคำสั่งพื้นฐาน...');
    
    const commands = [
      { cmd: '!help', desc: 'แสดงความช่วยเหลือ' },
      { cmd: '!status', desc: 'ตรวจสอบสถานะ' },
      { cmd: '!setchannel', desc: 'ตั้งค่า channel' }
    ];
    
    for (const { cmd, desc } of commands) {
      console.log(`\n--- ทดสอบ: ${desc} ---`);
      const success = await this.testBotCommand(cmd);
      
      if (success) {
        console.log(`✅ ${desc} ทำงานปกติ`);
      } else {
        console.log(`❌ ${desc} ไม่ทำงาน`);
      }
      
      // รอระหว่างคำสั่ง
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // ทดสอบการบันทึกเสียงจริง (จำลองด้วยการเข้า Voice Channel)
  async testVoiceRecording() {
    console.log('\n🎙️ ทดสอบการบันทึกเสียงจริง...');
    
    try {
      // 1. ส่งคำสั่ง !join (ต้องมีคนใน Voice Channel ก่อน)
      console.log('📢 คำเตือน: ต้องมีคนเข้า Voice Channel ก่อนเพื่อให้ Bot เข้าร่วมได้');
      console.log(`🎙️  Voice Channel: ${this.testVoiceChannelId}`);
      
      const joinSuccess = await this.testBotCommand('!join');
      
      if (joinSuccess) {
        console.log('✅ Bot เข้า Voice Channel สำเร็จ');
        
        // รอ 10 วินาที (ให้เวลาบันทึก)
        console.log('⏳ รอ 10 วินาที สำหรับการบันทึกเสียง...');
        console.log('💡 สามารถพูดในห้องเสียงเพื่อทดสอบการแปลงเสียงได้');
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // 2. ส่งคำสั่ง !leave
        const leaveSuccess = await this.testBotCommand('!leave');
        
        if (leaveSuccess) {
          console.log('✅ Bot ออกจาก Voice Channel สำเร็จ');
          
          // ตรวจสอบไฟล์ที่ถูกสร้าง
          await this.checkRecordingFiles();
          
        } else {
          console.log('❌ Bot ไม่สามารถออกจาก Voice Channel ได้');
        }
        
      } else {
        console.log('⚠️  Bot ไม่สามารถเข้า Voice Channel ได้ (อาจไม่มีคนในห้อง)');
      }
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทดสอบ Voice Recording:', error);
    }
  }

  // ตรวจสอบไฟล์ที่ถูกบันทึก
  async checkRecordingFiles() {
    console.log('\n📁 ตรวจสอบไฟล์ที่ถูกบันทึก...');
    
    const recordingsDir = path.join(__dirname, '..', 'recordings');
    
    if (!fs.existsSync(recordingsDir)) {
      console.log('❌ ไม่พบโฟลเดอร์ recordings');
      return;
    }
    
    const files = fs.readdirSync(recordingsDir);
    console.log(`📋 ไฟล์ใน recordings/ (${files.length} ไฟล์):`);
    
    files.forEach(file => {
      const filePath = path.join(recordingsDir, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      const modified = stats.mtime.toLocaleString('th-TH');
      
      console.log(`  📄 ${file} (${size} KB, ${modified})`);
    });
    
    // ตรวจสอบ transcripts.txt
    const transcriptsFile = path.join(recordingsDir, 'transcripts.txt');
    if (fs.existsSync(transcriptsFile)) {
      const content = fs.readFileSync(transcriptsFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      console.log(`\n📝 Transcripts (${lines.length} บรรทัด):`);
      lines.slice(-5).forEach((line, index) => {
        console.log(`  ${index + 1}. ${line}`);
      });
      
      if (lines.length > 5) {
        console.log(`  ... และอีก ${lines.length - 5} บรรทัด`);
      }
    } else {
      console.log('❌ ไม่พบไฟล์ transcripts.txt');
    }
  }

  // ทดสอบ Transcription Service จริง
  async testRealTranscription() {
    console.log('\n🔊 ทดสอบ Transcription Service จริง...');
    
    // สร้างไฟล์เสียงทดสอบ (silence)
    const testAudioFile = path.join(__dirname, 'test-audio-real.wav');
    
    try {
      // ใช้ ffmpeg สร้างไฟล์เสียงเงียบ 3 วินาที
      console.log('🎵 สร้างไฟล์เสียงทดสอบ...');
      
      const ffmpegProcess = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-t', '3',
        '-y',
        testAudioFile
      ]);
      
      await new Promise((resolve, reject) => {
        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ สร้างไฟล์เสียงทดสอบสำเร็จ');
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });
      
      // ทดสอบ transcription
      if (fs.existsSync(testAudioFile)) {
        console.log('🔄 ทดสอบการแปลงเสียงจริง...');
        
        // ใช้ function จาก codebase
        try {
          const { transcribeAudio } = require('../src/transcriber');
          const result = await transcribeAudio(testAudioFile, 'test-user');
          
          if (result) {
            console.log(`✅ Transcription สำเร็จ: "${result.transcript}" (${(result.confidence * 100).toFixed(1)}%)`);
          } else {
            console.log('❌ Transcription ล้มเหลว');
          }
        } catch (error) {
          console.log('⚠️  ไม่สามารถทดสอบ transcription ได้:', error.message);
        }
        
        // ลบไฟล์ทดสอบ
        fs.unlinkSync(testAudioFile);
      }
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทดสอบ Transcription:', error);
    }
  }

  // สร้าง Test Report
  generateTestReport() {
    console.log('\n📊 สรุปผลการทดสอบ');
    console.log('=' .repeat(60));
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    
    console.log(`📋 จำนวนการทดสอบทั้งหมด: ${totalTests}`);
    console.log(`✅ ทดสอบสำเร็จ: ${successfulTests}`);
    console.log(`❌ ทดสอบล้มเหลว: ${failedTests}`);
    console.log(`📈 อัตราความสำเร็จ: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📝 รายละเอียดผลการทดสอบ:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? `${result.duration}ms` : '';
      
      console.log(`${index + 1}. ${status} "${result.command}" ${duration}`);
      
      if (result.response) {
        console.log(`   📄 Response: ${result.response.substring(0, 100)}...`);
      }
      
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      }
    });
    
    // บันทึกรายงานลงไฟล์
    const reportFile = path.join(__dirname, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalTests,
      successfulTests,
      failedTests,
      successRate: (successfulTests / totalTests) * 100,
      results: this.testResults
    }, null, 2));
    
    console.log(`\n💾 บันทึกรายงานลงไฟล์: ${reportFile}`);
  }

  // รันการทดสอบทั้งหมด
  async runAllTests() {
    console.log('🚀 เริ่มการทดสอบ Real Discord Bot Integration');
    console.log('=' .repeat(70));
    
    try {
      // 1. เริ่มต้น Test Client
      await this.initializeTestClient();
      
      // 2. ค้นหา Test Channels
      await this.findTestChannels();
      
      // 3. ทดสอบคำสั่งพื้นฐาน
      await this.testBasicCommands();
      
      // 4. ทดสอบการบันทึกเสียง
      await this.testVoiceRecording();
      
      // 5. ทดสอบ Transcription Service
      await this.testRealTranscription();
      
      // 6. สร้างรายงาน
      this.generateTestReport();
      
      console.log('\n🎉 การทดสอบ Real Discord Bot Integration เสร็จสิ้น!');
      
    } catch (error) {
      console.error('💥 เกิดข้อผิดพลาดในการทดสอบ:', error);
      throw error;
    } finally {
      // ปิดการเชื่อมต่อ
      if (this.testClient) {
        await this.testClient.destroy();
        console.log('👋 ปิดการเชื่อมต่อ Discord แล้ว');
      }
    }
  }
}

// รันการทดสอบ
async function main() {
  const tester = new RealDiscordBotTester();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 การทดสอบล้มเหลว:', error);
    process.exit(1);
  }
}

// เรียกใช้ถ้ารันไฟล์นี้โดยตรง
if (require.main === module) {
  main();
}

module.exports = { RealDiscordBotTester };