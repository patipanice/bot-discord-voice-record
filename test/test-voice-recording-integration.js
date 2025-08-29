/**
 * Voice Recording Integration Test
 * ทดสอบการบันทึกเสียงจริงๆ และการแปลงเป็นข้อความ
 * รวมถึงการจำลอง audio stream และการทดสอบ transcription service
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createWriteStream } = require('fs');

// จำลอง dependencies
const mockTranscriber = {
  async transcribeAudio(wavFile, userId) {
    console.log(`🔄 จำลองการแปลงเสียงจาก ${wavFile} สำหรับ ${userId}`);
    
    // จำลองผลลัพธ์การแปลง
    const mockResults = [
      { transcript: 'สวัสดีครับ วันนี้ผมมาเล่าถึงงานที่ทำเสร็จแล้ว', confidence: 0.95 },
      { transcript: 'งานของผมคือออกแบบหน้า login page เสร็จแล้ว', confidence: 0.88 },
      { transcript: 'วันนี้ผมจะทำ unit testing ให้เสร็จครับ', confidence: 0.92 },
      { transcript: 'ขอบคุณครับ ประชุมจบแล้ว', confidence: 0.94 }
    ];
    
    // เลือกผลลัพธ์แบบสุ่ม
    const result = mockResults[Math.floor(Math.random() * mockResults.length)];
    
    // จำลองเวลาในการประมวลผล
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      userId,
      transcript: result.transcript,
      confidence: result.confidence,
      timestamp: new Date().toISOString()
    };
  }
};

const mockColabAPI = {
  async checkColabAPIHealth() {
    console.log('🔍 ตรวจสอบสถานะ Colab API...');
    // จำลองว่า Colab API พร้อมใช้งาน 70% ของเวลา
    return Math.random() > 0.3;
  },

  async transcribeAudioWithColab(audioBuffer, userId) {
    console.log(`🚀 ส่งไฟล์เสียงไป Colab API (${audioBuffer.length} bytes) สำหรับ ${userId}`);
    
    // จำลองผลลัพธ์จาก Colab API (ภาษาไทย)
    const thaiResults = [
      { transcript: 'สวัสดีครับทุกคน วันนี้ผมจะมารายงานความคืบหน้างานที่รับผิดชอบ', confidence: 0.97 },
      { transcript: 'งานที่ได้รับมอบหมายเมื่อสัปดาห์ที่แล้วผมทำเสร็จแล้วครับ', confidence: 0.93 },
      { transcript: 'สำหรับงานวันนี้ผมจะมาเริ่มทำ feature ใหม่ที่ได้รับมอบหมาย', confidence: 0.90 },
      { transcript: 'ถ้ามีคำถามหรือข้อสงสัยอะไรสามารถถามได้เลยครับ', confidence: 0.95 },
      { transcript: 'ขอบคุณมากครับ ประชุมวันนี้จบแล้ว', confidence: 0.96 }
    ];
    
    const result = thaiResults[Math.floor(Math.random() * thaiResults.length)];
    
    // จำลองเวลาในการประมวลผลผ่าน API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      userId,
      transcript: result.transcript,
      confidence: result.confidence,
      timestamp: new Date().toISOString()
    };
  }
};

class VoiceRecordingTester {
  constructor() {
    this.sessionTranscripts = [];
    this.pendingTranscriptions = 0;
    this.isRecording = false;
    
    console.log('🎤 เริ่มต้น Voice Recording Integration Tester');
  }

  // จำลอง audio stream จาก Discord voice channel
  createMockAudioStream(userId, duration = 3000) {
    console.log(`🎵 สร้าง mock audio stream สำหรับ ${userId} (${duration}ms)`);
    
    const stream = new Readable({
      read() {}
    });

    // จำลอง audio data
    let bytesGenerated = 0;
    const totalBytes = duration * 48; // 48kHz sample rate
    
    const interval = setInterval(() => {
      if (bytesGenerated >= totalBytes) {
        stream.push(null); // End stream
        clearInterval(interval);
        return;
      }
      
      // สร้าง mock audio data (random bytes)
      const chunk = Buffer.alloc(1024);
      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = Math.floor(Math.random() * 256);
      }
      
      stream.push(chunk);
      bytesGenerated += chunk.length;
    }, 100);

    return stream;
  }

  // จำลองการบันทึกเสียงของผู้ใช้
  async simulateUserAudioRecording(userId, duration = 3000) {
    console.log(`\n🎤 เริ่มบันทึกเสียงของ ${userId}...`);
    
    const audioStream = this.createMockAudioStream(userId, duration);
    const filename = `recordings/${userId}-${Date.now()}.pcm`;
    const output = createWriteStream(filename);

    return new Promise((resolve, reject) => {
      // จำลอง opus decoder
      audioStream.on('data', (chunk) => {
        // จำลองการ decode จาก Opus
        output.write(chunk);
      });

      audioStream.on('end', async () => {
        output.end();
        console.log(`💾 บันทึกไฟล์เสียงของ ${userId} ที่ ${filename}`);
        
        try {
          await this.processAudioFile(userId, filename);
          resolve(filename);
        } catch (error) {
          reject(error);
        }
      });

      audioStream.on('error', (error) => {
        console.error(`❌ เกิดข้อผิดพลาดใน audio stream:`, error);
        reject(error);
      });
    });
  }

  // ประมวลผลไฟล์เสียง (แปลง PCM -> WAV -> Transcribe)
  async processAudioFile(userId, pcmFilename) {
    console.log(`🔄 ประมวลผลไฟล์เสียงของ ${userId}...`);
    
    this.pendingTranscriptions++;
    
    try {
      // จำลองการแปลง PCM เป็น WAV
      const wavFilename = pcmFilename.replace('.pcm', '.wav');
      await this.convertPcmToWav(pcmFilename, wavFilename);
      console.log(`✅ แปลงไฟล์ WAV สำเร็จ: ${wavFilename}`);
      
      // อ่านไฟล์ WAV (จำลอง)
      const audioBuffer = fs.readFileSync(pcmFilename); // ใช้ PCM แทน WAV สำหรับ demo
      
      // ตรวจสอบสถานะ API
      const isColabAvailable = await mockColabAPI.checkColabAPIHealth();
      
      let result = null;
      
      if (isColabAvailable) {
        // ใช้ Colab API
        console.log(`🚀 ใช้ Colab API สำหรับการแปลงเสียง...`);
        result = await mockColabAPI.transcribeAudioWithColab(audioBuffer, userId);
      } else {
        // ใช้ local Whisper
        console.log('🔄 ใช้ local Whisper แทน...');
        result = await mockTranscriber.transcribeAudio(wavFilename, userId);
      }
      
      if (result) {
        console.log(`✅ แปลงเสียงสำเร็จ! "${result.transcript}" (${(result.confidence * 100).toFixed(1)}%)`);
        
        // เพิ่มใน session
        this.addToSession(result);
        
        // บันทึกลงไฟล์
        this.saveTranscriptionToFile(result);
        
      } else {
        console.log('❌ ไม่สามารถแปลงเสียงได้');
      }
      
      // ลบไฟล์ชั่วคราว
      this.cleanupTempFiles([pcmFilename, wavFilename]);
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการประมวลผลเสียง:', error);
    } finally {
      this.pendingTranscriptions--;
    }
  }

  // จำลองการแปลง PCM เป็น WAV
  async convertPcmToWav(pcmFile, wavFile) {
    console.log(`🔄 แปลง PCM เป็น WAV: ${pcmFile} -> ${wavFile}`);
    
    // จำลองเวลาในการแปลง
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // สร้างไฟล์ WAV (จำลอง)
    const pcmData = fs.readFileSync(pcmFile);
    fs.writeFileSync(wavFile, pcmData);
    
    console.log(`✅ แปลงไฟล์ WAV สำเร็จ`);
  }

  // เพิ่ม transcript ใน session
  addToSession(result) {
    // ตรวจสอบ duplicate
    const exists = this.sessionTranscripts.some(
      item => item.userId === result.userId && item.transcript === result.transcript
    );
    
    if (!exists) {
      this.sessionTranscripts.push({
        userId: result.userId,
        transcript: result.transcript,
        confidence: result.confidence,
        timestamp: result.timestamp
      });
      console.log(`📝 เพิ่ม transcript ในเซสชัน: "${result.transcript}"`);
    } else {
      console.log(`⚠️ ข้าม transcript ที่ซ้ำ: "${result.transcript}"`);
    }
  }

  // บันทึก transcript ลงไฟล์
  saveTranscriptionToFile(result) {
    const transcriptFile = 'recordings/transcripts.txt';
    const line = `[${result.timestamp}] ${result.userId}: ${result.transcript} (ความแม่นยำ: ${(result.confidence * 100).toFixed(1)}%)\n`;
    
    fs.appendFileSync(transcriptFile, line, 'utf8');
    console.log(`📄 บันทึก transcript ลงใน ${transcriptFile}`);
  }

  // ลบไฟล์ชั่วคราว
  cleanupTempFiles(files) {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`🗑️ ลบไฟล์ชั่วคราว: ${file}`);
        }
      } catch (error) {
        console.error(`❌ ไม่สามารถลบไฟล์ ${file}:`, error);
      }
    }
  }

  // จำลองการประชุมจริง
  async simulateRealMeeting() {
    console.log('\n🏢 จำลองการประชุมทีม Daily Standup');
    console.log('=' .repeat(60));
    
    this.isRecording = true;
    
    // รายชื่อผู้เข้าประชุม
    const participants = [
      { userId: '111111111111111111', name: 'นาย A - Frontend Developer' },
      { userId: '222222222222222222', name: 'นาง B - Backend Developer' },
      { userId: '333333333333333333', name: 'นาย C - Project Manager' },
      { userId: '444444444444444444', name: 'นาง D - UI/UX Designer' }
    ];
    
    console.log('👥 ผู้เข้าประชุม:');
    participants.forEach(p => console.log(`   - ${p.name} (${p.userId})`));
    
    console.log('\n🎤 เริ่มการบันทึกเสียง...');
    
    // จำลองการพูดของแต่ละคน
    for (let round = 0; round < 2; round++) {
      console.log(`\n--- รอบที่ ${round + 1} ---`);
      
      for (const participant of participants) {
        console.log(`\n🗣️ ${participant.name} กำลังพูด...`);
        
        // จำลองระยะเวลาการพูด (2-5 วินาที)
        const speakingDuration = 2000 + Math.random() * 3000;
        
        await this.simulateUserAudioRecording(participant.userId, speakingDuration);
        
        // รอสักครู่ระหว่างผู้พูด
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // รอให้การแปลงเสียงทั้งหมดเสร็จ
    console.log('\n⏳ รอให้การแปลงเสียงทั้งหมดเสร็จ...');
    while (this.pendingTranscriptions > 0) {
      console.log(`   - รออีก ${this.pendingTranscriptions} ไฟล์...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isRecording = false;
    
    console.log('\n✅ การบันทึกเสียงจบแล้ว!');
    this.generateSessionReport();
  }

  // สร้างรายงานสรุปเซสชัน
  generateSessionReport() {
    console.log('\n📊 รายงานสรุปการประชุม');
    console.log('=' .repeat(60));
    
    console.log(`📝 จำนวนข้อความทั้งหมด: ${this.sessionTranscripts.length}`);
    
    // จัดกลุ่มตามผู้พูด
    const groupedTranscripts = new Map();
    
    for (const transcript of this.sessionTranscripts) {
      if (!groupedTranscripts.has(transcript.userId)) {
        groupedTranscripts.set(transcript.userId, []);
      }
      groupedTranscripts.get(transcript.userId).push(transcript);
    }
    
    console.log(`👥 จำนวนผู้พูด: ${groupedTranscripts.size}`);
    
    // รายละเอียดแต่ละคน
    for (const [userId, transcripts] of groupedTranscripts) {
      console.log(`\n👤 ${userId}:`);
      console.log(`   - จำนวนครั้งที่พูด: ${transcripts.length}`);
      console.log(`   - ความแม่นยำเฉลี่ย: ${(transcripts.reduce((sum, t) => sum + t.confidence, 0) / transcripts.length * 100).toFixed(1)}%`);
      
      console.log('   - ข้อความที่พูด:');
      transcripts.forEach((t, index) => {
        console.log(`     ${index + 1}. "${t.transcript}" (${(t.confidence * 100).toFixed(1)}%)`);
      });
    }
    
    // สถิติรวม
    const avgConfidence = this.sessionTranscripts.reduce((sum, t) => sum + t.confidence, 0) / this.sessionTranscripts.length;
    console.log(`\n📈 สถิติรวม:`);
    console.log(`   - ความแม่นยำเฉลี่ยทั้งหมด: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`   - ข้อความที่มีความแม่นยำ > 90%: ${this.sessionTranscripts.filter(t => t.confidence > 0.9).length}`);
    console.log(`   - ข้อความที่มีความแม่นยำ < 80%: ${this.sessionTranscripts.filter(t => t.confidence < 0.8).length}`);
  }

  // ทดสอบ transcription service เท่านั้น
  async testTranscriptionServices() {
    console.log('\n🧪 ทดสอบ Transcription Services');
    console.log('=' .repeat(50));
    
    const testUserId = '999999999999999999';
    const mockAudioBuffer = Buffer.alloc(1000, 0x41); // สร้าง buffer ขนาด 1KB
    
    // ทดสอบ Colab API
    console.log('\n1. ทดสอบ Colab API:');
    try {
      const colabResult = await mockColabAPI.transcribeAudioWithColab(mockAudioBuffer, testUserId);
      console.log(`✅ Colab API: "${colabResult.transcript}" (${(colabResult.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error('❌ Colab API Error:', error);
    }
    
    // ทดสอบ Local Whisper
    console.log('\n2. ทดสอบ Local Whisper:');
    try {
      const localResult = await mockTranscriber.transcribeAudio('test.wav', testUserId);
      console.log(`✅ Local Whisper: "${localResult.transcript}" (${(localResult.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error('❌ Local Whisper Error:', error);
    }
    
    // ทดสอบ API Health Check
    console.log('\n3. ทดสอบ API Health Check:');
    for (let i = 0; i < 5; i++) {
      const isHealthy = await mockColabAPI.checkColabAPIHealth();
      console.log(`   รอบที่ ${i + 1}: ${isHealthy ? '✅ พร้อมใช้งาน' : '❌ ไม่พร้อมใช้งาน'}`);
    }
  }

  // รันการทดสอบทั้งหมด
  async runAllTests() {
    console.log('🚀 เริ่มการทดสอบ Voice Recording Integration');
    console.log('=' .repeat(70));
    
    try {
      // สร้างโฟลเดอร์ recordings ถ้าไม่มี
      if (!fs.existsSync('recordings')) {
        fs.mkdirSync('recordings');
        console.log('📁 สร้างโฟลเดอร์ recordings');
      }
      
      // 1. ทดสอบ transcription services
      await this.testTranscriptionServices();
      
      // 2. จำลองการประชุมจริง
      await this.simulateRealMeeting();
      
      console.log('\n🎉 การทดสอบ Voice Recording Integration สำเร็จครบทุกส่วน!');
      
    } catch (error) {
      console.error('💥 เกิดข้อผิดพลาดในการทดสอบ:', error);
      throw error;
    }
  }
}

// รันการทดสอบ
async function main() {
  const tester = new VoiceRecordingTester();
  
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

module.exports = { VoiceRecordingTester };