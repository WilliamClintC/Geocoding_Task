const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { URL } = require('url');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
    CSV_FILE: 'iexit_states_exits_2025-07-09T00-41-25-365Z.csv',
    OUTPUT_DIR: 'interstate_webpage_downloads',
    TEST_MODE: true, // Set to false for full download
    TEST_LIMIT: 4, // Number of links to test
    DELAYS: {
        MIN_WAIT: 2000,
        MAX_WAIT: 4000,
        PAGE_LOAD: 12000,
        SCROLL_DELAY: 500,
        BETWEEN_DOWNLOADS: 5000,
        RESOURCE_WAIT: 3000
    }
};

// Function to display setup instructions
function displaySetupInstructions() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 SETUP INSTRUCTIONS FOR CURL EXTRACTION');
    console.log('='.repeat(80));
    console.log('1. 🌐 Go to any iexitapp.com page (e.g., https://www.iexitapp.com/exits/Alabama/I-10/East/648)');
    console.log('2. 🔧 Open DevTools:');
    console.log('   • Right-click → Inspect OR');
    console.log('   • Press Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)');
    console.log('3. 📡 Go to the Network tab');
    console.log('4. 🔄 Refresh the page');
    console.log('5. 🔍 Find the main request (usually the first one):');
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
    
    console.log(`✅ Extracted ${Object.keys(headers).length} headers and ${cookies.length} cookies`);
    
    // Display some key headers for verification
    if (headers['user-agent']) {
        console.log(`🌐 User-Agent: ${headers['user-agent'].substring(0, 50)}...`);
    }
    if (cookies.find(c => c.name === 'cf_clearance')) {
        console.log('🔐 Cloudflare clearance cookie found');
    }
    
    return { headers, cookies };
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
        console.log('');
        
        rl.question('📋 Paste your cURL command and press Enter: ', (input) => {
            rl.close();
            resolve(input.trim());
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

class WebpageDownloader {
    constructor(browserConfig = null) {
        this.browser = null;
        this.page = null;
        this.browserConfig = browserConfig || this.getDefaultConfig();
        this.outputDir = CONFIG.OUTPUT_DIR;
        this.downloadCount = 0;
        this.failedDownloads = [];
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

    // Create output directory
    async createOutputDirectory() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
                console.log(`📁 Created output directory: ${this.outputDir}`);
            } else {
                console.log(`📁 Output directory already exists: ${this.outputDir}`);
            }
        } catch (error) {
            console.error('❌ Failed to create output directory:', error.message);
            throw error;
        }
    }

    // Read CSV file and extract exit links
    async readCSVFile() {
        console.log(`📖 Reading CSV file: ${CONFIG.CSV_FILE}`);
        
        return new Promise((resolve, reject) => {
            const exitLinks = [];
            
            fs.createReadStream(CONFIG.CSV_FILE)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.Exit_Link && row.Exit_Link.trim() !== '' && !row.Exit_Link.includes('No exits found')) {
                        exitLinks.push({
                            state: row.State,
                            highway: row.Highway,
                            url: row.Exit_Link.trim()
                        });
                    }
                })
                .on('end', () => {
                    console.log(`✅ Read ${exitLinks.length} exit links from CSV`);
                    
                    // Apply test mode limit if enabled
                    if (CONFIG.TEST_MODE) {
                        const testLinks = exitLinks.slice(0, CONFIG.TEST_LIMIT);
                        console.log(`🧪 Test mode: Processing only ${testLinks.length} links`);
                        resolve(testLinks);
                    } else {
                        resolve(exitLinks);
                    }
                })
                .on('error', (error) => {
                    console.error('❌ Error reading CSV file:', error.message);
                    reject(error);
                });
        });
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
    }

    // Generate filename from URL
    generateFilename(url, state, highway) {
        // Extract meaningful parts from URL
        const urlParts = url.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        
        // Clean state and highway for filename
        const cleanState = state.replace(/[^a-zA-Z0-9]/g, '_');
        const cleanHighway = highway.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Create filename
        const filename = `${cleanState}_${cleanHighway}_${lastPart}.html`;
        return filename;
    }

    // Download single webpage with all resources
    async downloadWebpage(exitLink) {
        const { state, highway, url } = exitLink;
        console.log(`\n🌐 Downloading: ${state} - ${highway}`);
        console.log(`🔗 URL: ${url}`);
        
        try {
            // Create subdirectory for this webpage
            const cleanState = state.replace(/[^a-zA-Z0-9]/g, '_');
            const cleanHighway = highway.replace(/[^a-zA-Z0-9]/g, '_');
            const urlParts = url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            const webpageDir = `${cleanState}_${cleanHighway}_${lastPart}`;
            const fullWebpageDir = path.join(this.outputDir, webpageDir);
            
            if (!fs.existsSync(fullWebpageDir)) {
                fs.mkdirSync(fullWebpageDir, { recursive: true });
            }
            
            // Create a new page for this download to avoid conflicts
            const downloadPage = await this.browser.newPage();
            
            // Set user agent and headers for the new page
            const userAgent = this.browserConfig.headers['user-agent'] || 
                             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
            await downloadPage.setUserAgent(userAgent);
            await downloadPage.setExtraHTTPHeaders(this.browserConfig.headers);
            
            // Set cookies if any are provided
            if (this.browserConfig.cookies && this.browserConfig.cookies.length > 0) {
                await downloadPage.setCookie(...this.browserConfig.cookies);
            }
            
            // Set up request interception to save resources
            await downloadPage.setRequestInterception(true);
            const resourceMap = new Map();
            const handledRequests = new Set();
            
            downloadPage.on('request', (request) => {
                const requestId = request.url() + request.method();
                if (!handledRequests.has(requestId)) {
                    handledRequests.add(requestId);
                    request.continue();
                } else {
                    // Request already handled, abort it
                    request.abort();
                }
            });
            
            downloadPage.on('response', async (response) => {
                const responseUrl = response.url();
                const resourceType = response.request().resourceType();
                
                // Save CSS, JS, images, fonts, and other resources
                if (['stylesheet', 'script', 'image', 'font', 'media'].includes(resourceType)) {
                    try {
                        const buffer = await response.buffer();
                        const urlObj = new URL(responseUrl);
                        let filename = path.basename(urlObj.pathname) || 'resource';
                        
                        // Generate filename if empty or add extension based on content type
                        if (!filename || filename === 'resource') {
                            const contentType = response.headers()['content-type'] || '';
                            if (contentType.includes('css')) filename = 'style.css';
                            else if (contentType.includes('javascript')) filename = 'script.js';
                            else if (contentType.includes('image')) {
                                const ext = contentType.split('/')[1] || 'png';
                                filename = `image.${ext}`;
                            }
                            else filename = 'resource';
                        }
                        
                        // Ensure unique filename
                        let counter = 1;
                        const originalFilename = filename;
                        while (resourceMap.has(filename)) {
                            const ext = path.extname(originalFilename);
                            const name = path.basename(originalFilename, ext);
                            filename = `${name}_${counter}${ext}`;
                            counter++;
                        }
                        
                        resourceMap.set(filename, responseUrl);
                        const resourcePath = path.join(fullWebpageDir, filename);
                        fs.writeFileSync(resourcePath, buffer);
                        console.log(`📦 Saved resource: ${filename}`);
                    } catch (error) {
                        console.log(`⚠️  Failed to save resource: ${responseUrl} - ${error.message}`);
                    }
                }
            });
            
            // Navigate to the page
            await downloadPage.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // Wait for page to fully load
            await this.sleep(CONFIG.DELAYS.PAGE_LOAD);
            
            // Check if manual intervention is needed (Cloudflare, etc.)
            const needsManualConfirmation = await downloadPage.evaluate(() => {
                return document.title.toLowerCase().includes('cloudflare') || 
                       document.body.textContent.toLowerCase().includes('checking your browser') ||
                       document.body.textContent.toLowerCase().includes('captcha') ||
                       document.body.textContent.toLowerCase().includes('just a moment');
            });
            
            if (needsManualConfirmation) {
                console.log('🛑 Manual confirmation needed. Waiting 15 seconds...');
                await this.sleep(15000);
                
                // Wait for page to load after Cloudflare
                await downloadPage.waitForSelector('body', { timeout: 30000 });
                await this.sleep(CONFIG.DELAYS.RESOURCE_WAIT);
            }
            
            // Wait for all resources to finish loading
            await downloadPage.waitForFunction(() => {
                const images = document.querySelectorAll('img');
                const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
                const scripts = document.querySelectorAll('script[src]');
                
                return Array.from(images).every(img => img.complete) &&
                       Array.from(stylesheets).every(link => link.sheet) &&
                       Array.from(scripts).every(script => script.readyState === 'complete' || !script.readyState);
            }, { timeout: 30000 }).catch(() => {
                console.log('⚠️  Resource loading timeout, proceeding anyway...');
            });
            
            // Get the complete HTML content
            let htmlContent = await downloadPage.content();
            
            // Update HTML to use local resources
            for (const [filename, originalUrl] of resourceMap) {
                const urlObj = new URL(originalUrl);
                htmlContent = htmlContent.replace(new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), filename);
                htmlContent = htmlContent.replace(new RegExp(urlObj.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), filename);
            }
            
            // Generate main HTML filename
            const mainFilename = `${webpageDir}.html`;
            const mainFilepath = path.join(fullWebpageDir, mainFilename);
            
            // Save the main HTML file
            fs.writeFileSync(mainFilepath, htmlContent, 'utf8');
            
            // Close the download page to free up resources
            await downloadPage.close();
            
            console.log(`✅ Downloaded complete webpage: ${webpageDir}/`);
            console.log(`📄 Main file: ${mainFilename}`);
            console.log(`📦 Resources saved: ${resourceMap.size}`);
            this.downloadCount++;
            
            // Add delay between downloads
            await this.sleep(CONFIG.DELAYS.BETWEEN_DOWNLOADS);
            
            return { success: true, filename: webpageDir, filepath: fullWebpageDir };
            
        } catch (error) {
            console.error(`❌ Failed to download ${url}:`, error.message);
            this.failedDownloads.push({ url, state, highway, error: error.message });
            return { success: false, error: error.message };
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

    // Main download function
    async downloadAll() {
        try {
            // Create output directory
            await this.createOutputDirectory();
            
            // Read CSV file
            const exitLinks = await this.readCSVFile();
            
            if (exitLinks.length === 0) {
                console.log('⚠️  No valid exit links found in CSV file');
                return;
            }
            
            // Initialize browser
            await this.initBrowser();
            
            console.log(`\n🚀 Starting download of ${exitLinks.length} webpages...`);
            console.log('='.repeat(60));
            
            // Download each webpage
            for (let i = 0; i < exitLinks.length; i++) {
                const exitLink = exitLinks[i];
                console.log(`\n📊 Progress: ${i + 1}/${exitLinks.length}`);
                
                const result = await this.downloadWebpage(exitLink);
                
                if (!result.success) {
                    console.log(`⚠️  Skipping to next link...`);
                }
            }
            
            // Display final summary
            console.log('\n📊 DOWNLOAD SUMMARY:');
            console.log('='.repeat(40));
            console.log(`✅ Successfully downloaded: ${this.downloadCount}`);
            console.log(`❌ Failed downloads: ${this.failedDownloads.length}`);
            console.log(`📁 Output directory: ${this.outputDir}`);
            
            if (this.failedDownloads.length > 0) {
                console.log('\n❌ Failed Downloads:');
                this.failedDownloads.forEach(failed => {
                    console.log(`   • ${failed.state} - ${failed.highway}: ${failed.error}`);
                });
            }
            
            // Save failed downloads log
            if (this.failedDownloads.length > 0) {
                const failedLog = path.join(this.outputDir, 'failed_downloads.json');
                fs.writeFileSync(failedLog, JSON.stringify(this.failedDownloads, null, 2));
                console.log(`📝 Failed downloads log saved to: ${failedLog}`);
            }
            
        } catch (error) {
            console.error('❌ Download process failed:', error.message);
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
    console.log('🎯 Starting Interstate Webpage Downloader');
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
    
    // Initialize downloader
    const downloader = new WebpageDownloader(browserConfig);
    
    try {
        await downloader.downloadAll();
        console.log('\n✅ Download process completed successfully!');
    } catch (error) {
        console.error('\n❌ Download process failed:', error.message);
        
        // Provide helpful debugging info
        console.log('\n🔧 Debugging Tips:');
        console.log('1. Make sure the cURL command includes fresh cookies');
        console.log('2. Try refreshing the page and getting a new cURL command');
        console.log('3. Check if Cloudflare protection is active');
        console.log('4. Verify the CSV file exists and has valid links');
        
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

module.exports = WebpageDownloader;