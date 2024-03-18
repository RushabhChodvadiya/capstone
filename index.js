const WebSocket = require("ws");
const axios = require("axios");
const dayjs = require("dayjs");

const HistoricalDataAPIEndpoint = "http://localhost:3000/data";

// Connect to Binance WebSocket API
const binanceWS = new WebSocket(
  "wss://stream.binance.com:9443/ws/btcusdt@trade/ethusdt@trade"
);

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
const clients = new Map(); // Using a Map to store clients and their desired cryptocurrency

async function fetchAndInsertDataForTimeRange(startTime, endTime) {
  try {

    //https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data
    const BTCresponse = await axios.get("https://api.binance.com/api/v3/klines", {
      params: {
        symbol: "BTCUSDT",
        interval: "1m",
        startTime: startTime.valueOf(), // Convert to Unix timestamp
        endTime: endTime.valueOf(), // Convert to Unix timestamp
        limit: 1000, // Adjust as needed, maximum allowed limit
      },
    });

    const ETHresponse = await axios.get("https://api.binance.com/api/v3/klines", {
      params: {
        symbol: "ETHUSDT",
        interval: "1m",
        startTime: startTime.valueOf(), // Convert to Unix timestamp
        endTime: endTime.valueOf(), // Convert to Unix timestamp
        limit: 1000, // Adjust as needed, maximum allowed limit
      },
    });

    const BTCticks = BTCresponse.data;
    const ETHticks = ETHresponse.data;

    // Extract necessary data from the response
    const dataToInsert = BTCticks.map((tick) => {
      const [timestamp, open, high, low, close, volume] = tick;
      return [
        "BTCUSDT", // Example ticker
        dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"), // Format timestamp using dayjs
        parseFloat(open),
        parseFloat(close),
        parseFloat(high),
        parseFloat(low),
        parseInt(volume),
      ];
    });

    const dataToInsertETH = ETHticks.map((tick) => {
      const [timestamp, open, high, low, close, volume] = tick;
      return [
        "ETHUSDT", // Example ticker
        dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss"), // Format timestamp using dayjs
        parseFloat(open),
        parseFloat(close),
        parseFloat(high),
        parseFloat(low),
        parseInt(volume),
      ];
    });

    // call the API to insert the data
    [
      ...dataToInsert,
      ...dataToInsertETH,
    ].forEach(async (data) => {
      try {
        await axios.post(HistoricalDataAPIEndpoint, {
          ticker: data[0],
          timestamp: data[1],
          open_price: data[2],
          close_price: data[3],
          high_price: data[4],
          low_price: data[5],
          volume: data[6],
        });
      } catch (error) {
        console.error("Error inserting data into database:", error);
      }
    });

    console.log(
      "Data to insert: at " + dayjs().format("YYYY-MM-DD HH:mm:ss"),
      dataToInsert
    );
  } catch (error) {
    console.error("Error fetching data from Binance API:", error);
  }
}

// Calculate start time and end time for the previous minute
let endTime = dayjs().startOf("minute");
let startTime = endTime.subtract(1, "minute");

// Listen for Binance WebSocket messages
binanceWS.on("message", (data) => {
  // This handler will only process incoming messages from Binance
  const message = JSON.parse(data);
  const crypto = message.s.startsWith("BTC") ? "BTC" : "ETH";
  // if currrent time and end time have a diff larger then 1 mint, fetch and insert data for the previous minute
  if (dayjs().diff(endTime, "minute") > 1) {
    fetchAndInsertDataForTimeRange(startTime, endTime);
    // Update start time and end time for the previous minute
    endTime = dayjs().startOf("minute");
    startTime = endTime.subtract(1, "minute");
  }

  if (clients.has(crypto)) {
    clients.get(crypto).forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            price: Number(message.p),
            p: message.p,
            crypto: crypto,
            time: new Date(),
          })
        );
      }
    });
  }
});

// Listen for client connections
wss.on("connection", (ws) => {
  console.log("Connected to us");
  // Listen for messages from clients
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.crypto && (data.crypto === "BTC" || data.crypto === "ETH")) {
        const crypto = data.crypto;
        // Add client to the set corresponding to the desired cryptocurrency
        if (!clients.has(crypto)) {
          clients.set(crypto, new Set());
        }
        clients.get(crypto).add(ws);
        console.log("Client connected for", crypto);
      }
    } catch (error) {
      console.error("Invalid message received from client:", error);
    }
  });

  // Remove client from set when connection closes
  ws.on("close", () => {
    clients.forEach((clientSet, crypto) => {
      if (clientSet.has(ws)) {
        clientSet.delete(ws);
        if (clientSet.size === 0) {
          clients.delete(crypto);
        }
      }
    });
  });
});
