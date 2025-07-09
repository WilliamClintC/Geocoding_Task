const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
    STATES_CSV_PATH: 'C:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate\\States.csv',
    OUTPUT_DIR: 'C:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate\\batch_output',
    DEFAULT_URL: 'https://www.iexitapp.com/exits/Alabama/I-10/East/648',
    DELAYS: {
        MIN_WAIT: 1000,
        MAX_WAIT: 3000,
        PAGE_LOAD: 5000,
        SCROLL_DELAY: 500
    }
};

// Function to read and parse the States.csv file
function readStatesCSV() {
    console.log('📄 Reading States.csv file...');
    
    try {
        const csvContent = fs.readFileSync(CONFIG.STATES_CSV_PATH, 'utf8');
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        const stateData = [];
        
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
                values.push(currentValue.trim());
                
                if (values.length >= 3) {
                    const state = values[0];
                    const highway = values[1];
                    const exitLink = values[2];
                    
                    // Skip entries with no exit link or invalid links
                    if (exitLink && exitLink.startsWith('http') && !exitLink.includes('No exits found')) {
                        stateData.push({
                            state: state,
                            highway: highway,
                            exitLink: exitLink
                        });
                    }
                }
            }
        }
        
        console.log(`✅ Successfully loaded ${stateData.length} valid state entries`);
        return stateData;
        
    } catch (error) {
        console.error('❌ Error reading States.csv:', error.message);
        throw error;
    }
}

// Function to select a random entry from the states data
function selectRandomStateEntry(stateData) {
    if (stateData.length === 0) {
        throw new Error('No valid state entries found');
    }
    
    const randomIndex = Math.floor(Math.random() * stateData.length);
    const selectedEntry = stateData[randomIndex];
    
    console.log('🎲 Randomly selected entry:');
    console.log(`   State: ${selectedEntry.state}`);
    console.log(`   Highway: ${selectedEntry.highway}`);
    console.log(`   Link: ${selectedEntry.exitLink}`);
    
    return selectedEntry;
}

// Function to display setup instructions
function displaySetupInstructions() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 SETUP INSTRUCTIONS FOR CURL EXTRACTION');
    console.log('='.repeat(80));
    console.log('1. 🌐 Go to your target iExit URL (e.g., https://www.iexitapp.com/exits/Alabama/I-10/East/648)');
    console.log('2. 🔧 Open DevTools:');
    console.log('   • Right-click → Inspect OR');
    console.log('   • Press Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)');
    console.log('3. 📡 Go to the Network tab');
    console.log('4. 🔄 Refresh the page');
    console.log('5. 🔍 Find the main document request (usually the page URL)');
    console.log('6. 📋 Right-click → Copy → Copy as cURL (bash)');
    console.log('7. 📝 Paste that cURL command when prompted below');
    console.log('='.repeat(80));
    console.log('');
}

// Function to check if the page shows session expiration/verification
function checkSessionExpiration(page) {
    return page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        const pageTitle = document.title.toLowerCase();
        
        // Check for various session expiration indicators
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
}

// Function to request new cURL command when session expires
async function requestNewCurlCommand() {
    // Play notification sound to alert user
    playNotificationSound();
    
    console.log('\n� �🚨 SESSION EXPIRED - NEW CURL COMMAND REQUIRED 🚨 🔔');
    console.log('='.repeat(60));
    console.log('🎵 SOUND NOTIFICATION: Session expired, new cURL needed!');
    console.log('The session has expired and the page is showing verification.');
    console.log('Please provide a new cURL command to continue.');
    console.log('');
    console.log('Steps to get a fresh cURL command:');
    console.log('1. 🌐 Open your browser and go to https://www.iexitapp.com');
    console.log('2. 🔄 Navigate to any exit page');
    console.log('3. 🔧 Open Developer Tools (F12)');
    console.log('4. 📡 Go to the Network tab');
    console.log('5. 🔄 Refresh the page');
    console.log('6. 📋 Right-click on the main request → Copy → Copy as cURL');
    console.log('7. 📝 Paste the command below');
    console.log('');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question('Paste your new cURL command (or type "quit" to exit): ', (curlCommand) => {
            rl.close();
            
            if (curlCommand.trim().toLowerCase() === 'quit') {
                resolve(null);
            } else if (curlCommand.trim() && curlCommand.toLowerCase().includes('curl')) {
                console.log('✅ New cURL command received, parsing...');
                resolve(curlCommand.trim());
            } else {
                console.log('❌ Invalid cURL command provided');
                resolve(null);
            }
        });
    });
}

