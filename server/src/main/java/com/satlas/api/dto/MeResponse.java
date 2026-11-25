package com.satlas.api.dto;

/**
 * @param authenticated Discord でログイン済みか
 * @param devFallback   未ログインだが開発用テストユーザーで API を利用している状態か
 * @param user          利用中のユーザー（どちらでもなければ null）
 */
public record MeResponse(boolean authenticated, boolean devFallback, UserResponse user) {
}
