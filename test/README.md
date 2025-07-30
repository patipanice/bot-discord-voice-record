# Test Scripts

## 🧪 Available Tests

### 1. Task Matcher Test
```bash
node test/test-task-matcher.js
```
ทดสอบ Task Matching Algorithm พร้อม:
- Keyword extraction
- Speech-to-task matching
- Multi-language support (Thai + English)
- Confidence scoring

### 2. ClickUp API Test  
```bash
node test/test-clickup-api.js
```
ทดสอบ ClickUp API integration:
- Authentication
- Team access
- Spaces listing
- Tasks retrieval

## 📊 Test Results

### Task Matcher Performance:
- **Success Rate:** 100% (9/9 test cases)
- **High Confidence:** 88.9% (8/9 matches)
- **Multi-language:** ✅ Thai + English mixed

### ClickUp API Status:
- **Authentication:** ✅ Connected
- **Team Access:** ✅ "Test-Bot-Discord-Voice-Record"
- **Tasks Found:** ✅ 7 sample tasks created

## 🚀 Usage

เรียกใช้ทั้งหมด:
```bash
# Run all tests
npm run test:all

# Individual tests
npm run test:matcher
npm run test:clickup
```

## 📝 Sample Data

### Test Tasks:
1. User Authentication System
2. Login Feature Implementation  
3. Database Integration
4. API Endpoint Development
5. Frontend Dashboard
6. Unit Testing Setup
7. Bug Fixes and Optimization

### Test Speeches:
- "วันนี้ทำ user auth ครับ"
- "login feature เสร็จแล้ว"
- "กำลังทำ api endpoint อยู่"
- "dashboard ทำเสร็จแล้วครับ"