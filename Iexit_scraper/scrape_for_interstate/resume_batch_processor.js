const { BatchProcessor } = require('./batch_processor');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔄 iExit Batch Processor Resume');
    console.log('='.repeat(50));
    console.log('⚠️  Note: You may need to provide a fresh curl command');
    console.log('   if the previous session has expired.');
    console.log('');
    
    const processor = new BatchProcessor();
    
    try {
        await processor.initialize();
        
        // Check if there's previous progress
        const progressFile = path.join(processor.progress.outputDir || 'batch_output', 'batch_progress.json');
        
        if (fs.existsSync(progressFile)) {
            console.log('📊 Previous progress found:');
            console.log(`   Processed: ${processor.progress.processedCount}/${processor.progress.totalCount}`);
            console.log(`   Failed: ${processor.progress.failedUrls.length}`);
            console.log('');
            
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise((resolve) => {
                rl.question('Do you want to resume from where you left off? (y/n): ', resolve);
            });
            
            rl.close();
            
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log('🔄 Resuming batch processing...');
                await processor.runBatchProcessing();
            } else {
                console.log('🛑 Resume cancelled');
            }
        } else {
            console.log('⚠️  No previous progress found.');
            console.log('   Use run_batch_processor.js to start fresh');
        }
        
    } catch (error) {
        console.error('❌ Fatal error in batch processing:', error.message);
        process.exit(1);
    }
}

main();
