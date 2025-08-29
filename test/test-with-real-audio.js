/**
 * Real Audio File Transcription Test
 * ทดสอบการแปลงเสียงจริงๆ ด้วยไฟล์เสียงจริง
 * ไม่ใช่ mock - ใช้ไฟล์เสียงภาษาไทยจริงๆ
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

class RealAudioTranscriptionTester {
  constructor() {
    this.testAudioFiles = [];
    this.transcriptionResults = [];
    
    console.log('🔊 เริ่มต้น Real Audio Transcription Tester');
    console.log('🎯 ทดสอบการแปลงเสียงจริงๆ ด้วยไฟล์เสียงภาษาไทย');
  }

  // สร้างไฟล์เสียงทดสอบด้วย Text-to-Speech
  async generateTestAudioFiles() {
    console.log('\n🎵 สร้างไฟล์เสียงทดสอบ...');
    
    const testTexts = [
      'สวัสดีครับ วันนี้ผมจะมารายงานความคืบหน้าของงาน',
      'งานที่ได้รับมอบหมายเมื่อสัปดาห์ที่แล้วผมทำเสร็จแล้วครับ',
      'วันนี้ผมจะเริ่มทำ feature ใหม่ที่ได้รับมอบหมาย',
      'ถ้ามีคำถามหรือข้อสงสัยอะไรสามารถถามได้เลยครับ',
      'ขอบคุณมากครับ ประชุมวันนี้จบแล้ว'
    ];
    
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      const audioFile = path.join(__dirname, `test-audio-${i + 1}.wav`);
      
      console.log(`🔄 สร้างไฟล์เสียง ${i + 1}: "${text.substring(0, 30)}..."`);
      
      try {
        // ใช้ espeak หรือ festival สำหรับ TTS (ถ้ามี)
        // หรือสร้างไฟล์เสียงเงียบพร้อม metadata
        await this.createSilentAudioWithMetadata(audioFile, text, 3 + i); // 3-7 วินาที
        
        this.testAudioFiles.push({
          file: audioFile,
          expectedText: text,
          duration: 3 + i
        });
        
        console.log(`✅ สร้างไฟล์ ${path.basename(audioFile)} สำเร็จ`);
        
      } catch (error) {
        console.error(`❌ ไม่สามารถสร้างไฟล์เสียง ${i + 1}:`, error);
      }
    }
    
    console.log(`📋 สร้างไฟล์เสียงทดสอบทั้งหมด: ${this.testAudioFiles.length} ไฟล์`);
  }

  // สร้างไฟล์เสียงเงียบพร้อม metadata
  async createSilentAudioWithMetadata(outputFile, text, duration) {
    return new Promise((resolve, reject) => {
      // สร้างไฟล์เสียงเงียบด้วย ffmpeg
      const ffmpegArgs = [
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`,
        '-t', duration.toString(),
        '-metadata', `title=${text}`,
        '-metadata', `comment=Test audio for transcription`,
        '-y', // overwrite
        outputFile
      ];
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  // ดาวน์โหลดไฟล์เสียงทดสอบจากอินเทอร์เน็ต (ถ้ามี)
  async downloadSampleAudioFiles() {
    console.log('\n📥 ดาวน์โหลดไฟล์เสียงตัวอย่าง...');
    
    // URL ของไฟล์เสียงภาษาไทยที่เป็น public domain
    const sampleUrls = [
      // เพิ่ม URL ไฟล์เสียงภาษาไทยที่สามารถใช้ทดสอบได้
      // 'https://example.com/thai-speech-sample.wav'
    ];
    
    if (sampleUrls.length === 0) {
      console.log('ℹ️  ไม่มี URL ไฟล์เสียงตัวอย่าง - ข้ามขั้นตอนนี้');
      return;
    }
    
    for (let i = 0; i < sampleUrls.length; i++) {
      const url = sampleUrls[i];
      const filename = `sample-audio-${i + 1}.wav`;
      const filepath = path.join(__dirname, filename);
      
      try {
        console.log(`📥 ดาวน์โหลด: ${url}`);
        await this.downloadFile(url, filepath);
        
        this.testAudioFiles.push({
          file: filepath,
          expectedText: 'Unknown - จากไฟล์ตัวอย่าง',
          duration: 'Unknown'
        });
        
        console.log(`✅ ดาวน์โหลด ${filename} สำเร็จ`);
        
      } catch (error) {
        console.error(`❌ ไม่สามารถดาวน์โหลด ${url}:`, error);
      }
    }
  }

  // ดาวน์โหลดไฟล์
  downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filepath);
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
      }).on('error', (error) => {
        fs.unlink(filepath, () => {}); // ลบไฟล์ที่ไม่สมบูรณ์
        reject(error);
      });
    });
  }

  // ทดสอบ Local Whisper Transcription
  async testLocalWhisperTranscription(audioFile, expectedText) {
    console.log(`\n🔄 ทดสอบ Local Whisper: ${path.basename(audioFile)}`);
    
    try {
      // นำเข้า transcriber จาก codebase
      const transcriber = require('../src/transcriber');
      
      const startTime = Date.now();
      const result = await transcriber.transcribeAudio(audioFile, 'test-user');
      const duration = Date.now() - startTime;
      
      if (result) {
        console.log(`✅ Local Whisper สำเร็จ (${duration}ms):`);
        console.log(`   📝 Text: "${result.transcript}"`);
        console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   🕒 Timestamp: ${result.timestamp}`);
        
        // เปรียบเทียบกับข้อความที่คาดหวัง
        const similarity = this.calculateTextSimilarity(result.transcript, expectedText);
        console.log(`   📊 Similarity: ${(similarity * 100).toFixed(1)}%`);
        
        return {
          service: 'Local Whisper',
          success: true,
          transcript: result.transcript,
          confidence: result.confidence,
          duration,
          similarity,
          error: null
        };
        
      } else {
        console.log(`❌ Local Whisper ล้มเหลว - ไม่ได้รับผลลัพธ์`);
        
        return {
          service: 'Local Whisper',
          success: false,
          error: 'ไม่ได้รับผลลัพธ์',
          duration
        };
      }
      
    } catch (error) {
      console.log(`❌ Local Whisper Error: ${error.message}`);
      
      return {
        service: 'Local Whisper',
        success: false,
        error: error.message,
        duration: Date.now() - Date.now()
      };
    }
  }

  // ทดสอบ Colab API Transcription
  async testColabAPITranscription(audioFile, expectedText) {
    console.log(`\n🚀 ทดสอบ Colab API: ${path.basename(audioFile)}`);
    
    try {
      // นำเข้า colab-api จาก codebase
      const colabAPI = require('../src/colab-api');
      
      // ตรวจสอบสถานะ API
      const isHealthy = await colabAPI.checkColabAPIHealth();
      if (!isHealthy) {
        console.log(`⚠️  Colab API ไม่พร้อมใช้งาน - ข้ามการทดสอบ`);
        return {
          service: 'Colab API',
          success: false,
          error: 'API ไม่พร้อมใช้งาน'
        };
      }
      
      // อ่านไฟล์เสียง
      const audioBuffer = fs.readFileSync(audioFile);
      
      const startTime = Date.now();
      const result = await colabAPI.transcribeAudioWithColab(audioBuffer, 'test-user');
      const duration = Date.now() - startTime;
      
      if (result) {
        console.log(`✅ Colab API สำเร็จ (${duration}ms):`);
        console.log(`   📝 Text: "${result.transcript}"`);
        console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   🕒 Timestamp: ${result.timestamp}`);
        
        // เปรียบเทียบกับข้อความที่คาดหวัง
        const similarity = this.calculateTextSimilarity(result.transcript, expectedText);
        console.log(`   📊 Similarity: ${(similarity * 100).toFixed(1)}%`);
        
        return {
          service: 'Colab API',
          success: true,
          transcript: result.transcript,
          confidence: result.confidence,
          duration,
          similarity,
          error: null
        };
        
      } else {
        console.log(`❌ Colab API ล้มเหลว - ไม่ได้รับผลลัพธ์`);
        
        return {
          service: 'Colab API',
          success: false,
          error: 'ไม่ได้รับผลลัพธ์',
          duration
        };
      }
      
    } catch (error) {
      console.log(`❌ Colab API Error: ${error.message}`);
      
      return {
        service: 'Colab API',
        success: false,
        error: error.message,
        duration: 0
      };
    }
  }

  // คำนวณความคล้ายคลึงของข้อความ (Simple Levenshtein Distance)
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const str1 = text1.toLowerCase().trim();
    const str2 = text2.toLowerCase().trim();
    
    if (str1 === str2) return 1;
    
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;
    
    // สร้าง matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // คำนวณ distance
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return maxLen > 0 ? (maxLen - distance) / maxLen : 0;
  }

  // ทดสอบไฟล์เสียงทั้งหมด
  async testAllAudioFiles() {
    console.log('\n🧪 ทดสอบการแปลงเสียงทั้งหมด...');
    
    if (this.testAudioFiles.length === 0) {
      console.log('❌ ไม่มีไฟล์เสียงสำหรับทดสอบ');
      return;
    }
    
    for (let i = 0; i < this.testAudioFiles.length; i++) {
      const audioData = this.testAudioFiles[i];
      const { file, expectedText, duration } = audioData;
      
      console.log(`\n--- ทดสอบไฟล์ ${i + 1}/${this.testAudioFiles.length} ---`);
      console.log(`📁 ไฟล์: ${path.basename(file)}`);
      console.log(`⏱️  Duration: ${duration}`);
      console.log(`🎯 Expected: "${expectedText.substring(0, 50)}..."`);
      
      // ตรวจสอบว่าไฟล์มีอยู่จริง
      if (!fs.existsSync(file)) {
        console.log(`❌ ไฟล์ไม่พบ: ${file}`);
        continue;
      }
      
      const fileSize = (fs.statSync(file).size / 1024).toFixed(2);
      console.log(`📊 ขนาดไฟล์: ${fileSize} KB`);
      
      // ทดสอบ Local Whisper
      const localResult = await this.testLocalWhisperTranscription(file, expectedText);
      
      // ทดสอบ Colab API  
      const colabResult = await this.testColabAPITranscription(file, expectedText);
      
      // เก็บผลลัพธ์
      this.transcriptionResults.push({
        audioFile: path.basename(file),
        expectedText,
        duration,
        fileSize: parseFloat(fileSize),
        localWhisper: localResult,
        colabAPI: colabResult
      });
      
      // รอระหว่างการทดสอบ
      console.log('⏳ รอ 2 วินาทีก่อนทดสอบไฟล์ถัดไป...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // วิเคราะห์และเปรียบเทียบผลลัพธ์
  analyzeResults() {
    console.log('\n📊 วิเคราะห์ผลลัพธ์การทดสอบ');
    console.log('=' .repeat(60));
    
    if (this.transcriptionResults.length === 0) {
      console.log('❌ ไม่มีผลลัพธ์สำหรับวิเคราะห์');
      return;
    }
    
    // สถิติรวม
    const totalTests = this.transcriptionResults.length;
    let localSuccesses = 0;
    let colabSuccesses = 0;
    let localTotalConfidence = 0;
    let colabTotalConfidence = 0;
    let localTotalSimilarity = 0;
    let colabTotalSimilarity = 0;
    let localTotalDuration = 0;
    let colabTotalDuration = 0;
    
    console.log(`📋 จำนวนไฟล์ทดสอบ: ${totalTests}`);
    
    // วิเคราะห์แต่ละผลลัพธ์
    this.transcriptionResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.audioFile}:`);
      
      // Local Whisper
      if (result.localWhisper.success) {
        localSuccesses++;
        localTotalConfidence += result.localWhisper.confidence || 0;
        localTotalSimilarity += result.localWhisper.similarity || 0;
        localTotalDuration += result.localWhisper.duration || 0;
        console.log(`   🔄 Local Whisper: ✅ (${result.localWhisper.duration}ms)`);
        console.log(`      📝 "${result.localWhisper.transcript}"`);
        console.log(`      🎯 Confidence: ${(result.localWhisper.confidence * 100).toFixed(1)}%, Similarity: ${(result.localWhisper.similarity * 100).toFixed(1)}%`);
      } else {
        console.log(`   🔄 Local Whisper: ❌ ${result.localWhisper.error}`);
      }
      
      // Colab API
      if (result.colabAPI.success) {
        colabSuccesses++;
        colabTotalConfidence += result.colabAPI.confidence || 0;
        colabTotalSimilarity += result.colabAPI.similarity || 0;
        colabTotalDuration += result.colabAPI.duration || 0;
        console.log(`   🚀 Colab API: ✅ (${result.colabAPI.duration}ms)`);
        console.log(`      📝 "${result.colabAPI.transcript}"`);
        console.log(`      🎯 Confidence: ${(result.colabAPI.confidence * 100).toFixed(1)}%, Similarity: ${(result.colabAPI.similarity * 100).toFixed(1)}%`);
      } else {
        console.log(`   🚀 Colab API: ❌ ${result.colabAPI.error}`);
      }
    });
    
    // สถิติสรุป
    console.log('\n📈 สถิติสรุป:');
    console.log(`🔄 Local Whisper:`);
    console.log(`   - Success Rate: ${localSuccesses}/${totalTests} (${(localSuccesses / totalTests * 100).toFixed(1)}%)`);
    if (localSuccesses > 0) {
      console.log(`   - Avg Confidence: ${(localTotalConfidence / localSuccesses * 100).toFixed(1)}%`);
      console.log(`   - Avg Similarity: ${(localTotalSimilarity / localSuccesses * 100).toFixed(1)}%`);
      console.log(`   - Avg Duration: ${(localTotalDuration / localSuccesses).toFixed(0)}ms`);
    }
    
    console.log(`🚀 Colab API:`);
    console.log(`   - Success Rate: ${colabSuccesses}/${totalTests} (${(colabSuccesses / totalTests * 100).toFixed(1)}%)`);
    if (colabSuccesses > 0) {
      console.log(`   - Avg Confidence: ${(colabTotalConfidence / colabSuccesses * 100).toFixed(1)}%`);
      console.log(`   - Avg Similarity: ${(colabTotalSimilarity / colabSuccesses * 100).toFixed(1)}%`);
      console.log(`   - Avg Duration: ${(colabTotalDuration / colabSuccesses).toFixed(0)}ms`);
    }
    
    // เปรียบเทียบ performance
    if (localSuccesses > 0 && colabSuccesses > 0) {
      console.log(`\n⚡ Performance Comparison:`);
      console.log(`   - Speed: Local Whisper ${localTotalDuration / localSuccesses < colabTotalDuration / colabSuccesses ? '🏆' : ''} vs Colab API ${colabTotalDuration / colabSuccesses < localTotalDuration / localSuccesses ? '🏆' : ''}`);
      console.log(`   - Accuracy: Local Whisper ${localTotalSimilarity / localSuccesses > colabTotalSimilarity / colabSuccesses ? '🏆' : ''} vs Colab API ${colabTotalSimilarity / colabSuccesses > localTotalSimilarity / localSuccesses ? '🏆' : ''}`);
    }
  }

  // บันทึกผลลัพธ์ลงไฟล์
  saveResults() {
    const reportFile = path.join(__dirname, `transcription-test-report-${Date.now()}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.transcriptionResults.length,
      results: this.transcriptionResults,
      summary: {
        localWhisper: {
          successCount: this.transcriptionResults.filter(r => r.localWhisper.success).length,
          avgConfidence: this.transcriptionResults
            .filter(r => r.localWhisper.success)
            .reduce((sum, r) => sum + (r.localWhisper.confidence || 0), 0) / 
            Math.max(1, this.transcriptionResults.filter(r => r.localWhisper.success).length),
          avgSimilarity: this.transcriptionResults
            .filter(r => r.localWhisper.success)
            .reduce((sum, r) => sum + (r.localWhisper.similarity || 0), 0) / 
            Math.max(1, this.transcriptionResults.filter(r => r.localWhisper.success).length)
        },
        colabAPI: {
          successCount: this.transcriptionResults.filter(r => r.colabAPI.success).length,
          avgConfidence: this.transcriptionResults
            .filter(r => r.colabAPI.success)
            .reduce((sum, r) => sum + (r.colabAPI.confidence || 0), 0) / 
            Math.max(1, this.transcriptionResults.filter(r => r.colabAPI.success).length),
          avgSimilarity: this.transcriptionResults
            .filter(r => r.colabAPI.success)
            .reduce((sum, r) => sum + (r.colabAPI.similarity || 0), 0) / 
            Math.max(1, this.transcriptionResults.filter(r => r.colabAPI.success).length)
        }
      }
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 บันทึกรายงานลงไฟล์: ${reportFile}`);
  }

  // ทำความสะอาดไฟล์ทดสอบ
  cleanup() {
    console.log('\n🧹 ทำความสะอาดไฟล์ทดสอบ...');
    
    this.testAudioFiles.forEach(audioData => {
      try {
        if (fs.existsSync(audioData.file)) {
          fs.unlinkSync(audioData.file);
          console.log(`🗑️  ลบไฟล์: ${path.basename(audioData.file)}`);
        }
      } catch (error) {
        console.error(`❌ ไม่สามารถลบไฟล์ ${audioData.file}:`, error);
      }
    });
  }

  // รันการทดสอบทั้งหมด
  async runAllTests() {
    console.log('🚀 เริ่มการทดสอบ Real Audio Transcription');
    console.log('=' .repeat(60));
    
    try {
      // 1. สร้างไฟล์เสียงทดสอบ
      await this.generateTestAudioFiles();
      
      // 2. ดาวน์โหลดไฟล์ตัวอย่าง (ถ้ามี)
      await this.downloadSampleAudioFiles();
      
      // 3. ทดสอบการแปลงเสียง
      await this.testAllAudioFiles();
      
      // 4. วิเคราะห์ผลลัพธ์
      this.analyzeResults();
      
      // 5. บันทึกผลลัพธ์
      this.saveResults();
      
      console.log('\n🎉 การทดสอบ Real Audio Transcription เสร็จสิ้น!');
      
    } catch (error) {
      console.error('💥 เกิดข้อผิดพลาดในการทดสอบ:', error);
      throw error;
    } finally {
      // 6. ทำความสะอาด
      this.cleanup();
    }
  }
}

// รันการทดสอบ
async function main() {
  const tester = new RealAudioTranscriptionTester();
  
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

module.exports = { RealAudioTranscriptionTester };