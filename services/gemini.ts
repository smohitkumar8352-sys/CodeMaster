
import { GoogleGenAI, Type } from "@google/genai";
import { Challenge, Difficulty, SupportedLanguage, ChatMode, SubmissionResult } from "../types";

// Safe access to process.env
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.API_KEY || '';
  }
  return '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

// Robust ID generator that doesn't rely on crypto.randomUUID in insecure contexts
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const generateChallenge = async (difficulty: Difficulty, topic: string, language: SupportedLanguage): Promise<Challenge> => {
  const model = "gemini-3-pro-preview";
  
  const isLearning = difficulty === Difficulty.Learning;

  const prompt = `
  Act as a ${isLearning ? "Computer Science Textbook Author" : "rigorous senior developer mentor"}.
  Create a ${isLearning ? "fundamental textbook exercise" : "complex coding *question* or *problem statement*"} for a developer wanting to ${isLearning ? "learn the specific concept of" : "master " + difficulty + " concepts in"} ${language}.
  The specific topic to test is: "${topic}".
  
  Context:
  The goal is to ${isLearning ? "verify understanding of the syntax, basic usage, and theory" : "challenge logical thinking, algorithmic approach, and deep understanding"} of ${language}'s features regarding ${topic}.
  
  Requirements for the response:
  1. Provide a ${isLearning ? "Clear, Educational Problem Statement" : "Challenging Problem Statement"}.
  2. List specific technical constraints or requirements (e.g., ${isLearning ? '"Use a for-loop", "Declare an array of size 10"' : '"Must use O(n) time", "Must use pointers"'}).
  3. **CRITICAL: DO NOT PROVIDE THE SOLUTION CODE.**
  4. The 'starterCode' field MUST contain ONLY empty boilerplate (imports, empty class/struct, main function). It must NOT contain any logic or implementation of the solution.
  5. The user must read the problem and solve it themselves.
  
  Return the response as a JSON object with the specified schema.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            category: { type: Type.STRING },
            starterCode: { type: Type.STRING },
            requirements: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "description", "difficulty", "starterCode", "requirements"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: generateId(),
        language,
        ...data
      };
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Error generating challenge:", error);
    throw error;
  }
};

export const submitSolution = async (code: string, challenge: Challenge): Promise<SubmissionResult> => {
  const model = "gemini-3-pro-preview";
  const prompt = `
    Act as a Strict Unit Test Runner and Code Grader.
    
    Your Task: Evaluate the user's submission for the following challenge.
    
    Challenge Requirements:
    Title: ${challenge.title}
    Description: ${challenge.description}
    Constraints: ${challenge.requirements.join(', ')}
    Language: ${challenge.language}

    User Submission:
    \`\`\`${challenge.language}
    ${code}
    \`\`\`

    Evaluation Criteria:
    1. Does the code compile/run without syntax errors?
    2. Does it strictly solve the problem described?
    3. Does it meet ALL specific constraints (e.g., specific time complexity, specific keywords used)?

    Return JSON format only:
    - success: boolean (true only if PERFECTLY correct)
    - status: "Correct" | "Incorrect" | "Syntax Error"
    - mistakes: array of strings (list every specific failure or error)
    - feedback: string (brief encouraging summary)
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            status: { type: Type.STRING, enum: ["Correct", "Incorrect", "Syntax Error"] },
            mistakes: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            feedback: { type: Type.STRING }
          },
          required: ["success", "status", "mistakes", "feedback"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SubmissionResult;
    }
    throw new Error("No data returned from grading");
  } catch (error) {
    console.error("Grading error:", error);
    return {
      success: false,
      status: 'Incorrect',
      mistakes: ["System error during grading. Please try again."],
      feedback: "Could not grade submission."
    };
  }
};

export const reviewCode = async (code: string, challenge: Challenge): Promise<string> => {
  const model = "gemini-3-pro-preview";
  const prompt = `
    Act as an expert code reviewer. Review the following ${challenge.language} code solution for the task "${challenge.title}".
    
    Challenge Description:
    ${challenge.description}

    Requirements:
    ${challenge.requirements.join('\n')}

    User Code:
    \`\`\`${challenge.language}
    ${code}
    \`\`\`

    Provide a comprehensive review following this iterative practice structure:
    1. **Analysis & Logic**: Did the user appear to plan their solution? Is the logic sound?
    2. **Time and Space Complexity**: Analyze the Big O complexity. Explain why it is efficient or inefficient.
    3. **Language Mastery**: Evaluate usage of ${challenge.language}-specific concepts.
    4. **Optimization & Refactoring**: Identify inefficient parts and suggest improvements, but DO NOT write the full optimized solution. Guide the user on how to improve it.
    5. **Cleanliness**: Check for modularity, variable naming, and readability.

    Be constructive, rigorous, and help the user master the language.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text || "Could not generate review.";
  } catch (error) {
    console.error("Error reviewing code:", error);
    return "Error generating review. Please try again.";
  }
};

export const chatWithBot = async (
  message: string, 
  history: {role: string, parts: {text: string}[]}[],
  mode: ChatMode = 'default'
): Promise<{ text: string; groundingMetadata?: any }> => {
  
  let model = 'gemini-3-pro-preview';
  let config: any = {
    systemInstruction: "You are a senior software engineer mentor skilled in multiple languages. Help the user solve coding problems, explain concepts, and debug code."
  };

  // Mode specific configurations
  switch (mode) {
    case 'fast':
      model = 'gemini-2.5-flash-lite'; // Low latency model
      config.systemInstruction = "You are a helpful coding assistant. Provide brief, concise, and fast answers.";
      break;
    case 'thinking':
      model = 'gemini-3-pro-preview';
      // Set thinking budget for complex queries, do not set maxOutputTokens
      config.thinkingConfig = { thinkingBudget: 32768 };
      config.systemInstruction = "You are a deep reasoning AI. Think carefully about the user's complex query before answering.";
      break;
    case 'search':
      model = 'gemini-2.5-flash'; // Best for general search tasks
      config.tools = [{ googleSearch: {} }];
      config.systemInstruction = "You are a helpful assistant with access to Google Search. Use it to provide up-to-date information.";
      break;
    default:
      // Default is still Gemini 3 Pro for high quality code advice
      model = 'gemini-3-pro-preview';
      break;
  }

  try {
    const chat = ai.chats.create({
      model: model,
      history: history,
      config: config
    });

    const response = await chat.sendMessage({ message });
    
    return {
      text: response.text || "",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("Error in chat:", error);
    return { text: "I'm having trouble connecting right now. Please try again." };
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          { text: "Transcribe the spoken language in this audio into text. Return only the transcription." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "";
  }
};

export const editImage = async (imageBase64: string, prompt: string, mimeType: string = 'image/png'): Promise<string | null> => {
  const model = "gemini-2.5-flash-image";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return part.inlineData.data;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    return null;
  }
};
