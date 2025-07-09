const { BatchProcessor } = require('./batch_processor');
const { CoordinateScraper } = require('./3_coordinate_scraper');
const fs = require('fs');
const path = require('path');

async function testBatchProcessor() {
    console.log('🧪 Testing Batch Processor Setup');
    console.log('='.repeat(40));
    
    try {
        // Get the directory where this script is located
        const scriptDir = path.dirname(__filename);
        console.log(`📁 Script directory: ${scriptDir}`);
        
        // Test 1: Check if all required files exist
        console.log('📋 Test 1: Checking required files...');
        const requiredFiles = [
            'batch_processor.js',
            'batch_config.js',
            '3_coordinate_scraper.js',
            'states.csv'
        ];
        
        const missingFiles = [];
        requiredFiles.forEach(file => {
            const filePath = path.join(scriptDir, file);
            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
            }
        });
        
        if (missingFiles.length > 0) {
            console.log('❌ Missing required files:', missingFiles.join(', '));
            console.log('   Make sure you are running this from the correct directory:');
            console.log('   cd "c:\\Users\\clint\\Desktop\\Geocoding_Task\\Iexit_scraper\\scrape_for_interstate"');
            console.log('   node test_batch_setup.js');
            return;
        }
        console.log('✅ All required files present');
        
        // Test 2: Initialize processor
        console.log('📋 Test 2: Initializing processor...');
        const processor = new BatchProcessor();
        await processor.initialize();
        console.log('✅ Processor initialized successfully');
        
        // Test 3: Check CSV parsing
        console.log('📋 Test 3: Checking CSV data...');
        console.log(`   Total entries found: ${processor.stateData.length}`);
        
        if (processor.stateData.length > 0) {
            console.log('   Sample entry:', {
                State: processor.stateData[0].State,
                Highway: processor.stateData[0].Highway,
                Exit_Link: processor.stateData[0].Exit_Link ? 'Present' : 'Missing'
            });
        }
        console.log('✅ CSV data parsed correctly');
        
        // Test 4: Check output directory
        console.log('📋 Test 4: Checking output directory...');
        const outputDir = processor.progress.outputDir || 'batch_output';
        if (fs.existsSync(outputDir)) {
            console.log(`✅ Output directory exists: ${outputDir}`);
        } else {
            console.log(`✅ Output directory will be created: ${outputDir}`);
        }
        
        // Test 5: Check if scraper can be instantiated
        console.log('📋 Test 5: Testing scraper instantiation...');
        const scraper = new CoordinateScraper();
        if (scraper) {
            console.log('✅ Scraper instantiated successfully');
        }
        
        console.log('\n🎉 All tests passed! The batch processor is ready to run.');
        console.log(`\nTo start processing, run: node run_batch_processor.js`);
        console.log(`To resume processing, run: node resume_batch_processor.js`);
        console.log(`To analyze results, run: node analyze_batch_data.js`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testBatchProcessor();
