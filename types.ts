import React from 'react';

// Native File System Access API Types (partial)
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  // Made optional for easier mocking in fallback mode, or impl needs to stub them
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  resolve?(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

// Global declaration for window.showDirectoryPicker
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }
}

export interface FileEntry {
  id: string;
  handle: FileSystemFileHandle;
  file?: File; // Loaded lazily or on demand
  name: string;
  relativePath?: string; // Path relative to the current view root
  extension: string;
  type: 'image' | 'pdf' | 'video' | 'unsupported';
}

export interface DirectoryEntry {
  id: string;
  handle: FileSystemDirectoryHandle;
  name: string;
}

export type SupportedExtension = 
  | 'psd' | 'ai' | 'pdf' | 'fits' | 'fit' | 'png' | 'jpg' | 'jpeg' | 'tiff' | 'tif' | 'bmp' | 'gif' | 'webp' | 'svg'
  | 'mp4' | 'avi' | 'wmv' | 'mov' | 'qt' | 'flv' | 'mpg' | 'mpeg' | 'vob' | 'asf' | 'mkv' | 'm2ts' | 'mts' | 'webm' | 'heic' | 'm4v' | '3gp';

export const SUPPORTED_EXTENSIONS: SupportedExtension[] = [
  'psd', 'ai', 'pdf', 'fits', 'fit', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'gif', 'webp', 'svg',
  'mp4', 'avi', 'wmv', 'mov', 'qt', 'flv', 'mpg', 'mpeg', 'vob', 'asf', 'mkv', 'm2ts', 'mts', 'webm', 'heic', 'm4v', '3gp'
];

export const MIME_TYPES: Record<string, string> = {
  // Video
  'mp4': 'video/mp4',
  'm4v': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime', // Safari handles this native, Chrome prefers mp4
  'qt': 'video/quicktime',
  'mkv': 'video/webm',      // Chrome can sometimes play MKV if container matches webm/matroska
  'avi': 'video/x-msvideo',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'mpg': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'm2ts': 'video/mp2t',
  'mts': 'video/mp2t',
  'vob': 'video/dvd', // Rare support
  'asf': 'video/x-ms-asf',
  '3gp': 'video/3gpp',
  
  // Image / Doc
  'pdf': 'application/pdf',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  'heic': 'image/heic',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'fits': 'application/fits',
  'fit': 'application/fits',
  'psd': 'image/vnd.adobe.photoshop',
  'ai': 'application/postscript'
};