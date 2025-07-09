# YellowPages Scraper with Puppeteer Stealth

This project provides a robust web scraper for YellowPages.com using Puppeteer with the Stealth plugin to avoid detection and gather business information based on phone numbers.

## Features

- **Stealth Mode**: Uses Puppeteer Stealth plugin to avoid bot detection
- **Phone Number Processing**: Reads phone numbers from CSV and processes them
- **Human-like Behavior**: Implements scrolling, mouse movements, and random delays
- **Comprehensive Data Extraction**: Extracts structured and unstructured data from business pages
- **CSV Export**: Saves all extracted data to CSV with dynamic column structure
- **Error Handling**: Robust error handling for failed requests and missing data

## Prerequisites

- Node.js (version 14 or higher)
- NPM (comes with Node.js)
- A CSV file with phone numbers (currently configured for `10.csv` in the Yelp_Lookup folder)

## Installation

1. **Enable PowerShell execution** (if needed):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. Navigate to the project directory:
   ```bash
   cd C:\Users\clint\Desktop\Geocoding_Task\YellowPages_scraper
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

   Or use the npm script:
   ```bash
   npm run install-deps
   ```

## Usage

Run the scraper:
```bash
npm start
```

Or alternatively:
```bash
npm run scrape
```

The scraper will:
1. Read phone numbers from `../Yelp_Lookup/10.csv`
2. Randomly select 5 unique phone numbers
3. Search for each phone number on YellowPages.com
4. Extract business information from search results
5. Save all data to `yellowpages_robust_scraped_data.csv`

## File Structure

- `robust_scraper.js` - Main scraper script
- `package.json` - Project dependencies and scripts
- `README.md` - This documentation
- `yellowpages_robust_scraped_data.csv` - Output file with scraped data

## Output

The scraper generates a CSV file with the following columns:
- ADDRESS - Full business address
- AKA - Also Known As / Alternative business names (supports multiple entries)
- BUSINESS_NAME - Name of the business
- BUSINESS_URL - YellowPages URL for the business
- CATEGORIES - Business categories (e.g., "Gas Stations, Convenience Stores")
- EXTRA_PHONES - Additional phone numbers (Fax, TollFree, etc.)
- JSONLD_* - Structured data fields (city, lat, lng, name, phone, state, street, zip)
- ORIGINAL_PHONE - The phone number used for searching
- PHONE - The phone number found on the business page
- SCRAPED_AT - Timestamp of when the data was scraped
- SEARCH_URL - The YellowPages search URL used
- WEBSITE - Business website URL (if available)

### Data Examples:
- **AKA**: `"Chevron Station #355746, Top Stop Chevron - Vernal C40"`
- **CATEGORIES**: `"Gas Stations, Convenience Stores"`
- **EXTRA_PHONES**: `"800 984 8289, 800 599 2729, 435 564 8262"`

2. **Test browser connectivity**:
   ```bash
   npm run connectivity-test
   ```

3. **Quick functionality test**:
   ```bash
   npm run quick-test
   ```

## Usage

### Basic Scraper

Run the basic scraper:
```bash
node scraper.js
```

Or use the npm script:
```bash
npm start
```

### Enhanced Scraper

Run the enhanced scraper (recommended):
```bash
node enhanced_scraper.js
```

## Configuration

### File Paths
- **Input CSV**: `C:/Users/clint/Desktop/Geocoding_Task/Yelp_Lookup/10.csv`
- **Output CSV**: `yellowpages_scraped_data.csv` (basic) or `yellowpages_enhanced_scraped_data.csv` (enhanced)

### Settings
You can modify the configuration in the scripts:

```javascript
const CONFIG = {
    csvFilePath: 'C:/Users/clint/Desktop/Geocoding_Task/Yelp_Lookup/10.csv',
    outputFilePath: 'yellowpages_enhanced_scraped_data.csv',
    phoneNumbersToProcess: 5,  // Number of phone numbers to process
    delays: {
        betweenRequests: 3000,  // Delay between phone number searches
        pageLoad: 2000,         // Wait time after page load
        humanLike: { min: 1000, max: 3000 }  // Random delay range
    }
};
```

## How It Works

1. **Phone Number Extraction**: 
   - Reads the CSV file and extracts unique phone numbers from the `phone` column
   - Randomly selects 5 phone numbers for processing

2. **Phone Number Formatting**:
   - Converts phone numbers from format `425-673-3675` to `425+673+3675`
   - Constructs search URLs: `https://www.yellowpages.com/search?search_terms=425+673+3675`

3. **Search Results Processing**:
   - Navigates to each search URL
   - Extracts business links from the search results
   - Finds links in `div.scrollable-pane > div.search-results.organic` container

4. **Business Data Extraction**:
   - Visits each business page
   - Extracts comprehensive information including:
     - Basic details (name, phone, address, website)
     - Business information sections
     - JSON-LD structured data
     - Categories and ratings
     - Metadata and additional fields

5. **Data Export**:
   - Saves all extracted data to CSV
   - Dynamically creates columns for all found fields
   - Maintains data integrity with proper escaping

## Data Fields Extracted

### Basic Information
- `original_phone`: The original phone number from the CSV
- `search_url`: The YellowPages search URL used
- `business_url`: The business page URL
- `business_name`: Extracted business name
- `address`: Business address
- `website`: Business website
- `categories`: Business categories/tags

### Detailed Information
- `phone_*`: All phone numbers found on the page
- `details_*`: Information from details card section
- `business_info_*`: Information from business info section
- `jsonld_*`: Structured data from JSON-LD scripts
- `meta_*`: Metadata from meta tags

### JSON-LD Structured Data
- `jsonld_id`: Business identifier
- `jsonld_name`: Business name
- `jsonld_telephone`: Phone number
- `jsonld_address_*`: Address components
- `jsonld_latitude`/`jsonld_longitude`: Coordinates
- `jsonld_image_*`: Image URLs
- `jsonld_opening_hours`: Business hours
- `jsonld_location_description`: Location landmarks

## Browser Settings

The scraper uses the following browser settings for stealth:
- Custom user agent
- Disabled security features
- Extra HTTP headers
- Viewport settings (1366x768)
- Various anti-detection measures

## Error Handling

The scraper includes comprehensive error handling for:
- Network timeouts
- Missing page elements
- Invalid phone numbers
- Parsing errors
- Browser crashes

## Output

The scraper generates CSV files with all extracted data. The CSV structure is dynamic and adapts to include all fields found during scraping.

Example output columns:
- `ORIGINAL_PHONE`
- `SEARCH_URL`
- `BUSINESS_URL`
- `BUSINESS_NAME`
- `ADDRESS`
- `WEBSITE`
- `CATEGORIES`
- `JSONLD_LATITUDE`
- `JSONLD_LONGITUDE`
- And many more...

## Notes

- The scraper runs in non-headless mode by default for debugging. Set `headless: true` for production use.
- Random delays are implemented to avoid being blocked
- The scraper respects robots.txt and implements reasonable delays
- All data is sanitized before CSV export

## Troubleshooting

1. **Browser won't start**: Make sure you have Chrome/Chromium installed
2. **CSV file not found**: Check the file path in the configuration
3. **No data extracted**: The website structure may have changed
4. **Memory issues**: Reduce the number of phone numbers to process

## Legal Disclaimer

This scraper is for educational and research purposes only. Please respect the website's terms of service and robots.txt file. Use responsibly and in accordance with applicable laws and regulations.
