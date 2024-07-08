import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
});

const banSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
});

const allowedChannelSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
});

export const Admin = mongoose.model('Admin', adminSchema);
export const Ban = mongoose.model('Ban', banSchema);
export const AllowedChannel = mongoose.model('AllowedChannel', allowedChannelSchema);
