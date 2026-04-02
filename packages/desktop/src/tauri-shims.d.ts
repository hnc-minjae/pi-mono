/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * Tauri API type shims — replaced by real types after `npm install`.
 */

declare module "@tauri-apps/api/core" {
	export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare module "@tauri-apps/plugin-dialog" {
	export interface OpenDialogOptions {
		multiple?: boolean;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
	export interface SaveDialogOptions {
		defaultPath?: string;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
	export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;
	export function save(options?: SaveDialogOptions): Promise<string | null>;
}
