const OpenAI = require('openai');

const openai = process.env.OPENROUTER_API_KEY ? new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:5000',
    'X-Title': 'JT NextGen Tech Hub Portal',
  },
}) : null;

async function gradeSubmission(studentResponse, assignmentDetails) {
  if (!openai) throw new Error('AI grading not configured (missing API key).');
  const { title, description, instructions, rubric, maxScore } = assignmentDetails;

  const prompt = `You are an expert instructor grading a student submission.

## Assignment Details
Title: ${title}
Description: ${description}
Instructions: ${instructions}
Marking Rubric: ${rubric}
Maximum Score: ${maxScore}

## Student Submission
${studentResponse}

## Task
Evaluate the student's submission against the assignment instructions and rubric. Provide:

1. **Score**: A numerical score out of ${maxScore}
2. **Strengths**: What the student did well
3. **Weaknesses**: Areas where the student fell short
4. **Suggestions**: Specific, actionable recommendations for improvement
5. **Detailed Feedback**: A comprehensive paragraph explaining the grade

Format your response as JSON:
{
  "score": <number>,
  "strengths": "<comma-separated list>",
  "weaknesses": "<comma-separated list>",
  "suggestions": "<comma-separated list>",
  "feedback": "<detailed paragraph>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful grading assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('OpenRouter grading error:', err.message);
    throw new Error('AI grading failed: ' + err.message);
  }
}

module.exports = { gradeSubmission };
