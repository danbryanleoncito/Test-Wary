import { NextRequest } from 'next/server';

// In-memory event emitter for real-time updates
class EventEmitter {
  private listeners: Set<(data: any) => void> = new Set();

  subscribe(listener: (data: any) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, data: any) {
    const message = {
      type: event,
      data,
      timestamp: new Date().toISOString()
    };

    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error emitting event:', error);
      }
    });
  }
}

export const eventEmitter = new EventEmitter();

// GET /api/realtime - Server-Sent Events endpoint for real-time updates
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Real-time connection established',
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Subscribe to events
      const unsubscribe = eventEmitter.subscribe((message) => {
        const data = `data: ${JSON.stringify(message)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const data = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      });
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Helper function to broadcast events to all connected clients
 * Import and use this from other API routes to send real-time updates
 */
export function broadcastEvent(type: string, data: any) {
  eventEmitter.emit(type, data);
}
