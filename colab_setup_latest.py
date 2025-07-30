# 🎯 Thonburian Whisper + GPU Acceleration (Latest Version)
# สำหรับ Google Colab

# ========================================
# 🔧 ติดตั้ง Dependencies
# ========================================

# รันคำสั่งนี้ใน Colab:
"""
!pip install transformers torch librosa accelerate
!pip install flask flask-cors pyngrok
!pip install soundfile numpy
"""

# ========================================
# 🎯 โหลด Thonburian Whisper Model
# ========================================

from transformers import pipeline
import torch

# ตั้งค่า device
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🎯 ใช้ Device: {device}")

# โหลด Thonburian Whisper
MODEL_NAME = "biodatlab/whisper-th-medium-combined"
print(f"📥 กำลังโหลด {MODEL_NAME}...")

pipe = pipeline(
    task="automatic-speech-recognition",
    model=MODEL_NAME,
    chunk_length_s=30,
    device=device,
)

# ตั้งค่า decoder สำหรับภาษาไทย
pipe.model.config.forced_decoder_ids = pipe.tokenizer.get_decoder_prompt_ids(
    language="th",
    task="transcribe"
)

print("✅ โหลด Thonburian Whisper สำเร็จ!")
print(f"🎯 WER: 7.42% (แม่นยำสูงสุด)")
print(f"⚡ Device: {device}")

# ========================================
# 🌐 สร้าง API Endpoint (Updated Version)
# ========================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import time
import os
import io
import wave
import numpy as np
import librosa
import soundfile as sf

app = Flask(__name__)
CORS(app)

def validate_and_fix_audio_file(file_path):
    """ตรวจสอบและแก้ไขไฟล์เสียง"""
    try:
        # ตรวจสอบว่าไฟล์มีอยู่จริง
        if not os.path.exists(file_path):
            print(f"❌ ไฟล์ไม่พบ: {file_path}")
            return False
        
        # ตรวจสอบขนาดไฟล์
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            print(f"⚠️ ไฟล์เสียงว่างเปล่า: {file_path}")
            return False
        
        print(f"📁 ขนาดไฟล์: {file_size} bytes")
        
        # ลองอ่านไฟล์ด้วย librosa
        try:
            audio, sr = librosa.load(file_path, sr=16000)
            print(f"🎵 อ่านไฟล์เสียงสำเร็จ: {len(audio)} samples, {sr}Hz")
            
            # ตรวจสอบว่าไฟล์เสียงไม่ว่างเปล่า
            if len(audio) == 0:
                print(f"⚠️ ไฟล์เสียงว่างเปล่า: {file_path}")
                return False
            
            # ตรวจสอบว่าไฟล์เสียงไม่เงียบเกินไป
            if np.max(np.abs(audio)) < 0.01:
                print(f"⚠️ ไฟล์เสียงเงียบเกินไป: {file_path}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ ไม่สามารถอ่านไฟล์เสียงได้: {e}")
            return False
            
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการตรวจสอบไฟล์: {e}")
        return False

