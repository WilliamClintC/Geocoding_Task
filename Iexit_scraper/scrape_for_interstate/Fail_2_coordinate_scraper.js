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
    OUTPUT_DIR: 'C:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate',
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
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('🔄 Choose data source:');
        console.log('1. 📄 Use random entry from States.csv (recommended)');
        console.log('2. 🌐 Enter URL manually');
        console.log('');
        
        rl.question('Enter your choice (1 or 2): ', (choice) => {
            if (choice.trim() === '1') {
                rl.close();
                resolve('csv');
            } else if (choice.trim() === '2') {
                console.log('🌐 Enter the iExit URL to scrape:');
                console.log(`💡 Press Enter for default: ${CONFIG.DEFAULT_URL}`);
                console.log('');
                
                rl.question('URL: ', (url) => {
                    rl.close();
                    resolve(url.trim() || CONFIG.DEFAULT_URL);
                });
            } else {
                console.log('❌ Invalid choice. Using CSV option...');
                rl.close();
                resolve('csv');
            }
        });
    });
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

    // Extract direction from the page and find opposite direction link
    async extractDirection() {
        console.log('🧭 Extracting direction information...');
        
        const directionInfo = await this.page.evaluate(() => {
            let currentDirection = 'Unknown';
            let oppositeDirectionLink = null;
            
            // Try to find direction button first
            const directionButton = document.querySelector('a.btn.btn-default.btn-sm');
            if (directionButton) {
                const buttonText = directionButton.textContent.trim();
                const href = directionButton.getAttribute('href');
                
                // The button text shows the current direction of the page we're on
                // The href leads to the opposite direction
                if (buttonText.toLowerCase().includes('east')) {
                    currentDirection = 'Eastbound';
                    oppositeDirectionLink = href;
                } else if (buttonText.toLowerCase().includes('west')) {
                    currentDirection = 'Westbound';
                    oppositeDirectionLink = href;
                } else if (buttonText.toLowerCase().includes('north')) {
                    currentDirection = 'Northbound';
                    oppositeDirectionLink = href;
                } else if (buttonText.toLowerCase().includes('south')) {
                    currentDirection = 'Southbound';
                    oppositeDirectionLink = href;
                }
                
                // Make sure the link is absolute
                if (oppositeDirectionLink && oppositeDirectionLink.startsWith('/')) {
                    oppositeDirectionLink = 'https://www.iexitapp.com' + oppositeDirectionLink;
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
                currentDirection,
                oppositeDirectionLink
            };
        });
        
        console.log(`🧭 Current Direction: ${directionInfo.currentDirection}`);
        if (directionInfo.oppositeDirectionLink) {
            console.log(`🔄 Opposite Direction Link: ${directionInfo.oppositeDirectionLink}`);
        } else {
            console.log('❌ No opposite direction link found');
        }
        
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
                
                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    
                    // Look for title assignment: title = 'Exit 48';
                    const titleMatch = line.match(/^\s*title\s*=\s*['"]([^'"]+)['"];?\s*$/);
                    if (titleMatch) {
                        currentTitle = titleMatch[1].trim();
                        continue;
                    }
                    
                    // Look for content assignment with Google Maps link
                    if (line.includes('content') && line.includes('maps.google.com')) {
                        const mapsMatch = line.match(/http:\/\/maps\.google\.com\/maps\?t=m&(?:amp;)?q=loc:([+-]?\d+\.\d+)[+\-]([+-]?\d+\.\d+)/);
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
                        continue;
                    }
                    
                    // Look for add_marker calls: add_marker(map, 40.801966, -73.91664, title, content, pin_url, 105, false, icon_width, icon_height)
                    const addMarkerMatch = line.match(/add_marker\s*\(\s*map\s*,\s*([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)\s*,\s*title\s*,\s*content/);
                    if (addMarkerMatch && currentTitle) {
                        const lat = addMarkerMatch[1];
                        const lng = addMarkerMatch[2];
                        const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                        
                        // Only add if we don't already have this exit (avoid duplicates)
                        if (!coordinates[currentTitle]) {
                            coordinates[currentTitle] = {
                                latitude: lat,
                                longitude: lng,
                                google_maps_link: mapsUrl
                            };
                        }
                        continue;
                    }
                    
                    // Alternative: Look for direct coordinate extraction in add_marker calls with explicit title
                    const directMarkerMatch = line.match(/add_marker\s*\(\s*map\s*,\s*([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)\s*,\s*['"]([^'"]+)['"]\s*,/);
                    if (directMarkerMatch) {
                        const lat = directMarkerMatch[1];
                        const lng = directMarkerMatch[2];
                        const title = directMarkerMatch[3].trim();
                        const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                        
                        coordinates[title] = {
                            latitude: lat,
                            longitude: lng,
                            google_maps_link: mapsUrl
                        };
                        continue;
                    }
                }
            }
            
            // Fallback method: Search for any Google Maps links in the entire HTML
            const allHtml = document.documentElement.innerHTML;
            const allMapsMatches = allHtml.match(/http:\/\/maps\.google\.com\/maps\?t=m&(?:amp;)?q=loc:([+-]?\d+\.\d+)[+\-]([+-]?\d+\.\d+)/g);
            
            if (allMapsMatches) {
                allMapsMatches.forEach(mapLink => {
                    const coordMatch = mapLink.match(/q=loc:([+-]?\d+\.\d+)[+\-]([+-]?\d+\.\d+)/);
                    if (coordMatch) {
                        const lat = coordMatch[1];
                        const lng = coordMatch[2];
                        const mapsUrl = `http://maps.google.com/maps?t=m&q=loc:${lat}+${lng}`;
                        
                        // Try to find the context around this link
                        const linkIndex = allHtml.indexOf(mapLink);
                        if (linkIndex > -1) {
                            // Look for exit information in surrounding 500 characters
                            const contextStart = Math.max(0, linkIndex - 500);
                            const contextEnd = Math.min(allHtml.length, linkIndex + 500);
                            const context = allHtml.substring(contextStart, contextEnd);
                            
                            // Look for title assignments in the context
                            const titlePatterns = [
                                /title\s*=\s*['"]([^'"]+)['"]/,
                                /<b>([^<]*(?:Exit|EXIT)\s*[^<]*)<\/b>/i,
                                /(?:Exit|EXIT)\s*(\d+[A-Za-z]?)/i
                            ];
                            
                            for (let pattern of titlePatterns) {
                                const match = context.match(pattern);
                                if (match) {
                                    let exitTitle = match[1].trim();
                                    
                                    // Clean up the exit title
                                    if (!exitTitle.toLowerCase().includes('exit') && /^\d+[A-Za-z]?$/.test(exitTitle)) {
                                        exitTitle = `Exit ${exitTitle}`;
                                    }
                                    
                                    // Only add if we don't already have coordinates for this exit
                                    if (!coordinates[exitTitle]) {
                                        coordinates[exitTitle] = {
                                            latitude: lat,
                                            longitude: lng,
                                            google_maps_link: mapsUrl
                                        };
                                    }
                                    break;
                                }
                            }
                        }
                    }
                });
            }
            
            return coordinates;
        });
        
        console.log(`📍 Found coordinates for ${Object.keys(coordinatesData).length} locations`);
        
        // Debug: Show what coordinates were found
        if (Object.keys(coordinatesData).length > 0) {
            console.log('📍 Sample coordinates found:');
            Object.keys(coordinatesData).slice(0, 5).forEach(title => {
                const coord = coordinatesData[title];
                console.log(`  ${title}: ${coord.latitude}, ${coord.longitude}`);
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
                    exitInfo.latitude = 'N/A';
                    exitInfo.longitude = 'N/A';
                    exitInfo.google_maps_link = 'N/A';
                    exitInfo.direction = directionInfo.currentDirection;
                    
                    // Try to find coordinates for this exit
                    if (coordinatesData) {
                        let foundMatch = false;
                        
                        // Determine the primary text to use for matching
                        const exitNameClean = (exitInfo.exit_name || '').trim().toUpperCase();
                        const exitDescClean = (exitInfo.exit_description || '').trim().toUpperCase();
                        
                        // Check if this is a special case exit (REST AREA, WEIGH STATION, etc.)
                        const isSpecialCaseExit = exitNameClean.includes('REST') || 
                                                 exitNameClean.includes('AREA') || 
                                                 exitNameClean.includes('WEIGH') || 
                                                 exitNameClean.includes('STATION') || 
                                                 exitNameClean.includes('WELCOME') ||
                                                 exitNameClean.includes('CENTER') ||
                                                 exitNameClean.includes('TURNOUT') ||
                                                 exitNameClean === 'EXIT' ||
                                                 !exitNameClean.match(/EXIT\s*\d+/);
                        
                        // For special case exits, use exit_description as primary match text
                        // For numeric exits, use exit_name as primary match text
                        let primaryMatchText = isSpecialCaseExit ? exitDescClean : exitNameClean;
                        let secondaryMatchText = isSpecialCaseExit ? exitNameClean : exitDescClean;
                        
                        // Clean the primary match text (keep mile markers but normalize spacing)
                        if (primaryMatchText) {
                            // Keep mile marker info but normalize spacing
                            primaryMatchText = primaryMatchText.replace(/\s+/g, ' ').trim();
                        }
                        
                        // Debug logging for matching
                        if (isSpecialCaseExit) {
                            console.log(`🔍 Special case exit matching:`);
                            console.log(`   Exit Name: "${exitInfo.exit_name}"`);
                            console.log(`   Exit Desc: "${exitInfo.exit_description}"`);
                            console.log(`   Primary Match Text: "${primaryMatchText}"`);
                            console.log(`   Available JS titles: ${Object.keys(coordinatesData).slice(0, 3).join(', ')}...`);
                        }
                        
                        // First try exact matches with the JavaScript title
                        for (const [coordTitle, coordData] of Object.entries(coordinatesData)) {
                            const coordTitleClean = coordTitle.toUpperCase().trim();
                            
                            // For numeric exits, try various patterns
                            if (!isSpecialCaseExit && exitNameClean) {
                                const possibleMatches = [
                                    exitNameClean,                    // "EXIT 48"
                                    exitNameClean.replace(/EXIT\s*/i, 'Exit '), // "Exit 48"
                                ];
                                
                                // If we have exit number, also try just the number
                                const exitNumberMatch = exitNameClean.match(/(?:EXIT\s*)?(\d+[A-Za-z]?)/i);
                                if (exitNumberMatch) {
                                    possibleMatches.push(`Exit ${exitNumberMatch[1]}`);
                                    possibleMatches.push(`EXIT ${exitNumberMatch[1]}`);
                                }
                                
                                for (const matchPattern of possibleMatches) {
                                    if (matchPattern.toUpperCase() === coordTitleClean) {
                                        exitInfo.latitude = coordData.latitude;
                                        exitInfo.longitude = coordData.longitude;
                                        exitInfo.google_maps_link = coordData.google_maps_link;
                                        foundMatch = true;
                                        break;
                                    }
                                }
                                
                                if (foundMatch) break;
                            }
                            
                            // For special case exits, match using exit_description
                            if (isSpecialCaseExit && primaryMatchText) {
                                // Try exact match first
                                if (primaryMatchText === coordTitleClean) {
                                    console.log(`✅ Found exact match: "${primaryMatchText}" -> "${coordTitle}"`);
                                    exitInfo.latitude = coordData.latitude;
                                    exitInfo.longitude = coordData.longitude;
                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                    foundMatch = true;
                                    break;
                                }
                                
                                // Try partial matches for rest areas, weigh stations, etc.
                                if (primaryMatchText.includes('REST') && coordTitleClean.includes('REST') && 
                                    primaryMatchText.includes('AREA') && coordTitleClean.includes('AREA')) {
                                    // Extract the name part (e.g., "HYSHAM" from "HYSHAM REST AREA (MM: 65.0)")
                                    // Remove REST AREA but keep everything else including mile markers
                                    const primaryName = primaryMatchText.replace(/\s*(REST|AREA)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    const coordName = coordTitleClean.replace(/\s*(REST|AREA)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    
                                    if (primaryName && coordName && (
                                        primaryName === coordName ||
                                        primaryName.includes(coordName) || 
                                        coordName.includes(primaryName)
                                    )) {
                                        console.log(`✅ Found rest area match: "${primaryName}" -> "${coordName}" (${coordTitle})`);
                                        exitInfo.latitude = coordData.latitude;
                                        exitInfo.longitude = coordData.longitude;
                                        exitInfo.google_maps_link = coordData.google_maps_link;
                                        foundMatch = true;
                                        break;
                                    }
                                }
                                
                                // Also try matching just the rest area name part (removing mile markers for comparison)
                                if (primaryMatchText.includes('REST') && coordTitleClean.includes('REST')) {
                                    // Extract location name (e.g., "Hysham" from "Hysham Rest Area (MM: 65.0)")
                                    const primaryWordsWithoutMM = primaryMatchText.replace(/\(MM:\s*[\d.]+\)/g, '').replace(/REST\s*AREA/g, '').trim().split(/\s+/);
                                    const coordWords = coordTitleClean.replace(/REST\s*AREA/g, '').trim().split(/\s+/);
                                    
                                    // Check if any significant words match
                                    for (const pWord of primaryWordsWithoutMM) {
                                        if (pWord.length > 2) { // Skip short words
                                            for (const cWord of coordWords) {
                                                if (pWord === cWord || 
                                                    pWord.includes(cWord) || 
                                                    cWord.includes(pWord)) {
                                                    exitInfo.latitude = coordData.latitude;
                                                    exitInfo.longitude = coordData.longitude;
                                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                                    foundMatch = true;
                                                    break;
                                                }
                                            }
                                            if (foundMatch) break;
                                        }
                                    }
                                    if (foundMatch) break;
                                }
                                
                                // Try similar matching for weigh stations
                                if (primaryMatchText.includes('WEIGH') && coordTitleClean.includes('WEIGH')) {
                                    const primaryName = primaryMatchText.replace(/\s*(WEIGH|STATION)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    const coordName = coordTitleClean.replace(/\s*(WEIGH|STATION)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    
                                    if (primaryName && coordName && (
                                        primaryName === coordName ||
                                        primaryName.includes(coordName) || 
                                        coordName.includes(primaryName)
                                    )) {
                                        exitInfo.latitude = coordData.latitude;
                                        exitInfo.longitude = coordData.longitude;
                                        exitInfo.google_maps_link = coordData.google_maps_link;
                                        foundMatch = true;
                                        break;
                                    }
                                }
                                
                                // Also try matching just the weigh station name part (removing mile markers for comparison)
                                if (primaryMatchText.includes('WEIGH') && coordTitleClean.includes('WEIGH')) {
                                    const primaryWordsWithoutMM = primaryMatchText.replace(/\(MM:\s*[\d.]+\)/g, '').replace(/WEIGH\s*(STATION)?/g, '').trim().split(/\s+/);
                                    const coordWords = coordTitleClean.replace(/WEIGH\s*(STATION)?/g, '').trim().split(/\s+/);
                                    
                                    // Check if any significant words match
                                    for (const pWord of primaryWordsWithoutMM) {
                                        if (pWord.length > 2) { // Skip short words
                                            for (const cWord of coordWords) {
                                                if (pWord === cWord || 
                                                    pWord.includes(cWord) || 
                                                    cWord.includes(pWord)) {
                                                    exitInfo.latitude = coordData.latitude;
                                                    exitInfo.longitude = coordData.longitude;
                                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                                    foundMatch = true;
                                                    break;
                                                }
                                            }
                                            if (foundMatch) break;
                                        }
                                    }
                                    if (foundMatch) break;
                                }
                                
                                // Try similar matching for welcome centers
                                if (primaryMatchText.includes('WELCOME') && coordTitleClean.includes('WELCOME')) {
                                    const primaryName = primaryMatchText.replace(/\s*(WELCOME|CENTER)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    const coordName = coordTitleClean.replace(/\s*(WELCOME|CENTER)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    
                                    if (primaryName && coordName && (
                                        primaryName === coordName ||
                                        primaryName.includes(coordName) || 
                                        coordName.includes(primaryName)
                                    )) {
                                        exitInfo.latitude = coordData.latitude;
                                        exitInfo.longitude = coordData.longitude;
                                        exitInfo.google_maps_link = coordData.google_maps_link;
                                        foundMatch = true;
                                        break;
                                    }
                                }
                                
                                // Also try matching just the welcome center name part (removing mile markers for comparison)
                                if (primaryMatchText.includes('WELCOME') && coordTitleClean.includes('WELCOME')) {
                                    const primaryWordsWithoutMM = primaryMatchText.replace(/\(MM:\s*[\d.]+\)/g, '').replace(/WELCOME\s*(CENTER)?/g, '').trim().split(/\s+/);
                                    const coordWords = coordTitleClean.replace(/WELCOME\s*(CENTER)?/g, '').trim().split(/\s+/);
                                    
                                    // Check if any significant words match
                                    for (const pWord of primaryWordsWithoutMM) {
                                        if (pWord.length > 2) { // Skip short words
                                            for (const cWord of coordWords) {
                                                if (pWord === cWord || 
                                                    pWord.includes(cWord) || 
                                                    cWord.includes(pWord)) {
                                                    exitInfo.latitude = coordData.latitude;
                                                    exitInfo.longitude = coordData.longitude;
                                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                                    foundMatch = true;
                                                    break;
                                                }
                                            }
                                            if (foundMatch) break;
                                        }
                                    }
                                    if (foundMatch) break;
                                }
                                
                                // Try similar matching for turnouts
                                if ((primaryMatchText.includes('TURNOUT') || primaryMatchText.includes('TURN')) && 
                                    (coordTitleClean.includes('TURNOUT') || coordTitleClean.includes('TURN'))) {
                                    const primaryName = primaryMatchText.replace(/\s*(TURNOUT|TURN|OUT|TRUCK)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    const coordName = coordTitleClean.replace(/\s*(TURNOUT|TURN|OUT|TRUCK)\s*/g, ' ').replace(/\s+/g, ' ').trim();
                                    
                                    if (primaryName && coordName && (
                                        primaryName === coordName ||
                                        primaryName.includes(coordName) || 
                                        coordName.includes(primaryName)
                                    )) {
                                        exitInfo.latitude = coordData.latitude;
                                        exitInfo.longitude = coordData.longitude;
                                        exitInfo.google_maps_link = coordData.google_maps_link;
                                        foundMatch = true;
                                        break;
                                    }
                                }
                                
                                // Also try matching just the turnout name part (removing mile markers for comparison)
                                if ((primaryMatchText.includes('TURNOUT') || primaryMatchText.includes('TURN')) && 
                                    (coordTitleClean.includes('TURNOUT') || coordTitleClean.includes('TURN'))) {
                                    const primaryWordsWithoutMM = primaryMatchText.replace(/\(MM:\s*[\d.]+\)/g, '').replace(/(TRUCK\s*)?(TURN\s*OUT|TURNOUT)/g, '').trim().split(/\s+/);
                                    const coordWords = coordTitleClean.replace(/(TRUCK\s*)?(TURN\s*OUT|TURNOUT)/g, '').trim().split(/\s+/);
                                    
                                    // Check if any significant words match
                                    for (const pWord of primaryWordsWithoutMM) {
                                        if (pWord.length > 2) { // Skip short words
                                            for (const cWord of coordWords) {
                                                if (pWord === cWord || 
                                                    pWord.includes(cWord) || 
                                                    cWord.includes(pWord)) {
                                                    exitInfo.latitude = coordData.latitude;
                                                    exitInfo.longitude = coordData.longitude;
                                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                                    foundMatch = true;
                                                    break;
                                                }
                                            }
                                            if (foundMatch) break;
                                        }
                                    }
                                    if (foundMatch) break;
                                }
                            }
                        }
                        
                        // If no exact match found, try broader partial matching as fallback
                        if (!foundMatch) {
                            for (const [coordTitle, coordData] of Object.entries(coordinatesData)) {
                                const coordTitleClean = coordTitle.toUpperCase().trim();
                                
                                // Check if there's any meaningful overlap
                                if (primaryMatchText && (
                                    primaryMatchText.includes(coordTitleClean) || 
                                    coordTitleClean.includes(primaryMatchText) ||
                                    // Handle exit number matching (e.g., "EXIT 48" matches "Exit 48")
                                    (primaryMatchText.match(/\d+/) && coordTitleClean.match(/\d+/) && 
                                     primaryMatchText.match(/\d+/)[0] === coordTitleClean.match(/\d+/)[0])
                                )) {
                                    exitInfo.latitude = coordData.latitude;
                                    exitInfo.longitude = coordData.longitude;
                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                    foundMatch = true;
                                    break;
                                }
                                
                                // Also check secondary match text
                                if (!foundMatch && secondaryMatchText && (
                                    secondaryMatchText.includes(coordTitleClean) ||
                                    coordTitleClean.includes(secondaryMatchText)
                                )) {
                                    exitInfo.latitude = coordData.latitude;
                                    exitInfo.longitude = coordData.longitude;
                                    exitInfo.google_maps_link = coordData.google_maps_link;
                                    foundMatch = true;
                                    break;
                                }
                            }
                        }
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
                exitData,
                oppositeDirectionLink: directionInfo.oppositeDirectionLink
            };
            
        } catch (error) {
            console.error('❌ Failed to extract exit information:', error.message);
            throw error;
        }
    }

    // Save exit data to CSV
    async saveExitDataToCsv(exitData, stateInfo, isCombined = false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let csvFilename;
        
        if (stateInfo && stateInfo.state && stateInfo.highway) {
            // Clean state and highway names for filename
            const cleanState = stateInfo.state.replace(/[^a-zA-Z0-9]/g, '');
            const cleanHighway = stateInfo.highway.replace(/[^a-zA-Z0-9-]/g, '');
            const directionSuffix = isCombined ? '_both_directions' : '';
            csvFilename = `iexit_${cleanState}_${cleanHighway}${directionSuffix}_${timestamp}.csv`;
        } else {
            const directionSuffix = isCombined ? '_both_directions' : '';
            csvFilename = `iexit_exit_details${directionSuffix}_${timestamp}.csv`;
        }
        
        // Create full file path in the output directory
        const fullFilePath = path.join(CONFIG.OUTPUT_DIR, csvFilename);
        
        // Ensure output directory exists
        if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
            console.log(`📁 Created output directory: ${CONFIG.OUTPUT_DIR}`);
        }
        
        // Create CSV content with state and highway information
        const fieldnames = ['state', 'highway', 'exit_name', 'exit_description', 'exit_location', 'iexit_detail_link', 'latitude', 'longitude', 'google_maps_link', 'direction'];
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
        if (isCombined) {
            console.log(`Data includes: Both directions`);
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

    // Main scraping function
    async scrapeExitCoordinates(targetUrl, stateInfo = null) {
        try {
            await this.initBrowser();
            
            // Add random delay before navigation
            await this.sleep(this.randomDelay());
            
            await this.navigateToPage(targetUrl);
            
            // Simulate human behavior
            await this.simulateMouseMovement();
            await this.simulateScrolling();
            
            // Extract exit information from current direction
            const extractionResult = await this.extractExitInformation();
            let allExitData = extractionResult.exitData;
            const oppositeDirectionLink = extractionResult.oppositeDirectionLink;
            
            // Save data for current direction
            const csvFilename = await this.saveExitDataToCsv(allExitData, stateInfo);
            
            // If we found an opposite direction link, scrape that too
            if (oppositeDirectionLink) {
                console.log('\n🔄 Found opposite direction link, scraping opposite direction...');
                console.log(`🌐 Navigating to opposite direction: ${oppositeDirectionLink}`);
                
                // Add delay before navigating to opposite direction
                await this.sleep(this.randomDelay(2000, 4000));
                
                try {
                    await this.navigateToPage(oppositeDirectionLink);
                    
                    // Simulate human behavior again
                    await this.simulateMouseMovement();
                    await this.simulateScrolling();
                    
                    // Extract exit information from opposite direction
                    const oppositeExtractionResult = await this.extractExitInformation();
                    const oppositeExitData = oppositeExtractionResult.exitData;
                    
                    if (oppositeExitData && oppositeExitData.length > 0) {
                        console.log(`✅ Successfully extracted ${oppositeExitData.length} exits from opposite direction`);
                        
                        // Combine both directions
                        allExitData = allExitData.concat(oppositeExitData);
                        
                        // Save combined data to a new CSV file
                        const combinedCsvFilename = await this.saveExitDataToCsv(allExitData, stateInfo, true);
                        
                        console.log(`💾 Combined data (both directions) saved to: ${combinedCsvFilename}`);
                    } else {
                        console.log('⚠️ No exits found in opposite direction');
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to scrape opposite direction:', error.message);
                    console.log('⚠️ Continuing with data from original direction only');
                }
            } else {
                console.log('ℹ️ No opposite direction link found, scraping single direction only');
            }
            
            console.log('\n📊 EXTRACTION SUMMARY:');
            console.log('======================');
            if (stateInfo) {
                console.log(`State: ${stateInfo.state}`);
                console.log(`Highway: ${stateInfo.highway}`);
            }
            console.log(`Original URL: ${targetUrl}`);
            if (oppositeDirectionLink) {
                console.log(`Opposite Direction URL: ${oppositeDirectionLink}`);
            }
            console.log(`Total exits extracted: ${allExitData.length}`);
            console.log(`CSV file saved: ${csvFilename}`);
            
            return {
                exitData: allExitData,
                csvFilename,
                targetUrl,
                oppositeDirectionLink,
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
        // Get target URL or CSV selection from user
        const urlChoice = await getTargetUrl();
        
        let targetUrl;
        let stateInfo = null;
        
        if (urlChoice === 'csv') {
            // Read states data and select random entry
            const stateData = readStatesCSV();
            const selectedEntry = selectRandomStateEntry(stateData);
            
            targetUrl = selectedEntry.exitLink;
            stateInfo = {
                state: selectedEntry.state,
                highway: selectedEntry.highway
            };
        } else {
            // Use manually entered URL
            targetUrl = urlChoice;
            console.log(`🌐 Target URL: ${targetUrl}`);
            
            // Validate URL
            if (!targetUrl.includes('iexitapp.com')) {
                console.log('⚠️  Warning: URL doesn\'t appear to be an iExit URL');
                const confirm = await new Promise((resolve) => {
                    const rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });
                    rl.question('Continue anyway? (y/n): ', (answer) => {
                        rl.close();
                        resolve(answer.trim().toLowerCase());
                    });
                });
                
                if (confirm !== 'y') {
                    console.log('❌ Extraction cancelled');
                    return;
                }
            }
        }
        
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

module.exports = CoordinateScraper;
