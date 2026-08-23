/**
 * Yjs WebSocket Server for Real-Time Collaboration
 *
 * This server provides a WebSocket endpoint for Yjs-based CRDT synchronization.
 * It handles multiple concurrent users editing the same document with automatic
 * conflict resolution.
 *
 * Architecture:
 * - WebSocket server for client connections
 * - y-websocket utilities for Yjs protocol handling
 * - In-memory document storage (can be extended to persist to database)
 * - Health check endpoint for monitoring
 *
 * Environment Variables:
 * - PORT: Server port (default: 1234)
 * - NODE_ENV: Environment (development, staging, production)
 */

const http = require("node:http");
const WebSocket = require("ws");
const Y = require("yjs");
const { setupWSConnection } = require("y-websocket/bin/utils");

const PORT = process.env.PORT || 1234;
const ENV = process.env.NODE_ENV || "development";

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        environment: ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: wss.clients.size,
        documents: docs.size,
      }),
    );
  } else if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Yjs WebSocket Server - Real-Time Collaboration");
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store Yjs documents in memory
// In production, you might want to persist these to a database
const docs = new Map();

// Track connection statistics
let connectionCount = 0;
let peakConnections = 0;

wss.on("connection", (ws, req) => {
  connectionCount++;
  peakConnections = Math.max(peakConnections, wss.clients.size);

  // Setup Yjs connection
  // This handles all the Yjs protocol communication
  setupWSConnection(ws, req, {
    // Optional: Add custom logic when documents are created
    docName: req.url?.slice(1), // Use URL path as document name
    gc: true, // Enable garbage collection for unused data
  });

  ws.on("close", () => {
    // Connection closed
  });

  ws.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  for (const client of wss.clients) {
    client.close(1000, "Server shutting down");
  }

  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  process.emit("SIGTERM");
});

// Start server
server.listen(PORT, () => {
  if (ENV === "development") {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   Yjs WebSocket Server - Real-Time Collaboration      ║
║                                                        ║
║   Environment: ${ENV.padEnd(38)}   ║
║   Port:        ${String(PORT).padEnd(38)}   ║
║   Health:      http://localhost:${PORT}/health${" ".repeat(19)}   ║
║   WebSocket:   ws://localhost:${PORT}${" ".repeat(27)}   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
  }
});

// Log statistics periodically (development only)
if (ENV === "development") {
  setInterval(() => {
    console.log(`
📊 Server Statistics:
  - Active Connections: ${wss.clients.size}
  - Peak Connections: ${peakConnections}
  - Total Documents: ${docs.size}
  - Uptime: ${Math.floor(process.uptime())}s
  - Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
    `);
  }, 60000); // Every minute
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

module.exports = { server, wss, docs };
