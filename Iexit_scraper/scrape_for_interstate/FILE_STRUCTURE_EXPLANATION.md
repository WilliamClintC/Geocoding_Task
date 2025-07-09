# iExit Scraper Files Explanation

## 📋 **MAIN SCRAPER FILES**

### 1. **`1_iexit_scraper.js`** - States List Scraper
- **Purpose**: Scrapes the main states page (https://www.iexitapp.com/states)
- **What it does**: 
  - Extracts all states and their exit links
  - Creates a comprehensive list of all exit pages
  - Saves to States.csv file
- **Use case**: Run this FIRST to get the list of all exit pages
- **Output**: `States.csv` with columns: State, Highway, Exit_Link

### 2. **`3_coordinate_scraper.js`** - Individual Exit Scraper
- **Purpose**: Scrapes individual exit pages for coordinates
- **What it does**:
  - Takes a single exit URL and extracts all exit coordinates
  - Handles both directions (Eastbound/Westbound, etc.)
  - Extracts coordinates from JavaScript map data
- **Use case**: Test scraping on a single exit page
- **Output**: Individual CSV files with exit coordinates

## 🔄 **BATCH PROCESSING SYSTEM**

### 3. **`batch_processor.js`** - Core Batch Processing Engine
- **Purpose**: The main batch processing class/library
- **What it does**:
  - Contains the BatchProcessor class
  - Handles session management and expiration
  - Processes multiple exits automatically
  - Manages progress tracking and error handling
- **Use case**: This is the ENGINE - not run directly
- **Output**: Combined CSV files with all processed exits

### 4. **`run_batch_processor.js`** - Batch Processing Launcher
- **Purpose**: The MAIN SCRIPT to run batch processing
- **What it does**:
  - Imports BatchProcessor class
  - Provides user interface and confirmations
  - Handles initialization and setup
  - Manages the entire batch processing workflow
- **Use case**: Run this to process ALL exits from States.csv
- **Output**: Processes all 539+ exit links automatically

### 5. **`resume_batch_processor.js`** - Resume Interrupted Processing
- **Purpose**: Continue batch processing from where it left off
- **What it does**:
  - Loads previous progress from batch_progress.json
  - Continues from the last processed entry
  - Handles interrupted sessions
- **Use case**: If batch processing was interrupted, use this to continue
- **Output**: Continues processing from last checkpoint

## 🛠️ **UTILITY FILES**

### 6. **`batch_config.js`** - Configuration Settings
- **Purpose**: Central configuration for batch processing
- **Contains**: 
  - File paths and directories
  - Timing settings and delays
  - Batch sizes and retry settings
  - Error handling configuration

### 7. **`launcher.bat`** - Windows Batch Launcher
- **Purpose**: Easy Windows command-line launcher
- **What it does**:
  - Changes to correct directory
  - Runs setup tests
  - Shows available commands
  - Provides menu of options
- **Use case**: Double-click to launch on Windows

## 🧪 **TEST FILES**

### 8. **`test_batch_setup.js`** - Setup Verification
- **Purpose**: Test if batch processing setup is correct
- **Checks**: Required files, directories, Node.js modules

### 9. **`test_curl_input.js`** - cURL Command Testing
- **Purpose**: Test if your cURL command works properly

### 10. **`test_ad_dismissal.js`** - Ad Handling Testing
- **Purpose**: Test ad dismissal functionality

## 📊 **ANALYSIS FILES**

### 11. **`analyze_batch_data.js`** - Data Analysis
- **Purpose**: Analyze collected batch data
- **What it does**: Statistics, success rates, data quality analysis

## ❌ **FAILED/DEPRECATED FILES**

### 12. **`FAIL_webpage_downloader.js`** - Deprecated
- **Purpose**: Old approach that didn't work well

### 13. **`Fail_2_coordinate_scraper.js`** - Deprecated
- **Purpose**: Previous version that had issues

---

## 🎯 **WHICH FILE TO USE WHEN?**

### **For Complete Automation (Recommended)**:
1. **First time**: `node run_batch_processor.js`
2. **If interrupted**: `node resume_batch_processor.js`
3. **Windows users**: Double-click `launcher.bat`

### **For Testing/Development**:
1. **Test single exit**: `node 3_coordinate_scraper.js`
2. **Get states list**: `node 1_iexit_scraper.js`
3. **Test setup**: `node test_batch_setup.js`

### **For Analysis**:
1. **Analyze results**: `node analyze_batch_data.js`

---

## 📁 **FILE RELATIONSHIP DIAGRAM**

```
launcher.bat (Windows launcher)
    ↓
run_batch_processor.js (Main script)
    ↓
batch_processor.js (Core engine)
    ↓
3_coordinate_scraper.js (Individual scraper)
    ↓
batch_output/ (Results folder)
```

## 🔧 **SIMPLE WORKFLOW**

1. **Windows users**: Double-click `launcher.bat`
2. **Command line users**: Run `node run_batch_processor.js`
3. **If interrupted**: Run `node resume_batch_processor.js`
4. **All files save to**: `batch_output/` folder

## 📊 **KEY DIFFERENCES**

| File | Purpose | Run Directly? | Processes | Output |
|------|---------|---------------|-----------|---------|
| `1_iexit_scraper.js` | Get states list | ✅ Yes | States page | States.csv |
| `3_coordinate_scraper.js` | Single exit | ✅ Yes | 1 exit page | Individual CSV |
| `batch_processor.js` | Core engine | ❌ No (library) | N/A | N/A |
| `run_batch_processor.js` | Main batch | ✅ Yes | All exits | Combined CSV |
| `resume_batch_processor.js` | Resume batch | ✅ Yes | Remaining exits | Combined CSV |
| `launcher.bat` | Windows launcher | ✅ Yes | Shows menu | N/A |

## 🎯 **BOTTOM LINE**

- **Most users should run**: `run_batch_processor.js` (or `launcher.bat` on Windows)
- **If it stops**: Use `resume_batch_processor.js`
- **For testing**: Use `3_coordinate_scraper.js`
- **The other files**: Support files, configs, and tests
