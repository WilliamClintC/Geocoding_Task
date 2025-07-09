const fs = require('fs');
const path = require('path');

class BatchDataAnalyzer {
    constructor(outputDir = 'batch_output') {
        this.outputDir = outputDir;
        this.combinedCsvPath = path.join(outputDir, 'combined_exit_data.csv');
        this.progressPath = path.join(outputDir, 'batch_progress.json');
        this.summaryPath = path.join(outputDir, 'batch_summary.json');
    }

    // Read and parse CSV data
    readCombinedData() {
        if (!fs.existsSync(this.combinedCsvPath)) {
            throw new Error(`Combined CSV file not found: ${this.combinedCsvPath}`);
        }

        const csvContent = fs.readFileSync(this.combinedCsvPath, 'utf8');
        const lines = csvContent.split('\n');
        
        if (lines.length < 2) {
            throw new Error('CSV file appears to be empty or only contains headers');
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = this.parseCSVLine(line);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                }
            }
        }

        return data;
    }

    // Parse CSV line with proper quote handling
    parseCSVLine(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            
            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    currentValue += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
            i++;
        }
        
        values.push(currentValue.trim());
        return values;
    }

    // Generate comprehensive analysis
    generateAnalysis() {
        console.log('📊 Batch Data Analysis Report');
        console.log('='.repeat(50));

        try {
            const data = this.readCombinedData();
            
            // Basic statistics
            console.log(`\n📈 BASIC STATISTICS`);
            console.log(`Total records: ${data.length}`);
            
            // Group by processing status
            const statusGroups = {};
            data.forEach(row => {
                const status = row.processing_status || 'UNKNOWN';
                if (!statusGroups[status]) {
                    statusGroups[status] = [];
                }
                statusGroups[status].push(row);
            });

            console.log(`\n📊 PROCESSING STATUS BREAKDOWN`);
            Object.keys(statusGroups).forEach(status => {
                console.log(`${status}: ${statusGroups[status].length} records`);
            });

            // Success rate
            const successCount = (statusGroups['SUCCESS'] || []).length;
            const successRate = ((successCount / data.length) * 100).toFixed(1);
            console.log(`\n✅ Success Rate: ${successRate}% (${successCount}/${data.length})`);

            // State and highway breakdown
            const stateGroups = {};
            data.forEach(row => {
                const state = row.state || 'UNKNOWN';
                if (!stateGroups[state]) {
                    stateGroups[state] = [];
                }
                stateGroups[state].push(row);
            });

            console.log(`\n🗺️  STATE BREAKDOWN`);
            Object.keys(stateGroups).sort().forEach(state => {
                const stateData = stateGroups[state];
                const stateSuccess = stateData.filter(row => row.processing_status === 'SUCCESS').length;
                const stateRate = ((stateSuccess / stateData.length) * 100).toFixed(1);
                console.log(`${state}: ${stateSuccess}/${stateData.length} (${stateRate}%)`);
            });

            // Coordinate availability
            const withCoordinates = data.filter(row => 
                row.latitude && row.longitude && 
                row.latitude !== 'N/A' && row.longitude !== 'N/A'
            );
            const coordRate = ((withCoordinates.length / data.length) * 100).toFixed(1);
            console.log(`\n📍 COORDINATE AVAILABILITY`);
            console.log(`Records with coordinates: ${withCoordinates.length}/${data.length} (${coordRate}%)`);

            // Direction analysis
            const directionGroups = {};
            data.forEach(row => {
                const direction = row.direction || 'UNKNOWN';
                if (!directionGroups[direction]) {
                    directionGroups[direction] = [];
                }
                directionGroups[direction].push(row);
            });

            console.log(`\n🧭 DIRECTION BREAKDOWN`);
            Object.keys(directionGroups).sort().forEach(direction => {
                console.log(`${direction}: ${directionGroups[direction].length} records`);
            });

            // Batch analysis
            const batchGroups = {};
            data.forEach(row => {
                const batchId = row.batch_id || 'UNKNOWN';
                if (!batchGroups[batchId]) {
                    batchGroups[batchId] = [];
                }
                batchGroups[batchId].push(row);
            });

            console.log(`\n📦 BATCH ANALYSIS`);
            console.log(`Total batches processed: ${Object.keys(batchGroups).length}`);
            
            // Show batch performance
            Object.keys(batchGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(batchId => {
                const batchData = batchGroups[batchId];
                const batchSuccess = batchData.filter(row => row.processing_status === 'SUCCESS').length;
                const batchRate = ((batchSuccess / batchData.length) * 100).toFixed(1);
                console.log(`Batch ${batchId}: ${batchSuccess}/${batchData.length} (${batchRate}%)`);
            });

            // Error analysis
            const errorRecords = data.filter(row => 
                row.processing_status === 'ERROR' || 
                row.processing_status === 'NO_DATA'
            );
            
            if (errorRecords.length > 0) {
                console.log(`\n❌ ERROR ANALYSIS`);
                const errorGroups = {};
                errorRecords.forEach(row => {
                    const error = row.error_message || 'Unknown error';
                    if (!errorGroups[error]) {
                        errorGroups[error] = [];
                    }
                    errorGroups[error].push(row);
                });

                Object.keys(errorGroups).forEach(error => {
                    console.log(`"${error}": ${errorGroups[error].length} occurrences`);
                });
            }

            // Save analysis to file
            const analysisData = {
                totalRecords: data.length,
                successRate: successRate,
                statusBreakdown: statusGroups,
                stateBreakdown: stateGroups,
                coordinateRate: coordRate,
                directionBreakdown: directionGroups,
                batchBreakdown: batchGroups,
                generatedAt: new Date().toISOString()
            };

            const analysisPath = path.join(this.outputDir, 'data_analysis.json');
            fs.writeFileSync(analysisPath, JSON.stringify(analysisData, null, 2));
            console.log(`\n📄 Detailed analysis saved to: ${analysisPath}`);

        } catch (error) {
            console.error('❌ Error during analysis:', error.message);
        }
    }

    // Generate CSV for successful records only
    generateCleanedCsv() {
        try {
            const data = this.readCombinedData();
            const successfulRecords = data.filter(row => row.processing_status === 'SUCCESS');
            
            if (successfulRecords.length === 0) {
                console.log('⚠️  No successful records found to export');
                return;
            }

            const headers = Object.keys(successfulRecords[0]);
            let csvContent = headers.join(',') + '\n';

            successfulRecords.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csvContent += values.join(',') + '\n';
            });

            const cleanedPath = path.join(this.outputDir, 'cleaned_exit_data.csv');
            fs.writeFileSync(cleanedPath, csvContent);
            console.log(`✅ Cleaned CSV with ${successfulRecords.length} successful records saved to: ${cleanedPath}`);

        } catch (error) {
            console.error('❌ Error generating cleaned CSV:', error.message);
        }
    }

    // Get summary of current progress
    getProgressSummary() {
        if (fs.existsSync(this.progressPath)) {
            const progress = JSON.parse(fs.readFileSync(this.progressPath, 'utf8'));
            console.log('📊 Current Progress Summary:');
            console.log(`Processed: ${progress.processedCount}/${progress.totalCount}`);
            console.log(`Failed: ${progress.failedUrls ? progress.failedUrls.length : 0}`);
            console.log(`Current Batch: ${progress.currentBatch || 'N/A'}`);
            console.log(`Session started: ${new Date(progress.sessionStartTime).toLocaleString()}`);
            console.log(`Last successful request: ${new Date(progress.lastSuccessfulRequest).toLocaleString()}`);
        } else {
            console.log('⚠️  No progress file found');
        }
    }
}

// Export for use in other modules
module.exports = { BatchDataAnalyzer };

// Main execution if run directly
if (require.main === module) {
    const analyzer = new BatchDataAnalyzer();
    
    console.log('🎯 Batch Data Analyzer');
    console.log('Choose an option:');
    console.log('1. Full analysis report');
    console.log('2. Generate cleaned CSV (successful records only)');
    console.log('3. Progress summary');
    console.log('4. All of the above');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Enter your choice (1-4): ', (choice) => {
        rl.close();
        
        switch (choice) {
            case '1':
                analyzer.generateAnalysis();
                break;
            case '2':
                analyzer.generateCleanedCsv();
                break;
            case '3':
                analyzer.getProgressSummary();
                break;
            case '4':
                analyzer.getProgressSummary();
                analyzer.generateAnalysis();
                analyzer.generateCleanedCsv();
                break;
            default:
                console.log('Invalid choice. Running full analysis...');
                analyzer.generateAnalysis();
        }
    });
}
