const axios = require('axios');
const fs = require('fs');

/**
 * Simple ALOC V2 Question Scraper Test
 * To run: ensure axios is installed (npm install axios) then: node scrape_test.js
 */

const ENDPOINT = 'https://questions.aloc.com.ng/api/v2/q?subject=physics';
const ACCESS_TOKEN = 'ALOC-71329e098ec1488987b9';

async function fetchOneQuestion() {
  try {
    console.log('--- Initiating Request to ALOC V2 ---');
    
    const response = await axios.get(ENDPOINT, {
      headers: {
        'AccessToken': ACCESS_TOKEN,
        'Accept': 'application/json'
      }
    });

    // Extract the core question object
    const questionData = response.data.data;

    if (!questionData) {
      throw new Error('No question data found in the response.');
    }

    // Save to local file
    fs.writeFileSync('physics_test.json', JSON.stringify(questionData, null, 2));

    console.log('✅ Success: One physics question successfully fetched!');
    console.log('📦 Saved to: physics_test.json');
    console.log('--- Execution Complete ---');

  } catch (error) {
    console.error('❌ Failed to fetch question:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Execute the fetch
fetchOneQuestion();
