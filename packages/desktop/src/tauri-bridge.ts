/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface FileFilter {
	name: string;
	extensions: string[];
}

/**
 * 파일 열기 다이얼로그를 표시하고 선택된 파일 경로를 반환한다.
 * 사용자가 취소하면 null을 반환한다.
 */
export async function openFileDialog(options?: {
	filters?: FileFilter[];
	multiple?: boolean;
	title?: string;
}): Promise<string | string[] | null> {
	const result = await open({
		multiple: options?.multiple ?? false,
		title: options?.title ?? "파일 열기",
		filters: options?.filters,
	});
	return result;
}

/**
 * 파일 저장 다이얼로그를 표시하고 선택된 경로를 반환한다.
 */
export async function saveFileDialog(options?: {
	defaultPath?: string;
	filters?: FileFilter[];
	title?: string;
}): Promise<string | null> {
	const result = await save({
		defaultPath: options?.defaultPath,
		title: options?.title ?? "파일 저장",
		filters: options?.filters,
	});
	return result;
}

/**
 * 파일을 텍스트로 읽는다.
 */
export async function readFileText(path: string): Promise<string> {
	return invoke<string>("read_file_text", { path });
}

/**
 * 파일을 바이너리로 읽는다.
 */
export async function readFileBinary(path: string): Promise<Uint8Array> {
	const data = await invoke<number[]>("read_file_binary", { path });
	return new Uint8Array(data);
}

/**
 * 파일에 바이너리 데이터를 쓴다.
 */
export async function writeFile(path: string, contents: Uint8Array): Promise<void> {
	await invoke("write_file", { path, contents: Array.from(contents) });
}

/**
 * 텍스트 파일을 저장한다 (다이얼로그 + 쓰기 결합).
 */
export async function saveTextFile(
	text: string,
	options?: {
		defaultPath?: string;
		filters?: FileFilter[];
	},
): Promise<string | null> {
	const path = await saveFileDialog(options);
	if (!path) return null;
	await writeFile(path, new TextEncoder().encode(text));
	return path;
}

/**
 * Tauri 환경인지 확인한다 (브라우저에서도 동작할 수 있도록).
 */
export function isTauri(): boolean {
	return "__TAURI_INTERNALS__" in window;
}
