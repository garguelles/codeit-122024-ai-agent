'use client';

import { useState, useEffect, useRef } from 'react';

const API_URL = 'localhost:8000';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    wsRef.current = new WebSocket(`ws://${API_URL}/ws`);

    wsRef.current.onopen = () => {
      setConnected(true);
      console.log('Connected to WebSocket');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [
        ...prev,
        {
          type: data.type,
          content: data.content,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    wsRef.current.onclose = () => {
      setConnected(false);
      console.log('Disconnected from WebSocket');
    };

    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !connected) return;

    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: input,
        timestamp: new Date().toISOString(),
      },
    ]);

    wsRef.current.send(input);
    setInput('');
  };

  const renderContent = (content) => {
    if (!content) return '';

    if (Array.isArray(content)) {
      const textContent = content.find((c) => c.type === 'text')?.text;
      return textContent || 'No readable content found';
    }

    return content;
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.type === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="text-sm text-gray-600 mb-1">
              {message.type === 'user' ? 'You' : 'Agent'}
            </div>
            <div className="whitespace-pre-wrap">
              {renderContent(message.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!connected}
        />
        <button
          type="submit"
          disabled={!connected}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300"
        >
          Send
        </button>
      </form>

      {!connected && (
        <div className="text-red-500 text-center mt-2">
          Disconnected from server. Please refresh the page.
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
