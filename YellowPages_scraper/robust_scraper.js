const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs-extra');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
    csvFilePath: 'C:/Users/clint/Desktop/Geocoding_Task/Yelp_Lookup/10.csv',
    outputFilePath: 'yellowpages_robust_scraped_data.csv',
    phoneNumbersToProcess: 'all', // Process all phone numbers instead of limiting to 5
    batchSize: 50, // Process phone numbers in batches
    saveProgressInterval: 10, // Save progress every N phone numbers
    resumeFromProgress: true, // Resume from where we left off
    progressFilePath: 'scraping_progress.json', // File to store progress
    delays: {
        betweenRequests: 3000,
        pageLoad: 2000,
        humanLike: { min: 1000, max: 3000 },
        scroll: { min: 100, max: 300 },
        mouse: { min: 100, max: 200 },
        betweenBatches: 5000 // Extra delay between batches
    },
    browser: {
        headless: true, // Use headless for stability
        timeout: 15000, // Reduced timeout
        viewport: { width: 1366, height: 768 }
    }
};

class RobustYellowPagesScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.allScrapedData = [];
        this.processedPhones = new Set(); // Track processed phone numbers
        this.currentBatch = 0;
        this.totalBatches = 0;
        this.totalPhones = 0;
        this.processedCount = 0;
        this.startTime = null;
        this.progressData = {
            processedPhones: [],
            currentIndex: 0,
            totalPhones: 0,
            startTime: null,
            lastSaved: null
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomDelay(min = CONFIG.delays.humanLike.min, max = CONFIG.delays.humanLike.max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    formatPhoneNumber(phone) {
        return phone.replace(/-/g, '+');
    }

    constructSearchUrl(formattedPhone) {
        return `https://www.yellowpages.com/search?search_terms=${formattedPhone}`;
    }

    // Progress tracking methods
    async loadProgress() {
        try {
            if (CONFIG.resumeFromProgress && fs.existsSync(CONFIG.progressFilePath)) {
                const progressJson = await fs.readFile(CONFIG.progressFilePath, 'utf-8');
                this.progressData = JSON.parse(progressJson);
                this.processedPhones = new Set(this.progressData.processedPhones);
                console.log(`📊 Loaded progress: ${this.processedPhones.size} phones already processed`);
                return true;
            }
        } catch (error) {
            console.error('❌ Error loading progress:', error.message);
        }
        return false;
    }

    async saveProgress() {
        try {
            this.progressData.processedPhones = Array.from(this.processedPhones);
            this.progressData.currentIndex = this.processedCount;
            this.progressData.totalPhones = this.totalPhones;
            this.progressData.lastSaved = new Date().toISOString();
            
            await fs.writeFile(CONFIG.progressFilePath, JSON.stringify(this.progressData, null, 2));
            console.log(`💾 Progress saved: ${this.processedCount}/${this.totalPhones} completed`);
        } catch (error) {
            console.error('❌ Error saving progress:', error.message);
        }
    }

    displayProgress() {
        const elapsed = Date.now() - this.startTime;
        const elapsedMinutes = Math.floor(elapsed / 60000);
        const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
        
        const percentage = ((this.processedCount / this.totalPhones) * 100).toFixed(1);
        const avgTimePerPhone = elapsed / this.processedCount;
        const estimatedRemainingTime = (this.totalPhones - this.processedCount) * avgTimePerPhone;
        const remainingMinutes = Math.floor(estimatedRemainingTime / 60000);
        const remainingSeconds = Math.floor((estimatedRemainingTime % 60000) / 1000);
        
        console.log(`\n📈 Progress: ${this.processedCount}/${this.totalPhones} (${percentage}%)`);
        console.log(`⏱️  Elapsed: ${elapsedMinutes}m ${elapsedSeconds}s`);
        console.log(`⏳ Estimated remaining: ${remainingMinutes}m ${remainingSeconds}s`);
        console.log(`📦 Batch: ${this.currentBatch}/${this.totalBatches}`);
        console.log(`📊 Records collected: ${this.allScrapedData.length}`);
    }

    // Batch processing methods
    createBatches(phoneNumbers) {
        const batches = [];
        for (let i = 0; i < phoneNumbers.length; i += CONFIG.batchSize) {
            batches.push(phoneNumbers.slice(i, i + CONFIG.batchSize));
        }
        return batches;
    }

    async processBatch(batch, batchIndex) {
        console.log(`\n🔄 Processing batch ${batchIndex + 1}/${this.totalBatches} (${batch.length} phones)`);
        
        const batchStartTime = Date.now();
        let batchSuccessCount = 0;
        let batchErrorCount = 0;
        
        for (let i = 0; i < batch.length; i++) {
            const phone = batch[i];
            
            // Skip if already processed
            if (this.processedPhones.has(phone)) {
                console.log(`⏭️  Skipping already processed: ${phone}`);
                continue;
            }
            
            const formattedPhone = this.formatPhoneNumber(phone);
            const searchUrl = this.constructSearchUrl(formattedPhone);
            
            console.log(`\n📱 Processing ${this.processedCount + 1}/${this.totalPhones}: ${phone} → ${formattedPhone}`);
            
            try {
                const businessLinks = await this.extractBusinessLinks(searchUrl);
                console.log(`  🔍 Found ${businessLinks.length} business links`);
                
                if (businessLinks.length === 0) {
                    // Add record even if no businesses found
                    this.allScrapedData.push({
                        original_phone: phone,
                        formatted_phone: formattedPhone,
                        search_url: searchUrl,
                        scraped_at: new Date().toISOString(),
                        status: 'no_results_found'
                    });
                } else {
                    // Process each business (limit to first 3 for stability)
                    const linksToProcess = businessLinks.slice(0, 3);
                    for (let j = 0; j < linksToProcess.length; j++) {
                        const businessUrl = linksToProcess[j];
                        console.log(`    🏢 Processing business ${j + 1}/${linksToProcess.length}`);
                        
                        const businessData = await this.extractBusinessData(businessUrl, phone, searchUrl);
                        this.allScrapedData.push(businessData);
                        
                        console.log(`      ✅ ${businessData.business_name || 'Business'} scraped`);
                        
                        if (j < linksToProcess.length - 1) {
                            await this.sleep(this.randomDelay(500, 1500));
                        }
                    }
                }
                
                batchSuccessCount++;
                
            } catch (error) {
                console.error(`  ❌ Error processing ${phone}:`, error.message);
                this.allScrapedData.push({
                    original_phone: phone,
                    formatted_phone: formattedPhone,
                    search_url: searchUrl,
                    scraped_at: new Date().toISOString(),
                    error: error.message
                });
                batchErrorCount++;
            }
            
            // Mark as processed
            this.processedPhones.add(phone);
            this.processedCount++;
            
            // Save progress periodically
            if (this.processedCount % CONFIG.saveProgressInterval === 0) {
                await this.saveProgress();
                await this.saveIntermediateResults();
            }
            
            // Display progress
            if (this.processedCount % 5 === 0) {
                this.displayProgress();
            }
            
            // Delay between phone searches
            if (i < batch.length - 1) {
                await this.sleep(CONFIG.delays.betweenRequests);
            }
        }
        
        const batchDuration = Date.now() - batchStartTime;
        const batchMinutes = Math.floor(batchDuration / 60000);
        const batchSeconds = Math.floor((batchDuration % 60000) / 1000);
        
        console.log(`\n✅ Batch ${batchIndex + 1} completed in ${batchMinutes}m ${batchSeconds}s`);
        console.log(`   📊 Success: ${batchSuccessCount}, Errors: ${batchErrorCount}`);
        
        // Save progress after each batch
        await this.saveProgress();
        await this.saveIntermediateResults();
        
        // Extra delay between batches
        if (batchIndex < this.totalBatches - 1) {
            console.log(`⏸️  Waiting ${CONFIG.delays.betweenBatches}ms before next batch...`);
            await this.sleep(CONFIG.delays.betweenBatches);
        }
    }

    async saveIntermediateResults() {
        if (this.allScrapedData.length > 0) {
            const tempFilePath = `temp_${CONFIG.outputFilePath}`;
            try {
                await this.saveToCsv(tempFilePath);
                console.log(`💾 Intermediate results saved to ${tempFilePath}`);
            } catch (error) {
                console.error('❌ Error saving intermediate results:', error.message);
            }
        }
    }

    // Read phone numbers from CSV
    async readPhoneNumbers() {
        return new Promise((resolve, reject) => {
            const phones = [];
            fs.createReadStream(CONFIG.csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.phone && row.phone.trim() !== '') {
                        phones.push(row.phone.trim());
                    }
                })
                .on('end', () => {
                    const uniquePhones = [...new Set(phones)];
                    console.log(`Found ${uniquePhones.length} unique phone numbers`);
                    
                    // Process all phone numbers instead of limiting to a specific count
                    if (CONFIG.phoneNumbersToProcess === 'all') {
                        console.log(`Processing all ${uniquePhones.length} phone numbers`);
                        resolve(uniquePhones);
                    } else {
                        // Legacy behavior: shuffle and limit
                        const shuffled = uniquePhones.sort(() => 0.5 - Math.random());
                        const selected = shuffled.slice(0, CONFIG.phoneNumbersToProcess);
                        console.log(`Processing ${selected.length} randomly selected phone numbers`);
                        resolve(selected);
                    }
                })
                .on('error', reject);
        });
    }

    // Initialize browser with retry logic
    async initializeBrowser(retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Initializing browser (attempt ${attempt}/${retries})...`);
                
                this.browser = await puppeteer.launch({
                    headless: CONFIG.browser.headless,
                    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-images' // Speed up loading
                    ]
                });
                
                this.page = await this.browser.newPage();
                await this.page.setViewport(CONFIG.browser.viewport);
                await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
                
                console.log('✅ Browser initialized successfully');
                return;
                
            } catch (error) {
                console.error(`❌ Browser initialization failed (attempt ${attempt}):`, error.message);
                
                if (this.browser) {
                    try {
                        await this.browser.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                    this.browser = null;
                    this.page = null;
                }
                
                if (attempt === retries) {
                    throw new Error(`Failed to initialize browser after ${retries} attempts`);
                }
                
                await this.sleep(2000); // Wait before retry
            }
        }
    }

    // Extract business links with timeout
    async extractBusinessLinks(searchUrl) {
        try {
            console.log(`  Navigating to: ${searchUrl}`);
            
            await this.page.goto(searchUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: CONFIG.browser.timeout 
            });
            
            await this.sleep(CONFIG.delays.pageLoad);
            
            // Try to find business links
            const businessLinks = await this.page.evaluate(() => {
                const links = new Set();
                
                // Multiple strategies to find business links
                const selectors = [
                    'a.business-name',
                    'a[href*="/mip/"]',
                    '.result a[href*="/mip/"]',
                    '[data-listing-id] a[href*="/mip/"]'
                ];
                
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        const href = element.getAttribute('href');
                        if (href && href.startsWith('/')) {
                            links.add(`https://www.yellowpages.com${href}`);
                        }
                    });
                });
                
                return Array.from(links);
            });
            
            return businessLinks;
            
        } catch (error) {
            console.error(`  ❌ Error extracting business links:`, error.message);
            return [];
        }
    }

    // Simple business data extraction
    async extractBusinessData(businessUrl, originalPhone, searchUrl) {
        try {
            await this.page.goto(businessUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: CONFIG.browser.timeout 
            });
            
            await this.sleep(1000);
            
            const businessData = await this.page.evaluate((originalPhone, searchUrl) => {
                const data = {
                    original_phone: originalPhone,
                    search_url: searchUrl,
                    business_url: window.location.href,
                    scraped_at: new Date().toISOString()
                };
                
                // Extract basic business info
                const nameElement = document.querySelector('h1, .business-name h1, [data-analytics="businessName"]');
                if (nameElement) {
                    data.business_name = nameElement.textContent.trim();
                }
                
                const phoneElement = document.querySelector('[data-analytics="phone"], .phone, a[href^="tel:"]');
                if (phoneElement) {
                    data.phone = (phoneElement.textContent || phoneElement.getAttribute('href')).replace('tel:', '').trim();
                }
                
                const addressElement = document.querySelector('.address, .business-address');
                if (addressElement) {
                    data.address = addressElement.textContent.trim();
                }
                
                const websiteElement = document.querySelector('[data-analytics="website"], .website a');
                if (websiteElement) {
                    data.website = websiteElement.getAttribute('href');
                }
                
                // Extract categories
                const categoriesElement = document.querySelector('.categories');
                if (categoriesElement) {
                    const categoryLinks = categoriesElement.querySelectorAll('a');
                    if (categoryLinks.length > 0) {
                        const categories = Array.from(categoryLinks).map(link => link.textContent.trim());
                        data.categories = categories.join(', ');
                    }
                } else {
                    // Try alternative category selectors
                    const altSelectors = [
                        '.business-categories a',
                        '.category-links a',
                        '[data-analytics*="category"] a',
                        '.categories-list a',
                        '.business-info .categories a',
                        '.listing-categories a'
                    ];
                    
                    for (const selector of altSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            const categories = Array.from(elements).map(el => el.textContent.trim());
                            data.categories = categories.join(', ');
                            break; // Use first successful selector
                        }
                    }
                }
                
                // Extract AKA (Also Known As) information
                const akaElement = document.querySelector('dd.aka');
                if (akaElement) {
                    const akaParagraphs = akaElement.querySelectorAll('p');
                    if (akaParagraphs.length > 0) {
                        // Extract text from all paragraphs and join with commas
                        const akaNames = Array.from(akaParagraphs).map(p => p.textContent.trim());
                        data.aka = akaNames.join(', ');
                    }
                } else {
                    // Try alternative selectors for AKA
                    const altAkaSelectors = [
                        '.aka p',
                        '.also-known-as p',
                        '[class*="aka"] p',
                        '.business-aka p',
                        'dd[class*="aka"] p'
                    ];
                    
                    for (const selector of altAkaSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            const akaNames = Array.from(elements).map(el => el.textContent.trim());
                            data.aka = akaNames.join(', ');
                            break;
                        }
                    }
                }
                
                // Extract extra phone numbers
                const extraPhoneElement = document.querySelector('dd.extra-phones');
                if (extraPhoneElement) {
                    const phoneNumbers = [];
                    
                    // Look for all <p> tags within extra-phones
                    const phoneParagraphs = extraPhoneElement.querySelectorAll('p');
                    phoneParagraphs.forEach(p => {
                        const spans = p.querySelectorAll('span');
                        if (spans.length >= 2) {
                            // Get the phone number from the second span
                            const phoneNumber = spans[1].textContent.trim();
                            // Clean the phone number: remove parentheses and hyphens, keep only digits and spaces
                            const cleanPhone = phoneNumber.replace(/[()]/g, '').replace(/-/g, ' ');
                            if (cleanPhone.match(/\d{3}[\s]*\d{3}[\s]*\d{4}/)) {
                                phoneNumbers.push(cleanPhone);
                            }
                        }
                    });
                    
                    // If no paragraphs found, try the original approach
                    if (phoneNumbers.length === 0) {
                        const phoneSpans = extraPhoneElement.querySelectorAll('span');
                        if (phoneSpans.length > 1) {
                            const phoneNumber = phoneSpans[1].textContent.trim();
                            const cleanPhone = phoneNumber.replace(/[()]/g, '').replace(/-/g, ' ');
                            if (cleanPhone.match(/\d{3}[\s]*\d{3}[\s]*\d{4}/)) {
                                phoneNumbers.push(cleanPhone);
                            }
                        }
                    }
                    
                    if (phoneNumbers.length > 0) {
                        data.extra_phones = phoneNumbers.join(', ');
                    }
                } else {
                    // Try alternative selectors for extra phones
                    const altSelectors = [
                        '.extra-phones span:last-child',
                        '.additional-phones span:last-child',
                        '[class*="extra-phone"] span:last-child',
                        '.phone-numbers .additional span:last-child',
                        'dd[class*="phone"] span:last-child'
                    ];
                    
                    for (const selector of altSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const phoneText = element.textContent.trim();
                            // Check if it looks like a phone number
                            if (phoneText.match(/\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{4}/)) {
                                const cleanPhone = phoneText.replace(/[()]/g, '').replace(/-/g, ' ');
                                data.extra_phones = cleanPhone;
                                break;
                            }
                        }
                    }
                }
                
                // Try to extract JSON-LD data
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                jsonLdScripts.forEach((script, index) => {
                    try {
                        const jsonData = JSON.parse(script.textContent);
                        if (jsonData.name) data[`jsonld_name_${index + 1}`] = jsonData.name;
                        if (jsonData.telephone) data[`jsonld_phone_${index + 1}`] = jsonData.telephone;
                        if (jsonData.address) {
                            const addr = jsonData.address;
                            if (addr.streetAddress) data[`jsonld_street_${index + 1}`] = addr.streetAddress;
                            if (addr.addressLocality) data[`jsonld_city_${index + 1}`] = addr.addressLocality;
                            if (addr.addressRegion) data[`jsonld_state_${index + 1}`] = addr.addressRegion;
                            if (addr.postalCode) data[`jsonld_zip_${index + 1}`] = addr.postalCode;
                        }
                        if (jsonData.geo) {
                            if (jsonData.geo.latitude) data[`jsonld_lat_${index + 1}`] = jsonData.geo.latitude;
                            if (jsonData.geo.longitude) data[`jsonld_lng_${index + 1}`] = jsonData.geo.longitude;
                        }
                    } catch (e) {
                        // Ignore JSON parsing errors
                    }
                });
                
                return data;
            }, originalPhone, searchUrl);
            
            return businessData;
            
        } catch (error) {
            console.error(`    ❌ Error extracting business data:`, error.message);
            return {
                original_phone: originalPhone,
                search_url: searchUrl,
                business_url: businessUrl,
                scraped_at: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Main scraping process
    async scrape() {
        console.log('🚀 Starting Robust YellowPages scraper with batch processing...');
        
        try {
            // Load existing progress
            await this.loadProgress();
            
            // Read phone numbers
            const allPhoneNumbers = await this.readPhoneNumbers();
            console.log(`📞 Found ${allPhoneNumbers.length} phone numbers to process`);
            
            // Filter out already processed phones
            const remainingPhones = allPhoneNumbers.filter(phone => !this.processedPhones.has(phone));
            console.log(`📋 Remaining phones to process: ${remainingPhones.length}`);
            
            if (remainingPhones.length === 0) {
                console.log('✅ All phone numbers have already been processed!');
                return;
            }
            
            // Set up tracking variables
            this.totalPhones = allPhoneNumbers.length;
            this.processedCount = this.processedPhones.size;
            this.startTime = Date.now();
            this.progressData.startTime = this.progressData.startTime || new Date().toISOString();
            
            // Create batches
            const batches = this.createBatches(remainingPhones);
            this.totalBatches = batches.length;
            
            console.log(`📦 Created ${this.totalBatches} batches of ${CONFIG.batchSize} phones each`);
            console.log(`� Starting from ${this.processedCount}/${this.totalPhones} phones processed`);
            
            // Initialize browser
            await this.initializeBrowser();
            
            // Process batches
            for (let i = 0; i < batches.length; i++) {
                this.currentBatch = i + 1;
                await this.processBatch(batches[i], i);
            }
            
            // Final progress display
            this.displayProgress();
            console.log('\n🎉 All batches completed successfully!');
            
        } catch (error) {
            console.error('❌ Critical error:', error.message);
            await this.saveProgress(); // Save progress even on error
        } finally {
            // Always save data and cleanup
            await this.saveAndCleanup();
        }
    }

    async saveAndCleanup() {
        // Save final progress
        await this.saveProgress();
        
        // Save data
        if (this.allScrapedData.length > 0) {
            console.log(`\n💾 Saving ${this.allScrapedData.length} records to CSV...`);
            try {
                await this.saveToCsv();
                console.log(`✅ Data saved to ${CONFIG.outputFilePath}`);
                
                // Verify file exists
                if (fs.existsSync(CONFIG.outputFilePath)) {
                    const stats = fs.statSync(CONFIG.outputFilePath);
                    console.log(`📄 File verified - Size: ${stats.size} bytes`);
                }
                
                // Clean up temp files
                const tempFilePath = `temp_${CONFIG.outputFilePath}`;
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🧹 Cleaned up temporary file: ${tempFilePath}`);
                }
                
                // If all phones processed, clean up progress file
                if (this.processedCount >= this.totalPhones) {
                    if (fs.existsSync(CONFIG.progressFilePath)) {
                        fs.unlinkSync(CONFIG.progressFilePath);
                        console.log(`🧹 Cleaned up progress file: ${CONFIG.progressFilePath}`);
                    }
                }
                
            } catch (saveError) {
                console.error('❌ Error saving CSV:', saveError.message);
            }
        } else {
            console.log('❌ No data to save');
        }
        
        // Close browser
        if (this.browser) {
            try {
                await this.browser.close();
                console.log('✅ Browser closed');
            } catch (browserError) {
                console.error('❌ Error closing browser:', browserError.message);
            }
        }
        
        console.log('🏁 Scraping completed!');
    }

    async saveToCsv(tempFilePath = CONFIG.outputFilePath) {
        if (this.allScrapedData.length === 0) return;
        
        // Get all unique keys
        const allKeys = new Set();
        this.allScrapedData.forEach(item => {
            Object.keys(item).forEach(key => allKeys.add(key));
        });
        
        // Create headers
        const headers = Array.from(allKeys).sort().map(key => ({
            id: key,
            title: key.toUpperCase()
        }));
        
        const csvWriter = createCsvWriter({
            path: tempFilePath,
            header: headers
        });
        
        await csvWriter.writeRecords(this.allScrapedData);
    }
}

// Run the scraper
async function runRobustScraper() {
    const scraper = new RobustYellowPagesScraper();
    await scraper.scrape();
}

if (require.main === module) {
    runRobustScraper().catch(console.error);
}

module.exports = { RobustYellowPagesScraper, runRobustScraper };
