import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ExternalLink, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { chatbotAPI } from '../api';

export default function AIChatbot({ assignmentId, assignmentTitle, mode = 'student' }) {
  const isPublic = mode === 'public';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const content = useMemo(() => getChatContent({ isPublic, assignmentTitle }), [isPublic, assignmentTitle]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const askAssistant = async (question, conversation) => {
    const payload = {
      question,
      conversation: conversation.map((message) => ({ role: message.role, content: message.content })),
    };
    if (!isPublic) payload.assignmentId = assignmentId || undefined;
    return isPublic ? chatbotAPI.askPublic(payload) : chatbotAPI.ask(payload);
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: 'user', content: question }];
    setInput('');
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await askAssistant(question, nextMessages);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: res.data.answer, sources: res.data.sources || [] },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: err.response?.data?.error || 'Sorry, I had trouble connecting. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleSend();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const choosePrompt = (question) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            aria-label="Close chatbot overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/20"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="accent-card fixed bottom-20 right-4 z-50 flex h-[620px] max-h-[calc(100vh-7rem)] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="bg-[#07111f] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{content.title}</h2>
                    <p className="mt-0.5 text-xs text-white/65">{content.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close chatbot"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
              {messages.length === 0 && (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{content.introTitle}</h3>
                  <p className="mx-auto mt-2 max-w-[290px] text-sm leading-6 text-slate-500">{content.intro}</p>
                  <div className="mt-5 space-y-2">
                    {content.prompts.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => choosePrompt(question)}
                        className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {messages.map((message, index) => (
                  <ChatBubble key={`${message.role}-${index}`} message={message} />
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="accent-card rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-2" aria-label="JTutor is thinking">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  disabled={messages.length === 0 || loading}
                  className="mb-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={500}
                  placeholder={content.placeholder}
                  disabled={loading}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">{content.disclaimer}</p>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-brand-700"
        aria-label={isOpen ? 'Close JTutor' : 'Open JTutor'}
        title={isOpen ? 'Close JTutor' : 'Open JTutor'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? 'rounded-br-md bg-brand-600 text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'
        }`}
      >
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">JT</span>
            <span className="text-xs font-semibold text-slate-500">JTutor</span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.sources?.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sources</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {message.sources.slice(0, 3).map((source) => (
                <a
                  key={`${source.source}-${source.title}`}
                  href={source.url}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-brand-100 hover:text-brand-700"
                >
                  {source.title}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getChatContent({ isPublic, assignmentTitle }) {
  if (isPublic) {
    return {
      title: 'JTutor Admissions',
      subtitle: 'RAG assistant for programs and enrollment',
      introTitle: 'Ask about JT NextGen',
      intro: 'I can answer from the site knowledge base about programs, sessions, certificates, location, and enrollment.',
      placeholder: 'Ask about programs, sessions, or certificates...',
      disclaimer: 'Grounded in JT NextGen site content. Confirm fees and schedules with admissions.',
      prompts: [
        'Which program is best for a beginner?',
        'Where is JT NextGen located?',
        'Do you offer morning and evening sessions?',
        'How do I register for a program?',
      ],
    };
  }

  return {
    title: 'JTutor AI',
    subtitle: assignmentTitle ? `Helping with: ${assignmentTitle}` : 'Study assistant',
    introTitle: 'Ask JTutor Anything',
    intro: 'I can help you understand assignment concepts, examples, structure, and common mistakes without doing the work for you.',
    placeholder: 'Ask about your assignment...',
    disclaimer: 'Answers are AI-generated. Verify important information.',
    prompts: [
      'Can you explain the key concepts in this assignment?',
      'Give me an example similar to what I need to do',
      'What are common mistakes to avoid?',
      'How should I structure my answer?',
    ],
  };
}
