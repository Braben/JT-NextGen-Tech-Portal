/**
 * Chatbot - AI-powered Q&A assistant
 */


const express = require('express');
const OpenAI = require('openai');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { trimString } = require('../lib/validators');
const {
  fallbackPublicAnswer,
  formatRagContext,
  retrievePublicKnowledge,
} = require('../lib/publicKnowledge');

const router = express.Router();

const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:5000',
    'X-Title': 'JT NextGen Tech Hub Portal',
  },
}) : null;

router.post('/ask-public', async (req, res, next) => {
  const question = trimString(req.body.question, 500);
  if (!question) return res.status(400).json({ error: 'Question is required' });

  try {
    const docs = await retrievePublicKnowledge(db, question);
    const sources = docs.map(({ title, source, url }) => ({ title, source, url }));

    if (!openai) {
      return res.json({
        answer: fallbackPublicAnswer(question, docs),
        model: 'local-retrieval',
        sources,
      });
    }

    const messages = [
      {
        role: 'system',
        content: `You are JTutor, the public admissions assistant for JT NextGen Tech Hub.
Answer only from the retrieved knowledge below. If the answer is not present, say you are not sure and suggest contacting admissions.
Be concise, friendly, and practical. Do not invent fees, dates, discounts, policies, or guarantees.

Retrieved knowledge:
${formatRagContext(docs)}`,
      },
    ];

    // Keep only recent visitor context and never trust client-supplied roles beyond chat continuity.
    if (Array.isArray(req.body.conversation)) {
      req.body.conversation.slice(-8).forEach((msg) => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: trimString(msg.content, 1000),
        });
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== question) {
      messages.push({ role: 'user', content: question });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 700,
    });

    res.json({
      answer: completion.choices[0]?.message?.content || fallbackPublicAnswer(question, docs),
      model: completion.model,
      sources,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/ask', authenticate, async (req, res, next) => {
  if (!openai) return res.status(503).json({ error: 'AI service not configured (missing API key).' });
  const { assignmentId, conversation } = req.body;
  const question = trimString(req.body.question, 500);
  if (!question) return res.status(400).json({ error: 'Question is required' });

  try {
    let context = '';
    if (assignmentId) {
      const assignment = await db.prepare(`
        SELECT title, description, instructions FROM assignments WHERE id = ?
      `).get(assignmentId);
      if (assignment) {
        context = `The student is working on the assignment: "${assignment.title}".
Description: ${assignment.description}
Instructions: ${assignment.instructions}`;
      }
    }

    const messages = [
      {
        role: 'system',
        content: `You are JTutor, an AI study assistant for JT NextGen Tech Hub. Your role is to help students understand topics related to their assignments. Follow these guidelines:
- Explain concepts clearly and simply, suitable for beginners
- Use examples to illustrate ideas
- If asked about code, show working examples
- Never do the student's assignment for them, but DO help them understand the concepts needed
- Ask guiding questions to help students think critically
- Be encouraging and supportive
- Keep responses concise but thorough

${context ? `\nCurrent assignment context:\n${context}` : ''}`
      },
    ];

    if (conversation && Array.isArray(conversation)) {
      const recent = conversation.slice(-10);
      recent.forEach((msg) => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      });
    } else {
      messages.push({ role: 'user', content: question });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const answer = completion.choices[0]?.message?.content || 'Sorry, I could not generate an answer.';

    res.json({ answer, model: completion.model });
  } catch (err) {
    console.error('Chatbot error:', err.message);
    res.status(500).json({ error: 'AI service unavailable. Please try again later.' });
  }
});

module.exports = router;
