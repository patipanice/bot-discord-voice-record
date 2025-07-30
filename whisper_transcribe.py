#!/usr/bin/env python3
import sys
import ssl
import urllib.request
import whisper
import os
import warnings
import librosa
import soundfile as sf
import numpy as np

# Suppress warnings
warnings.filterwarnings("ignore")

# Bypass SSL verification
ssl._create_default_https_context = ssl._create_unverified_context

def check_audio_file(wav_file_path):
    """ตรวจสอบไฟล์เสียงอย่างละเอียด"""
    try:
        # ตรวจสอบว่าไฟล์มีอยู่จริง
        if not os.path.exists(wav_file_path):
            print(f"❌ ไฟล์ไม่พบ: {wav_file_path}", file=sys.stderr)
            return False, None
        
        # ตรวจสอบขนาดไฟล์
        file_size = os.path.getsize(wav_file_path)
        if file_size == 0:
            print(f"⚠️ ไฟล์เสียงว่างเปล่า: {wav_file_path}", file=sys.stderr)
            return False, None
        
        print(f"📁 ขนาดไฟล์: {file_size} bytes", file=sys.stderr)
        
        # ลองอ่านไฟล์ด้วย librosa
        try:
            audio, sr = librosa.load(wav_file_path, sr=16000)
            print(f"🎵 อ่านไฟล์เสียงสำเร็จ: {len(audio)} samples, {sr}Hz", file=sys.stderr)
            
            # ตรวจสอบว่าไฟล์เสียงไม่ว่างเปล่า
            if len(audio) == 0:
                print(f"⚠️ ไฟล์เสียงว่างเปล่า: {wav_file_path}", file=sys.stderr)
                return False, None
            
            # ตรวจสอบว่าไฟล์เสียงไม่เงียบเกินไป
            max_amplitude = np.max(np.abs(audio))
            if max_amplitude < 0.001:  # ลด threshold ลง
                print(f"⚠️ ไฟล์เสียงเงียบเกินไป (max amplitude: {max_amplitude}): {wav_file_path}", file=sys.stderr)
                return False, None
            
            print(f"✅ ไฟล์เสียงผ่านการตรวจสอบ (max amplitude: {max_amplitude})", file=sys.stderr)
            return True, (audio, sr)
            
        except Exception as e:
            print(f"❌ ไม่สามารถอ่านไฟล์เสียงได้: {e}", file=sys.stderr)
            return False, None
            
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการตรวจสอบไฟล์: {e}", file=sys.stderr)
        return False, None

def fix_audio_file(wav_file_path):
    """แก้ไขไฟล์เสียงที่มีปัญหา"""
    try:
        # ตรวจสอบไฟล์ก่อน
        is_valid, audio_data = check_audio_file(wav_file_path)
        if not is_valid:
            return None
        
        audio, sr = audio_data
        
        # บันทึกไฟล์ใหม่ในรูปแบบที่ถูกต้อง
        fixed_path = wav_file_path.replace('.wav', '_fixed.wav')
        sf.write(fixed_path, audio, sr, subtype='PCM_16')
        
        print(f"✅ แก้ไขไฟล์เสียงสำเร็จ: {fixed_path}", file=sys.stderr)
        return fixed_path
        
    except Exception as e:
        print(f"❌ ไม่สามารถแก้ไขไฟล์เสียงได้: {e}", file=sys.stderr)
        return None

def transcribe_audio(wav_file_path):
    try:
        # ตรวจสอบและแก้ไขไฟล์เสียงก่อน
        fixed_file = fix_audio_file(wav_file_path)
        if fixed_file:
            wav_file_path = fixed_file
        else:
            # ถ้าไม่สามารถแก้ได้ ให้ลองใช้ไฟล์เดิม
            is_valid, _ = check_audio_file(wav_file_path)
            if not is_valid:
                print(f"❌ ไม่สามารถใช้ไฟล์เสียงได้: {wav_file_path}", file=sys.stderr)
                return None
        
        # Load Thonburian Whisper model (ภาษาไทยโดยเฉพาะ)
        print(f"Loading Thonburian Whisper model...", file=sys.stderr)
        try:
            # ใช้ Thonburian Whisper (ภาษาไทยโดยเฉพาะ - แม่นยำสูงสุด)
            print(f"🎯 ใช้ Thonburian Whisper (ภาษาไทยโดยเฉพาะ)...", file=sys.stderr)
            
            from transformers import pipeline
            
            MODEL_NAME = "biodatlab/whisper-th-medium-combined"
            device = "cpu"  # ใช้ CPU เพื่อความเสถียร
            
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
            
            # แปลงเสียง
            result = pipe(wav_file_path)
            transcript = result["text"].strip()
            language = "th"
            segments = result.get("chunks", [])
            
        except Exception as e:
            print(f"⚠️ ไม่สามารถใช้ Whisper ได้: {e}", file=sys.stderr)
            return None
        
        # Return transcript with additional info
        # transcript, language, segments ถูกกำหนดไว้แล้วใน try/except block
        
        # กรองข้อความที่ไม่เหมาะสม
        if transcript:
            # ลบข้อความที่ซ้ำกันมากเกินไป
            if len(set(transcript)) < len(transcript) * 0.3:  # ถ้ามีตัวอักษรซ้ำมากเกินไป
                transcript = transcript[:50] + "..." if len(transcript) > 50 else transcript
            
            # ลบข้อความที่สั้นเกินไป
            if len(transcript.strip()) < 3:
                transcript = ""
            
            print(f"Transcript: {transcript}", file=sys.stderr)
            print(f"Language: Thai", file=sys.stderr)
            print(f"Segments: {len(segments)}", file=sys.stderr)
            
            # Return JSON format with all info
            import json
            output = {
                "transcript": transcript,
                "language": language,
                "segments": segments
            }
            print(json.dumps(output))
            return transcript
        else:
            print("No transcript generated", file=sys.stderr)
            return None
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 whisper_transcribe.py <wav_file_path>", file=sys.stderr)
        sys.exit(1)
    
    wav_file = sys.argv[1]
    if not os.path.exists(wav_file):
        print(f"Error: File {wav_file} not found", file=sys.stderr)
        sys.exit(1)
    
    transcript = transcribe_audio(wav_file)
    if transcript:
        print(transcript)
        sys.exit(0)
    else:
        sys.exit(1) 