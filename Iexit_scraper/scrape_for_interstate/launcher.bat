@echo off
echo 🚀 iExit Batch Processor Launcher
echo =====================================
echo.
echo This script will:
echo 1. Change to the correct directory
echo 2. Run the batch processor setup test
echo 3. Launch the batch processor if tests pass
echo.

cd /d "c:\Users\clint\Desktop\Geocoding_Task\Iexit_scraper\scrape_for_interstate"

echo 📁 Changed to: %CD%
echo.

echo 🧪 Running setup test...
node test_batch_setup.js

echo.
echo 🎯 If tests passed, you can now run:
echo    node run_batch_processor.js
echo.
echo 📋 Available commands:
echo    node run_batch_processor.js     - Start fresh batch processing
echo    node resume_batch_processor.js  - Resume interrupted processing
echo    node analyze_batch_data.js      - Analyze collected data
echo    node test_curl_input.js         - Test curl command input
echo.

pause
