package com.satlas.ai;

/** AI 生成結果（使用プロバイダ・モデル名を含む）。 */
public record AiResult(
        String text,
        AiProvider provider,
        String model) {
}
