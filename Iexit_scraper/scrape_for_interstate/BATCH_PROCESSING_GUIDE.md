# 🚀 iExit Batch Processing - Complete Guide

## Overview

I've created a comprehensive batch processing system that will:
- Process all 539 Exit_Link entries from your states.csv file
- Handle session expiration automatically
- Save all results to a single combined CSV file
- Provide progress tracking and resume capabilities
- Include data analysis tools

## 📁 Files Created

The system consists of these files:

1. **`batch_processor.js`** - Main processing engine
2. **`batch_config.js`** - Configuration settings
3. **`run_batch_processor.js`** - Start fresh processing
4. **`resume_batch_processor.js`** - Resume interrupted processing
5. **`analyze_batch_data.js`** - Analyze collected data
6. **`test_batch_setup.js`** - Test system setup
7. **`README_BATCH_PROCESSING.md`** - Detailed documentation

## 🎯 Quick Start

### Step 1: Test the Setup
```bash
node test_batch_setup.js
```

### Step 2: Get a Curl Command Ready
Before starting, you'll need a curl command from the iExit website:
1. Open your browser and go to https://www.iexitapp.com
2. Navigate to any exit page (e.g., Alabama I-10 exits)
3. Open Developer Tools (F12)
4. Go to the Network tab
5. Refresh the page
6. Right-click on the main request → Copy → Copy as cURL
7. Keep this command ready for the next step

### Step 3: Start Batch Processing
```bash
node run_batch_processor.js
```
The system will prompt you for the curl command during initialization.

### Step 4: Monitor Progress
The system will show real-time progress:
- Current batch being processed
- Success/failure counts
- Estimated time remaining

### Step 4: Handle Session Expiration
When the session expires (every ~30 minutes), the system will:
1. Pause automatically
2. Ask for a new curl command
3. Resume processing

### Step 5: Analyze Results
```bash
node analyze_batch_data.js
```

## 🔧 Configuration

Edit `batch_config.js` to customize:
- **BATCH_SIZE**: 10 entries per batch (recommended)
- **DELAYS**: Time between requests and batches
- **SESSION_TIMEOUT**: When to refresh sessions
- **OUTPUT_DIR**: Where to save results

## 📊 Output Files

All files are saved in the `batch_output` directory:

### Primary Output
- **`combined_exit_data.csv`** - All scraped data in one file with these columns:
  - batch_id, processing_timestamp
  - state, highway, source_url
  - exit_id, title, exit_name, exit_description, exit_location
  - iexit_detail_link, latitude, longitude, google_maps_link
  - direction, processing_status, error_message

### Progress Files
- **`batch_progress.json`** - Current progress tracking
- **`batch_summary.json`** - Final processing summary
- **`data_analysis.json`** - Detailed analysis results

### Generated Files
- **`cleaned_exit_data.csv`** - Only successful records (via analyzer)

## 🔄 Session Management

The system automatically handles session expiration:

1. **When session expires:**
   - System detects timeout
   - Pauses processing
   - Prompts for new curl command

2. **Getting new curl command:**
   - Open browser to iExit site
   - Open Developer Tools (F12)
   - Go to Network tab
   - Navigate to any exit page
   - Right-click request → Copy → Copy as cURL
   - Paste when prompted

3. **System resumes:**
   - Continues from where it left off
   - No data loss

## 📈 Progress Tracking

The system provides comprehensive progress tracking:

### Real-time Status
- Current batch: X/Y
- Current entry: X/539
- Success rate: X%
- Time elapsed
- Estimated time remaining

### Resume Capability
If interrupted, simply run:
```bash
node resume_batch_processor.js
```

The system will:
- Load previous progress
- Continue from where it stopped
- Preserve all collected data

## 🛠️ Error Handling

The system handles various error conditions:

### Network Issues
- Timeouts → Retry with exponential backoff
- Cloudflare challenges → Pause for manual intervention
- Connection errors → Log and continue

### Data Issues
- No exits found → Mark as NO_DATA
- Invalid coordinates → Mark as N/A
- Missing information → Continue with available data

### Session Issues
- Expired sessions → Request refresh
- Authentication failures → Prompt for new curl
- Rate limiting → Increase delays

## 📊 Data Analysis

The analyzer provides comprehensive insights:

### Success Metrics
- Overall success rate
- State-by-state breakdown
- Highway-by-highway analysis
- Batch performance

### Data Quality
- Coordinate availability
- Direction coverage
- Error patterns
- Missing data identification

### Export Options
- Full dataset (all records)
- Cleaned dataset (successful only)
- JSON analysis results
- Custom filtered exports

## 🎛️ Customization

### Adjust Processing Speed
```javascript
// In batch_config.js
DELAYS: {
    BETWEEN_BATCHES: 60000,    // 1 minute (increase for slower)
    BETWEEN_REQUESTS: 5000,    // 5 seconds (increase for slower)
}
```

### Change Batch Size
```javascript
BATCH_SIZE: 10,  // Smaller = more reliable, larger = faster
```

### Error Handling
```javascript
ERROR_HANDLING: {
    CONTINUE_ON_ERROR: true,    // Keep going despite errors
    MAX_CONSECUTIVE_ERRORS: 5,  // Stop after X consecutive errors
}
```

## 🚨 Important Notes

### Performance Tips
- Run during off-peak hours
- Monitor first few batches
- Keep curl commands ready
- Use stable internet connection

### Best Practices
- Don't interrupt during processing
- Let session expiration handle itself
- Check data quality regularly
- Use cleaned CSV for analysis

### Expected Timeline
- 539 entries ÷ 10 per batch = 54 batches
- ~2 minutes per batch = ~108 minutes
- Including delays and session refresh: ~3-4 hours

## 🔍 Monitoring

### Real-time Monitoring
Watch the console for:
- Batch progress
- Success/failure rates
- Session status
- Error patterns

### File Monitoring
Check these files for status:
- `batch_progress.json` - Current progress
- `combined_exit_data.csv` - Growing dataset
- Error logs in console

## 🎯 Next Steps

1. **Run the test** to verify setup
2. **Start processing** with run_batch_processor.js
3. **Monitor progress** in real-time
4. **Handle session expiration** as needed
5. **Analyze results** when complete
6. **Use cleaned data** for your analysis

## 🆘 Troubleshooting

### Common Issues
- **"No such file"** → Check file paths in config
- **"Cannot find module"** → Verify all files are present
- **"Session expired"** → Provide new curl command
- **"Processing stopped"** → Use resume script

### Recovery Steps
1. Check progress file for last position
2. Use resume script to continue
3. Analyze partial results if needed
4. Contact support if issues persist

## 📞 Support

If you encounter issues:
1. Check the progress files
2. Review error messages
3. Use the resume functionality
4. Analyze partial results

The system is designed to be robust and handle most issues automatically. The batch processing will give you a complete dataset of all exits across all states and highways!

---

**Ready to start? Run: `node run_batch_processor.js`**
