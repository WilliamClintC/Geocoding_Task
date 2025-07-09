const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { CoordinateScraper } = require('./3_coordinate_scraper');
const BATCH_CONFIG = require('./batch_config');

// Add stealth plugin
puppeteer.use(StealthPlugin());

class BatchProcessor {
    constructor() {
        this.progress = {
            currentBatch: 0,
            processedCount: 0,
            totalCount: 0,
            failedUrls: [],
            sessionStartTime: Date.now(),
            lastSuccessfulRequest: Date.now()
        };
        this.stateData = [];
        this.allResults = [];
        this.scraper = null;
        this.sessionExpired = false;
        this.browserConfig = null; // Store browser configuration
    }

    // Get initial curl command from user
    async getInitialCurlCommand() {
        console.log('\n🔧 CURL COMMAND SETUP');
        console.log('='.repeat(40));
        console.log('To scrape the iExit website, we need a curl command with proper headers.');
        console.log('');
        console.log('How to get a curl command:');
        console.log('1. Open your browser and go to https://www.iexitapp.com');
        console.log('2. Navigate to any exit page (e.g., an Alabama I-10 exit)');
        console.log('3. Open Developer Tools (F12)');
        console.log('4. Go to the Network tab');
        console.log('5. Refresh the page');
        console.log('6. Right-click on the main request → Copy → Copy as cURL');
        console.log('7. Paste the command below');
        console.log('');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question('Please paste your curl command (or press Enter to use default config): ', (curlCommand) => {
                rl.close();
                
                if (curlCommand.trim()) {
                    console.log('✅ Curl command received, parsing...');
                    const config = this.parseCurlCommand(curlCommand);
                    this.browserConfig = config;
                    console.log(`📋 Parsed ${Object.keys(config.headers).length} headers`);
                    console.log(`🍪 Found ${config.cookies.length} cookies`);
                } else {
                    console.log('⚠️  Using default configuration (may have limited success)');
                    this.browserConfig = null;
                }
                
                this.progress.sessionStartTime = Date.now();
                this.progress.lastSuccessfulRequest = Date.now();
                this.sessionExpired = false;
                
                resolve();
            });
        });
    }

    // Initialize batch processing
    async initialize() {
        console.log('🚀 Initializing Batch Processor...');
        
        // Create output directory
        if (!fs.existsSync(BATCH_CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(BATCH_CONFIG.OUTPUT_DIR, { recursive: true });
            console.log(`📁 Created output directory: ${BATCH_CONFIG.OUTPUT_DIR}`);
        }

        // Get initial curl command
        await this.getInitialCurlCommand();

        // Load states data
        this.loadStatesData();
        
        // Load previous progress if exists
        this.loadProgress();
        
        // Initialize combined CSV file
        this.initializeCombinedCsv();
        
        console.log(`✅ Batch processor initialized`);
        console.log(`📊 Total entries to process: ${this.stateData.length}`);
        console.log(`📊 Already processed: ${this.progress.processedCount}`);
        console.log(`📊 Remaining: ${this.stateData.length - this.progress.processedCount}`);
    }

    // Load states data from CSV
    loadStatesData() {
        console.log('📄 Loading States.csv file...');
        
        try {
            const csvContent = fs.readFileSync(BATCH_CONFIG.STATES_CSV_PATH, 'utf8');
            const lines = csvContent.split('\n');
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            
            this.stateData = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    // Parse CSV line handling quoted fields
                    const values = [];
                    let currentValue = '';
                    let inQuotes = false;
                    
                    for (let j = 0; j < line.length; j++) {
                        const char = line[j];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            values.push(currentValue.trim());
                            currentValue = '';
                        } else {
                            currentValue += char;
                        }
                    }
                    values.push(currentValue.trim()); // Add the last value
                    
                    // Create state object
                    const stateObj = {};
                    headers.forEach((header, index) => {
                        stateObj[header] = values[index] ? values[index].replace(/"/g, '') : '';
                    });
                    
                    // Only add entries with valid Exit_Link
                    if (stateObj.Exit_Link && stateObj.Exit_Link.trim() !== '' && stateObj.Exit_Link !== 'No exits found') {
                        this.stateData.push(stateObj);
                    }
                }
            }
            
            this.progress.totalCount = this.stateData.length;
            console.log(`✅ Loaded ${this.stateData.length} valid exit links from states.csv`);
            
        } catch (error) {
            console.error('❌ Error loading states.csv:', error.message);
            throw error;
        }
    }

    // Load previous progress
    loadProgress() {
        const progressPath = path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.PROGRESS_FILE);
        
        if (fs.existsSync(progressPath)) {
            try {
                const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
                this.progress = { ...this.progress, ...progressData };
                console.log(`📊 Loaded previous progress: ${this.progress.processedCount}/${this.progress.totalCount} completed`);
            } catch (error) {
                console.log('⚠️  Could not load previous progress, starting fresh');
            }
        }
    }

    // Save progress
    saveProgress() {
        const progressPath = path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.PROGRESS_FILE);
        try {
            fs.writeFileSync(progressPath, JSON.stringify(this.progress, null, 2));
            console.log(`💾 Progress saved: ${this.progress.processedCount}/${this.progress.totalCount}`);
        } catch (error) {
            console.error('❌ Error saving progress:', error.message);
        }
    }

    // Initialize combined CSV file
    initializeCombinedCsv() {
        const csvPath = path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.COMBINED_OUTPUT_FILE);
        
        // Only create header if file doesn't exist
        if (!fs.existsSync(csvPath)) {
            const headers = [
                'batch_id',
                'processing_timestamp',
                'state',
                'highway',
                'source_url',
                'exit_id',
                'title',
                'exit_name',
                'exit_description',
                'exit_location',
                'iexit_detail_link',
                'latitude',
                'longitude',
                'google_maps_link',
                'direction',
                'processing_status',
                'error_message'
            ];
            
            fs.writeFileSync(csvPath, headers.join(',') + '\n');
            console.log(`📄 Created combined CSV file: ${csvPath}`);
        }
    }

    // Enhanced session expiration check with comprehensive detection
    async checkSessionExpiry() {
        const sessionAge = Date.now() - this.progress.sessionStartTime;
        const timeSinceLastRequest = Date.now() - this.progress.lastSuccessfulRequest;
        
        // Check for time-based expiration
        if (sessionAge > BATCH_CONFIG.SESSION_TIMEOUT || timeSinceLastRequest > BATCH_CONFIG.SESSION_TIMEOUT) {
            this.sessionExpired = true;
            console.log('⏰ Session expired based on time');
            return true;
        }
        
        // Check for page-based expiration if scraper exists
        if (this.scraper && this.scraper.page) {
            try {
                const sessionStatus = await this.scraper.page.evaluate(() => {
                    const bodyText = document.body.textContent.toLowerCase();
                    const pageTitle = document.title.toLowerCase();
                    
                    // Check for session expiration indicators
                    const sessionExpiredIndicators = [
                        'verifying you are human',
                        'checking your browser',
                        'captcha',
                        'verification is taking longer than expected',
                        'needs to review the security of your connection',
                        'enable javascript and cookies to continue',
                        'challenge-error-text',
                        'cf-turnstile-response'
                    ];
                    
                    // Check for the specific HTML structure from the user's example
                    const hasMainContent = document.querySelector('.main-content');
                    const hasVerificationMessage = document.querySelector('#bkObw1');
                    const hasLoadingRing = document.querySelector('.lds-ring');
                    
                    const hasSessionExpiredText = sessionExpiredIndicators.some(indicator => 
                        bodyText.includes(indicator) || pageTitle.includes(indicator)
                    );
                    
                    return {
                        isSessionExpired: hasSessionExpiredText || (hasMainContent && hasVerificationMessage),
                        hasMainContent: !!hasMainContent,
                        hasVerificationMessage: !!hasVerificationMessage,
                        hasLoadingRing: !!hasLoadingRing,
                        bodyText: bodyText.substring(0, 500) // First 500 chars for debugging
                    };
                });
                
                if (sessionStatus.isSessionExpired) {
                    this.sessionExpired = true;
                    console.log('🚨 Session expired based on page content');
                    console.log('   - Has main content:', sessionStatus.hasMainContent);
                    console.log('   - Has verification message:', sessionStatus.hasVerificationMessage);
                    console.log('   - Has loading ring:', sessionStatus.hasLoadingRing);
                    console.log('   - Body text preview:', sessionStatus.bodyText.substring(0, 200) + '...');
                    
                    // Play notification sound
                    this.playNotificationSound();
                    
                    return true;
                }
            } catch (error) {
                console.log('⚠️  Could not check page for session expiration:', error.message);
            }
        }
        
        return false;
    }

    // Request new session configuration from user
    async requestSessionRefresh() {
        // Play notification sound to alert user
        this.playNotificationSound();
        
        console.log('\n� 🚨 SESSION REFRESH REQUIRED 🚨 🔔');
        console.log('='.repeat(50));
        console.log('🎵 SOUND NOTIFICATION: New cURL command needed!');
        console.log('The session has expired and needs to be refreshed.');
        console.log('Please provide a new curl command to continue.');
        console.log('');
        console.log('How to get a fresh curl command:');
        console.log('1. Open your browser and go to https://www.iexitapp.com');
        console.log('2. Navigate to any exit page');
        console.log('3. Open Developer Tools (F12)');
        console.log('4. Go to the Network tab');
        console.log('5. Refresh the page');
        console.log('6. Right-click on the main request → Copy → Copy as cURL');
        console.log('7. Paste the command below');
        console.log('');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question('Do you want to continue with session refresh? (y/n): ', (answer) => {
                if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                    rl.question('Please paste the new curl command: ', (curlCommand) => {
                        rl.close();
                        
                        if (curlCommand.trim()) {
                            console.log('✅ New curl command received, parsing...');
                            const config = this.parseCurlCommand(curlCommand);
                            this.browserConfig = config;
                            console.log(`📋 Parsed ${Object.keys(config.headers).length} headers`);
                            console.log(`🍪 Found ${config.cookies.length} cookies`);
                            
                            this.progress.sessionStartTime = Date.now();
                            this.progress.lastSuccessfulRequest = Date.now();
                            this.sessionExpired = false;
                            resolve(config);
                        } else {
                            console.log('❌ No curl command provided');
                            resolve(false);
                        }
                    });
                } else {
                    rl.close();
                    resolve(false); // User wants to stop
                }
            });
        });
    }

    // Simple curl command parser
    parseCurlCommand(curlCommand) {
        const config = {
            headers: {},
            cookies: []
        };
        
        // Extract headers
        const headerMatches = curlCommand.match(/-H\s+['"]([^'"]+)['"]|\s--header\s+['"]([^'"]+)['"]/g);
        if (headerMatches) {
            headerMatches.forEach(match => {
                const headerContent = match.replace(/-H\s+['"]|--header\s+['"]|['"]/g, '');
                const [key, ...valueParts] = headerContent.split(':');
                if (key && valueParts.length > 0) {
                    config.headers[key.trim().toLowerCase()] = valueParts.join(':').trim();
                }
            });
        }
        
        // Extract cookies
        const cookieMatch = curlCommand.match(/-b\s+['"]([^'"]+)['"]|\s--cookie\s+['"]([^'"]+)['"]/);
        if (cookieMatch) {
            const cookieString = cookieMatch[1] || cookieMatch[2];
            const cookies = cookieString.split(';').map(cookie => {
                const [name, value] = cookie.trim().split('=');
                return { 
                    name: name.trim(), 
                    value: value ? value.trim() : '',
                    domain: '.iexitapp.com', // Add domain for iExit website
                    path: '/' // Add path
                };
            });
            config.cookies = cookies;
        }
        
        return config;
    }

    // Process a single batch
    async processBatch(batchIndex) {
        const batchStart = batchIndex * BATCH_CONFIG.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_CONFIG.BATCH_SIZE, this.stateData.length);
        const batchData = this.stateData.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Processing Batch ${batchIndex + 1}`);
        console.log(`📊 Items ${batchStart + 1} to ${batchEnd} of ${this.stateData.length}`);
        console.log(`🎯 Batch contains ${batchData.length} entries`);
        
        // Check session expiry
        if (this.checkSessionExpiry()) {
            const refreshResult = await this.requestSessionRefresh();
            if (refreshResult === false) {
                console.log('🛑 User stopped the process');
                return false;
            }
        }

        // Initialize scraper with browser configuration (reuse if exists)
        try {
            if (!this.scraper) {
                this.scraper = new CoordinateScraper(this.browserConfig);
            }
            
            // Always reinitialize browser for each batch to ensure clean state
            if (this.scraper.browser) {
                await this.scraper.browser.close();
            }
            
            await this.scraper.initBrowser();
            console.log('✅ Browser initialized for batch processing');
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error.message);
            return false;
        }

        // Process each entry in the batch
        for (let i = 0; i < batchData.length; i++) {
            const entry = batchData[i];
            const globalIndex = batchStart + i;
            
            // Skip if already processed
            if (globalIndex < this.progress.processedCount) {
                console.log(`⏭️  Skipping already processed item ${globalIndex + 1}: ${entry.State} - ${entry.Highway}`);
                continue;
            }
            
            console.log(`\n🔄 Processing item ${globalIndex + 1}/${this.stateData.length}: ${entry.State} - ${entry.Highway}`);
            
            // Check for session expiration before processing each entry
            if (await this.checkSessionExpiry()) {
                console.log('🚨 Session expired during batch processing');
                
                // Request session refresh
                const refreshResult = await this.requestSessionRefresh();
                
                if (!refreshResult) {
                    console.log('❌ Session refresh cancelled or failed. Stopping batch processing.');
                    return false;
                }
                
                // Reinitialize scraper with new session
                if (this.scraper) {
                    if (this.scraper.browser) {
                        await this.scraper.browser.close();
                    }
                    this.scraper.browserConfig = refreshResult;
                    await this.scraper.initBrowser();
                }
                
                console.log('✅ Session refreshed successfully. Continuing batch processing...');
            }

            const result = await this.processEntryWithDirectionHandling(entry, globalIndex);
            
            if (result) {
                this.progress.processedCount++;
                this.progress.lastSuccessfulRequest = Date.now();
            } else {
                this.progress.failedUrls.push({
                    index: globalIndex,
                    state: entry.State,
                    highway: entry.Highway,
                    url: entry.Exit_Link,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Save progress after each entry
            this.saveProgress();
            
            // Delay between requests
            if (i < batchData.length - 1) {
                console.log(`⏱️  Waiting ${BATCH_CONFIG.DELAYS.BETWEEN_REQUESTS}ms before next request...`);
                await this.sleep(BATCH_CONFIG.DELAYS.BETWEEN_REQUESTS);
            }
        }
        
        // Close browser after batch
        if (this.scraper && this.scraper.browser) {
            await this.scraper.browser.close();
            console.log('🔒 Browser closed after batch completion');
        }
        
        return true;
    }

    // Process a single entry
    async processEntry(entry, globalIndex) {
        const batchId = Math.floor(globalIndex / BATCH_CONFIG.BATCH_SIZE) + 1;
        const processingTimestamp = new Date().toISOString();
        
        console.log(`🌐 Processing: ${entry.Exit_Link}`);
        
        try {
            // Create state info object
            const stateInfo = {
                state: entry.State,
                highway: entry.Highway
            };
            
            // Scrape exit data with retry logic for navigation errors
            let result = null;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
                try {
                    result = await this.scraper.scrapeExitCoordinates(entry.Exit_Link, stateInfo);
                    break; // Success, exit retry loop
                } catch (error) {
                    if (error.message.includes('Navigating frame was detached') || 
                        error.message.includes('Navigation timeout') ||
                        error.message.includes('Protocol error') ||
                        error.message.includes('detached Frame')) {
                        
                        console.log(`⚠️  Navigation error (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}`);
                        
                        if (retryCount < maxRetries) {
                            console.log('🔄 Retrying with fresh browser...');
                            
                            // Close and reinitialize browser
                            if (this.scraper.browser) {
                                await this.scraper.browser.close();
                            }
                            await this.scraper.initBrowser();
                            
                            retryCount++;
                            await this.sleep(2000); // Wait 2 seconds before retry
                        } else {
                            throw error; // Re-throw after max retries
                        }
                    } else {
                        throw error; // Re-throw non-navigation errors immediately
                    }
                }
            }
            
            if (result && result.exitData && result.exitData.length > 0) {
                console.log(`✅ Successfully scraped ${result.exitData.length} exits`);
                
                // Add to combined results
                this.appendToCombinedCsv(result.exitData, {
                    batchId,
                    processingTimestamp,
                    state: entry.State,
                    highway: entry.Highway,
                    sourceUrl: entry.Exit_Link,
                    status: 'SUCCESS'
                });
                
                return true;
            } else {
                console.log('⚠️  No data scraped for this entry');
                
                // Add failure record
                this.appendToCombinedCsv([], {
                    batchId,
                    processingTimestamp,
                    state: entry.State,
                    highway: entry.Highway,
                    sourceUrl: entry.Exit_Link,
                    status: 'NO_DATA',
                    errorMessage: 'No exit data found'
                });
                
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Error processing entry: ${error.message}`);
            
            // Add error record
            this.appendToCombinedCsv([], {
                batchId,
                processingTimestamp,
                state: entry.State,
                highway: entry.Highway,
                sourceUrl: entry.Exit_Link,
                status: 'ERROR',
                errorMessage: error.message
            });
            
            return false;
        }
    }

    // Enhanced processing with direction switching browser restart
    async processEntryWithDirectionHandling(entry, globalIndex) {
        const batchId = Math.floor(globalIndex / BATCH_CONFIG.BATCH_SIZE) + 1;
        const processingTimestamp = new Date().toISOString();
        
        console.log(`🌐 Processing with enhanced direction handling: ${entry.Exit_Link}`);
        
        try {
            // Create state info object
            const stateInfo = {
                state: entry.State,
                highway: entry.Highway
            };
            
            // Scrape exit data with enhanced retry logic
            let result = null;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount <= maxRetries) {
                try {
                    result = await this.scraper.scrapeExitCoordinates(entry.Exit_Link, stateInfo);
                    break; // Success, exit retry loop
                } catch (error) {
                    console.log(`⚠️  Error during processing (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}`);
                    
                    // Check if it's a session expiration error
                    if (error.message.includes('Session expired') || 
                        error.message.includes('verification') ||
                        error.message.includes('session refresh')) {
                        
                        console.log('🚨 Session expired during processing, requesting refresh...');
                        
                        const refreshResult = await this.requestSessionRefresh();
                        
                        if (!refreshResult) {
                            throw new Error('Session refresh cancelled or failed');
                        }
                        
                        // Update scraper config and reinitialize
                        this.scraper.browserConfig = refreshResult;
                        if (this.scraper.browser) {
                            await this.scraper.browser.close();
                        }
                        await this.scraper.initBrowser();
                        
                        console.log('✅ Session refreshed, retrying...');
                        retryCount++;
                        await this.sleep(2000);
                        continue;
                    }
                    
                    // Handle navigation/browser errors
                    if (error.message.includes('Navigating frame was detached') || 
                        error.message.includes('Navigation timeout') ||
                        error.message.includes('Protocol error') ||
                        error.message.includes('detached Frame') ||
                        error.message.includes('browser restart')) {
                        
                        if (retryCount < maxRetries) {
                            console.log('🔄 Retrying with fresh browser after navigation error...');
                            
                            // Close and reinitialize browser
                            if (this.scraper.browser) {
                                await this.scraper.browser.close();
                            }
                            await this.scraper.initBrowser();
                            
                            retryCount++;
                            await this.sleep(2000);
                        } else {
                            throw error;
                        }
                    } else {
                        throw error; // Re-throw non-recoverable errors
                    }
                }
            }
            
            if (result && result.exitData && result.exitData.length > 0) {
                console.log(`✅ Successfully scraped ${result.exitData.length} exits`);
                
                // Add to combined results
                this.appendToCombinedCsv(result.exitData, {
                    batchId,
                    processingTimestamp,
                    state: entry.State,
                    highway: entry.Highway,
                    sourceUrl: entry.Exit_Link,
                    status: 'SUCCESS'
                });
                
                return true;
            } else {
                console.log('⚠️  No data scraped for this entry');
                
                // Add failure record
                this.appendToCombinedCsv([], {
                    batchId,
                    processingTimestamp,
                    state: entry.State,
                    highway: entry.Highway,
                    sourceUrl: entry.Exit_Link,
                    status: 'NO_DATA',
                    errorMessage: 'No exit data found'
                });
                
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Error processing entry: ${error.message}`);
            
            // Add error record
            this.appendToCombinedCsv([], {
                batchId,
                processingTimestamp,
                state: entry.State,
                highway: entry.Highway,
                sourceUrl: entry.Exit_Link,
                status: 'ERROR',
                errorMessage: error.message
            });
            
            return false;
        }
    }

    // Append data to combined CSV
    appendToCombinedCsv(exitData, metadata) {
        const csvPath = path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.COMBINED_OUTPUT_FILE);
        
        try {
            let csvContent = '';
            
            if (exitData.length > 0) {
                // Add each exit as a row
                exitData.forEach(exit => {
                    const row = [
                        metadata.batchId,
                        metadata.processingTimestamp,
                        metadata.state,
                        metadata.highway,
                        metadata.sourceUrl,
                        exit.exit_id || 'N/A',
                        exit.title || 'N/A',
                        exit.exit_name || 'N/A',
                        exit.exit_description || 'N/A',
                        exit.exit_location || 'N/A',
                        exit.iexit_detail_link || 'N/A',
                        exit.latitude || 'N/A',
                        exit.longitude || 'N/A',
                        exit.google_maps_link || 'N/A',
                        exit.direction || 'N/A',
                        metadata.status || 'SUCCESS',
                        metadata.errorMessage || ''
                    ];
                    
                    // Escape and quote fields that contain commas
                    const escapedRow = row.map(field => {
                        const fieldStr = String(field);
                        if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
                            return `"${fieldStr.replace(/"/g, '""')}"`;
                        }
                        return fieldStr;
                    });
                    
                    csvContent += escapedRow.join(',') + '\n';
                });
            } else {
                // Add a single row for failed entries
                const row = [
                    metadata.batchId,
                    metadata.processingTimestamp,
                    metadata.state,
                    metadata.highway,
                    metadata.sourceUrl,
                    'N/A', // exit_id
                    'N/A', // title
                    'N/A', // exit_name
                    'N/A', // exit_description
                    'N/A', // exit_location
                    'N/A', // iexit_detail_link
                    'N/A', // latitude
                    'N/A', // longitude
                    'N/A', // google_maps_link
                    'N/A', // direction
                    metadata.status || 'FAILED',
                    metadata.errorMessage || ''
                ];
                
                csvContent += row.join(',') + '\n';
            }
            
            fs.appendFileSync(csvPath, csvContent);
            console.log(`💾 Data appended to combined CSV`);
            
        } catch (error) {
            console.error('❌ Error appending to combined CSV:', error.message);
        }
    }

    // Run the complete batch processing
    async runBatchProcessing() {
        console.log('\n🚀 Starting Batch Processing...');
        console.log('='.repeat(60));
        
        const totalBatches = Math.ceil(this.stateData.length / BATCH_CONFIG.BATCH_SIZE);
        const startBatch = Math.floor(this.progress.processedCount / BATCH_CONFIG.BATCH_SIZE);
        
        console.log(`📊 Total batches: ${totalBatches}`);
        console.log(`📊 Starting from batch: ${startBatch + 1}`);
        
        for (let batchIndex = startBatch; batchIndex < totalBatches; batchIndex++) {
            console.log(`\n📦 Starting Batch ${batchIndex + 1}/${totalBatches}`);
            
            const batchResult = await this.processBatch(batchIndex);
            
            if (!batchResult) {
                console.log('🛑 Batch processing stopped');
                break;
            }
            
            console.log(`✅ Batch ${batchIndex + 1} completed`);
            
            // Delay between batches (except for the last batch)
            if (batchIndex < totalBatches - 1) {
                console.log(`⏱️  Waiting ${BATCH_CONFIG.DELAYS.BETWEEN_BATCHES}ms before next batch...`);
                await this.sleep(BATCH_CONFIG.DELAYS.BETWEEN_BATCHES);
            }
        }
        
        // Final summary
        this.generateFinalSummary();
    }

    // Generate final summary
    generateFinalSummary() {
        console.log('\n📊 BATCH PROCESSING COMPLETE!');
        console.log('='.repeat(60));
        console.log(`✅ Total processed: ${this.progress.processedCount}/${this.progress.totalCount}`);
        console.log(`❌ Failed entries: ${this.progress.failedUrls.length}`);
        
        if (this.progress.failedUrls.length > 0) {
            console.log('\n❌ Failed URLs:');
            this.progress.failedUrls.forEach((failed, index) => {
                console.log(`  ${index + 1}. ${failed.state} - ${failed.highway}: ${failed.url}`);
            });
        }
        
        const summaryPath = path.join(BATCH_CONFIG.OUTPUT_DIR, 'batch_summary.json');
        const summary = {
            totalProcessed: this.progress.processedCount,
            totalEntries: this.progress.totalCount,
            failedEntries: this.progress.failedUrls.length,
            failedUrls: this.progress.failedUrls,
            completedAt: new Date().toISOString(),
            outputFiles: {
                combinedCsv: path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.COMBINED_OUTPUT_FILE),
                progressFile: path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.PROGRESS_FILE)
            }
        };
        
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        console.log(`📄 Final summary saved to: ${summaryPath}`);
        console.log(`📄 Combined results saved to: ${path.join(BATCH_CONFIG.OUTPUT_DIR, BATCH_CONFIG.COMBINED_OUTPUT_FILE)}`);
    }

    // Function to play system sound/bell
    playNotificationSound() {
        try {
            // System bell character - works on most systems
            process.stdout.write('\x07');
            
            // For Windows, we can also try to play a system sound
            if (process.platform === 'win32') {
                try {
                    const { exec } = require('child_process');
                    // Play Windows system sound asynchronously
                    exec('powershell -c "[console]::beep(800,300)"', (error) => {
                        if (error) {
                            console.log('🔔 Bell notification sent (PowerShell beep failed)');
                        } else {
                            console.log('🔔 Sound notification played');
                        }
                    });
                } catch (error) {
                    console.log('🔔 Bell notification sent (system sound unavailable)');
                }
            } else {
                console.log('🔔 Bell notification sent');
            }
        } catch (error) {
            console.log('🔔 Notification attempted');
        }
    }

    // Utility sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
module.exports = { BatchProcessor, BATCH_CONFIG };

// Main execution if run directly
if (require.main === module) {
    async function main() {
        const processor = new BatchProcessor();
        
        try {
            await processor.initialize();
            await processor.runBatchProcessing();
        } catch (error) {
            console.error('❌ Fatal error in batch processing:', error.message);
            process.exit(1);
        }
    }
    
    main();
}
