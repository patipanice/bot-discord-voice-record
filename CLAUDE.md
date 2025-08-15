# Discord Voice Recorder Bot with ClickUp Integration

## Project Overview
A Discord voice recording bot with real-time Thai speech transcription and ClickUp task matching for daily standup automation. Uses Thonburian Whisper for Thai speech-to-text and matches transcripts with existing ClickUp tasks.

## Current Architecture (After Refactoring)

### 🏗️ BLL (Business Logic Layer) - `src/bll/`
- `TaskMatchingBLL`: Pure business logic for matching transcripts with ClickUp tasks
- `TranscriptValidationBLL`: Validation rules for filtering malformed transcripts
- `SessionManagementBLL`: Logic for session management and transcript grouping

### 🔧 Service Layer (Infrastructure) - `src/services/`
- `ClickUpService`: ClickUp API calls, connection testing, task loading
- `UserMappingService`: File I/O for Discord ID ↔ ClickUp email mapping
- `DiscordService`: Discord UI interactions, embed creation, message sending
- `TranscriptManagerService`: Data management for session transcripts

### 📁 Types - `src/types/`
- `clickup.types.ts`: ClickUp integration interfaces (NOT .interface.ts - deleted duplicate)
- `transcript.types.ts`: Transcript data structures

## Key Features Implemented
1. **Real-time transcript display**: Shows transcripts immediately in dedicated Discord channel
2. **Silent filtering**: Automatically filters malformed transcripts without showing errors
3. **ClickUp task matching**: Matches Thai speech with existing ClickUp tasks
4. **Interactive buttons**: Complete/To Do/Ignore actions for matched tasks
5. **Session management**: Groups transcripts by user for standup summaries

## Current Status
- ✅ Architecture refactored to proper Service/BLL separation
- ✅ Removed duplicate files (clickup.interface.ts)
- ✅ Fixed naming conventions (using .types.ts)
- ✅ Business logic separated from infrastructure concerns

## Next Steps (TODO for tomorrow)
1. **Complete bot.ts refactoring**:
   - Update remaining functions to use new Services/BLL
   - Replace old function calls with service methods
   - Update sendTranscriptToDiscord() function

2. **Testing and validation**:
   - Test the refactored system
   - Ensure all functionality works correctly
   - Run lint/typecheck commands

3. **Bug fixes if any**:
   - Fix import errors
   - Resolve any missing dependencies
   - Test ClickUp integration

## Key Files Modified Today
- `src/bll/task-matching.bll.ts` (NEW)
- `src/bll/transcript-validation.bll.ts` (NEW) 
- `src/bll/session-management.bll.ts` (NEW)
- `src/services/clickup.service.ts` (NEW)
- `src/services/discord.service.ts` (NEW)
- `src/services/transcript-manager.service.ts` (REFACTORED)
- `src/bot.ts` (PARTIALLY REFACTORED)

## Important Notes
- **Services** handle infrastructure (API calls, file I/O, Discord UI)
- **BLL** handles pure business logic (validation, matching algorithms)
- Real-time display is used for 20-person standup meetings
- Manager/co-project can monitor in dedicated bot channel
- Silent filtering prevents malformed transcripts from appearing

## Configuration
- User mapping: `config/user-mapping.json` (Discord ID → ClickUp email)
- Recording saves to: `recordings/` directory
- Channel settings saved to: `recordings/saved_channel.txt`

## Commands
- `!join` - Start voice recording
- `!leave` - Stop recording and send session summary
- `!setchannel` - Set channel for automatic transcripts
- `!status` - Check bot status
- `!help` - Show all commands