// Function to parse cURL command and extract headers/cookies
function parseCurlCommand(curlCommand) {
    console.log('🔍 Parsing cURL command...');
    
    const headers = {};
    const cookies = [];
    
    // Clean up the cURL command - remove line breaks and extra spaces
    const cleanedCurl = curlCommand.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract headers using regex (handles both single and double quotes)
    const headerPattern = /-H\s+(['"])(.*?)\1/g;
    let headerMatch;
    
    while ((headerMatch = headerPattern.exec(cleanedCurl)) !== null) {
        const headerContent = headerMatch[2];
        const colonIndex = headerContent.indexOf(':');
        
        if (colonIndex > 0) {
            const headerName = headerContent.substring(0, colonIndex).trim().toLowerCase();
            const headerValue = headerContent.substring(colonIndex + 1).trim();
            
            if (headerName === 'cookie') {
                // Parse cookies from -H 'cookie: ...' format
                const cookiePairs = headerValue.split(';').map(c => c.trim());
                
                cookiePairs.forEach(pair => {
                    const equalIndex = pair.indexOf('=');
                    if (equalIndex > 0) {
                        const name = pair.substring(0, equalIndex).trim();
                        const value = pair.substring(equalIndex + 1).trim();
                        
                        if (name && value) {
                            cookies.push({
                                name: name,
                                value: value,
                                domain: '.iexitapp.com'
                            });
                        }
                    }
                });
            } else {
                headers[headerName] = headerValue;
            }
        }
    }
    
    // Extract cookies from -b flag (separate from headers)
    const cookiePattern = /-b\s+(['"])(.*?)\1/g;
    let cookieMatch;
    
    while ((cookieMatch = cookiePattern.exec(cleanedCurl)) !== null) {
        const cookieString = cookieMatch[2];
        const cookiePairs = cookieString.split(';').map(c => c.trim());
        
        cookiePairs.forEach(pair => {
            const equalIndex = pair.indexOf('=');
            if (equalIndex > 0) {
                const name = pair.substring(0, equalIndex).trim();
                const value = pair.substring(equalIndex + 1).trim();
                
                if (name && value) {
                    cookies.push({
                        name: name,
                        value: value,
                        domain: '.iexitapp.com'
                    });
                }
            }
        });
    }
    
    // Extract URL to verify it's correct
    const urlMatch = cleanedCurl.match(/curl\s+(?:-[^\s]+\s+)*['"]?([^'"\\s]+)['"]?/);
    const extractedUrl = urlMatch ? urlMatch[1] : null;
    
    console.log(`✅ Extracted ${Object.keys(headers).length} headers and ${cookies.length} cookies`);
    console.log(`🔗 URL: ${extractedUrl || 'Not found'}`);
    
    // Display some key headers for verification
    if (headers['user-agent']) {
        console.log(`🌐 User-Agent: ${headers['user-agent'].substring(0, 50)}...`);
    }
    if (cookies.find(c => c.name === 'cf_clearance')) {
        console.log('🔐 Cloudflare clearance cookie found');
    }
    if (cookies.find(c => c.name === '_iexitapp_session')) {
        console.log('🔑 Session cookie found');
    }
    
    return { headers, cookies, url: extractedUrl };
}

// Function to get user input for cURL command
async function getCurlInput() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('📝 Please paste your cURL command here:');
        console.log('💡 TIP: You can paste it as multiple lines (with \\ backslashes) or as one long line');
        console.log('');
        
        rl.question('> ', (singleLine) => {
            rl.close();
            resolve(singleLine.trim());
        });
    });
}

// Function to prompt user for cURL method choice
async function promptCurlMethod() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('🔧 Choose your preferred method:');
        console.log('1. 📋 Paste cURL command (recommended for best results)');
        console.log('2. 🔄 Use default headers/cookies (may not work if they\'re expired)');
        console.log('');
        
        rl.question('Enter your choice (1 or 2): ', (choice) => {
            rl.close();
            resolve(choice.trim());
        });
    });
}

// Function to get target URL from user
async function getTargetUrl() {
    console.log('🔄 Data source: Using random entry from States.csv');
    console.log('');
    return 'csv';
}

class CoordinateScraper {
    constructor(browserConfig = null) {
        this.browser = null;
        this.page = null;
        this.browserConfig = browserConfig || this.getDefaultConfig();
    }
    
