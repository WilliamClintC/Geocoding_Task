const { BatchProcessor } = require('./batch_processor');

async function testCurlInput() {
    console.log('🧪 Testing Curl Command Input');
    console.log('='.repeat(40));
    
    try {
        const processor = new BatchProcessor();
        
        console.log('📋 Testing curl command input...');
        await processor.getInitialCurlCommand();
        
        console.log('✅ Curl command input test completed');
        console.log('Configuration stored:', processor.browserConfig ? 'Yes' : 'No (using default)');
        
        if (processor.browserConfig) {
            console.log(`Headers count: ${Object.keys(processor.browserConfig.headers).length}`);
            console.log(`Cookies count: ${processor.browserConfig.cookies.length}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testCurlInput();
