import { config } from 'dotenv';

config();

interface GPTResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Send a request to the GPT model and return the response.
 * @param prompt The user's input prompt
 * @param system The system message to set the context
 * @returns A promise that resolves to the GPT response
 * @throws Error if the request fails or the response is invalid
 */
export const gpreq = async (prompt: string, system: string): Promise<GPTResponse> => {
    const req = {
        messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
        ],
        temperature: 0.975,
        max_tokens: process.env.MAX_GPT_TOKENS,
        stream: false
    };
    console.log('LLM Request executing...');
    try {
        const response = await fetch(`${process.env.LMSTUDIO_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as GPTResponse;

        if (!data.choices || data.choices.length === 0) {
            throw new Error('Invalid response from GPT model');
        }
        console.log('LLM Request completed.');
        return data;
    } catch (error) {
        console.error('Error in gpreq:', error);
        throw error;
    }
};