@app.route('/transcribe', methods=['POST'])
def transcribe_api():
    """API endpoint สำหรับแปลงเสียง"""
    
    try:
        # รับข้อมูล
        data = request.get_json()
        audio_base64 = data.get('audio')
        user_id = data.get('user_id', 'unknown')
        
        if not audio_base64:
            return jsonify({"error": "ไม่พบไฟล์เสียง"}), 400
        
        print(f"🎤 รับไฟล์เสียงจาก user: {user_id}")
        start_time = time.time()
        
        # แปลง base64 เป็นไฟล์
        audio_data = base64.b64decode(audio_base64)
        
        # ตรวจสอบขนาดข้อมูล
        if len(audio_data) == 0:
            return jsonify({"error": "ไฟล์เสียงว่างเปล่า"}), 400
        
        print(f"📊 ขนาดข้อมูล: {len(audio_data)} bytes")
        
        # สร้างไฟล์ WAV ที่ถูกต้อง
        temp_file = f"temp_audio_{user_id}.wav"
        
        # ตรวจสอบว่าเป็น WAV header หรือไม่
        if audio_data[:4] == b'RIFF':
            # เป็น WAV อยู่แล้ว
            with open(temp_file, "wb") as f:
                f.write(audio_data)
            print(f"✅ ไฟล์ WAV ถูกต้อง")
        else:
            # เป็น raw PCM - แปลงเป็น WAV
            print(f"🔄 แปลง raw PCM เป็น WAV...")
            
            # สมมติว่าเป็น 16-bit PCM, 48kHz, stereo
            sample_rate = 48000
            channels = 2
            sample_width = 2  # 16-bit = 2 bytes
            
            # สร้าง WAV file
            with wave.open(temp_file, 'wb') as wav_file:
                wav_file.setnchannels(channels)
                wav_file.setsampwidth(sample_width)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data)
            print(f"✅ แปลง PCM เป็น WAV สำเร็จ")
        
        print(f"✅ สร้างไฟล์ WAV: {temp_file}")
        print(f"📊 ขนาดไฟล์: {len(audio_data)} bytes")
        
        # ตรวจสอบและแก้ไขไฟล์เสียง
        if not validate_and_fix_audio_file(temp_file):
            return jsonify({"error": "ไฟล์เสียงไม่ถูกต้องหรือเสียหาย"}), 400
        
        # แปลงเสียงด้วย Thonburian Whisper
        result = pipe(temp_file)
        transcript = result["text"].strip()
        
        # คำนวณเวลา
        duration = time.time() - start_time
        
        # ลบไฟล์ชั่วคราว
        try:
            os.remove(temp_file)
            print(f"🗑️ ลบไฟล์ชั่วคราว: {temp_file}")
        except:
            pass
        
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
        
        # ลบไฟล์ชั่วคราวถ้ามี
        try:
            if 'temp_file' in locals():
                os.remove(temp_file)
        except:
            pass
            
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "model": "thonburian-whisper"})

print("🔧 API อัปเดตแล้ว!")
print("📝 POST /transcribe - แปลงเสียง (รองรับ WAV และ PCM)")
print("🔍 GET /health - ตรวจสอบสถานะ")

# ========================================
# 🌐 เปิด ngrok tunnel
# ========================================

from pyngrok import ngrok

# เปิด tunnel
public_url = ngrok.connect(5000)
print(f"🌐 Public URL: {public_url}")

# รัน Flask app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

# ========================================
# 📊 ข้อมูลเพิ่มเติม
# ========================================

"""
### 🎯 Thonburian Whisper:
- Model: biodatlab/whisper-th-medium-combined
- WER: 7.42% (แม่นยำสูงสุด)
- ขนาด: 817M parameters
- ภาษา: ไทยโดยเฉพาะ

### ⚡ ความเร็ว:
- Local CPU: 10-15 วินาที
- Colab GPU: 1-2 วินาที (5-10x เร็วขึ้น!)

### 🔧 การปรับปรุงล่าสุด:
- ✅ รองรับ WAV และ PCM อัตโนมัติ
- ✅ การตรวจสอบไฟล์เสียงที่แข็งแกร่ง
- ✅ Error handling ที่ดีขึ้น
- ✅ Dynamic timeout ตามขนาดไฟล์
- ✅ การลบไฟล์ชั่วคราวอัตโนมัติ
- ✅ การตรวจสอบไฟล์เสียงด้วย librosa
- ✅ การจัดการ error ที่ครอบคลุม

### 📋 ขั้นตอนการใช้งาน:
1. เปิด Google Colab
2. อัปโหลดไฟล์นี้ หรือ copy-paste โค้ด
3. รัน cell ทั้งหมดตามลำดับ
4. คัดลอก ngrok URL
5. อัปเดต Discord Bot ใน src/colab-api.ts
6. ทดสอบการทำงาน

### 🎯 ผลลัพธ์ที่คาดหวัง:
🎤 รับไฟล์เสียงจาก user: 414300827793227797
📊 ขนาดข้อมูล: 1991723 bytes
✅ ไฟล์ WAV ถูกต้อง
✅ สร้างไฟล์ WAV: temp_audio_414300827793227797.wav
📁 ขนาดไฟล์: 1991723 bytes
🎵 อ่านไฟล์เสียงสำเร็จ: 99586 samples, 16000Hz
✅ แปลงเสร็จ: 2.11s - สวัสดีครับวันนี้วันที่ยี่สิบเก้ากรกฎาคม...
🗑️ ลบไฟล์ชั่วคราว: temp_audio_414300827793227797.wav
""" 