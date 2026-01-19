import { KEY_BLOB } from "./key_blob.js";

export async function getApiKey() {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const password = "yt-comment-viewer-secret-seed-v1"

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("yt-comment-viewer"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: new Uint8Array(KEY_BLOB.iv)
        },
        key,
        new Uint8Array(KEY_BLOB.data)
    );

    return dec.decode(decrypted);
}
