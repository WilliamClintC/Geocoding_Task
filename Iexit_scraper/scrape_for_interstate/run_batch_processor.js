const { BatchProcessor } = require('./batch_processor');

async function main() {
    console.log('🎯 iExit Batch Processor Launcher');
    console.log('='.repeat(50));
    console.log('This will process all Exit_Link entries from states.csv');
    console.log('The process will run in batches with automatic session management');
    console.log('');
    console.log('Features:');
    console.log('✅ Batch processing (10 entries per batch)');
    console.log('✅ Progress tracking and resume capability');
    console.log('✅ Redundancy processing (reprocesses 2 previous entries for safety)');
    console.log('✅ Session expiration handling');
    console.log('🔔 Sound notifications for session expiration');
    console.log('✅ Combined CSV output');
    console.log('✅ Error handling and retry logic');
    console.log('');
    console.log('⚠️  IMPORTANT: You will need to provide a curl command');
    console.log('   from the iExit website to authenticate requests.');
    console.log('🔔 The system will play a sound when new cURL is needed.');
    console.log('');
    
    const processor = new BatchProcessor();
    
    try {
        await processor.initialize();
        
        // Show confirmation before starting
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('⚠️  CONFIRMATION REQUIRED');
        console.log('This will process 539 exit links in ~3-4 hours');
        console.log('');
        console.log('Selecting "y" will:');
        console.log('✅ Start batch processing immediately');
        console.log('✅ Process all 539 entries automatically');
        console.log('✅ Apply redundancy (reprocess 2 previous entries for safety)');
        console.log('✅ Save results to combined CSV file');
        console.log('✅ Handle session expiration automatically');
        console.log('');
        console.log('Selecting "n" will:');
        console.log('❌ Cancel batch processing');
        console.log('❌ Exit the program safely');
        console.log('❌ No data will be collected');
        console.log('');

        const answer = await new Promise((resolve) => {
            rl.question('Do you want to start the batch processing? (y/n): ', resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            await processor.runBatchProcessing();
        } else {
            console.log('🛑 Batch processing cancelled');
        }
        
    } catch (error) {
        console.error('❌ Fatal error in batch processing:', error.message);
        process.exit(1);
    }
}

main();
