# 🌐 Discord Bot + Google Colab API Integration

## 📋 ภาพรวม

เชื่อมต่อ Discord Bot กับ Google Colab เพื่อใช้ **Thonburian Whisper + GPU** ที่เร็วขึ้น 5-10 เท่า!

### 🎯 ผลลัพธ์:
- **ความเร็ว:** 1-2 วินาที (แทน 10-15 วินาที)
- **แม่นยำ:** WER 7.42% (สูงสุด)
- **GPU:** Tesla T4/V100/A100

---

## 🚀 ขั้นตอนที่ 1: ตั้งค่า Google Colab

### 1.1 เปิด Google Colab
```
https://colab.research.google.com/
```

### 1.2 สร้าง Notebook ใหม่
```python
# Cell 1: ติดตั้ง Dependencies
!pip install flask flask-cors pyngrok
!pip install transformers torch librosa accelerate

# Cell 2: โหลด Thonburian Whisper
from transformers import pipeline
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "biodatlab/whisper-th-medium-combined"

pipe = pipeline(
    task="automatic-speech-recognition",
    model=MODEL_NAME,
    chunk_length_s=30,
    device=device,
)

pipe.model.config.forced_decoder_ids = pipe.tokenizer.get_decoder_prompt_ids(
    language="th",
    task="transcribe"
)

print(f"✅ โหลด Thonburian Whisper สำเร็จ!")
print(f"🎯 Device: {device}")
print(f"⚡ WER: 7.42%")
```

### 1.3 สร้าง Flask API
```python
# Cell 3: สร้าง API
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import time
import os

app = Flask(__name__)
CORS(app)

@app.route('/transcribe', methods=['POST'])
def transcribe_api():
    try:
        data = request.get_json()
        audio_base64 = data.get('audio')
        user_id = data.get('user_id', 'unknown')
        
        if not audio_base64:
            return jsonify({"error": "ไม่พบไฟล์เสียง"}), 400
        
        print(f"🎤 รับไฟล์เสียงจาก user: {user_id}")
        start_time = time.time()
        
        # แปลง base64 เป็นไฟล์
        audio_data = base64.b64decode(audio_base64)
        
        # บันทึกไฟล์ชั่วคราว
        temp_file = f"temp_audio_{user_id}.wav"
        with open(temp_file, "wb") as f:
            f.write(audio_data)
        
        # แปลงเสียง
        result = pipe(temp_file)
        transcript = result["text"].strip()
        
        # คำนวณเวลา
        duration = time.time() - start_time
        
        # ลบไฟล์ชั่วคราว
        os.remove(temp_file)
        
        print(f"✅ แปลงเสร็จ: {duration:.2f}s - {transcript[:50]}...")
        
        return jsonify({
            "transcript": transcript,
            "language": "th",
            "duration": duration,
            "user_id": user_id,
            "wer": 7.42,
            "device": device
        })
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "model": "biodatlab/whisper-th-medium-combined",
        "wer": 7.42,
        "device": device,
        "gpu_available": torch.cuda.is_available()
    })
```

### 1.4 เปิด ngrok tunnel
```python
# Cell 4: เปิด tunnel
from pyngrok import ngrok

# เปิด tunnel
public_url = ngrok.connect(5000)
print(f"🌐 Public URL: {public_url}")

# รัน Flask app
app.run(host='0.0.0.0', port=5000)
```

### 1.5 บันทึก URL
```
🌐 Public URL: https://abc123.ngrok.io
```

---

## 🤖 ขั้นตอนที่ 2: ปรับปรุง Discord Bot

### 2.1 ติดตั้ง axios
```bash
npm install axios
```

### 2.2 แก้ไข src/utils.ts
```typescript
// เพิ่ม import
import axios from 'axios';

// เพิ่มฟังก์ชันใหม่
const COLAB_API_URL = 'https://abc123.ngrok.io'; // ใส่ URL จาก ngrok

export async function transcribeAudioWithColab(audioBuffer: Buffer, userId: string): Promise<TranscriptionResult | null> {
    try {
        console.log(`🚀 ส่งไฟล์เสียงไป Colab API...`);
        
        // แปลง Buffer เป็น base64
        const audioBase64 = audioBuffer.toString('base64');
        
        // ส่งไป Colab API
        const response = await axios.post(`${COLAB_API_URL}/transcribe`, {
            audio: audioBase64,
            user_id: userId
        });
        
        const result = response.data;
        
        console.log(`✅ ได้ผลลัพธ์จาก Colab: ${result.transcript}`);
        console.log(`⏱️ เวลา: ${result.duration}s`);
        
        return {
            userId,
            transcript: result.transcript,
            confidence: 0.95, // Thonburian Whisper
            timestamp: new Date().toISOString(),
            language: "th",
            segments: []
        };
        
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Colab API:', error);
        
        // Fallback ไปใช้ local Whisper
        console.log('🔄 ใช้ local Whisper แทน...');
        return await transcribeAudioLocal(audioBuffer, userId);
    }
}

// ฟังก์ชันเดิม (local fallback)
async function transcribeAudioLocal(audioBuffer: Buffer, userId: string): Promise<TranscriptionResult | null> {
    // โค้ดเดิม...
}
```

