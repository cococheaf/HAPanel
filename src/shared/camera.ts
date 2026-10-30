import { z } from 'zod';
export const rtcCandidateSchema = z
  .object({
    candidate: z.string().max(8192),
    sdpMid: z.string().max(64).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(16).nullable().optional(),
    usernameFragment: z.string().max(256).nullable().optional(),
  })
  .strict();
export const cameraSignalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('offer'), sdp: z.string().min(20).max(65536) }).strict(),
  z.object({ type: z.literal('candidate'), candidate: rtcCandidateSchema }).strict(),
]);
export type CameraCandidate = z.infer<typeof rtcCandidateSchema>;
export type CameraSignalEvent =
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: CameraCandidate }
  | { type: 'error' };
export type CameraCapabilities = { webrtc: boolean; hls: boolean; dataChannel?: string };
