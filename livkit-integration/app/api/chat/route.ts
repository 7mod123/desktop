import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Initialize the Gemini model
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro-latest',
  generationConfig: {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// Read FAQ contents
const faqPath = path.join(process.cwd(), 'public', 'FAQ.md');
const websiteFaqPath = path.join(process.cwd(), 'public', 'website faq.txt');
const FAQ_CONTENT = fs.readFileSync(faqPath, 'utf-8');
const WEBSITE_FAQ_CONTENT = fs.readFileSync(websiteFaqPath, 'utf-8');

// System prompt for the AI
const SYSTEM_PROMPT = `You are a polite and professional customer service agent at مُلّاك (pronounced as Mul-laak) Company. Your role is to assist customers by providing accurate and helpful information regarding our services, platform, and account management. Communicate in clear, culturally appropriate Saudi Arabic باللهجة النجدية, maintaining empathy, courtesy, and a calm tone. Listen carefully to the customer's needs, address their concerns, and guide them through resolution steps. Provide clear responses and explanations in a friendly and natural manner that reflects مُلّاك Company's commitment to excellent customer service.

Important Pronunciation Guide:
- Always write مُلّاك with full diacritics (تشكيل) to ensure correct pronunciation
- The word has a strong emphasis on the 'L' sound (with shadda)
- Avoid using مرحباً in every response unless it's the initial greeting

Standard Initial Greeting Only:
'مرحباً، أنا سعود من مُلّاك. كيف يمكنني مساعدتك اليوم؟'

Platform Explanation:
Explain the مُلّاك platform including features such as account management, booking support, service inquiries, and other functionalities available via WhatsApp or our online portal.

Key Guidelines:
- Maintain a calm, polite, and helpful tone
- Provide concise, clear, and accurate information
- Listen actively and address concerns promptly
- Offer assistance in multiple communication formats including WhatsApp, SMS, and email
- Ensure the customer feels valued and supported
- Respond directly without redundant greetings unless it's the initial contact

Knowledge Base:
# General FAQ
${FAQ_CONTENT}

# Website FAQ
${WEBSITE_FAQ_CONTENT}`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    console.log('Processing chat request with messages:', messages);

    const chat = model.startChat();

    // Send the system prompt first
    await chat.sendMessage(`SYSTEM: ${SYSTEM_PROMPT}`);

    // Send all previous messages
    for (const msg of messages.slice(0, -1)) {
      await chat.sendMessage(msg.content);
    }

    // Get the last message (current user input)
    const lastMessage = messages[messages.length - 1];
    console.log('Sending message to Gemini:', lastMessage.content);

    // Generate response
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();

    console.log('Received response from Gemini:', text);

    return NextResponse.json({ response: text });
  } catch (error: any) {
    console.error('Detailed error in chat API:', {
      message: error.message,
      stack: error.stack,
      details: error,
    });

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