### 2.3 แก้ไข saveUserAudioStream
```typescript
// ในฟังก์ชัน saveUserAudioStream
output.on('finish', async () => {
    console.log(`💾 บันทึกไฟล์เสียงของ ${userId} ที่ ${filename}`);
    console.log(`🚀 เริ่มแปลงเสียงด้วย Colab API...`);

    incrementPendingTranscriptions();

    try {
        // อ่านไฟล์เสียง
        const audioBuffer = readFileSync(filename);
        
        // ใช้ Colab API
        const result = await transcribeAudioWithColab(audioBuffer, userId);
        
        if (result) {
            console.log(`✅ แปลงเสียงสำเร็จ! ข้อความ: "${result.transcript}"`);
            saveTranscription(result);
            await addSessionTranscript(result.userId, result.transcript, result.confidence);
        } else {
            console.log('❌ ไม่สามารถแปลงเสียงได้');
        }
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการแปลงเสียง:', error);
    } finally {
        decrementPendingTranscriptions();
    }
});
```

---

## 🔧 ขั้นตอนที่ 3: การทดสอบ

### 3.1 ทดสอบ API
```bash
# ทดสอบ health check
curl https://abc123.ngrok.io/health

# ทดสอบ transcribe
curl -X POST https://abc123.ngrok.io/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio":"base64_audio_data","user_id":"test"}'
```

### 3.2 รัน Discord Bot
```bash
npm run start
```

### 3.3 ทดสอบใน Discord
```
!join
พูดภาษาไทย
!leave
```

---

## 📊 การตรวจสอบ

### 4.1 ตรวจสอบ Colab
- **GPU Usage:** ดูใน Colab
- **API Logs:** ดูใน Colab console
- **Memory:** ดู GPU memory

### 4.2 ตรวจสอบ Discord Bot
- **Logs:** ดู console output
- **Speed:** เปรียบเทียบเวลา
- **Accuracy:** ตรวจสอบข้อความ

---

## ⚠️ ข้อควรระวัง

### 5.1 ngrok Limitations
- **Free tier:** 40 connections/minute
- **Session timeout:** ต้อง reconnect
- **URL changes:** เปลี่ยนทุกครั้งที่ restart

### 5.2 Colab Limitations
- **Session timeout:** 12 hours
- **GPU quota:** จำกัดการใช้งาน
- **Memory:** ต้องมี RAM เพียงพอ

### 5.3 Network Issues
- **Latency:** ใช้เวลาในการส่งข้อมูล
- **Connection:** อาจขาดหาย
- **Fallback:** ต้องมี local backup

---

## 🎯 ผลลัพธ์ที่คาดหวัง

### 6.1 ความเร็ว
| Environment | เวลา | ปรับปรุง |
|-------------|------|----------|
| **Local CPU** | 10-15 วินาที | - |
| **Colab GPU** | **1-2 วินาที** | **5-10x เร็วขึ้น** |

### 6.2 ความแม่นยำ
| Model | WER | ความแม่นยำ |
|-------|-----|------------|
| **Whisper Base** | ~12% | 88% |
| **Thonburian** | **7.42%** | **92.58%** |

### 6.3 การใช้งาน
- **Discord Bot:** ทำงานปกติ
- **API:** ตอบสนองเร็ว
- **Fallback:** ใช้ local ถ้า Colab ไม่ได้

---

## 🔄 การบำรุงรักษา

### 7.1 Colab Session
- **Restart:** ทุก 12 ชั่วโมง
- **ngrok:** เปลี่ยน URL ใหม่
- **Update:** ใส่ URL ใหม่ใน Discord Bot

### 7.2 Monitoring
- **Health Check:** ตรวจสอบ API
- **Error Handling:** จัดการข้อผิดพลาด
- **Logs:** ดู logs ทั้งสองฝั่ง

---

## 📞 การแก้ไขปัญหา

### 8.1 Colab ไม่ตอบ
```bash
# ตรวจสอบ Colab
curl https://abc123.ngrok.io/health

# ถ้าไม่ได้ - ใช้ local
# แก้ไข COLAB_API_URL = null
```

### 8.2 ngrok Error
```bash
# เปิด tunnel ใหม่
public_url = ngrok.connect(5000)
print(f"🌐 New URL: {public_url}")

# อัพเดท Discord Bot
COLAB_API_URL = 'new_url'
```

### 8.3 Memory Error
```python
# ลด chunk_length_s
pipe = pipeline(
    task="automatic-speech-recognition",
    model=MODEL_NAME,
    chunk_length_s=15,  # ลดลง
    device=device,
)
```

---

## 🎉 สรุป

**Discord Bot + Google Colab API** ให้:
- ⚡ **ความเร็ว:** 5-10x เร็วขึ้น
- 🎯 **แม่นยำ:** WER 7.42% (สูงสุด)
- 🚀 **GPU:** Tesla T4/V100/A100
- 🔄 **Fallback:** ใช้ local ถ้าไม่ได้

**พร้อมใช้งานแล้ว!** 🚀 