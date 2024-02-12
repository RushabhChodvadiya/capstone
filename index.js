const WebSocket = require("ws");

// Connect to Binance WebSocket API
const binanceWS = new WebSocket(
  "wss://stream.binance.com:9443/ws/btcusdt@trade/ethusdt@trade"
);

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
const clients = new Map(); // Using a Map to store clients and their desired cryptocurrency

// Listen for Binance WebSocket messages
binanceWS.on("message", (data) => {
  // This handler will only process incoming messages from Binance
  // You may choose to process or ignore these messages
  const message = JSON.parse(data);
  const crypto = message.s.startsWith("BTC") ? "BTC" : "ETH";
  if (clients.has(crypto)) {
    clients.get(crypto).forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({ ...message, crypto: crypto, time: new Date() })
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
