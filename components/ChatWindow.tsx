import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AllHostFacts } from '../types';
import { SendIcon, XSmallIcon, DocumentTextIcon } from './icons/Icons';
import Spinner from './Spinner';

interface ChatWindowProps {
  isVisible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isSending: boolean;
}

// A simple component to render text with basic Markdown (bold and lists).
// This avoids adding a full Markdown library dependency.
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(\*\*.*?\*\*|\* .*)/g).filter(Boolean);
    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('* ')) {
                     return <li key={index} className="ml-4 list-disc">{part.slice(2)}</li>;
                }
                // Handle newlines correctly
                return part.split('\n').map((line, lineIndex) => (
                    <React.Fragment key={`${index}-${lineIndex}`}>
                        {line}
                        {lineIndex < part.split('\n').length - 1 && <br />}
                    </React.Fragment>
                ));
            })}
        </>
    );
};


const ChatWindow: React.FC<ChatWindowProps> = ({ isVisible, onClose, messages, onSendMessage, isSending }) => {
  const [input, setInput] = useState('');
  const [contextToShow, setContextToShow] = useState<AllHostFacts | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 128)}px`; // Max height of 128px (8rem)
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isSending) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as any);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-md h-[70vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-zinc-700/50 animate-[slide-in-up_0.3s_ease-out]">
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
          <h3 className="font-semibold text-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-500 dark:to-fuchsia-400">
              AI Assistant
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            title="Close chat"
          >
            <XSmallIcon />
          </button>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role !== 'user' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0" />}
              <div
                className={`max-w-[80%] rounded-2xl p-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-violet-600 dark:bg-violet-500 text-white rounded-br-none' :
                  msg.role === 'error' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 rounded-bl-none' :
                  'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-bl-none'
                }`}
              >
                <SimpleMarkdown text={msg.content} />
              </div>
              {msg.role === 'assistant' && msg.context && Object.keys(msg.context).length > 0 && (
                 <button 
                    onClick={() => setContextToShow(msg.context)} 
                    title="View context provided to AI"
                    className="p-1.5 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex-shrink-0 self-center"
                 >
                    <DocumentTextIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {isSending && (
              <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex-shrink-0" />
                  <div className="max-w-[80%] rounded-2xl p-3 bg-slate-100 dark:bg-zinc-800 rounded-bl-none flex items-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite_0.2s] ml-1"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite_0.4s] ml-1"></div>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your hosts..."
              rows={1}
              className="flex-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/70 border border-transparent transition"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="w-10 h-10 flex items-center justify-center bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:bg-violet-500 dark:hover:bg-violet-600 dark:focus:ring-offset-zinc-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isSending ? <Spinner className="w-5 h-5 text-white" /> : <SendIcon />}
            </button>
          </form>
        </div>

        {contextToShow && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 animate-[fade-in_0.2s_ease-out]">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-11/12 max-w-2xl h-3/4 flex flex-col border dark:border-zinc-700">
              <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-zinc-100">Context Provided to AI</h3>
                <button onClick={() => setContextToShow(null)} className="p-1 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                  <XSmallIcon />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <pre className="text-xs bg-slate-100 dark:bg-zinc-900 p-3 rounded-md ring-1 ring-slate-200 dark:ring-zinc-800">
                  <code className="text-slate-700 dark:text-zinc-300">{JSON.stringify(contextToShow, null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default ChatWindow;