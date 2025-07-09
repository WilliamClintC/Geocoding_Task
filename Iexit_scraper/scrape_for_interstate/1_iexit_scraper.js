const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const readline = require('readline');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
    TARGET_URL: 'https://www.iexitapp.com/states',
    SELECTOR: 'h3.panel-title.state_guide_state_header',
    DELAYS: {
        MIN_WAIT: 1000,
        MAX_WAIT: 3000,
        PAGE_LOAD: 5000,
        SCROLL_DELAY: 500
    }
};

// Function to display setup instructions
function displaySetupInstructions() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 SETUP INSTRUCTIONS FOR CURL EXTRACTION');
    console.log('='.repeat(80));
    console.log('1. 🌐 Go to: https://www.iexitapp.com/states');
    console.log('2. 🔧 Open DevTools:');
    console.log('   • Right-click → Inspect OR');
    console.log('   • Press Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)');
    console.log('3. 📡 Go to the Network tab');
    console.log('4. 🔄 Refresh the page');
    console.log('5. 🔍 Find the request where:');
    console.log('   • Name = "states"');
    console.log('   • Domain = "www.iexitapp.com"');
    console.log('   • Type = "document"');
    console.log('   • Status = "200 OK"');
    console.log('6. 📋 Right-click → Copy → Copy as cURL (bash)');
    console.log('7. 📝 Paste that cURL command when prompted below');
    console.log('='.repeat(80));
    console.log('');
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
    
    // Display cookie count breakdown
    console.log(`📊 Cookie breakdown: ${cookies.map(c => c.name).join(', ')}`);
    
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
        console.log('   The scraper will automatically handle both formats!');
        console.log('   Example formats accepted:');
        console.log('   • Multi-line with \\ (as copied from DevTools)');
        console.log('   • Single line (if you prefer to paste it condensed)');
        console.log('');
        console.log('📋 Paste your cURL command and press Enter:');
        console.log('');
        
        let curlInput = '';
        rl.on('line', (line) => {
            curlInput += line + '\n';
        });
        
        rl.on('SIGINT', () => {
            rl.close();
            resolve(curlInput.trim());
        });
        
        // Handle single line paste (most common)
        rl.question('> ', (singleLine) => {
            if (singleLine.trim()) {
                rl.close();
                resolve(singleLine.trim());
            }
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

class IExitScraper {
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
    async navigateToPage() {
        console.log(`🌐 Navigating to: ${CONFIG.TARGET_URL}`);
        
        try {
            await this.page.goto(CONFIG.TARGET_URL, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            console.log('✅ Page loaded successfully');
            
            // Check for session expiration immediately after page load
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
                
                // Navigate to the page again with fresh session
                await this.page.goto(CONFIG.TARGET_URL, {
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

    // Extract state names and their exit links from the page
    async extractStatesAndExits() {
        console.log('🔍 Extracting state names and exit links...');
        
        try {
            // Wait for the elements to be present
            await this.page.waitForSelector(CONFIG.SELECTOR, { timeout: 10000 });
            
            // Extract state names and their associated exit links
            const statesData = await this.page.evaluate((selector) => {
                const stateElements = document.querySelectorAll(selector);
                const statesWithExits = [];
                
                stateElements.forEach(stateElement => {
                    const stateName = stateElement.textContent.trim();
                    
                    if (stateName) {
                        // Find the parent panel that contains this state
                        const panel = stateElement.closest('.panel');
                        const exitLinks = [];
                        
                        if (panel) {
                            // Find all exit links within this panel
                            const exitElements = panel.querySelectorAll('a.state_guide_link_container[href*="/exits/"]');
                            
                            exitElements.forEach(exitElement => {
                                const href = exitElement.getAttribute('href');
                                if (href && href.includes('/exits/')) {
                                    // Extract highway name directly from the URL path
                                    let highway = 'Unknown';
                                    
                                    // Extract route designation from URL: /exits/State/Route/Direction/ID
                                    const stateMatch = href.match(/\/exits\/([^\/]+)\/([^\/]+)/);
                                    if (stateMatch && stateMatch[2]) {
                                        // Decode the URL-encoded route name and use it as-is
                                        highway = decodeURIComponent(stateMatch[2]);
                                    }
                                    
                                    exitLinks.push({
                                        highway: highway,
                                        href: href,
                                        fullUrl: `https://www.iexitapp.com${href}`
                                    });
                                }
                            });
                        }
                        
                        statesWithExits.push({
                            state: stateName,
                            exitLinks: exitLinks
                        });
                    }
                });
                
                return statesWithExits;
            }, CONFIG.SELECTOR);
            
            const totalExits = statesData.reduce((total, state) => total + state.exitLinks.length, 0);
            console.log(`✅ Successfully extracted ${statesData.length} states with ${totalExits} total exit links`);
            return statesData;
            
        } catch (error) {
            console.error('❌ Failed to extract states and exits:', error.message);
            
            // Try to get page content for debugging
            const pageContent = await this.page.content();
            console.log('📄 Page title:', await this.page.title());
            console.log('🔍 Looking for alternative selectors...');
            
            // Try alternative selectors
            const alternativeSelectors = [
                'h3.panel-title',
                '.state_guide_state_header',
                'h3',
                '[class*="state"]',
                '[class*="panel-title"]'
            ];
            
            for (const selector of alternativeSelectors) {
                try {
                    const elements = await this.page.$$(selector);
                    if (elements.length > 0) {
                        console.log(`🔍 Found ${elements.length} elements with selector: ${selector}`);
                        const texts = await Promise.all(elements.map(el => el.evaluate(node => node.textContent.trim())));
                        console.log('📝 Sample texts:', texts.slice(0, 5));
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }
            
            throw error;
        }
    }

    // Extract exit details from the page
    async extractExitDetailsFromPage() {
        console.log('🔍 Extracting exit details from page...');
        
        try {
            // Wait for the exit rows to be present
            await this.page.waitForSelector('tr.list_exit_row_container_tr', { timeout: 10000 });
            
            // Extract direction from page
            const direction = await this.page.evaluate(() => {
                const directionButton = document.querySelector('a.btn.btn-default.btn-sm');
                if (directionButton) {
                    return directionButton.textContent.trim();
                }
                
                // Try to extract from URL
                const url = window.location.href;
                if (url.includes('eastbound')) return 'Eastbound';
                if (url.includes('westbound')) return 'Westbound';
                if (url.includes('northbound')) return 'Northbound';
                if (url.includes('southbound')) return 'Southbound';
                
                return 'Unknown';
            });
            
            // Extract coordinates from JavaScript
            const coordinatesData = await this.page.evaluate(() => {
                const coordinates = {};
                const scriptTags = document.querySelectorAll('script');
                
                for (let script of scriptTags) {
                    const content = script.innerHTML;
                    const lines = content.split('\n');
                    
                    let currentTitle = null;
                    
                    for (let line of lines) {
                        line = line.trim();
                        
                        // Look for title assignment
                        const titleMatch = line.match(/title\s*=\s*['"]([^'"]+)['"]/);
                        if (titleMatch) {
                            currentTitle = titleMatch[1];
                        }
                        
                        // Look for Google Maps link with coordinates
                        if (line.includes('maps.google.com') && line.includes('content')) {
                            const mapsMatch = line.match(/http:\/\/maps\.google\.com\/maps\?t=m&(?:amp;)?q=loc:([+-]?\d+\.\d+)\+([+-]?\d+\.\d+)/);
                            if (mapsMatch && currentTitle) {
                                const lat = mapsMatch[1];
                                const lng = mapsMatch[2];
                                const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                                
                                coordinates[currentTitle] = {
                                    latitude: lat,
                                    longitude: lng,
                                    google_maps_link: mapsUrl
                                };
                            }
                        }
                    }
                }
                
                return coordinates;
            });
            
            // Extract exit information
            const exitData = await this.page.evaluate((direction, coordinatesData) => {
                const exits = [];
                const exitRows = document.querySelectorAll('tr.list_exit_row_container_tr');
                
                exitRows.forEach(row => {
                    const exitInfo = {};
                    
                    // Find exit sign (exit number/name)
                    const exitSignLines = row.querySelectorAll('div.exitsignline');
                    if (exitSignLines.length > 0) {
                        const exitNameParts = Array.from(exitSignLines)
                            .map(line => line.textContent.trim())
                            .filter(text => text.length > 0);
                        exitInfo.exit_name = exitNameParts.join(' ');
                    }
                    
                    // Find exit description
                    const exitDesc = row.querySelector('div.exitdescription');
                    if (exitDesc) {
                        exitInfo.exit_description = exitDesc.textContent.trim();
                    }
                    
                    // Find exit location
                    const exitLocation = row.querySelector('div.exitlocation');
                    if (exitLocation) {
                        exitInfo.exit_location = exitLocation.textContent.trim();
                    }
                    
                    // Find iExit detail page link
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
                    exitInfo.latitude = 'N/A';
                    exitInfo.longitude = 'N/A';
                    exitInfo.google_maps_link = 'N/A';
                    exitInfo.direction = direction;
                    
                    // Try to match coordinates
                    if (exitInfo.exit_name && coordinatesData) {
                        // Try exact match first
                        if (coordinatesData[exitInfo.exit_name]) {
                            const coordData = coordinatesData[exitInfo.exit_name];
                            exitInfo.latitude = coordData.latitude;
                            exitInfo.longitude = coordData.longitude;
                            exitInfo.google_maps_link = coordData.google_maps_link;
                        } else {
                            // Try partial matches
                            const exitNameClean = exitInfo.exit_name.toUpperCase().trim();
                            const exitDescClean = (exitInfo.exit_description || '').toUpperCase().trim();
                            
                            for (const [coordTitle, coordData] of Object.entries(coordinatesData)) {
                                const coordTitleClean = coordTitle.toUpperCase().trim();
                                
                                if (exitNameClean.includes(coordTitleClean) || 
                                    coordTitleClean.includes(exitNameClean) ||
                                    exitDescClean.includes(coordTitleClean) ||
                                    coordTitleClean.includes(exitDescClean) ||
                                    (exitNameClean.includes('TURN') && coordTitleClean.includes('TURNOUT')) ||
                                    (exitNameClean.includes('TURNOUT') && coordTitleClean.includes('TURN')) ||
                                    (exitNameClean.includes('WELCOME') && coordTitleClean.includes('WELCOME'))) {
                                    
                                    exitInfo.latitude = coordData.latitude;
                                    exitInfo.longitude = coordData.longitude;
                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Only add if we have meaningful exit info
                    if (exitInfo.exit_name && exitInfo.exit_name.trim().length > 0) {
                        exits.push(exitInfo);
                    }
                });
                
                return exits;
            }, direction, coordinatesData);
            
            console.log(`✅ Successfully extracted ${exitData.length} exits from the page`);
            
            return exitData;
            
        } catch (error) {
            console.error('❌ Failed to extract exit details:', error.message);
            throw error;
        }
    }

    // Save data to multiple formats
    async saveData(statesData) {
        const fs = require('fs');
        const path = require('path');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Define output directory
        const outputDir = 'C:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate\\batch_output';
        
        // Save as JSON
        const jsonFilename = path.join(outputDir, `iexit_states_exits_${timestamp}.json`);
        fs.writeFileSync(jsonFilename, JSON.stringify(statesData, null, 2), 'utf8');
        console.log(`💾 JSON data saved to: ${jsonFilename}`);
        
        // Save as CSV
        const csvFilename = path.join(outputDir, `iexit_states_exits_${timestamp}.csv`);
        let csvContent = 'State,Highway,Exit_Link\n';
        
        statesData.forEach(stateData => {
            if (stateData.exitLinks.length > 0) {
                stateData.exitLinks.forEach(exit => {
                    csvContent += `"${stateData.state}","${exit.highway}","${exit.fullUrl}"\n`;
                });
            } else {
                // Include states with no exits
                csvContent += `"${stateData.state}","No exits found",""\n`;
            }
        });
        
        fs.writeFileSync(csvFilename, csvContent, 'utf8');
        console.log(`💾 CSV data saved to: ${csvFilename}`);
        
        // Save simple text file (backward compatibility)
        const textFilename = path.join(outputDir, `iexit_states_${timestamp}.txt`);
        const stateNames = statesData.map(s => s.state);
        fs.writeFileSync(textFilename, stateNames.join('\n'), 'utf8');
        console.log(`💾 Text file saved to: ${textFilename}`);
        
        return {
            jsonFile: jsonFilename,
            csvFile: csvFilename,
            textFile: textFilename
        };
    }

    // Function to check if the page shows session expiration/verification
    checkSessionExpiration() {
        return this.page.evaluate(() => {
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
    async requestNewCurlCommand() {
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

    // Main scraping function
    async scrape() {
        try {
            await this.initBrowser();
            
            // Add random delay before navigation
            await this.sleep(this.randomDelay());
            
            await this.navigateToPage();
            
            // Simulate human behavior
            await this.simulateMouseMovement();
            await this.simulateScrolling();
            
            // Extract states and their exit links
            const statesData = await this.extractStatesAndExits();
            
            // Display results
            console.log('\n📋 EXTRACTED STATES AND EXITS:');
            console.log('================================');
            statesData.forEach((stateData, index) => {
                console.log(`\n${index + 1}. ${stateData.state}`);
                if (stateData.exitLinks.length > 0) {
                    console.log(`   🛣️  ${stateData.exitLinks.length} highways found:`);
                    stateData.exitLinks.forEach(exit => {
                        console.log(`   • ${exit.highway}: ${exit.fullUrl}`);
                    });
                } else {
                    console.log('   ⚠️  No exit links found');
                }
            });
            
            // Save data in multiple formats
            const savedFiles = await this.saveData(statesData);
            
            console.log('\n📊 SUMMARY:');
            console.log('===========');
            console.log(`States processed: ${statesData.length}`);
            console.log(`Total exit links: ${statesData.reduce((total, state) => total + state.exitLinks.length, 0)}`);
            console.log(`Files saved: ${Object.values(savedFiles).join(', ')}`);
            
            // Play notification sound on completion
            this.playNotificationSound();
            
            return statesData;
            
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

// Function to extract exit details from a specific URL
async function extractExitDetailsFromUrl(targetUrl, browserConfig) {
    console.log(`🎯 Extracting exit details from specific URL: ${targetUrl}`);
    
    const scraper = new IExitScraper(browserConfig);
    
    try {
        await scraper.initBrowser();
        
        // Navigate to the specific exit page
        console.log(`🌐 Navigating to: ${targetUrl}`);
        await scraper.page.goto(targetUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Add random delay to simulate human behavior
        await scraper.sleep(scraper.randomDelay());
        
        // Simulate human behavior
        await scraper.simulateMouseMovement();
        await scraper.simulateScrolling();
        
        // Extract exit information
        const exitData = await scraper.extractExitDetailsFromPage();
        
        // Save the exit data to CSV
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fs = require('fs');
        const path = require('path');
        
        // Define output directory
        const outputDir = 'C:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate\\batch_output';
        const csvFilename = path.join(outputDir, `iexit_exit_details_${timestamp}.csv`);
        
        // Create CSV content
        const fieldnames = ['exit_name', 'exit_description', 'exit_location', 'iexit_detail_link', 'latitude', 'longitude', 'google_maps_link', 'direction'];
        let csvContent = fieldnames.join(',') + '\n';
        
        exitData.forEach(exit => {
            const values = fieldnames.map(field => {
                const value = exit[field] || 'N/A';
                // Escape quotes and wrap in quotes if contains comma
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvContent += values.join(',') + '\n';
        });
        
        fs.writeFileSync(csvFilename, csvContent, 'utf8');
        console.log(`💾 Exit details saved to: ${csvFilename}`);
        
        console.log(`\n✅ Successfully extracted ${exitData.length} exits from ${targetUrl}`);
        
        return exitData;
        
    } catch (error) {
        console.error('❌ Exit extraction failed:', error.message);
        throw error;
    } finally {
        if (scraper.browser) {
            await scraper.browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

// Run the scraper
async function main() {
    // Check if target URL is provided as argument
    const args = process.argv.slice(2);
    const targetUrlIndex = args.indexOf('--target-url');
    
    if (targetUrlIndex !== -1 && targetUrlIndex + 1 < args.length) {
        const targetUrl = args[targetUrlIndex + 1];
        
        console.log('🎯 Starting iExit Exit Details Scraper for specific URL');
        console.log('='.repeat(60));
        console.log(`Target URL: ${targetUrl}`);
        
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
        
        // Extract exit details from the specific URL
        try {
            await extractExitDetailsFromUrl(targetUrl, browserConfig);
            console.log('\n✅ Exit details extraction completed successfully!');
        } catch (error) {
            console.error('\n❌ Exit details extraction failed:', error.message);
            process.exit(1);
        }
        
        return;
    }
    
    // Original states scraper functionality
    console.log('🎯 Starting iExit States Scraper with cURL Integration');
    console.log('='.repeat(60));
    
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
                
                // Validate that we got some useful data
                if (Object.keys(parsedCurl.headers).length === 0) {
                    console.log('⚠️  No headers extracted from cURL. Using default configuration...');
                    browserConfig = null;
                } else {
                    browserConfig = {
                        headers: parsedCurl.headers,
                        cookies: parsedCurl.cookies
                    };
                    
                    // Verify URL matches target
                    if (parsedCurl.url && !parsedCurl.url.includes('iexitapp.com')) {
                        console.log('⚠️  Warning: The cURL URL doesn\'t match iexitapp.com');
                        console.log(`   Extracted URL: ${parsedCurl.url}`);
                        console.log(`   Target URL: ${CONFIG.TARGET_URL}`);
                    }
                }
            } catch (error) {
                console.log('❌ Error parsing cURL command:', error.message);
                console.log('   Using default configuration...');
                browserConfig = null;
            }
        }
    } else if (choice === '2') {
        console.log('🔄 Using default configuration...');
        browserConfig = null;
    } else {
        console.log('❌ Invalid choice. Using default configuration...');
        browserConfig = null;
    }
    
    // Initialize scraper with config
    const scraper = new IExitScraper(browserConfig);
    
    try {
        await scraper.scrape();
        console.log('\n✅ Scraping completed successfully!');
    } catch (error) {
        console.error('\n❌ Scraping failed:', error.message);
        
        // Provide helpful debugging info
        console.log('\n🔧 Debugging Tips:');
        console.log('1. Make sure the cURL command includes fresh cookies');
        console.log('2. Try refreshing the page and getting a new cURL command');
        console.log('3. Check if Cloudflare protection is active');
        console.log('4. Verify the website is accessible manually');
        
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

module.exports = IExitScraper;
