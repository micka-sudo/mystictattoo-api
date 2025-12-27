import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// Types pour les médias
export type MediaType = 'image' | 'video';

export interface IMedia {
    filename: string;
    path: string;
    category: string;
    type: MediaType;
    tags: string[];
    cloudUrl: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

// Types pour les news
export interface INews {
    title: string;
    content: string;
    image: string;
    isVisible: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

// Types pour l'authentification
export interface AuthPayload extends JwtPayload {
    admin: boolean;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthPayload;
}

// FileRequest utilise directement le type de Multer
export interface FileRequest extends Request {
    file?: Express.Multer.File;
}

// Configuration admin
export interface AdminConfig {
    showNewsOnHome: boolean;
    passwordHash?: string;
}

// Réponses API standard
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Types pour le logger
export interface LogMeta {
    [key: string]: unknown;
}

export interface RequestLogMeta extends LogMeta {
    method: string;
    path: string;
    ip: string | undefined;
    userAgent?: string;
}
