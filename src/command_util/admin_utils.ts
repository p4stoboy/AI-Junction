import { Admin, Ban, AllowedChannel } from '../mongo_models/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const GLOBAL_ADMIN_ID = process.env.GLOBAL_ADMIN_ID;

export async function isAdmin(userId: string): Promise<boolean> {
    if (userId === GLOBAL_ADMIN_ID) {
        return true;
    }
    const admin = await Admin.findOne({ userId });
    return !!admin;
}

export async function isBanned(userId: string): Promise<boolean> {
    const ban = await Ban.findOne({ userId });
    return !!ban;
}

export async function isAllowedChannel(channelId: string): Promise<boolean> {
    const allowedChannels = await AllowedChannel.find();
    return allowedChannels.length === 0 || !!await AllowedChannel.findOne({ channelId });
}
