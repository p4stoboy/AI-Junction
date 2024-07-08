import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';

config();

const SERVER_ADDRESS = process.env.COMFY_URL || "http://127.0.0.1:8188";
const WS_ADDRESS = process.env.COMFY_WS || "ws://127.0.0.1:8188";

export interface Prompt {
    [key: string]: any;
}

async function queuePrompt(prompt: Prompt, id: string): Promise<{ prompt_id: string }> {
    const response = await fetch(`${SERVER_ADDRESS}/prompt`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, client_id: id }),
    });
    return response.json();
}

async function getImage(filename: string, subfolder: string, folder_type: string): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type: folder_type });
    const response = await fetch(`${SERVER_ADDRESS}/view?${params}`);
    return Buffer.from(await response.arrayBuffer());
}

async function getHistory(prompt_id: string): Promise<any> {
    const response = await fetch(`${SERVER_ADDRESS}/history/${prompt_id}`);
    return response.json();
}

function getImages(ws: WebSocket, prompt: Prompt, id: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        try {
            const { prompt_id } = await queuePrompt(prompt, id);
            console.log('Prompt queued with ID:', prompt_id);
            let executionCompleted = false;

            ws.on('message', async (data: Buffer) => {
                // console.log('Received binary data of length:', data.length);

                if (data.length < 200000) {  // Assuming this is a text message
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.type === 'executing' && message.data.prompt_id === prompt_id && !message.data?.node) {
                            // console.log('Execution completed for prompt:', prompt_id);
                            executionCompleted = true;

                            // console.log('Fetching history for prompt:', prompt_id);
                            const history = await getHistory(prompt_id);
                            const outputs = history[prompt_id].outputs;
                            const lastNodeId = Object.keys(outputs).pop();

                            if (lastNodeId && outputs[lastNodeId].images) {
                                const lastImage = outputs[lastNodeId].images[0];
                                console.log(`Fetching final image: ${lastImage.filename}`);
                                const imageData = await getImage(lastImage.filename, lastImage.subfolder, lastImage.type);

                                ws.close();
                                resolve(imageData);
                            } else {
                                ws.close();
                                reject(new Error('No image found in the output'));
                            }
                        }
                    } catch (error) {
                        // console.error('Error parsing message:', error);
                    }
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                ws.close();
                reject(error);
            });

        } catch (error) {
            console.error('Error in getImages:', error);
            ws.close();
            reject(error);
        }
    });
}

export function fetchImage(prompt: Prompt): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const CLIENT_ID = uuidv4();
        const ws = new WebSocket(`${WS_ADDRESS}/ws?clientId=${CLIENT_ID}`);

        ws.on('open', async () => {
            console.log('WebSocket connection opened');
            try {
                const imageBuffer = await getImages(ws, prompt, CLIENT_ID);
                // console.log(`Received final image buffer of length: ${imageBuffer.length}`);
                resolve(imageBuffer);
            } catch (error) {
                console.error('Error:', error);
                reject(error);
            } finally {
                ws.close();
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            reject(error);
        });

        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });
}