    // Default browser configuration (fallback)
    getDefaultConfig() {
        return {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'max-age=0',
                'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
            },
            cookies: []
        };
    }

    // Generate random delay
    randomDelay(min = CONFIG.DELAYS.MIN_WAIT, max = CONFIG.DELAYS.MAX_WAIT) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initialize browser with stealth settings
    async initBrowser() {
        console.log('🚀 Launching browser with stealth mode...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--window-size=1920,1080'
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        });

        this.page = await this.browser.newPage();
        
        // Set user agent from config
        const userAgent = this.browserConfig.headers['user-agent'] || 
                         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
        await this.page.setUserAgent(userAgent);
        
        // Set extra headers
        await this.page.setExtraHTTPHeaders(this.browserConfig.headers);
        
        // Set cookies if any are provided
        if (this.browserConfig.cookies && this.browserConfig.cookies.length > 0) {
            console.log(`🍪 Setting ${this.browserConfig.cookies.length} cookies...`);
            await this.page.setCookie(...this.browserConfig.cookies);
        }
        
        console.log('✅ Browser initialized successfully');
        console.log(`📋 Headers: ${Object.keys(this.browserConfig.headers).length}`);
        console.log(`🍪 Cookies: ${this.browserConfig.cookies ? this.browserConfig.cookies.length : 0}`);
    }

    // Check for session expiration and handle it
    async checkAndHandleSessionExpiration() {
        console.log('🔍 Checking for session expiration...');
        
        try {
            const sessionStatus = await checkSessionExpiration(this.page);
            
            if (sessionStatus.isSessionExpired) {
                console.log('🚨 Session expired detected!');
                console.log('   - Has main content:', sessionStatus.hasMainContent);
                console.log('   - Has verification message:', sessionStatus.hasVerificationMessage);
                console.log('   - Has loading ring:', sessionStatus.hasLoadingRing);
                console.log('   - Body text preview:', sessionStatus.bodyText.substring(0, 200) + '...');
                
                // Request new cURL command
                const newCurlCommand = await requestNewCurlCommand();
                
                if (!newCurlCommand) {
                    throw new Error('User cancelled session refresh or provided invalid cURL command');
                }
                
                // Parse the new cURL command
                const newConfig = parseCurlCommand(newCurlCommand);
                
                // Update browser configuration
                this.browserConfig = {
                    headers: newConfig.headers,
                    cookies: newConfig.cookies
                };
                
                console.log('✅ Session refreshed with new cURL command');
                console.log(`📋 Updated with ${Object.keys(newConfig.headers).length} headers`);
                console.log(`🍪 Updated with ${newConfig.cookies.length} cookies`);
                
                // Close current browser and reinitialize with new config
                if (this.browser) {
                    await this.browser.close();
                }
                await this.initBrowser();
                
                return true; // Session was refreshed
            }
            
            return false; // No session expiration
            
        } catch (error) {
            console.error('❌ Error checking session expiration:', error.message);
            throw error;
        }
    }

    // Simulate human-like mouse movement
    async simulateMouseMovement() {
        const viewport = this.page.viewport();
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        
        await this.page.mouse.move(x, y, { steps: 10 });
        await this.sleep(this.randomDelay(100, 500));
    }

    // Simulate human-like scrolling
    async simulateScrolling() {
        console.log('📜 Simulating human-like scrolling...');
        
        const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = await this.page.evaluate(() => window.innerHeight);
        
        let currentPosition = 0;
        const scrollStep = Math.floor(viewportHeight / 3);
        
        while (currentPosition < scrollHeight) {
            await this.page.evaluate((scrollTo) => {
                window.scrollTo(0, scrollTo);
            }, currentPosition);
            
            await this.sleep(CONFIG.DELAYS.SCROLL_DELAY);
            await this.simulateMouseMovement();
            
            currentPosition += scrollStep;
        }
        
        // Scroll back to top
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.sleep(CONFIG.DELAYS.SCROLL_DELAY);
    }

    // Navigate to target page with retry mechanism
    async navigateToPage(targetUrl) {
        console.log(`🌐 Navigating to: ${targetUrl}`);
        
        try {
            await this.page.goto(targetUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            console.log('✅ Page loaded successfully');
            
            // Check for session expiration immediately after page load
            const sessionRefreshed = await this.checkAndHandleSessionExpiration();
            
            if (sessionRefreshed) {
                // If session was refreshed, navigate to the page again
                console.log('🔄 Reloading page after session refresh...');
                await this.page.goto(targetUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                console.log('✅ Page reloaded after session refresh');
            }
            
            // Wait for potential Cloudflare challenge
            console.log('⏳ Waiting for Cloudflare verification...');
            console.log('🔧 Please solve any CAPTCHA manually if prompted');
            
            // Pause for manual intervention
            await this.sleep(CONFIG.DELAYS.PAGE_LOAD);
            
            // Check if we need to wait for user confirmation
            const needsManualConfirmation = await this.page.evaluate(() => {
                return document.title.toLowerCase().includes('cloudflare') || 
                       document.body.textContent.toLowerCase().includes('checking your browser') ||
                       document.body.textContent.toLowerCase().includes('captcha');
            });
            
            if (needsManualConfirmation) {
                console.log('🛑 Manual confirmation needed. Press Enter to continue after solving CAPTCHA...');
                await this.waitForUserInput();
            }
            
        } catch (error) {
            console.error('❌ Navigation failed:', error.message);
            throw error;
        }
    }

    // Wait for user input (for CAPTCHA solving)
    async waitForUserInput() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('Press Enter to continue after solving CAPTCHA...', () => {
                rl.close();
                resolve();
            });
        });
    }

    // Extract direction from the page
    async extractDirection() {
        console.log('🧭 Extracting direction information...');
        
        const directionInfo = await this.page.evaluate(() => {
            let currentDirection = 'Unknown';
            
            // Try to find direction button first
            const directionButton = document.querySelector('a.btn.btn-default.btn-sm');
            if (directionButton) {
                const buttonText = directionButton.textContent.trim();
                
                if (buttonText.toLowerCase().includes('east')) {
                    currentDirection = 'Eastbound';
                } else if (buttonText.toLowerCase().includes('west')) {
                    currentDirection = 'Westbound';
                } else if (buttonText.toLowerCase().includes('north')) {
                    currentDirection = 'Northbound';
                } else if (buttonText.toLowerCase().includes('south')) {
                    currentDirection = 'Southbound';
                }
            }
            
            // If we couldn't determine from button, try to extract from URL
            if (currentDirection === 'Unknown') {
                const url = window.location.href.toLowerCase();
                if (url.includes('eastbound') || url.includes('east')) {
                    currentDirection = 'Eastbound';
                } else if (url.includes('westbound') || url.includes('west')) {
                    currentDirection = 'Westbound';
                } else if (url.includes('northbound') || url.includes('north')) {
                    currentDirection = 'Northbound';
                } else if (url.includes('southbound') || url.includes('south')) {
                    currentDirection = 'Southbound';
                }
            }
            
            return {
                currentDirection
            };
        });
        
        console.log(`🧭 Current Direction: ${directionInfo.currentDirection}`);
        
        return directionInfo;
    }

    // Extract coordinates from JavaScript map initialization code
    async extractCoordinatesFromJavaScript() {
        console.log('📍 Extracting coordinates from JavaScript map initialization...');
        
        const coordinatesData = await this.page.evaluate(() => {
            const coordinates = {};
            const scriptTags = document.querySelectorAll('script');
            
            for (let script of scriptTags) {
                const content = script.innerHTML;
                const lines = content.split('\n');
                
                let currentTitle = null;
                let currentExitId = null;
                
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    
                    // Look for title assignment: title = 'Exit 6';
                    const titleMatch = line.match(/^\s*title\s*=\s*['"]([^'"]+)['"];?\s*$/);
                    if (titleMatch) {
                        currentTitle = titleMatch[1].trim();
                        continue;
                    }
                    
                    // Look for add_marker calls to extract coordinates and exit ID
                    const addMarkerMatch = line.match(/add_marker\s*\(\s*map\s*,\s*([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)\s*,\s*title\s*,\s*content\s*,\s*[^,]+\s*,\s*(\d+)\s*,/);
                    if (addMarkerMatch && currentTitle) {
                        const lat = addMarkerMatch[1];
                        const lng = addMarkerMatch[2];
                        currentExitId = addMarkerMatch[3];
                        const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                        
                        coordinates[currentExitId] = {
                            title: currentTitle,
                            latitude: lat,
                            longitude: lng,
                            google_maps_link: mapsUrl,
                            exit_id: currentExitId
                        };
                        continue;
                    }
                    
                    // Alternative: Look for direct coordinate extraction in add_marker calls with explicit title
                    const directMarkerMatch = line.match(/add_marker\s*\(\s*map\s*,\s*([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)\s*,\s*['"]([^'"]+)['"]\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*(\d+)\s*,/);
                    if (directMarkerMatch) {
                        const lat = directMarkerMatch[1];
                        const lng = directMarkerMatch[2];
                        const title = directMarkerMatch[3].trim();
                        const exitId = directMarkerMatch[4];
                        const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                        
                        coordinates[exitId] = {
                            title: title,
                            latitude: lat,
                            longitude: lng,
                            google_maps_link: mapsUrl,
                            exit_id: exitId
                        };
                        continue;
                    }
                }
            }
            
            return coordinates;
        });
        
        console.log(`📍 Found coordinates for ${Object.keys(coordinatesData).length} exits`);
        
        // Debug: Show what coordinates were found
        if (Object.keys(coordinatesData).length > 0) {
            console.log('📍 Sample coordinates found:');
            Object.keys(coordinatesData).slice(0, 5).forEach(exitId => {
                const coord = coordinatesData[exitId];
                console.log(`  Exit ID ${exitId} (${coord.title}): ${coord.latitude}, ${coord.longitude}`);
            });
        }
        
        return coordinatesData;
    }

    // Extract exit information from the page
    async extractExitInformation() {
        console.log('🔍 Extracting exit information...');
        
        try {
            // Wait for the exit rows to be present
            await this.page.waitForSelector('tr.list_exit_row_container_tr', { timeout: 10000 });
            
            // Extract direction and coordinates
            const directionInfo = await this.extractDirection();
            const coordinatesData = await this.extractCoordinatesFromJavaScript();
            
            // Extract exit information
            const exitData = await this.page.evaluate((directionInfo, coordinatesData) => {
                const exits = [];
                const exitRows = document.querySelectorAll('tr.list_exit_row_container_tr');
                
                console.log(`Found ${exitRows.length} exit rows`);
                
                exitRows.forEach(row => {
                    const exitInfo = {};
                    
                    // Extract exit ID from the row's id attribute
                    const exitId = row.getAttribute('id');
                    if (!exitId) return; // Skip if no ID found
                    
                    exitInfo.exit_id = exitId;
                    
                    // Find exit sign (exit number/name)
                    const exitSignLines = row.querySelectorAll('div.exitsignline');
                    if (exitSignLines.length > 0) {
                        // Combine all exit sign lines (usually "EXIT" and the number)
                        const exitNameParts = Array.from(exitSignLines)
                            .map(line => line.textContent.trim())
                            .filter(text => text.length > 0);
                        exitInfo.exit_name = exitNameParts.join(' ');
                    }
                    
                    // Find exit description (this is usually the clickable link)
                    const exitDesc = row.querySelector('div.exitdescription');
                    if (exitDesc) {
                        exitInfo.exit_description = exitDesc.textContent.trim();
                    }
                    
                    // Find exit location
                    const exitLocation = row.querySelector('div.exitlocation');
                    if (exitLocation) {
                        exitInfo.exit_location = exitLocation.textContent.trim();
                    }
                    
                    // Find iExit detail page link (the entire exit row is a link)
                    const iexitLink = row.querySelector('a.list_exit_row_container');
                    if (iexitLink) {
                        let href = iexitLink.getAttribute('href');
                        if (href && href.startsWith('/')) {
                            href = 'https://www.iexitapp.com' + href;
                        }
                        exitInfo.iexit_detail_link = href || 'N/A';
                    } else {
                        exitInfo.iexit_detail_link = 'N/A';
                    }
                    
                    // Initialize coordinate fields
                    exitInfo.title = 'N/A';
                    exitInfo.latitude = 'N/A';
                    exitInfo.longitude = 'N/A';
                    exitInfo.google_maps_link = 'N/A';
                    exitInfo.direction = directionInfo.currentDirection;
                    
                    // Try to find coordinates for this exit using the exit ID
                    if (coordinatesData && coordinatesData[exitId]) {
                        const coordData = coordinatesData[exitId];
                        exitInfo.title = coordData.title;
                        exitInfo.latitude = coordData.latitude;
                        exitInfo.longitude = coordData.longitude;
                        exitInfo.google_maps_link = coordData.google_maps_link;
                        console.log(`✅ Found coordinates for Exit ID ${exitId}: ${coordData.title}`);
                    } else {
                        console.log(`⚠️ No coordinates found for Exit ID ${exitId}`);
                    }
                    
                    // Only add if we have meaningful exit info (skip empty rows)
                    if (exitInfo.exit_name && exitInfo.exit_name.trim().length > 0) {
                        exits.push(exitInfo);
                    }
                });
                
                return exits;
            }, directionInfo, coordinatesData);
            
            console.log(`✅ Successfully extracted ${exitData.length} exits from the page`);
            return {
                exitData
            };
            
        } catch (error) {
            console.error('❌ Failed to extract exit information:', error.message);
            throw error;
        }
    }

    // Save exit data to CSV
    async saveExitDataToCsv(exitData, stateInfo) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let csvFilename;
        
        if (stateInfo && stateInfo.state && stateInfo.highway) {
            // Clean state and highway names for filename
            const cleanState = stateInfo.state.replace(/[^a-zA-Z0-9]/g, '');
            const cleanHighway = stateInfo.highway.replace(/[^a-zA-Z0-9-]/g, '');
            csvFilename = `iexit_${cleanState}_${cleanHighway}_${timestamp}.csv`;
        } else {
            csvFilename = `iexit_exit_details_${timestamp}.csv`;
        }
        
        // Create full file path in the output directory
        const fullFilePath = path.join(CONFIG.OUTPUT_DIR, csvFilename);
        
        // Ensure output directory exists
        if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
            console.log(`📁 Created output directory: ${CONFIG.OUTPUT_DIR}`);
        }
        
        // Create CSV content with state and highway information
        const fieldnames = ['state', 'highway', 'exit_id', 'title', 'exit_name', 'exit_description', 'exit_location', 'iexit_detail_link', 'latitude', 'longitude', 'google_maps_link', 'direction'];
        let csvContent = fieldnames.join(',') + '\n';
        
        exitData.forEach(exit => {
            const values = fieldnames.map(field => {
                let value;
                if (field === 'state') {
                    value = stateInfo ? stateInfo.state : 'N/A';
                } else if (field === 'highway') {
                    value = stateInfo ? stateInfo.highway : 'N/A';
                } else {
                    value = exit[field] || 'N/A';
                }
                
                // Escape quotes and wrap in quotes if contains comma
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvContent += values.join(',') + '\n';
        });
        
        fs.writeFileSync(fullFilePath, csvContent, 'utf8');
        console.log(`💾 Exit details saved to: ${fullFilePath}`);
        
        // Display preview of extracted data
        console.log('\n🔍 Preview of extracted exits:');
        console.log('-'.repeat(80));
        if (stateInfo) {
            console.log(`State: ${stateInfo.state}`);
            console.log(`Highway: ${stateInfo.highway}`);
        }
        console.log('-'.repeat(80));
        
        // Group exits by direction for better display
        const exitsByDirection = {};
        exitData.forEach(exit => {
            const direction = exit.direction || 'Unknown';
            if (!exitsByDirection[direction]) {
                exitsByDirection[direction] = [];
            }
            exitsByDirection[direction].push(exit);
        });
        
        // Display summary by direction
        Object.keys(exitsByDirection).forEach(direction => {
            const directionExits = exitsByDirection[direction];
            console.log(`\n📍 ${direction}: ${directionExits.length} exits`);
            
            directionExits.slice(0, 3).forEach((exit, i) => {
                console.log(`  Exit ${i+1}:`);
                console.log(`    ID: ${exit.exit_id}`);
                console.log(`    Title: ${exit.title}`);
                console.log(`    Name: ${exit.exit_name}`);
                console.log(`    Description: ${exit.exit_description}`);
                console.log(`    Location: ${exit.exit_location}`);
                console.log(`    Coordinates: ${exit.latitude}, ${exit.longitude}`);
            });
            
            if (directionExits.length > 3) {
                console.log(`    ... and ${directionExits.length - 3} more exits`);
            }
        });
        
        return csvFilename;
    }

    // Save combined exit data from all directions to a single CSV
    async saveCombinedDataToCsv(exitData, stateInfo) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let csvFilename;
        
        if (stateInfo && stateInfo.state && stateInfo.highway) {
            // Clean state and highway names for filename
            const cleanState = stateInfo.state.replace(/[^a-zA-Z0-9]/g, '');
            const cleanHighway = stateInfo.highway.replace(/[^a-zA-Z0-9-]/g, '');
            csvFilename = `iexit_${cleanState}_${cleanHighway}_both_directions_${timestamp}.csv`;
        } else {
            csvFilename = `iexit_exit_details_both_directions_${timestamp}.csv`;
        }
        
        // Create full file path in the output directory
        const fullFilePath = path.join(CONFIG.OUTPUT_DIR, csvFilename);
        
        // Ensure output directory exists
        if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
            console.log(`📁 Created output directory: ${CONFIG.OUTPUT_DIR}`);
        }
        
        // Create CSV content with state and highway information
        const fieldnames = ['state', 'highway', 'exit_id', 'title', 'exit_name', 'exit_description', 'exit_location', 'iexit_detail_link', 'latitude', 'longitude', 'google_maps_link', 'direction'];
        let csvContent = fieldnames.join(',') + '\n';
        
        exitData.forEach(exit => {
            const values = fieldnames.map(field => {
                let value;
                if (field === 'state') {
                    value = stateInfo ? stateInfo.state : 'N/A';
                } else if (field === 'highway') {
                    value = stateInfo ? stateInfo.highway : 'N/A';
                } else {
                    value = exit[field] || 'N/A';
                }
                
                // Escape quotes and wrap in quotes if contains comma
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvContent += values.join(',') + '\n';
        });
        
        fs.writeFileSync(fullFilePath, csvContent, 'utf8');
        console.log(`💾 Combined exit details saved to: ${fullFilePath}`);
        
        // Display summary of combined data
        console.log('\n📊 COMBINED DATA SUMMARY:');
        console.log('='.repeat(60));
        
        // Group exits by direction for summary
        const exitsByDirection = {};
        exitData.forEach(exit => {
            const direction = exit.direction || 'Unknown';
            if (!exitsByDirection[direction]) {
                exitsByDirection[direction] = [];
            }
            exitsByDirection[direction].push(exit);
        });
        
        // Display summary by direction
        Object.keys(exitsByDirection).forEach(direction => {
            const directionExits = exitsByDirection[direction];
            console.log(`📍 ${direction}: ${directionExits.length} exits`);
            
            // Show coordinate success rate
            const exitsWithCoords = directionExits.filter(exit => 
                exit.latitude !== 'N/A' && exit.longitude !== 'N/A'
            );
            const coordSuccessRate = ((exitsWithCoords.length / directionExits.length) * 100).toFixed(1);
            console.log(`   Coordinates found: ${exitsWithCoords.length}/${directionExits.length} (${coordSuccessRate}%)`);
        });
        
        console.log(`🎯 Total exits across all directions: ${exitData.length}`);
        
        return csvFilename;
    }

    // Check if there's a direction-switching button and extract its URL
    async checkDirectionSwitchButton() {
        console.log('🔍 Checking for direction-switching button...');
        
        const buttonInfo = await this.page.evaluate(() => {
            const directionButton = document.querySelector('a.btn.btn-default.btn-sm');
            if (directionButton) {
                let href = directionButton.getAttribute('href');
                if (href && href.startsWith('/')) {
                    href = 'https://www.iexitapp.com' + href;
                }
                return {
                    found: true,
                    url: href,
                    text: directionButton.textContent.trim()
                };
            }
            return { found: false };
        });
        
        if (buttonInfo.found) {
            console.log(`🔄 Found direction switch button: "${buttonInfo.text}" → ${buttonInfo.url}`);
        } else {
            console.log('ℹ️  No direction-switching button found');
        }
        
        return buttonInfo;
    }

    // Click the direction-switching button and navigate to the opposite direction
    async clickDirectionSwitchButton() {
        console.log('🖱️  Switching directions by closing and reopening browser...');
        
        try {
            // Wait for the button to be present
            await this.page.waitForSelector('a.btn.btn-default.btn-sm', { timeout: 5000 });
            
            // Get button info before closing browser
            const buttonInfo = await this.checkDirectionSwitchButton();
            
            if (!buttonInfo.found) {
                console.log('❌ Direction-switching button not found');
                return null;
            }
            
            console.log(`🔄 Found direction switch button: "${buttonInfo.text}" → ${buttonInfo.url}`);
            
            // Close the current browser to avoid ad popups
            console.log('🔒 Closing browser to avoid ads...');
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            
            // Wait a moment before reopening
            await this.sleep(2000);
            
            // Reinitialize browser with the same configuration
            console.log('🚀 Reopening browser for opposite direction...');
            await this.initBrowser();
            
            // Navigate directly to the opposite direction URL
            if (buttonInfo.url) {
                console.log(`🌐 Navigating to opposite direction: ${buttonInfo.url}`);
                await this.navigateToPage(buttonInfo.url);
                
                // Add delay to ensure page is fully loaded
                await this.sleep(CONFIG.DELAYS.PAGE_LOAD);
                
                return {
                    previousDirection: buttonInfo.text,
                    newUrl: buttonInfo.url
                };
            } else {
                console.error('❌ No URL available for opposite direction');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Failed to switch directions:', error.message);
            return null;
        }
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

    // Main scraping function with bidirectional support
    async scrapeExitCoordinates(targetUrl, stateInfo = null) {
        let allExitData = [];
        let allCsvFilenames = [];
        
        try {
            // Check if browser is properly initialized and functional
            if (!this.browser || !this.page) {
                await this.initBrowser();
            } else {
                // Test if browser is still functional
                try {
                    await this.page.evaluate(() => window.location.href);
                } catch (error) {
                    // Browser is detached, reinitialize
                    console.log('🔄 Browser detached, reinitializing...');
                    if (this.browser) {
                        await this.browser.close();
                    }
                    await this.initBrowser();
                }
            }
            
            // Add random delay before navigation
            await this.sleep(this.randomDelay());
            
            await this.navigateToPage(targetUrl);
            
            // Simulate human behavior
            await this.simulateMouseMovement();
            await this.simulateScrolling();
            
            // Extract exit information for the first direction
            console.log('\n📍 Extracting exits for first direction...');
            const firstExtractionResult = await this.extractExitInformation();
            const firstDirectionData = firstExtractionResult.exitData;
            
            // Save data for first direction
            const firstCsvFilename = await this.saveExitDataToCsv(firstDirectionData, stateInfo);
            allExitData = allExitData.concat(firstDirectionData);
            allCsvFilenames.push(firstCsvFilename);
            
            console.log(`✅ First direction completed: ${firstDirectionData.length} exits extracted`);
            
            // Check if there's a direction-switching button
            const buttonInfo = await this.checkDirectionSwitchButton();
            
            if (buttonInfo.found) {
                console.log('\n🔄 Attempting to scrape opposite direction...');
                
                // Click the direction-switching button
                const switchResult = await this.clickDirectionSwitchButton();
                
                if (switchResult) {
                    // Simulate human behavior after navigation
                    await this.simulateMouseMovement();
                    await this.simulateScrolling();
                    
                    // Extract exit information for the opposite direction
                    console.log('\n📍 Extracting exits for opposite direction...');
                    const secondExtractionResult = await this.extractExitInformation();
                    const secondDirectionData = secondExtractionResult.exitData;
                    
                    // Save data for second direction
                    const secondCsvFilename = await this.saveExitDataToCsv(secondDirectionData, stateInfo);
                    allExitData = allExitData.concat(secondDirectionData);
                    allCsvFilenames.push(secondCsvFilename);
                    
                    console.log(`✅ Opposite direction completed: ${secondDirectionData.length} exits extracted`);
                } else {
                    console.log('⚠️  Failed to switch directions, continuing with first direction only');
                }
            } else {
                console.log('ℹ️  No direction-switching button found, single direction only');
            }
            
            // Create combined CSV with all directions
            const combinedCsvFilename = await this.saveCombinedDataToCsv(allExitData, stateInfo);
            allCsvFilenames.push(combinedCsvFilename);
            
            console.log('\n📊 EXTRACTION SUMMARY:');
            console.log('======================');
            if (stateInfo) {
                console.log(`State: ${stateInfo.state}`);
                console.log(`Highway: ${stateInfo.highway}`);
            }
            console.log(`URL: ${targetUrl}`);
            console.log(`Total exits extracted: ${allExitData.length}`);
            console.log(`CSV files saved: ${allCsvFilenames.length}`);
            allCsvFilenames.forEach(filename => console.log(`  - ${filename}`));
            
            return {
                exitData: allExitData,
                csvFilenames: allCsvFilenames,
                targetUrl,
                stateInfo
            };
            
        } catch (error) {
            console.error('❌ Scraping failed:', error.message);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log('🔒 Browser closed');
            }
        }
    }
}

// Main function
async function main() {
    console.log('🎯 Starting iExit Coordinate Scraper');
    console.log('='.repeat(50));
    
    try {
        // Get target URL from CSV selection
        const urlChoice = await getTargetUrl();
        
        let targetUrl;
        let stateInfo = null;
        
        // Read states data and select random entry
        const stateData = readStatesCSV();
        const selectedEntry = selectRandomStateEntry(stateData);
        
        targetUrl = selectedEntry.exitLink;
        stateInfo = {
            state: selectedEntry.state,
            highway: selectedEntry.highway
        };
        
        console.log(`🌐 Target URL: ${targetUrl}`);
        
        // Display setup instructions
        displaySetupInstructions();
        
        // Prompt user for method choice
        const choice = await promptCurlMethod();
        
        let browserConfig = null;
        
        if (choice === '1') {
            // Get cURL command from user
            const curlCommand = await getCurlInput();
            
            if (!curlCommand || !curlCommand.toLowerCase().includes('curl')) {
                console.log('❌ Invalid cURL command. Using default configuration...');
                browserConfig = null;
            } else {
                try {
                    const parsedCurl = parseCurlCommand(curlCommand);
                    
                    if (Object.keys(parsedCurl.headers).length === 0) {
                        console.log('⚠️  No headers extracted from cURL. Using default configuration...');
                        browserConfig = null;
                    } else {
                        browserConfig = {
                            headers: parsedCurl.headers,
                            cookies: parsedCurl.cookies
                        };
                    }
                } catch (error) {
                    console.log('❌ Error parsing cURL command. Using default configuration...');
                    browserConfig = null;
                }
            }
        }
        
        // Initialize scraper
        const scraper = new CoordinateScraper(browserConfig);
        
        // Start scraping
        console.log('\n🚀 Starting coordinate extraction...');
        const result = await scraper.scrapeExitCoordinates(targetUrl, stateInfo);
        
        console.log('\n✅ Coordinate extraction completed successfully!');
        console.log(`📊 Total exits extracted: ${result.exitData.length}`);
        console.log(`💾 CSV file saved: ${result.csvFilename}`);
        
    } catch (error) {
        console.error('\n❌ Extraction failed:', error.message);
        
        // Provide helpful debugging info
        console.log('\n🔧 Debugging Tips:');
        console.log('1. Make sure the cURL command includes fresh cookies');
        console.log('2. Try refreshing the page and getting a new cURL command');
        console.log('3. Check if Cloudflare protection is active');
        console.log('4. Verify the website is accessible manually');
        console.log('5. Ensure the URL contains exit information');
        
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

// Export the class for use in other modules
module.exports = { CoordinateScraper };
