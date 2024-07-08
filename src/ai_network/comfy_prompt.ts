import { Prompt } from "./comfy";
import {ImageConfig} from "../types";

export const get_comfy_prompt = (
    userPrompt: string,
    config: ImageConfig,
): Prompt => {
    const positivePrompt = config.positivePrompt || "{prompt}";
    const fullPrompt = positivePrompt.replace("{prompt}", userPrompt);

    const res: Prompt = {
        "3": {
            "inputs": {
                "seed": Math.floor(Math.random() * 100000000),
                "steps": config.steps,
                "cfg": config.cfg,
                "sampler_name": "euler_ancestral",
                "scheduler": "karras",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": config.selectedModel
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": fullPrompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": config.negativePrompt || "",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "images": ["8", 0],
                "filename_prefix": "ComfyUI"
            },
            "class_type": "SaveImage"
        }
    };
    return res;
}
