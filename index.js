const fs = require('fs');
const WebSocket = require('ws');

// Binance WebSocket API endpoint for Bitcoin price
const binanceWebSocketUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';

// File to store live Bitcoin price data
const outputFile = 'bitcoin_price_data.txt';

// Create a WebSocket connection
const ws = new WebSocket(binanceWebSocketUrl);

// Open connection to Binance WebSocket API
ws.on('open', () => {
  console.log('Connected to Binance WebSocket API');
});

// Handle WebSocket messages
ws.on('message', (data) => {
  const jsonData = JSON.parse(data);

  // Extract the live price from the WebSocket message
  const livePrice = jsonData.p;

  // Log live price to the console
  console.log(`Live Bitcoin Price: $${livePrice}`);

  // Append live price to the file
  fs.appendFileSync(outputFile, `${new Date().toISOString()} - $${livePrice}\n`);
});

// Handle WebSocket errors
ws.on('error', (error) => {
  console.error(`WebSocket error: ${error.message}`);
});

// Handle WebSocket close
ws.on('close', (code, reason) => {
  console.log(`WebSocket closed: ${code} - ${reason}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Closing WebSocket connection...');
  ws.close();
  process.exit();
});
